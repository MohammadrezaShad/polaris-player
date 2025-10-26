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

export function useAdsAutoplayResume(params: { engine: any; source: any; analytics: any; duration: number; currentTime: number; videoRef: React.RefObject<HTMLVideoElement>; adVideoRef: React.RefObject<HTMLVideoElement>; autoplayMode: "off" | "on" | "smart"; onDispatch: (type: "play" | "pause") => void; scheduleStallWatch: (reason: string) => void; onAutoplayMuted?: () => void }) {
  const { engine, source, analytics, duration, currentTime, videoRef, adVideoRef, autoplayMode, onDispatch, scheduleStallWatch, onAutoplayMuted } = params;

  const [adActive, setAdActive] = React.useState(false);
  const adActiveRef = React.useRef(false);
  React.useEffect(() => {
    adActiveRef.current = adActive;
  }, [adActive]);

  // preroll flags
  const hasPreroll = React.useMemo(() => {
    const s = source.ads?.schedule;
    return Boolean((s && s.prerollTag) || source.ads?.vmapUrl);
  }, [source.ads]);
  const adsPrerollPendingRef = React.useRef<boolean>(false);
  const prerollServedRef = React.useRef<boolean>(false);
  const wasPlayingBeforeAdRef = React.useRef(false);

  React.useEffect(() => {
    adsPrerollPendingRef.current = hasPreroll;
    prerollServedRef.current = false;
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

    console.log("Attempting play with current audio settings");

    const onPlaying = () => {
      resolved = true;
      onDispatch("play");
      // Only show hint if we force-muted due to fallback (avoids hint if user-prefs are muted)
      if (usedMutedFallback) {
        setTimeout(() => {
          if (v.muted) onAutoplayMuted?.(); // Show unmute hint
        }, 60);
      }
    };
    v.addEventListener("playing", onPlaying, { once: true });

    try {
      await (engine.play?.() ?? v.play?.());
      console.log("Play succeeded with current settings");
    } catch (err: any) {
      console.error("Initial play failed:", err.name, err.message);
      // Fallback: Force muted only if initial fails (policy block)
      try {
        engine.setMuted?.(true);
        v.muted = true;
        usedMutedFallback = true;
        await (engine.play?.() ?? v.play?.());
        console.log("Muted fallback play succeeded");
      } catch (mutedErr: any) {
        console.error("Muted fallback failed:", mutedErr.name, mutedErr.message);
        // Optional: Set state for "tap to play" overlay here if needed
      }
    }

    window.setTimeout(() => v.removeEventListener("playing", onPlaying), 2500);
    return { resolved, usedMutedFallback };
  }, [engine, videoRef, onDispatch, onAutoplayMuted]);

  const gatedPlay = React.useCallback(async (): Promise<boolean> => {
    const v = videoRef.current;
    if (!v) return false;
    if (adActive || adActiveRef.current) {
      wasPlayingBeforeAdRef.current = true;
      return false;
    }
    if (adsPrerollPendingRef.current) {
      wasPlayingBeforeAdRef.current = true;
      try {
        const prevMuted = v.muted,
          prevVol = v.volume;
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
      return false;
    }
    await tryPlayWithEventDispatch();
    return true;
  }, [adActive, engine, tryPlayWithEventDispatch, videoRef]);

  const resumeMainAfterAd = React.useCallback(
    async (reason: "ads_resume" | "ads_skip" | "ads_error") => {
      setAdActive(false);
      try {
        if (adPlaybackGuardRef.current) videoRef.current?.removeEventListener("play", adPlaybackGuardRef.current);
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

  // stable schedule
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

  // ad events to resume
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

  // fallback: ad <video> ends
  React.useEffect(() => {
    const el = adVideoRef.current;
    if (!el) return;
    const onEnded = () => {
      if (adActiveRef.current) void resumeMainAfterAd("ads_resume");
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [adVideoRef, resumeMainAfterAd]);

  // ad markers from schedule
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

  return { ads, adActive, adActiveRef, adMarkers, gatedPlay, tryPlayWithEventDispatch, tryPrimeAt };
}
