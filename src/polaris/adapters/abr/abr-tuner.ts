/** src/player/adapters/abr/abr-tuner.ts
 * Advanced ABR tuner: startup profile, smarter downswitch (stalls+drops+low buffer),
 * dynamic caps (viewport + network), manual stickiness + auto-revert, telemetry, EMA smoothing.
 */
import type { EnginePort, AnalyticsPort, Level } from '../../ports';

// Tiny helpers
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const uniqBy = <T, K>(arr: T[], key: (t: T) => K) => {
  const m = new Set<K>();
  const out: T[] = [];
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) {
      m.add(k);
      out.push(x);
    }
  }
  return out;
};

export type AbrTunerOptions = {
  analytics?: AnalyticsPort;

  // Startup
  initialLevel?: 'low' | 'auto' | { height: number };
  minBufferSec?: number; // "safe" buffer to consider ramp/decisions, default 3s

  // Dynamic caps
  capToViewport?: boolean; // default true
  netAwareCap?: boolean; // default true
  // Mapping of effectiveType -> px height ceiling
  netCapMap?: Partial<Record<'slow-2g' | '2g' | '3g' | '4g' | '5g', number>>;

  // Manual stickiness
  autoRevertMs?: number; // revert manual ceiling back to Auto after this (default 10min)

  // Bandwidth smoothing (EMA)
  emaAlpha?: number; // 0..1, default 0.25 (closer to 1 => more weight on recent)
  bwSampleMs?: number; // sample bandwidth every N ms, default 1000
};

export type AbrTunerController = {
  stop(): void;
  manualSelection(sel: 'auto' | number, opts?: { revertMs?: number }): void;
  setViewportCap(enabled: boolean): void;
  setNetworkCap(enabled: boolean): void;
};

