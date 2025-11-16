"use client";
import * as React from "react";

import { useAdManager } from "../ads/ad-manager";

function bufferedAhead(video: HTMLVideoElement | null, at: number): number {
  if (!video) return 0;
  const br = video.buffered;
  for (let i = 0; i < br.length; i++) {
    const start = br.start(i);
    const end = br.end(i);
    if (at >= start && at <= end) return end - at;
  }
  return 0;
}

/**
 * Brutal killer: pause + clear ALL video/audio on the page.
 * If `except` is provided, it will be kept alive.
 */
function killAllMedia(except?: HTMLMediaElement | null) {
  try {
    const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
    const audios = Array.from(document.querySelectorAll("audio")) as HTMLAudioElement[];
    const all = [...videos, ...audios] as HTMLMediaElement[];

    for (const el of all) {
      if (except && el === except) continue;
      try {
        el.pause();
      } catch {}
      try {
        el.removeAttribute("src");
      } catch {}
      try {
        (el as any).load?.();
      } catch {}
    }
  } catch {
    // ignore
  }
}

export function useAdsAutoplayResume(params: { engine: any; source: any; analytics: any; duration: number; currentTime: number; videoRef: React.RefObject<HTMLVideoElement>; adVideoRef: React.RefObject<HTMLVideoElement>; autoplayMode: "off" | "on" | "smart"; onDispatch: (type: "play" | "pause") => void; scheduleStallWatch: (reason: string) => void; onAutoplayMuted?: () => void }) {
  const { engine, source, analytics, duration, currentTime, videoRef, adVideoRef, autoplayMode, onDispatch, scheduleStallWatch, onAutoplayMuted } = params;

  const [adActive, setAdActive] = React.useState(false);
  const adActiveRef = React.useRef(false);
  React.useEffect(() => {
    adActiveRef.current = adActive;
  }, [adActive]);

  // Keep latest ads manager for resets
  const adsRef = React.useRef<any>(null);

  // ---------- preroll flags ----------

  const hasPreroll = React.useMemo(() => {
    const s = source.ads?.schedule;
    return Boolean(s && s.prerollTag); // ONLY explicit prerollTag, not "any VMAP"
  }, [source.ads]);

  const adsPrerollPendingRef = React.useRef<boolean>(false);
  const prerollServedRef = React.useRef<boolean>(false);
  const wasPlayingBeforeAdRef = React.useRef(false);

  React.useEffect(() => {
    adsPrerollPendingRef.current = hasPreroll;
    prerollServedRef.current = false;
    wasPlayingBeforeAdRef.current = false;
  }, [hasPreroll, source.id]);

  // guard main element during ads
  const adPlaybackGuardRef = React.useRef<((e?: any) => void) | null>(null);

  const restoreMediaSettingsAfterAds = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = v.muted;
      v.volume = v.volume;
    } catch {}
  }, [videoRef]);

  const tryPlayWithEventDispatch = React.useCallback(async () => {
    const v = videoRef.current;
    if (!v || adActiveRef.current) return { resolved: false, usedMutedFallback: false };

    let resolved = false;
    let usedMutedFallback = false;

    const onPlaying = () => {
      resolved = true;
      onDispatch("play");
      if (usedMutedFallback) {
        setTimeout(() => {
          if (v.muted) onAutoplayMuted?.();
        }, 60);
      }
    };
    v.addEventListener("playing", onPlaying, { once: true });

    try {
      await (engine.play?.() ?? v.play?.());
    } catch (err: any) {
      console.error("Initial play failed:", err?.name, err?.message);
      try {
        engine.setMuted?.(true);
        v.muted = true;
        usedMutedFallback = true;
        await (engine.play?.() ?? v.play?.());
        console.log("Muted fallback play succeeded");
      } catch (mutedErr: any) {
        console.error("Muted fallback failed:", mutedErr?.name, mutedErr?.message);
      }
    }

    window.setTimeout(() => v.removeEventListener("playing", onPlaying), 2500);
    return { resolved, usedMutedFallback };
  }, [engine, videoRef, onDispatch, onAutoplayMuted]);

  const resumeMainAfterAd = React.useCallback(
    async (reason: "ads_resume" | "ads_skip" | "ads_error") => {
      setAdActive(false);
      adActiveRef.current = false;

      try {
        const guard = adPlaybackGuardRef.current;
        const main = videoRef.current;
        if (guard && main) main.removeEventListener("play", guard);
      } catch {}
      adPlaybackGuardRef.current = null;

      restoreMediaSettingsAfterAds();

      const shouldResume = wasPlayingBeforeAdRef.current || autoplayMode === "on" || autoplayMode === "smart";
      wasPlayingBeforeAdRef.current = false;

      if (shouldResume) {
        const res = await tryPlayWithEventDispatch();
        if (!res?.resolved) {
          try {
            await (engine.play?.() ?? videoRef.current?.play?.());
            onDispatch("play");
          } catch {}
        }
        scheduleStallWatch(reason);
      }
    },
    [restoreMediaSettingsAfterAds, tryPlayWithEventDispatch, scheduleStallWatch, autoplayMode, engine, videoRef, onDispatch]
  );

  // ---------- stable schedule ----------

  const [stableSchedule, setStableSchedule] = React.useState<{ breaks: any[] } | undefined>(undefined);

  React.useEffect(() => {
    const s = source.ads?.schedule;
    if (!s) {
      setStableSchedule(undefined);
      return;
    }

    const breaks: any[] = [];
    if (s.prerollTag && !prerollServedRef.current) breaks.push({ id: "preroll", kind: "preroll", vastTagUrl: s.prerollTag });
    (s.midrolls ?? []).forEach((m: any, i: number) => breaks.push({ id: `mid_${i}`, kind: "midroll", timeOffsetSec: m.at, vastTagUrl: m.tag }));
    if (s.postrollTag) breaks.push({ id: "postroll", kind: "postroll", vastTagUrl: s.postrollTag });

    setStableSchedule({ breaks });
  }, [source.id, source.ads]);

  const ads = useAdManager(adVideoRef as any, {
    schedule: stableSchedule,
    vmapUrl: source.ads?.vmapUrl,
    durationProvider: () => engine.getDuration?.() ?? duration,
    timeProvider: () => engine.getCurrentTime?.() ?? currentTime,
    onPauseMain: () => {
      const wasPreroll = adsPrerollPendingRef.current === true;
      wasPlayingBeforeAdRef.current = true;
      adsPrerollPendingRef.current = false;
      if (wasPreroll) prerollServedRef.current = true;

      try {
        engine.pause?.();
      } catch {}
      try {
        videoRef.current?.pause?.();
      } catch {}

      setAdActive(true);
      adActiveRef.current = true;

      try {
        const guard = () => {
          if (adActiveRef.current) {
            try {
              videoRef.current?.pause?.();
            } catch {}
          }
        };
        adPlaybackGuardRef.current = guard;
        videoRef.current?.addEventListener("play", guard);
      } catch {}
    },
    onResumeMain: () => {
      void resumeMainAfterAd("ads_resume");
    },
    analyticsEmit: (e: any) => analytics.emit(e),
  });

  React.useEffect(() => {
    adsRef.current = ads;
  }, [ads]);

  // ---------- FULL RESET on source change ----------
  React.useEffect(() => {
    // 1) reset ad manager internals
    try {
      const mgr: any = adsRef.current;
      mgr?.hardReset?.();
    } catch {}

    // 2) reset flags
    setAdActive(false);
    adActiveRef.current = false;
    wasPlayingBeforeAdRef.current = false;
    adsPrerollPendingRef.current = hasPreroll;
    prerollServedRef.current = false;

    // 3) remove guard
    try {
      const guard = adPlaybackGuardRef.current;
      const main = videoRef.current;
      if (guard && main) main.removeEventListener("play", guard);
    } catch {}
    adPlaybackGuardRef.current = null;

    // 4) hard-stop ad element itself
    try {
      const adEl = adVideoRef.current;
      if (adEl) {
        adEl.pause();
        adEl.removeAttribute("src");
        adEl.load();
      }
    } catch {}

    // 5) KILL ALL other media except the new main content video
    killAllMedia(videoRef.current || null);
  }, [source.id, hasPreroll, videoRef, adVideoRef]);

  // ad events → resume main (kept for future, safe noop if ads has no .on)
  React.useEffect(() => {
    const a: any = ads as any;
    const offSkipped = a?.on?.("ad_skipped", () => void resumeMainAfterAd("ads_skip"));
    const offEnded = a?.on?.("ad_break_ended", () => void resumeMainAfterAd("ads_resume"));
    const offError = a?.on?.("ad_error", () => void resumeMainAfterAd("ads_error"));
    return () => {
      try {
        offSkipped?.();
        offEnded?.();
        offError?.();
      } catch {}
    };
  }, [ads, resumeMainAfterAd]);

  // fallback: ad <video> ends → resume main
  React.useEffect(() => {
    const el = adVideoRef.current;
    if (!el) return;
    const onEnded = () => {
      if (adActiveRef.current) void resumeMainAfterAd("ads_resume");
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [adVideoRef, resumeMainAfterAd]);

  // --- CONFLICT GUARD: if main + ad play together (e.g. on back), kill the ad ---
  React.useEffect(() => {
    const stopAdKeepMain = () => {
      const main = videoRef.current;
      const ad = adVideoRef.current;
      if (!main || !ad) return;

      // Reset ad manager so it stops scheduling anything
      try {
        const mgr: any = adsRef.current;
        mgr?.hardReset?.();
      } catch {}

      // Stop & clear ad element
      try {
        ad.pause();
        ad.removeAttribute("src");
        ad.load();
      } catch {}

      // Remove play-guard on main
      try {
        const guard = adPlaybackGuardRef.current;
        if (guard && main) main.removeEventListener("play", guard);
      } catch {}
      adPlaybackGuardRef.current = null;

      // Mark ads inactive – we intentionally dismiss this ad
      adActiveRef.current = false;
      setAdActive(false);
    };

    const id = window.setInterval(() => {
      const main = videoRef.current;
      const ad = adVideoRef.current;
      if (!main || !ad) return;

      const mainPlaying = !main.paused && !main.ended && (main.readyState ?? 0) >= 2;
      const adPlaying = !ad.paused && !ad.ended && (ad.readyState ?? 0) >= 2;

      // This state should NEVER happen normally (preroll must pause main),
      // so if we see it, we aggressively drop the ad and keep content.
      if (mainPlaying && adPlaying) {
        stopAdKeepMain();
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [videoRef, adVideoRef]);

  // ad markers from schedule (for UI)
  const adMarkers = React.useMemo(() => {
    const arr: { at: number }[] = [];
    const s = source.ads?.schedule;
    if (s) {
      if (s.prerollTag && !prerollServedRef.current) arr.push({ at: 0 });
      (s.midrolls ?? []).forEach((m: any) => arr.push({ at: m.at ?? 0 }));
    }
    return arr.sort((a, b) => a.at - b.at);
  }, [source.ads]);

  // prime helper for resume
  const tryPrimeAt = React.useCallback(
    async (targ: number) => {
      engine.pause?.();
      videoRef.current?.pause?.();
      engine.setLevel?.("auto" as any);
      engine.seekTo?.(targ);
      const start = Date.now();
      while (Date.now() - start < 3500 && bufferedAhead(videoRef.current!, targ) < 1 && (videoRef.current?.readyState ?? 0) < 3) {
        await new Promise((r) => setTimeout(r, 140));
      }
      return bufferedAhead(videoRef.current!, targ) >= 0.5 || (videoRef.current?.readyState ?? 0) >= 3;
    },
    [engine, videoRef]
  );

  // ---------- Gated play with stale-ad protection ----------

  const gatedPlay = React.useCallback(async (): Promise<boolean> => {
    const v = videoRef.current;
    if (!v) return false;

    // If we *think* an ad is active, verify it's really playing.
    if (adActiveRef.current) {
      const adEl = adVideoRef.current;
      const adIsReal = adEl && !adEl.paused && !adEl.ended && (adEl.readyState ?? 0) >= 2;

      if (!adIsReal) {
        // Stale ghost state (e.g. from previous page) → nuke it.
        adActiveRef.current = false;
        setAdActive(false);
        try {
          const guard = adPlaybackGuardRef.current;
          if (guard && v) v.removeEventListener("play", guard);
        } catch {}
        adPlaybackGuardRef.current = null;
      } else {
        // Real ad → remember desired play and bail
        wasPlayingBeforeAdRef.current = true;
        return false;
      }
    }

    // Already playing → done
    if (!v.paused && !v.ended) {
      onDispatch("play");
      return true;
    }

    // If preroll pending, do a silent prime for autoplay policy, but still try to play.
    if (adsPrerollPendingRef.current) {
      wasPlayingBeforeAdRef.current = true;
      try {
        const prevMuted = v.muted;
        const prevVol = v.volume;
        v.muted = true;
        engine.setMuted?.(true);
        v.volume = 0;
        engine.setVolume?.(0);
        try {
          await (engine.play?.() ?? v.play?.());
        } catch {}
        setTimeout(() => {
          try {
            v.pause();
          } catch {}
        }, 0);
        v.muted = prevMuted;
        v.volume = prevVol;
      } catch {}
      // fall through to tryPlayWithEventDispatch()
    }

    await tryPlayWithEventDispatch();
    return true;
  }, [engine, tryPlayWithEventDispatch, videoRef, onDispatch, adVideoRef]);

  // --- On unmount: HARD RESET + kill ALL media on page ---
  React.useEffect(() => {
    return () => {
      try {
        const mgr: any = adsRef.current;
        mgr?.hardReset?.();
      } catch {}

      adActiveRef.current = false;
      setAdActive(false);
      wasPlayingBeforeAdRef.current = false;
      adsPrerollPendingRef.current = false;
      prerollServedRef.current = false;

      try {
        const guard = adPlaybackGuardRef.current;
        const main = videoRef.current;
        if (guard && main) main.removeEventListener("play", guard);
      } catch {}
      adPlaybackGuardRef.current = null;

      try {
        const adEl = adVideoRef.current;
        if (adEl) {
          adEl.pause();
          adEl.removeAttribute("src");
          adEl.load();
        }
      } catch {}

      try {
        const main = videoRef.current;
        if (main) {
          main.pause();
        }
      } catch {}

      // HERE: make sure no ad sound survives when leaving the page
      killAllMedia();
    };
  }, [videoRef, adVideoRef]);

  return { ads, adActive, adActiveRef, adMarkers, gatedPlay, tryPlayWithEventDispatch, tryPrimeAt };
}
