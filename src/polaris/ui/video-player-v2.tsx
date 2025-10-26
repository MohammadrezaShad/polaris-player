"use client";
import * as React from "react";
import dynamic from "next/dynamic";

import { I18nProvider, useI18n } from "../providers/i18n/i18n";
import type { SourceDescriptor, Level, Track } from "../ports";
import { PlayerProvider, usePlayerDeps } from "../providers/player-provider";
import { usePlayerMachine } from "../core/machine";
import type { PlayerContext } from "../core/state";
import { useHysteresis } from "../hooks/use-hysteresis";
import { useAutoHide } from "../hooks/use-auto-hide";
import { MediaSurface } from "./surface/media-surface";
import { ControlsBar } from "./controls/controls-bar";
import { OfflineBanner } from "./overlays/offline-banner";
import type { CaptionStyle } from "./overlays/caption-overlay";
import { useFullscreen } from "../hooks/use-fullscreen";
import { usePiP } from "../hooks/use-pip";
import { usePageActivity } from "../hooks/use-page-activity";
import { useResilience } from "../hooks/use-resilience";
import { useSsaiRanges } from "../hooks/use-ssai-ranges";
import { usePersistenceAndPrefs } from "../hooks/use-persistence-and-prefs";
import { useTimeAndBuffer } from "../hooks/use-time-and-buffer";
import { useThumbs } from "../hooks/use-thumbs";
import { useQoSHeartbeat } from "../hooks/use-qo-s-heartbeat";
import { useAdsAutoplayResume } from "../hooks/use-ads-autoplay-resume";
import { useStallWatch } from "../hooks/use-stall-watch";
import { useKeyboardShortcuts } from "../hooks/use-keyboard";
import { useMobileExtras } from "../hooks/use-mobile-extras";
import { MobileControls } from "./controls/mobile-controls";
import { TapToUnmute } from "./overlays/tap-to-unmute";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { cn } from "../../vendor/helpers/cn";

const SettingsPopover = dynamic(() => import("./settings/settings-popover"), { ssr: false });
const SettingsDrawer = dynamic(() => import("./settings/settings-drawer"), { ssr: false });

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type FirstLoadedPayload = {
  video: HTMLVideoElement | null;
  duration: number;
  levels: Level[];
  audios: Track[];
  texts: Track[];
};

type Props = {
  source: SourceDescriptor;
  analyticsEndpoint: string;
  hasAnalytics?: boolean;
  embedCtx: {
    sessionId?: string;
    origin?: string;
    iframeSrc?: string;
    multimediaId: number;
    streamingId: number;
    forbidden?: boolean;
  };
  playerVersion?: string;
  autoplayMode?: "off" | "on" | "smart";
  autoplayVolume?: number;
  locale?: string;
  onFirstVideoLoaded?: (info: FirstLoadedPayload) => void;
  className?: string;
};

export default function VideoPlayer({ source, analyticsEndpoint, hasAnalytics = false, embedCtx, playerVersion = "v2.7-refactor-final", autoplayMode = "smart", autoplayVolume = 1, locale = "en", className, onFirstVideoLoaded }: Props) {
  // Avoid random on the server render to keep SSR/CSR stable
  const sessionRef = React.useRef<string | null>(null);
  if (sessionRef.current == null) {
    sessionRef.current = embedCtx.sessionId ?? (typeof window !== "undefined" ? uuid() : "ssr");
  }

  const ctx = React.useMemo(
    () => ({
      sessionId: sessionRef.current!,
      origin: embedCtx.origin ?? (typeof document !== "undefined" ? document.referrer || window.location.origin : undefined),
      iframeSrc: embedCtx.iframeSrc ?? (typeof window !== "undefined" ? window.location.href : undefined),
      multimediaId: embedCtx.multimediaId,
      streamingId: embedCtx.streamingId,
      forbidden: embedCtx.forbidden ?? false,
      playerVersion,
    }),
    [embedCtx.origin, embedCtx.iframeSrc, embedCtx.multimediaId, embedCtx.streamingId, embedCtx.forbidden, playerVersion]
  );

  return (
    <I18nProvider locale={locale as any}>
      <PlayerProvider analyticsEndpoint={analyticsEndpoint} hasAnalytics={hasAnalytics} embedCtx={ctx} playerVersion={playerVersion}>
        <TooltipProvider delayDuration={100}>
          <InnerPlayer source={source} autoplayMode={autoplayMode} autoplayVolume={autoplayVolume} onFirstVideoLoaded={onFirstVideoLoaded} className={className} />
        </TooltipProvider>
      </PlayerProvider>
    </I18nProvider>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Inner (refactored): composition of hooks + simple render
// ────────────────────────────────────────────────────────────────────────────────
const MEDIA_Q = "(min-width: 960px)";

function useDesktopAfterMount(): boolean | null {
  // Hydration-safe media query: SSR → null (no branching), CSR after mount → boolean
  const [isDesktop, setIsDesktop] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const mql = window.matchMedia(MEDIA_Q);
    const apply = () => setIsDesktop(mql.matches);
    apply();
    try {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    } catch {
      // Safari < 14
      mql.addListener(apply);
      return () => mql.removeListener(apply);
    }
  }, []);
  return isDesktop;
}