export function startAbrTuner(engine: EnginePort, opts: AbrTunerOptions = {}): AbrTunerController {
  // ---- Defaults
  const a = opts.analytics;
  const minBuffer = clamp(opts.minBufferSec ?? 3, 0, 30);
  const emaAlpha = opts.emaAlpha ?? 0.25;
  const bwSampleMs = clamp(opts.bwSampleMs ?? 1000, 250, 5000);
  let viewportCapOn = opts.capToViewport !== false;
  let networkCapOn = opts.netAwareCap !== false;
  const netMap = {
    'slow-2g': 240,
    '2g': 360,
    '3g': 480,
    '4g': 1080,
    '5g': 2160,
    ...(opts.netCapMap || {}),
  };

  // ---- Internal state
  let emaBw: number | undefined; // EMA of bandwidth (bps)
  let bwTimer: any;
  let stallCount = 0;
  let lastDropped = 0;
  let manualCeiling: number | undefined; // px height as ceiling
  let manualRevertTimer: any;

  const recomputeDerivedCap = () => {
    const caps: number[] = [];
    const vcap = viewportCapOn ? calcViewportCap() : undefined;
    if (vcap) {
      caps.push(vcap);
      a?.emit?.({ type: 'abr_cap', reason: 'viewport', cap: vcap });
    }
    const ncap = networkCapOn ? calcNetworkCap() : undefined;
    if (ncap) {
      caps.push(ncap);
      a?.emit?.({ type: 'abr_cap', reason: 'network', cap: ncap });
    }
    if (manualCeiling) {
      caps.push(manualCeiling);
      a?.emit?.({ type: 'abr_cap', reason: 'manual', cap: manualCeiling });
    }
    const ceiling = caps.length ? Math.min(...caps) : undefined;
    engine.setMaxResolution?.(ceiling);
  };

  // ---- Startup profile
  if (opts.initialLevel && opts.initialLevel !== 'auto') {
    const levels = sortedLevels(engine);
    let startH = levels.length ? levels[0].height : undefined;
    if (typeof opts.initialLevel === 'object') startH = opts.initialLevel.height ?? startH;
    if (startH) {
      engine.setLevel?.({ height: startH });
      a?.emit?.({ type: 'abr_startup', mode: 'low', height: startH });
      setTimeout(() => tryRampToAuto(), 4000);
    }
  } else {
    engine.setLevel?.('auto');
    a?.emit?.({ type: 'abr_startup', mode: 'auto' });
  }

  // ---- EMA Bandwidth sampling
  const sampleBw = () => {
    const bw = engine.getBandwidthEstimate?.();
    if (!bw || !Number.isFinite(bw)) return;
    emaBw = emaBw == null ? bw : emaAlpha * bw + (1 - emaAlpha) * emaBw;
  };
  bwTimer = setInterval(sampleBw, bwSampleMs);

  // ---- Dynamic caps
  const onResize = () => {
    if (viewportCapOn) recomputeDerivedCap();
  };
  const onFs = () => {
    if (viewportCapOn) recomputeDerivedCap();
  };
  const onConn = () => {
    if (networkCapOn) recomputeDerivedCap();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFs);
    (navigator as any).connection?.addEventListener?.('change', onConn);
  }
  recomputeDerivedCap();

  // ---- Engine event reactions
  const offBufStart = engine.on('engine_buffering_start', () => {
    stallCount++;
  });
  const offBufEnd = engine.on('engine_buffering_end', () => evaluateDownswitch('buffering_end'));
  const offLevelSw = engine.on('engine_level_switched', () => sampleBw());

  // ---- Decision logic
  function evaluateDownswitch(_trigger: 'buffering_end' | 'explicit') {
    const dropped = engine.getDroppedFrames?.() || 0;
    const diff = Math.max(0, dropped - lastDropped);
    lastDropped = dropped;

    const bufEnd = engine.getBufferedEnd?.() || 0;
    const t = engine.getCurrentTime?.() || 0;
    const bufferLen = Math.max(0, bufEnd - t);

    const needAction = stallCount > 0 || diff > 10 || bufferLen < minBuffer;

    if (!needAction) return;

    const levels = sortedLevels(engine);
    if (!levels.length) return;

    const bw = emaBw ?? engine.getBandwidthEstimate?.();
    let target: Level | undefined;
    if (bw && Number.isFinite(bw)) {
      const idx = levels.findIndex((l) => (l.bandwidth || 0) >= bw * 0.8);
      const pick = idx > 0 ? idx - 1 : 0;
      target = levels[pick];
    } else {
      const mid = Math.max(0, Math.floor(levels.length / 2) - 1);
      target = levels[mid];
    }

    if (target) {
      const reason = diff > 10 ? 'dropped_frames' : bufferLen < minBuffer ? 'low_buffer' : 'stall';
      a?.emit?.({
        type: 'abr_switch',
        reason,
        to: target.height,
        droppedFramesDelta: diff,
        bufferLen,
        estBw: engine.getBandwidthEstimate?.(),
        estBwEma: emaBw,
      });
      engine.setLevel?.({ height: target.height });
    }
    stallCount = 0;
  }

  function tryRampToAuto() {
    const bufEnd = engine.getBufferedEnd?.() || 0;
    const t = engine.getCurrentTime?.() || 0;
    const bufferLen = Math.max(0, bufEnd - t);
    if (bufferLen >= minBuffer) {
      engine.setLevel?.('auto');
    } else {
      setTimeout(tryRampToAuto, 1500);
    }
  }

  function calcViewportCap(): number | undefined {
    try {
      const el = (document.fullscreenElement as HTMLElement | null) || document.documentElement;
      const rect = el.getBoundingClientRect();
      const h0 = Math.ceil(rect.height || window.innerHeight || 0);
      if (!h0) return undefined;
      if (h0 >= 2160) return 2160;
      if (h0 >= 1440) return 1440;
      if (h0 >= 1080) return 1080;
      if (h0 >= 720) return 720;
      if (h0 >= 480) return 480;
      return 360;
    } catch {
      return undefined;
    }
  }

  function calcNetworkCap(): number | undefined {
    const c: any = (navigator as any).connection;
    if (!c || !c.effectiveType) return undefined;
    return (
      {
        'slow-2g': 240,
        '2g': 360,
        '3g': 480,
        '4g': 1080,
        '5g': 2160,
        ...(opts.netCapMap || {}),
      } as any
    )[c.effectiveType];
  }

  function manualSelection(sel: 'auto' | number, p?: { revertMs?: number }) {
    clearTimeout(manualRevertTimer);
    if (sel === 'auto') {
      manualCeiling = undefined;
      engine.setLevel?.('auto');
      a?.emit?.({ type: 'abr_manual_selection', mode: 'auto' });
    } else {
      manualCeiling = sel;
      engine.setLevel?.('auto'); // keep ABR but ceiling to 'sel'
      a?.emit?.({ type: 'abr_manual_selection', mode: 'manual', ceiling: sel });
      const ms = p?.revertMs ?? opts.autoRevertMs ?? 10 * 60 * 1000;
      if (ms > 0) {
        manualRevertTimer = setTimeout(() => {
          manualCeiling = undefined;
          engine.setLevel?.('auto');
          a?.emit?.({ type: 'abr_manual_revert', afterMs: ms });
          recomputeDerivedCap();
        }, ms);
      }
    }
    recomputeDerivedCap();
  }

  function setViewportCap(enabled: boolean) {
    viewportCapOn = !!enabled;
    engine.configureAbr?.({ capToViewport: viewportCapOn });
    recomputeDerivedCap();
  }
  function setNetworkCap(enabled: boolean) {
    networkCapOn = !!enabled;
    recomputeDerivedCap();
  }

  function stop() {
    clearInterval(bwTimer);
    clearTimeout(manualRevertTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
      (navigator as any).connection?.removeEventListener?.('change', onConn);
    }
    offBufStart();
    offBufEnd();
    offLevelSw();
  }

  return { stop, manualSelection, setViewportCap, setNetworkCap };
}

function sortedLevels(engine: EnginePort): Level[] {
  const lvls = uniqBy(engine.getLevels?.() || [], (l) => l.height || l.id);
  return lvls.slice().sort((a, b) => (a.bandwidth || a.height || 0) - (b.bandwidth || b.height || 0));
}
