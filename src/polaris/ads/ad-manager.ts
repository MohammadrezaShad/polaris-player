/** src/player/ads/ad-manager.tsx */
'use client';
import * as React from 'react';

import type { AdSchedule, AdBreak, AdState, VastResponse, AdIcon } from './types';
import { fetchVast, fireUrls, fireError } from './vast';
import { fetchVmapToSchedule } from './vmap';

export type UseAdsOptions = {
  schedule?: AdSchedule;
  vmapUrl?: string;
  durationProvider: () => number; // content duration
  timeProvider: () => number; // content current time
  onPauseMain: () => void;
  onResumeMain: () => void;
  analyticsEmit?: (e: any) => void;
};

export function useAdManager(adVideoRef: React.RefObject<HTMLVideoElement>, opts: UseAdsOptions) {
  const [state, setState] = React.useState<AdState>({ phase: 'idle' });

  // --- internal refs/state
  const scheduleRef = React.useRef<AdSchedule | null>(opts.schedule ?? null);
  const activeBreakRef = React.useRef<AdBreak | null>(null);
  const vastRef = React.useRef<VastResponse | null>(null);

  const quartilesRef = React.useRef<{ q1: boolean; q2: boolean; q3: boolean }>({ q1: false, q2: false, q3: false });
  const percResolvedRef = React.useRef<boolean>(false);

  // one-time beacons & helpers
  const startedRef = React.useRef(false);
  const creativeViewRef = React.useRef(false);
  const pausedRef = React.useRef(false);
  const lastMutedRef = React.useRef<boolean | null>(null);
  const progressFiredRef = React.useRef<Set<string>>(new Set());
  const cleanupRef = React.useRef<() => void>(() => {});
  const iconViewedRef = React.useRef<Set<number>>(new Set());
  const endingRef = React.useRef(false);

  // Persistent served/in-progress sets (survive prop identity changes)
  const servedSetRef = React.useRef<Set<string>>(new Set());
  const inProgressRef = React.useRef<Set<string>>(new Set());

  // --- helpers

  function pickMediaFile(vast: VastResponse): string | null {
    const files = vast.linear?.mediaFiles ?? [];
    if (!files.length) return null;
    const mp4s = files.filter((f) => (f.type || '').includes('mp4'));
    const pick = (arr: typeof files) => arr.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.url ?? null;
    return pick(mp4s.length ? mp4s : files);
  }

  function visibleIconsAt(vast: VastResponse, cur: number) {
    const all = vast.linear?.icons ?? [];
    const list = [] as (AdIcon & { _idx: number })[];
    all.forEach((icon, idx) => {
      const start = icon.offsetSec ?? 0;
      const end = icon.durationSec != null ? start + icon.durationSec : Infinity;
      if (cur >= start && cur <= end) {
        list.push({ ...icon, _idx: idx });
      }
    });
    return list;
  }

  // ----------------- schedule wiring -----------------

  // Keep schedule in ref and merge "served" flags from persistent set
  React.useEffect(() => {
    if (!opts.schedule) return;
    const next: AdSchedule = { breaks: opts.schedule.breaks.map((b) => ({ ...b })) };
    for (const b of next.breaks) {
      if (servedSetRef.current.has(b.id)) (b as any).served = true;
    }
    scheduleRef.current = next;
    // allow percentage midrolls to resolve again for this schedule
    percResolvedRef.current = false;
  }, [opts.schedule]);

  // Build schedule from VMAP (once, or when URL changes)
  React.useEffect(() => {
    (async () => {
      if (scheduleRef.current || !opts.vmapUrl) return;
      try {
        const sched = await fetchVmapToSchedule(opts.vmapUrl);
        const next: AdSchedule = { breaks: sched.breaks.map((b) => ({ ...b })) };
        for (const b of next.breaks) {
          if (servedSetRef.current.has(b.id)) (b as any).served = true;
        }
        scheduleRef.current = next;
        percResolvedRef.current = false;
      } catch {
        /* swallow VMAP fetch errors; just don't schedule ads */
      }
    })();
  }, [opts.vmapUrl]);

  // Resolve percentage-based midrolls after we know duration
  const ensureResolvedMidrolls = React.useCallback(() => {
    const sched = scheduleRef.current;
    if (!sched || percResolvedRef.current) return;
    const dur = opts.durationProvider();
    if (!Number.isFinite(dur) || dur <= 0) return;

    for (const b of sched.breaks) {
      if (b.kind === 'midroll' && (b.timeOffsetSec ?? 0) < 0) {
        // Example policy: negative offset -> 50% point
        b.timeOffsetSec = Math.floor(dur * 0.5);
      }
    }
    percResolvedRef.current = true;
  }, [opts]);

  // --------------- preroll trigger (hardened) ---------------
  React.useEffect(() => {
    const sched = scheduleRef.current;
    if (!sched) return;

    // only consider a preroll that has not been served (persistently)
    const pre = sched.breaks.find((b) => b.kind === 'preroll' && !servedSetRef.current.has(b.id));
    if (!pre) return;

    // only start preroll when idle and no other break is active/in progress
    if (state.phase !== 'idle' || activeBreakRef.current) return;
    if (inProgressRef.current.has(pre.id)) return;

    const id = requestAnimationFrame(() => playBreak(pre));
    return () => cancelAnimationFrame(id);
    // react when schedule identity wiggles or phase changes
  }, [opts.schedule, state.phase]); // playBreak is stable from useCallback deps

  // --------------- player state updates (ad video) ---------------

  const updatePlayingState = React.useCallback(() => {
    const v = adVideoRef.current;
    const brk = activeBreakRef.current;
    const vast = vastRef.current;
    if (!v || !brk || !vast?.linear) return;

    const knownDur =
      Number.isFinite(vast.linear.durationSec) && vast.linear.durationSec! > 0
        ? vast.linear.durationSec!
        : Number.isFinite(v.duration)
          ? v.duration
          : 0;

    const cur = Number.isFinite(v.currentTime) ? v.currentTime : 0;
    const remaining = Math.max(0, Math.ceil(knownDur - cur));

    let skipCountdown: number | undefined;
    let canSkip = false;
    const off = vast.linear.skipOffsetSec;
    if (typeof off === 'number') {
      const left = Math.max(0, Math.ceil(off - cur));
      skipCountdown = left;
      canSkip = left <= 0;
    }

    // fire START / CREATIVEVIEW once when playback really advancing
    if (!startedRef.current && v.currentTime > 0) {
      startedRef.current = true;
      fireUrls((vast.linear.tracking as any).start ?? []);
      opts.analyticsEmit?.({ type: 'ad_start', break: brk });
    }
    if (!creativeViewRef.current && v.currentTime > 0) {
      creativeViewRef.current = true;
      fireUrls((vast.linear.tracking as any).creativeView ?? []);
    }

    // progress beacons
    const progressList = ((vast.linear as any).progress as { url: string; offsetSec: number }[]) ?? [];
    for (const p of progressList) {
      const key = p.url;
      if (!progressFiredRef.current.has(key) && cur >= (p.offsetSec ?? Infinity)) {
        progressFiredRef.current.add(key);
        fireUrls([p.url]);
        opts.analyticsEmit?.({ type: 'ad_progress', break: brk, at: p.offsetSec });
      }
    }

    // quartiles
    const q = quartilesRef.current;
    const d = Math.max(0.1, knownDur);
    const pct = cur / d;
    if (!q.q1 && pct >= 0.25) {
      q.q1 = true;
      fireUrls(vast.linear.tracking.firstQuartile);
      opts.analyticsEmit?.({ type: 'ad_quartile', break: brk, quartile: 1 });
    }
    if (!q.q2 && pct >= 0.5) {
      q.q2 = true;
      fireUrls(vast.linear.tracking.midpoint);
      opts.analyticsEmit?.({ type: 'ad_quartile', break: brk, quartile: 2 });
    }
    if (!q.q3 && pct >= 0.75) {
      q.q3 = true;
      fireUrls(vast.linear.tracking.thirdQuartile);
      opts.analyticsEmit?.({ type: 'ad_quartile', break: brk, quartile: 3 });
    }

    const vis = visibleIconsAt(vast, cur);
    for (const it of vis) {
      if (!iconViewedRef.current.has(it._idx) && (it.viewTrackingUrls?.length ?? 0) > 0) {
        iconViewedRef.current.add(it._idx);
        fireUrls(it.viewTrackingUrls!);
        opts.analyticsEmit?.({ type: 'ad_icon_view', break: brk, program: it.program, idx: it._idx });
      }
    }

    setState({
      phase: 'playing',
      break: brk,
      remainingSec: remaining,
      skipOffsetSec: off,
      skipCountdownSec: skipCountdown,
      canSkip,
      // optional field on AdState; cast if your type doesn't have it
      ...(vis ? ({ icons: vis } as any) : null),
    });
  }, [adVideoRef, opts]);

  // --------------- play / end logic ---------------

  const startStatePlaying = (brk: AdBreak, vast: VastResponse) => {
    setState({
      phase: 'playing',
      break: brk,
      remainingSec: vast.linear!.durationSec,
      skipOffsetSec: vast.linear!.skipOffsetSec,
      skipCountdownSec: vast.linear!.skipOffsetSec ?? undefined,
      canSkip: (vast.linear!.skipOffsetSec ?? Infinity) <= 0,
    });
    // Start/CreativeView beacons are handled in updatePlayingState()
  };

  const endBreak = React.useCallback(
    (brk: AdBreak, reason: 'skip' | 'complete' | 'error' = 'complete') => {
      if (endingRef.current) return;
      endingRef.current = true;

      const v = adVideoRef.current;
      // 1) stop ad media + detach listeners
      try {
        if (v) {
          v.pause();
          cleanupRef.current?.();
          v.onended = null;
          v.onerror = null;
          v.removeAttribute('src');
          v.load(); // release buffer
        }
      } catch {}

      // 2) persist served & update local state
      servedSetRef.current.add(brk.id);
      brk.served = true;

      setState((s) => ({
        ...s,
        phase: 'completed',
        break: brk,
        ...(s && (s as any).icons ? { icons: [] } : {}),
      }));
      opts.analyticsEmit?.({ type: 'ad_break_end', break: brk, reason });

      // 3) clear per-break refs
      activeBreakRef.current = null;
      vastRef.current = null;
      startedRef.current = false;
      creativeViewRef.current = false;
      pausedRef.current = false;
      lastMutedRef.current = null;
      progressFiredRef.current.clear();
      iconViewedRef.current?.clear?.();
      inProgressRef.current.delete(brk.id);

      // 4) resume main content
      const doResume = () => {
        try {
          opts.onResumeMain();
        } catch {}
      };
      if (reason === 'skip') {
        // keep gesture context
        doResume();
        requestAnimationFrame(() => doResume());
      } else {
        requestAnimationFrame(() => doResume());
      }

      // 5) flip back to idle quickly
      setTimeout(() => {
        setState({ phase: 'idle' });
        endingRef.current = false;
      }, 0);
    },
    [adVideoRef, opts],
  );

  const playBreak = React.useCallback(
    async (brk: AdBreak) => {
      const v = adVideoRef.current;
      if (!v) return;

      // prevent duplicates / overlaps
      if (servedSetRef.current.has(brk.id) || inProgressRef.current.has(brk.id) || activeBreakRef.current) return;
      inProgressRef.current.add(brk.id);

      activeBreakRef.current = brk;
      quartilesRef.current = { q1: false, q2: false, q3: false };
      startedRef.current = false;
      creativeViewRef.current = false;
      pausedRef.current = false;
      lastMutedRef.current = null;
      progressFiredRef.current.clear();
      cleanupRef.current?.();

      setState({ phase: 'loading', break: brk });

      // pause main content immediately
      opts.onPauseMain();
      opts.analyticsEmit?.({ type: 'ad_break_start', break: brk });

      // Fetch VAST
      let vast: VastResponse;
      try {
        vast = await fetchVast(brk.vastTagUrl);
      } catch (e: any) {
        setState({ phase: 'error', break: brk, message: e?.message ?? 'vast_fetch_error' });
        opts.analyticsEmit?.({ type: 'ad_error', break: brk, message: 'vast_fetch_error' });
        return endBreak(brk, 'error');
      }
      vastRef.current = vast;

      // Impressions
      fireUrls(vast.impressions);
      opts.analyticsEmit?.({ type: 'ad_impression', break: brk });

      // Pick media
      const mediaUrl = pickMediaFile(vast);
      if (!mediaUrl || !vast.linear) {
        fireError(vast.errorUrls, 401);
        setState({ phase: 'error', break: brk, message: 'no_linear_media' });
        opts.analyticsEmit?.({ type: 'ad_error', break: brk, message: 'no_linear_media' });
        return endBreak(brk, 'error');
      }

      // Prepare ad element
      v.src = mediaUrl;
      v.currentTime = 0;
      v.muted = false;
      v.playsInline = true;
      v.crossOrigin = 'anonymous';
      v.load();

      // Terminal events
      v.onended = () => {
        fireUrls(vast.linear?.tracking?.complete ?? []);
        opts.analyticsEmit?.({ type: 'ad_complete', break: brk });
        endBreak(brk, 'complete');
      };
      v.onerror = () => {
        fireError(vast.errorUrls, 405);
        opts.analyticsEmit?.({ type: 'ad_error', break: brk, message: 'ad_media_error' });
        endBreak(brk, 'error');
      };

      // Listeners
      const onTU = () => updatePlayingState();
      const onLM = () => updatePlayingState();
      const onPlaying = () => {
        if (pausedRef.current) {
          pausedRef.current = false;
          fireUrls((vast.linear?.tracking as any).resume ?? []);
        }
        updatePlayingState();
      };
      const onPause = () => {
        pausedRef.current = true;
        fireUrls((vast.linear?.tracking as any).pause ?? []);
      };
      const onVol = () => {
        const nowMuted = !!v.muted;
        if (lastMutedRef.current === null) {
          lastMutedRef.current = nowMuted;
          return;
        }
        if (lastMutedRef.current !== nowMuted) {
          lastMutedRef.current = nowMuted;
          fireUrls((vast.linear?.tracking as any)[nowMuted ? 'mute' : 'unmute'] ?? []);
        }
      };

      v.addEventListener('timeupdate', onTU);
      v.addEventListener('loadedmetadata', onLM);
      v.addEventListener('playing', onPlaying);
      v.addEventListener('pause', onPause);
      v.addEventListener('volumechange', onVol);

      cleanupRef.current = () => {
        v.removeEventListener('timeupdate', onTU);
        v.removeEventListener('loadedmetadata', onLM);
        v.removeEventListener('playing', onPlaying);
        v.removeEventListener('pause', onPause);
        v.removeEventListener('volumechange', onVol);
      };

      // Try autoplay; fallback to muted
      try {
        await v.play();
        startStatePlaying(brk, vast);
        updatePlayingState();
      } catch {
        try {
          v.muted = true;
          await v.play();
          startStatePlaying(brk, vast);
          updatePlayingState();
          opts.analyticsEmit?.({ type: 'ad_start', break: brk, mutedAutoplay: true });
        } catch {
          cleanupRef.current();
          setState({ phase: 'error', break: brk, message: 'ad_autoplay_blocked' });
          opts.analyticsEmit?.({ type: 'ad_error', break: brk, message: 'ad_autoplay_blocked' });
          endBreak(brk, 'error');
        }
      }
    },
    [adVideoRef, opts, updatePlayingState, endBreak],
  );

  // --------------- driver loop: midrolls ---------------
  React.useEffect(() => {
    const id = window.setInterval(() => {
      ensureResolvedMidrolls();

      const sched = scheduleRef.current;
      if (!sched) return;

      // Only schedule when idle and nothing active/in-progress
      if (state.phase !== 'idle' || activeBreakRef.current) return;

      const now = opts.timeProvider();
      for (const br of sched.breaks) {
        if (servedSetRef.current.has(br.id) || inProgressRef.current.has(br.id)) continue;
        if (br.kind === 'midroll') {
          const at = br.timeOffsetSec ?? 0;
          if (at > 0 && now >= at - 0.25) {
            playBreak(br);
            break;
          }
        }
      }
    }, 300);
    return () => window.clearInterval(id);
  }, [state.phase, ensureResolvedMidrolls, opts.timeProvider, playBreak]);

  // --------------- external API ---------------

  const notifyEnded = React.useCallback(() => {
    const sched = scheduleRef.current;
    if (!sched) return;
    const pr = sched.breaks.find((b) => b.kind === 'postroll' && !servedSetRef.current.has(b.id));
    if (pr) playBreak(pr);
  }, [playBreak]);

  const clickThrough = React.useCallback(() => {
    const url = vastRef.current?.linear?.clickThroughUrl;
    if (url) {
      try {
        window.open(url, '_blank', 'noopener');
      } catch {}
      const clickUrls = vastRef.current?.linear?.clickTrackingUrls ?? [];
      fireUrls(clickUrls);
      const brk = activeBreakRef.current;
      if (brk) opts.analyticsEmit?.({ type: 'ad_click', break: brk, url });
    }
  }, [opts]);

  const skip = React.useCallback(() => {
    const brk = activeBreakRef.current;
    const v = adVideoRef.current;
    const vast = vastRef.current;
    if (!brk || !v || !vast?.linear) return;

    const off = vast.linear.skipOffsetSec;
    const allowed = typeof off === 'number' ? v.currentTime >= off - 0.01 : false;
    if (!allowed) return;

    fireUrls((vast.linear.tracking as any).skip ?? []);
    fireUrls((vast.linear.tracking as any).closeLinear ?? []);
    opts.analyticsEmit?.({ type: 'ad_skip', break: brk });
    endBreak(brk, 'skip');
  }, [adVideoRef, endBreak, opts]);

  const iconClick = React.useCallback(
    (iconIdx: number) => {
      const linear = vastRef.current?.linear;
      if (!linear?.icons) return;
      const icon = linear.icons[iconIdx];
      if (!icon) return;

      if (icon.clickThroughUrl) {
        try {
          window.open(icon.clickThroughUrl, '_blank', 'noopener');
        } catch {}
      }
      if (icon.clickTrackingUrls?.length) fireUrls(icon.clickTrackingUrls);
      const br = activeBreakRef.current;
      if (br) {
        opts.analyticsEmit?.({
          type: 'ad_icon_click',
          break: br,
          program: icon.program,
          idx: iconIdx,
        });
      }
    },
    [opts],
  );

  return { state, clickThrough, skip, notifyEnded, iconClick };
}