const InnerPlayer = React.memo(function InnerPlayer({
  source,
  autoplayMode,
  autoplayVolume, // kept for API parity
  onFirstVideoLoaded,
  className,
}: {
  source: SourceDescriptor;
  autoplayMode: "off" | "on" | "smart";
  autoplayVolume: number;
  onFirstVideoLoaded?: (info: FirstLoadedPayload) => void;
  className?: string;
}) {
  const { t, dir, lang, announce } = useI18n();

  // Refs
  const videoRef = React.useRef<HTMLVideoElement>(null as any);
  const adVideoRef = React.useRef<HTMLVideoElement>(null as any);
  const containerRef = React.useRef<HTMLDivElement>(null as any);
  const settingsBtnRef = React.useRef<HTMLButtonElement>(null as any);

  // Hydration-safe layout decision
  const isDesktopResolved = useDesktopAfterMount(); // null on SSR / first paint
  const isMobileResolved = isDesktopResolved === false;

  // Providers
  const { engine, storage, analytics, embedCtx, playerVersion } = usePlayerDeps();
  const { active: pageActive } = usePageActivity(containerRef as any);
  const ssai = useSsaiRanges(videoRef as any);

  // Machine
  const initial: PlayerContext = React.useMemo(() => ({ prefs: { volume: 1, muted: false, speed: 1, quality: "auto" }, state: "idle", intentPlaying: false }), []);
  const { state, dispatch } = usePlayerMachine(initial);
  const playingRef = React.useRef(false);
  React.useEffect(() => {
    playingRef.current = state.state === "playing";
  }, [state.state]);

  // UI hide
  const { visible: controlsVisible, setMenuOpen, setInteractionLock, ping, onPointerMove, onControlsPointerEnter, onControlsPointerLeave, onControlsPointerDown, setVisible, toggleVisible } = useAutoHide({ idleMs: 2500 }) as any;

  // Guard: block control interactions for a short time right after reveal
  const controlsRevealGuardUntilRef = React.useRef(0);

  // EXTRA guards/locks to manage two-tap pause while playing
  const controlsLockRef = React.useRef(false);
  const bgPauseGuardRef = React.useRef(0);

  // Keep controls visible when paused/ended (mobile spec)
  React.useEffect(() => {
    const keep = state.state === "paused" || state.state === "ended" || (state.state === "idle" && (videoRef.current?.paused ?? true));
    setInteractionLock(keep);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    keep && setVisible(keep);
  }, [state.state, setInteractionLock]);

  const hideCursor = state.state === "playing" && !controlsVisible;

  // ── Pulse overlay state ──────────────────────────────────────────────────────
  const [pulse, setPulse] = React.useState<null | { kind: "play" | "pause"; key: number }>(null);
  const triggerPulse = React.useCallback((kind: "play" | "pause") => {
    setPulse({ kind, key: Date.now() });
    window.setTimeout(() => setPulse(null), 560);
  }, []);

  // FS / PiP
  const { active: fsActive, toggle: toggleFullscreen } = useFullscreen(containerRef as any, videoRef as any);
  const { active: pipActive, toggle: togglePiP } = usePiP(videoRef as any);

  // Online
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const sync = () => setOnline(typeof navigator === "undefined" ? true : !!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Resilience
  const [resState, setResState] = React.useState<"ok" | "stall" | "retrying" | "offline">("ok");
  useResilience({ engine, source, onState: setResState });

  // Prefs + persistence

  const prefs = usePersistenceAndPrefs({ engine: engine as any, storage, sourceId: source.id, videoRef });
  const { volume, setVolume, muted, setMuted, rate, setRate, dataSaver, setDataSaver, persistOn, setPersistOn, levels, audios, texts, textId, setTextId, cc, setCc, audioId, setAudioId, levelSel, setLevelSel, refreshTracks } = prefs;

  // Remember last non-zero volume (for unmute restore)
  const lastNonZeroVolumeRef = React.useRef<number>(volume > 0 ? volume : 0.6);
  React.useEffect(() => {
    if (volume > 0) lastNonZeroVolumeRef.current = volume;
  }, [volume]);

  // Time/buffer polling
  const { currentTime, setCurrentTime, duration, setDuration, buffered } = useTimeAndBuffer(engine, {
    pageActive,
    videoRef,
  });

  // Stall watchdog
  const adActiveRef = React.useRef(false);
  const { scheduleStallWatch } = useStallWatch({ engine, duration, adActiveRef, playingRef, videoRef });

  // Ads + autoplay + resume
  const [unmuteHint, setUnmuteHint] = React.useState(false);
  const {
    ads,
    adActive,
    adActiveRef: adRef,
    adMarkers,
    gatedPlay,
    tryPlayWithEventDispatch,
    tryPrimeAt,
  } = useAdsAutoplayResume({
    engine,
    source,
    analytics,
    duration,
    currentTime,
    videoRef,
    adVideoRef,
    autoplayMode,
    onDispatch: (type: any) => dispatch({ type } as any),
    scheduleStallWatch,
    onAutoplayMuted: () => {
      setUnmuteHint(true);
      window.setTimeout(() => setUnmuteHint(false), 3000);
    },
  });
  React.useEffect(() => {
    adActiveRef.current = adActive;
  }, [adActive]);

  // QoS heartbeat
  useQoSHeartbeat({
    videoRef,
    engine,
    analytics,
    embedCtx,
    playerVersion,
    sourceId: source.id,
    pageActive,
  });

  // Thumbnails
  const { seekbarRef, hoverState, onSeekbarMouseMove, onSeekbarLeave, sliderMax, updateFromRatio } = useThumbs(source, duration, currentTime);

  // Mobile extras
  useMobileExtras({
    statePlaying: state.state === "playing",
    pipActive,
    togglePiP,
    fsActive,
    toggleFullscreen,
    adActive,
  });

  // Derived UI flags
  const loadingActive = state.state === "loading" || state.state === "buffering" || state.state === "seeking" || resState === "retrying";
  const showLoading = useHysteresis(loadingActive, 120, 100);
  const showEnded = state.state === "ended";
  const showError = resState === "offline";

  // Toggle helpers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const togglePlay = async () => {
    if (adActive) {
      ping();
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      try {
        await (engine.pause ? engine.pause?.() : v.pause?.());
      } catch {}
      dispatch({ type: "pause" } as any);
      triggerPulse("pause");
    } else {
      await gatedPlay();
      triggerPulse("play");
    }
    ping();
  };

  const seekBy = (delta: number) => {
    if (adActive) {
      ping();
      return;
    }
    const to = Math.max(0, Math.min((engine.getDuration?.() ?? duration) || 0, (engine.getCurrentTime?.() ?? currentTime) + delta));
    setCurrentTime(to);
    engine.seekTo?.(to);
    ping();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    try {
      v.muted = next;
    } catch {}
    if (!next && v.volume === 0) {
      const target = lastNonZeroVolumeRef.current ?? 0.6;
      try {
        v.volume = target;
      } catch {}
      setVolume(target);
      engine.setVolume?.(target);
    }
    setMuted(next);
    engine.setMuted?.(next);
    ping();
  };

  /** First-tap unmute: used by TapToUnmute and by container tap interception */
  const forceUnmute = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = false;
    } catch {}
    const target = lastNonZeroVolumeRef.current ?? (volume > 0 ? volume : 0.6);
    if (v.volume === 0) {
      try {
        v.volume = target;
      } catch {}
      setVolume(target);
      engine.setVolume?.(target);
    }
    setMuted(false);
    engine.setMuted?.(false);
    setUnmuteHint(false);
  }, [engine, setMuted, setVolume, volume]);

  // Keyboard (with chapters)
  const { onKeyDown } = useKeyboardShortcuts({
    adActive,
    engine,
    currentTime,
    texts,
    textId,
    setTextId,
    togglePlay,
    seekBy,
    toggleMute,
    toggleFullscreen,
    togglePiP,
    announce,
    t,
    chapters: (source.chapters ?? []).map((c) => ({ start: c.start, title: c.title })),
  });

  // refs to suppress one toggle after a "reveal" tap
  const consumeNextToggleRef = React.useRef(false);
  const suppressToggleUntilRef = React.useRef(0);

  // capture-phase guard: only on mobile, only when playing & controls hidden
  const onContainerPointerUpCapture = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDesktopResolved !== false) return; // mobile-only
      if (adActive) return;
      if (state.state === "playing" && !controlsVisible) {
        consumeNextToggleRef.current = true; // skip next toggle
        suppressToggleUntilRef.current = Date.now() + 350;
      }
    },
    [isDesktopResolved, adActive, state.state, controlsVisible]
  );

  const guardedTogglePlay = React.useCallback(async () => {
    // desktop: unchanged
    if (isDesktopResolved !== false) return togglePlay();

    // mobile: consume the first tap after reveal
    if (consumeNextToggleRef.current || Date.now() < suppressToggleUntilRef.current) {
      consumeNextToggleRef.current = false; // one-time
      return;
    }
    return togglePlay();
  }, [isDesktopResolved, togglePlay]);

  // Double-tap seek + tap-to-unmute interception (mobile)
  const lastTapRef = React.useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 });
  const onContainerPointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (adActive) return;

      const isMobile = isDesktopResolved === false;
      const isControlsTarget = (e.target as HTMLElement | null)?.closest?.('[data-controls-root="true"]');

      // Tap-to-unmute has priority
      if (isMobile && state.state === "playing" && muted) {
        forceUnmute();
        return;
      }

      // ── Mobile & controls hidden ───────────────────────────────────────────────
      if (isMobile && !controlsVisible) {
        if (state.state === "playing") {
          // Double-tap seek while playing
          const now = Date.now();
          const { t: lastT, x: lastX, y: lastY } = lastTapRef.current;
          const isDouble = now - lastT < 300 && Math.hypot((e.clientX ?? 0) - lastX, (e.clientY ?? 0) - lastY) < 40;
          lastTapRef.current = { t: now, x: e.clientX ?? 0, y: e.clientY ?? 0 };
          if (isDouble) {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const leftHalf = (e.clientX ?? 0) < rect.left + rect.width / 2;
            seekBy(leftHalf ? -10 : +10);
            return;
          }

          // First reveal while playing → show controls + arm 2-tap pause guard
          controlsRevealGuardUntilRef.current = Date.now() + 350; // block clicks for 350ms
          requestAnimationFrame(() => {
            setVisible?.(true);
            setInteractionLock(true);
          });
          controlsLockRef.current = true;
          bgPauseGuardRef.current = 2;
          ping();
          return;
        } else {
          // Paused / idle / ended → single tap just reveals controls (no pause guard)
          controlsRevealGuardUntilRef.current = Date.now() + 350;
          requestAnimationFrame(() => {
            setVisible?.(true);
            setInteractionLock(true);
          });
          ping();
          return;
        }
      }

      // ── Mobile & controls visible ──────────────────────────────────────────────
      if (isMobile && controlsVisible) {
        if (isControlsTarget) return; // controls handle their own taps

        // While locked & playing: require two bg taps to pause
        if (controlsLockRef.current && state.state === "playing") {
          if (bgPauseGuardRef.current > 0) {
            bgPauseGuardRef.current -= 1;
            ping();
            return;
          }
          (async () => {
            try {
              const v = videoRef.current;
              if (v && !v.paused) await (engine.pause ? engine.pause() : v.pause());
            } catch {}
            dispatch({ type: "pause" } as any);
            triggerPulse("pause");
          })();
          controlsLockRef.current = false;
          setInteractionLock(false);
          ping();
          return;
        }

        // Not locked → background tap toggles controls only (no play/pause)
        toggleVisible?.();
        controlsLockRef.current = false;
        setInteractionLock(false);
        return;
      }

      // Desktop or other: keep UI alive
      ping();
    },
    [adActive, isDesktopResolved, controlsVisible, state.state, muted, forceUnmute, seekBy, setVisible, setInteractionLock, toggleVisible, ping, engine, dispatch, videoRef, triggerPulse]
  );

  // Provide a background-tap toggle for MobileControls dim area
  const onToggleControls = React.useCallback(() => {
    if (!isMobileResolved) return;
    if (!controlsVisible) {
      controlsRevealGuardUntilRef.current = Date.now() + 350;
      requestAnimationFrame(() => {
        setVisible?.(true);
        setInteractionLock(true);
      });
      ping();
    } else {
      toggleVisible?.();
      setInteractionLock(false);
    }
  }, [isMobileResolved, controlsVisible, setVisible, toggleVisible, setInteractionLock, ping]);

  // Surface toggle: prevent mobile surface tap from starting playback when paused
  const onSurfaceToggle = React.useCallback(() => {
    if (isDesktopResolved === false) {
      // Mobile: just reveal controls, do not toggle playback
      controlsRevealGuardUntilRef.current = Date.now() + 350;
      requestAnimationFrame(() => {
        setVisible?.(true);
        setInteractionLock(true);
      });
      ping();
      return;
    }
    // Desktop: classic behavior
    togglePlay();
  }, [isDesktopResolved, setVisible, setInteractionLock, ping, togglePlay]);

  // Track lists refresh when metadata ready
  const firstLoadedRef = React.useRef(false);

  // Attach / load engine once — FIXED: await attach() before load() to avoid "attach() first" errors
  React.useEffect(() => {
    if (!videoRef.current) return;
    const cancelled = false;

    const doAttachAndLoad = async () => {
      try {
        dispatch({ type: "load" } as any);
        // Ensure attach completes before load
        await ((engine.attach?.(videoRef.current) as any) ?? Promise.resolve());
        if (cancelled) return;
        await (engine.load?.(source) ?? Promise.resolve());
        if (cancelled) return;
        analytics.emit({ type: "session_start", ctx: embedCtx, src: { id: source.id, url: source.url } });
      } catch (err) {
        console.error("engine attach/load failed:", err);
      }
    };

    void doAttachAndLoad();

    const unMeta = engine.on?.("engine_loadedmetadata", async () => {
      dispatch({ type: "engine_ready" } as any);
      refreshTracks();

      const lvls = engine.getLevels?.() ?? [];
      const auds = engine.getAudioTracks?.() ?? [];
      const subs = engine.getTextTracks?.() ?? [];

      if (!firstLoadedRef.current) {
        firstLoadedRef.current = true;
        try {
          onFirstVideoLoaded?.({
            video: videoRef.current,
            duration: engine.getDuration?.() ?? 0,
            levels: lvls,
            audios: auds,
            texts: subs,
          });
        } catch {}
      }

      // Smart resume
      let resumeTarget: number | null = null;
      try {
        const raw = typeof storage.getResume === "function" ? await storage.getResume(`vod:${source.id}`) : ((await storage.getPrefs(`vod:${source.id}`)) as any)?.lastTime ?? null;
        const durNow = engine.getDuration?.() ?? 0;
        const t0 = typeof raw === "string" ? parseFloat(raw) : Number(raw);
        const endGuard = Number.isFinite(durNow) && durNow > 0 ? Math.max(5, durNow * 0.03) : 0;
        if (Number.isFinite(t0) && t0 > 1 && (Number.isFinite(durNow) ? t0 < Math.max(0, durNow - endGuard) : true)) {
          resumeTarget = Math.min(Math.max(0, t0), Math.max(0, (Number.isFinite(durNow) ? durNow : Infinity) - 1));
        }
      } catch {}

      const wantAutoplay = autoplayMode !== "off";
      if (resumeTarget != null) {
        let ok = await tryPrimeAt(resumeTarget);
        if (!ok) ok = await tryPrimeAt(Math.max(0, resumeTarget - 15));
        if (!ok) await tryPrimeAt(0);
        if (wantAutoplay) void gatedPlay();
      } else if (wantAutoplay) {
        void gatedPlay();
      }
    });

    const unCanPlay = engine.on?.("engine_canplay", () => dispatch({ type: "engine_ready" } as any));
    const unBufS = engine.on?.("engine_buffering_start", () => dispatch({ type: "buffer_start" } as any));
    const unBufE = engine.on?.("engine_buffering_end", () => dispatch({ type: "buffer_end" } as any));
    const unSeekS = engine.on?.("engine_seek_start", () => dispatch({ type: "seek_start" } as any));
    const unSeekE = engine.on?.("engine_seek_end", () => dispatch({ type: "seek_end" } as any));

    const unEnd = engine.on?.("engine_ended", async () => {
      const dur = engine.getDuration?.() ?? 0;
      const cur = engine.getCurrentTime?.() ?? 0;
      const endGuard = Number.isFinite(dur) && dur > 0 ? Math.max(5, dur * 0.03) : 0;
      const reallyAtEnd = Number.isFinite(dur) && dur > 0 ? cur >= dur - endGuard : false;
      if (!reallyAtEnd) {
        scheduleStallWatch("spurious_ended");
        return;
      }
      dispatch({ type: "ended" } as any);
      try {
        if (typeof storage.setResume === "function") await storage.setResume(`vod:${source.id}`, 0);
        else {
          const p = (await storage.getPrefs(`vod:${source.id}`)) ?? ({} as any);
          await storage.setPrefs(`vod:${source.id}`, { ...(p as any), lastTime: 0 } as any);
        }
      } catch {}
      (ads as any)?.notifyEnded?.();
    });

    const unErr = engine.on?.("engine_error", async (e: any) => {
      const firstPlaybackNotStarted = (engine.getCurrentTime?.() ?? 0) < 0.1;
      if (e?.fatal && firstPlaybackNotStarted) {
        try {
          await storage.setResume(`vod:${source.id}`, 0);
        } catch {}
      }
    });

    if (videoRef.current) {
      const v = videoRef.current;
      const onPlay = () => dispatch({ type: "play" } as any);
      const onPause = () => dispatch({ type: "pause" } as any);
      const onWaiting = () => {
        if (state.state === "playing" && !adActiveRef.current) scheduleStallWatch("waiting_event");
      };
      const onVol = () => {
        const vv = Number.isFinite(v.volume) ? v.volume : volume;
        if (Math.abs(vv - volume) > 0.01) setVolume(vv);
        if (v.muted !== muted) setMuted(v.muted);
        engine.setVolume?.(vv);
        engine.setMuted?.(v.muted);
      };
      v.addEventListener("playing", onPlay);
      v.addEventListener("pause", onPause);
      v.addEventListener("waiting", onWaiting);
      v.addEventListener("volumechange", onVol);

      return () => {
        try {
          unMeta?.();
        } catch {}
        try {
          unCanPlay?.();
        } catch {}
        try {
          unBufS?.();
        } catch {}
        try {
          unBufE?.();
        } catch {}
        try {
          unSeekS?.();
        } catch {}
        try {
          unSeekE?.();
        } catch {}
        try {
          unEnd?.();
        } catch {}
        try {
          unErr?.();
        } catch {}
        try {
          engine.detach?.();
          engine.destroy?.();
        } catch {}
        v.removeEventListener("playing", onPlay);
        v.removeEventListener("pause", onPause);
        v.removeEventListener("waiting", onWaiting);
        v.removeEventListener("volumechange", onVol);
      };
    }

    return () => {
      try {
        unMeta?.();
      } catch {}
      try {
        unCanPlay?.();
      } catch {}
      try {
        unBufS?.();
      } catch {}
      try {
        unBufE?.();
      } catch {}
      try {
        unSeekS?.();
      } catch {}
      try {
        unSeekE?.();
      } catch {}
      try {
        unEnd?.();
      } catch {}
      try {
        unErr?.();
      } catch {}
      try {
        engine.detach?.();
        engine.destroy?.();
      } catch {}
    };
    // include engine in deps to be safe if engine instance changes
  }, [engine, source.id, source.url, autoplayMode]);

  // Save resume every 3s + on pause/seek end
  React.useEffect(() => {
    const push = async (t: number) => {
      if (adActive || t < 5) return;
      try {
        if (typeof storage.setResume === "function") await storage.setResume(`vod:${source.id}`, t);
        else {
          const p = (await storage.getPrefs(`vod:${source.id}`)) ?? ({} as any);
          await storage.setPrefs(`vod:${source.id}`, { ...(p as any), lastTime: t } as any);
        }
      } catch {}
    };
    const i = window.setInterval(() => {
      const t = engine.getCurrentTime?.() ?? 0;
      void push(t);
    }, 3000);
    const v = videoRef.current;
    const onPauseSave = () => void push(engine.getCurrentTime?.() ?? 0);
    const unSeekEnd = engine.on?.("engine_seek_end", () => void push(engine.getCurrentTime?.() ?? 0));
    if (v) v.addEventListener("pause", onPauseSave);
    return () => {
      window.clearInterval(i);
      try {
        unSeekEnd?.();
      } catch {}
      if (v) v.removeEventListener("pause", onPauseSave);
    };
  }, [engine, adActive, storage, source.id]);

  // Truth reconciliation A: UI says playing, element not progressing → recover
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let lastT = v.currentTime;
    const id = window.setInterval(() => {
      if (adActiveRef.current) return;
      const uiPlaying = state.state === "playing";
      const elPlaying = !v.paused && !v.ended && v.readyState > 2;
      const progressed = v.currentTime > lastT + 0.05;
      if (uiPlaying && (!elPlaying || !progressed)) {
        scheduleStallWatch("ui_playing_but_frozen");
      }
      lastT = v.currentTime;
    }, 1200);
    return () => clearInterval(id);
  }, [scheduleStallWatch, state.state]);

  // Truth reconciliation B: UI says buffering, element progressing → clear spinner
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let last = v.currentTime;
    let raf = 0;
    const loop = () => {
      const inBuffer = state.state === "buffering" || state.state === "loading" || state.state === "seeking";
      const progressed = v.currentTime > last + 0.06;
      if (!adActiveRef.current && inBuffer && progressed) {
        try {
          (dispatch as any)({ type: "buffer_end" });
        } catch {}
      }
      last = v.currentTime;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.state, dispatch]);

  // Settings open/close
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const openSettings = (o: boolean) => {
    setSettingsOpen(o);
    setMenuOpen(o);
  };

  // Scrub UX with SSAI snap + announce
  const [scrub, setScrub] = React.useState<number | null>(null);
  const [wasPlayingOnScrub, setWasPlayingOnScrub] = React.useState(false);

  const handleSeekChange = (value: number[]) => {
    const to = value[0];
    if (scrub === null) {
      setWasPlayingOnScrub(state.state === "playing");
      dispatch({ type: "seek_start" } as any);
      setInteractionLock(true);
    }
    setScrub(to);
    setCurrentTime(to);
    engine.seekTo?.(to);
    ping();
  };

  const handleSeekCommit = async (value: number[]) => {
    let target = value[0];
    if ((ssai as any)?.snapSeek) {
      const snapped = (ssai as any).snapSeek(target);
      const durNow = engine.getDuration?.() ?? duration ?? 0;
      const within = Number.isFinite(snapped) && snapped! >= 0 && (!Number.isFinite(durNow) || snapped! <= durNow);
      const notCrazy = Number.isFinite(snapped) && Math.abs((snapped as number) - target) <= 30;
      if (within && notCrazy && snapped! !== target) {
        target = snapped as number;
        announce?.(t("tooltip.adBreak"));
      }
    }
    engine.seekTo?.(target);
    setCurrentTime(target);
    dispatch({ type: "seek_end" } as any);
    setScrub(null);
    setInteractionLock(false);
    if (wasPlayingOnScrub && state.state !== "playing") {
      await tryPlayWithEventDispatch();
    }
    ping();
  };

  // Cast/AirPlay presence
  const [castAvailable, setCastAvailable] = React.useState(false);
  const [airplayAvailable, setAirplayAvailable] = React.useState(false);
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        setCastAvailable(!!(window as any).cast && !!(window as any).chrome);
      } catch {}
    }
    try {
      setAirplayAvailable(!!(videoRef.current as any)?.webkitShowPlaybackTargetPicker);
    } catch {}
  }, []);
  const startCast = React.useCallback(() => {}, []);
  const showAirplayPicker = React.useCallback(() => {
    try {
      (videoRef.current as any)?.webkitShowPlaybackTargetPicker?.();
    } catch {}
  }, []);

  const selectedText = React.useMemo(() => (textId ? texts.find((t: { id: any }) => t.id === textId) : undefined), [texts, textId]);

  // Combine CSAI schedule + SSAI ranges
  const adMarkersCombined = React.useMemo(() => {
    const ssaiMarkers = (ssai as any)?.ranges ? (ssai as any).ranges.map((r: any) => ({ at: r.start })) : [];
    return [...adMarkers, ...ssaiMarkers].sort((a, b) => a.at - b.at);
  }, [adMarkers, ssai]);

  // Briefly re-expand the unmute pill when controls appear while muted & playing (mobile)
  React.useEffect(() => {
    if (!isMobileResolved || adActive || !muted || state.state !== "playing") return;
    if (controlsVisible) {
      setUnmuteHint(true);
      const id = window.setTimeout(() => setUnmuteHint(false), 1000);
      return () => window.clearTimeout(id);
    }
  }, [controlsVisible, isMobileResolved, adActive, muted, state.state]);

  // MOBILE controls visibility:
  const tapUnmuteActive = isMobileResolved && state.state === "playing" && muted && !adActive;
  const mobileControlsVisible = isMobileResolved && !tapUnmuteActive && !adActive && (controlsVisible || state.state === "ended" || showLoading);

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={onKeyDown} onPointerMove={onPointerMove} onPointerUp={onContainerPointerUp} onPointerUpCapture={onContainerPointerUpCapture} className={cn("player-v2 relative w-full overflow-hidden bg-black outline-none", hideCursor ? "cursor-none" : "cursor-auto", className)} aria-label={t("a11y.playerRegion")} role="region" lang={lang} dir={dir} suppressHydrationWarning>
      <OfflineBanner online={online} />

      <MediaSurface
        videoRef={videoRef as any}
        poster={source.poster}
        hideCursor={state.state === "playing" && !controlsVisible}
        onTogglePlay={onSurfaceToggle}
        showLoading={showLoading}
        showCenterPlay={state.state === "paused" && currentTime < 0.05}
        showEnded={showEnded}
        showError={showError}
        errorMessage={t("overlays.errorGeneric")}
        onRetry={() => {
          (async () => {
            try {
              await storage.setResume(`vod:${source.id}`, 0);
            } catch {}
          })();
          dispatch({ type: "retry" } as any);
          engine.load?.(source);
        }}
        seekBy={seekBy}
        pulse={pulse}
        caption={{
          active: !!textId,
          selectedTrackId: textId,
          selectedLang: selectedText?.lang,
          selectedLabel: selectedText?.label,
          style: cc as CaptionStyle,
          safeBottomPx: controlsVisible && isDesktopResolved ? 104 : 32,
        }}
        ads={ads}
        adActive={adActive}
        adVideoRef={adVideoRef as any}
        className={className}
        isMobileResolved={isMobileResolved}
      >
        {/* Mobile tap-to-unmute */}
        {tapUnmuteActive && <TapToUnmute showPill={unmuteHint} showIcon={!unmuteHint} onUnmute={forceUnmute} />}

        {/* Controls: render ONLY after mount to avoid SSR hydration mismatches */}
        {isDesktopResolved === true ? (
          <ControlsBar
            chapterTicks={(source.chapters ?? []).map((c) => ({ at: c.start, title: c.title || "" }))}
            adMarkers={adMarkersCombined}
            controlsVisible={controlsVisible}
            onPointerEnter={() => onControlsPointerEnter()}
            onPointerLeave={() => onControlsPointerLeave()}
            onPointerDown={() => onControlsPointerDown()}
            seekbarRef={seekbarRef as any}
            sliderMax={sliderMax}
            buffered={buffered}
            hoverState={hoverState}
            onSeekbarMouseMove={onSeekbarMouseMove}
            onSeekbarLeave={onSeekbarLeave}
            currentTime={currentTime}
            scrub={scrub}
            onSeekChange={handleSeekChange}
            onSeekCommit={handleSeekCommit}
            playing={state.state === "playing"}
            onTogglePlay={togglePlay}
            muted={muted}
            volume={volume}
            onToggleMute={toggleMute}
            onVolumeChange={(v01) => {
              setInteractionLock(true);
              setVolume(v01);
              try {
                if (videoRef.current) videoRef.current.volume = v01;
              } catch {}
              engine.setVolume?.(v01);
              if (v01 > 0 && muted) {
                setMuted(false);
                try {
                  if (videoRef.current) videoRef.current.muted = false;
                } catch {}
                engine.setMuted?.(false);
              }
              ping();
            }}
            onVolumeCommit={() => setInteractionLock(false)}
            unmuteChip={
              unmuteHint
                ? {
                    show: true,
                    onClick: () => {
                      try {
                        const v = videoRef.current;
                        if (v) {
                          v.muted = false;
                          if (v.volume === 0) v.volume = 0.5;
                        }
                      } catch {}
                      setMuted(false);
                      setVolume(volume === 0 ? 0.5 : volume);
                      (engine as any).setMuted?.(false);
                      (engine as any).setVolume?.(0.5);
                      setUnmuteHint(false);
                    },
                  }
                : undefined
            }
            duration={duration}
            onTogglePiP={togglePiP}
            onToggleFullscreen={toggleFullscreen}
            fsActive={fsActive}
            onOpenSettings={() => {
              setSettingsOpen(true);
              setMenuOpen(true);
            }}
            settingsBtnRef={settingsBtnRef as any}
            castAvailable={castAvailable}
            onCastClick={startCast}
            airplayAvailable={airplayAvailable}
            onAirplayClick={showAirplayPicker}
            adActive={adActive}
          />
        ) : isDesktopResolved === false && mobileControlsVisible ? (
          <MobileControls
            controlsVisible={controlsVisible}
            onPointerEnter={() => onControlsPointerEnter()}
            onPointerLeave={() => onControlsPointerLeave()}
            onPointerDown={() => onControlsPointerDown()}
            onToggleControls={onToggleControls}
            seekbarRef={seekbarRef as any}
            sliderMax={sliderMax}
            buffered={buffered}
            hoverState={hoverState}
            onSeekbarMouseMove={onSeekbarMouseMove}
            onSeekbarLeave={onSeekbarLeave}
            currentTime={currentTime}
            scrub={scrub}
            onSeekChange={handleSeekChange}
            onSeekCommit={handleSeekCommit}
            updateFromRatio={updateFromRatio}
            playing={state.state === "playing"}
            onTogglePlay={togglePlay}
            duration={duration}
            onTogglePiP={togglePiP}
            onToggleFullscreen={toggleFullscreen}
            fsActive={fsActive}
            onOpenSettings={() => {
              setSettingsOpen(true);
              setMenuOpen(true);
            }}
            settingsBtnRef={settingsBtnRef as any}
            castAvailable={castAvailable}
            onCastClick={startCast}
            airplayAvailable={airplayAvailable}
            onAirplayClick={showAirplayPicker}
            adActive={adActive}
            isLoading={showLoading}
            revealGuardUntil={controlsRevealGuardUntilRef.current}
          />
        ) : null}
      </MediaSurface>

      {/* Settings */}
      {isDesktopResolved !== null &&
        (isDesktopResolved ? (
          <SettingsPopover
            open={settingsOpen}
            onOpenChange={openSettings}
            containerRef={containerRef as any}
            anchorRef={settingsBtnRef as any}
            levels={levels}
            levelSelection={levelSel}
            onChangeLevel={(sel) => {
              setLevelSel(sel);
              if (sel === "auto") engine.setLevel?.("auto");
              else engine.setLevel?.({ id: (sel as any).id });
            }}
            rate={rate}
            onChangeRate={(r: number) => {
              setRate(r);
              try {
                if (videoRef.current) {
                  videoRef.current.defaultPlaybackRate = r;
                  videoRef.current.playbackRate = r;
                }
              } catch {}
              engine.setPlaybackRate?.(r);
            }}
            audioTracks={audios}
            audioId={audioId}
            onChangeAudio={(id?: string) => {
              setAudioId(id);
              if (id != null) engine.setAudioTrack?.(id);
            }}
            textTracks={texts}
            textId={textId}
            onChangeText={(id?: string) => {
              setTextId(id);
              engine.setTextTrack?.(id);
            }}
            captionStyle={cc as any}
            onChangeCaptionStyle={setCc}
            persistenceEnabled={persistOn}
            onTogglePersistence={(enabled) => {
              try {
                (storage as any).setEnabled?.(enabled);
              } catch {}
              setPersistOn(!!enabled);
            }}
            dataSaverEnabled={dataSaver}
            onToggleDataSaver={setDataSaver}
          />
        ) : (
          <SettingsDrawer
            open={settingsOpen}
            onOpenChange={openSettings}
            levels={levels}
            levelSelection={levelSel}
            onChangeLevel={(sel) => {
              setLevelSel(sel);
              if (sel === "auto") engine.setLevel?.("auto");
              else engine.setLevel?.({ id: (sel as any).id });
            }}
            rate={rate}
            onChangeRate={(r: number) => {
              setRate(r);
              try {
                if (videoRef.current) {
                  videoRef.current.defaultPlaybackRate = r;
                  videoRef.current.playbackRate = r;
                }
              } catch {}
              engine.setPlaybackRate?.(r);
            }}
            audioTracks={audios}
            audioId={audioId}
            onChangeAudio={(id?: string) => {
              setAudioId(id);
              if (id != null) engine.setAudioTrack?.(id);
            }}
            textTracks={texts}
            textId={textId}
            onChangeText={(id?: string) => {
              setTextId(id);
              engine.setTextTrack?.(id);
            }}
            captionStyle={cc as any}
            onChangeCaptionStyle={setCc}
            persistenceEnabled={persistOn}
            onTogglePersistence={(enabled) => {
              try {
                (storage as any).setEnabled?.(enabled);
              } catch {}
              setPersistOn(!!enabled);
            }}
            dataSaverEnabled={dataSaver}
            onToggleDataSaver={setDataSaver}
          />
        ))}
    </div>
  );
});
