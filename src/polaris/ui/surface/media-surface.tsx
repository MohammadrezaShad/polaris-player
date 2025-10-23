/* eslint-disable react/no-unknown-property */
/** src/player/ui/surface/media-surface.tsx
 * Notes:
 * - Avoids using `ref.current` in dependency arrays to prevent missed updates / loops.
 * - Best-effort "reveal controls" that works even if parent doesn't pass a handler.
 * - Defensive pointer handlers to keep taps from bubbling through overlays/ads.
 * - iOS/Safari: explicitly disables remote playback to reduce AirPlay ghost states.
 */
"use client";
import * as React from "react";
import { AdOverlay } from "../overlays/ad-overlay";
import type { AdState } from "../../ads/types";
import { cn } from "../../../vendor/helpers/cn";

import { useT } from "../../providers/i18n/i18n";
import { PlayPausePulse } from "../overlays/play-pause-pulse";
import { CaptionOverlay, type CaptionStyle } from "../overlays/caption-overlay";
import { LoadingOverlay } from "../overlays/loading-overlay";
import { CenterPlayOverlay } from "../overlays/center-play-overlay";
import { EndedOverlay } from "../overlays/ended-overlay";
import { ErrorOverlay } from "../overlays/error-overlay";

export type Pulse = { kind: "play" | "pause"; key: number };

type CaptionMeta = {
  active: boolean;
  selectedTrackId?: string;
  selectedLang?: string;
  selectedLabel?: string;
  style: CaptionStyle;
  safeBottomPx: number;
};

type MediaSurfaceProps = {
  initialMutedAttr?: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  poster?: string;

  /** True when we're playing AND controls are hidden (used for single-tap gate) */
  hideCursor: boolean;

  onTogglePlay: () => void;

  showLoading: boolean;
  showCenterPlay: boolean;
  showEnded: boolean;
  showError: boolean;
  errorMessage?: string;
  onRetry?: () => void;

  seekBy: (delta: number) => void;
  pulse: Pulse | null;

  caption: CaptionMeta;

  /** Controls layer comes in here */
  children?: React.ReactNode;

  /** Ads wiring */
  ads: {
    state: AdState;
    clickThrough: () => void;
    skip: () => void;
    notifyEnded: () => void;
    iconClick: (iconIdx: number) => void;
  };
  adActive?: boolean;
  adVideoRef?: React.RefObject<HTMLVideoElement>;
  className?: string;
  isMobileResolved?: boolean;
  /** Optional: if provided, used to explicitly reveal controls on first tap */
  onRevealControls?: () => void;
};

export function MediaSurface({ videoRef, poster, hideCursor, onTogglePlay, showLoading, initialMutedAttr, showCenterPlay, showEnded, showError, errorMessage, onRetry, isMobileResolved, pulse, caption, children, ads, adActive = false, adVideoRef, onRevealControls, className }: MediaSurfaceProps) {
  const t = useT();

  // Prevent a quick second tap from toggling play immediately after we just revealed controls.
  const tapGuardUntilRef = React.useRef(0);

  // --- Ad mute sync ---
  const [adMuted, setAdMuted] = React.useState<boolean>(() => !!adVideoRef?.current?.muted);
  React.useEffect(() => {
    const v = adVideoRef?.current;
    if (!v) return;
    const onVol = () => setAdMuted(!!v.muted);
    v.addEventListener("volumechange", onVol);
    // initialize
    setAdMuted(!!v.muted);
    return () => v.removeEventListener("volumechange", onVol);
  }, [adVideoRef]);

  const toggleAdMute = React.useCallback(() => {
    const v = adVideoRef?.current;
    if (!v) return;
    try {
      v.muted = !v.muted;
      setAdMuted(!!v.muted);
    } catch {
      /* noop */
    }
  }, [adVideoRef]);

  // Reveal controls helper
  const revealControls = React.useCallback(() => {
    if (onRevealControls) {
      onRevealControls();
      return;
    }
    const el = videoRef.current?.closest(".player-v2") ?? videoRef.current?.parentElement ?? (videoRef.current as HTMLElement | null);

    if (!el) return;

    try {
      el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 0, clientY: 0 }));
    } catch {
      el.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 0, clientY: 0 }));
    }
  }, [onRevealControls, videoRef]);

  // Single-tap behavior
  const handleSurfacePointerUp = (e: React.PointerEvent<HTMLVideoElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (adActive) return;

    const now = performance.now();

    if (hideCursor) {
      revealControls();
      tapGuardUntilRef.current = now + 350;
      return;
    }

    if (now < tapGuardUntilRef.current) return;

    onTogglePlay();
  };

  // Prevent iOS/Safari remote playback & hand-off (AirPlay ghost state)
  React.useEffect(() => {
    const main = videoRef.current;
    const ad = adVideoRef?.current;
    try {
      if (main) {
        (main as any).disableRemotePlayback = true;
        main.setAttribute("disableRemotePlayback", "");
      }
      if (ad) {
        (ad as any).disableRemotePlayback = true;
        ad.setAttribute("disableRemotePlayback", "");
      }
    } catch {
      /* best-effort */
    }
  }, [videoRef, adVideoRef]);

  return (
    <div className={cn("relative aspect-video h-full w-full bg-black", className)}>
      {/* Main content video */}
      <video
        ref={videoRef}
        muted={initialMutedAttr ?? false}
        poster={poster}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        crossOrigin="anonymous"
        preload="metadata"
        className={"h-full w-full object-contain " + (hideCursor ? "cursor-none" : "cursor-auto")}
        onPointerUp={handleSurfacePointerUp}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        aria-label="Video"
      />

      {/* Play/Pause pulse */}
      {adActive || isMobileResolved ? null : <PlayPausePulse kind={pulse?.kind ?? "play"} visible={!!pulse} />}

      {/* Ad video sits above content, below overlays */}
      <video ref={adVideoRef} className={"absolute inset-0 z-[45] h-full w-full object-cover " + (adActive ? "block" : "hidden")} playsInline preload="auto" crossOrigin="anonymous" aria-label="Advertisement" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => e.preventDefault()} />

      {/* Ad overlay (skip + countdown + mute + clickthrough) */}
      {adActive && ads.state.phase === "playing" && <AdOverlay remainingSec={ads.state.remainingSec} skipCountdownSec={ads.state.skipCountdownSec} canSkip={ads.state.canSkip} muted={adMuted} onToggleMute={toggleAdMute} onSkip={() => ads.skip()} onClickThrough={() => ads.clickThrough()} icons={(ads.state as any).icons ?? []} onIconClick={(idx) => ads.iconClick?.(idx)} />}

      {/* Custom captions (hidden during ads) */}
      {!adActive && <CaptionOverlay video={videoRef.current} active={caption.active} selectedTrackId={caption.selectedTrackId} selectedLang={caption.selectedLang} selectedLabel={caption.selectedLabel} style={caption.style} safeBottomPx={caption.safeBottomPx} />}

      {/* Core overlays (hidden during ads to avoid overlap) */}
      {!adActive && showLoading && !isMobileResolved && <LoadingOverlay />}
      {!adActive && !showLoading && showCenterPlay && !isMobileResolved && <CenterPlayOverlay onPlay={onTogglePlay} />}
      {!adActive && showEnded && !isMobileResolved && <EndedOverlay onReplay={onTogglePlay} />}
      {!adActive && showError && <ErrorOverlay message={errorMessage ?? t("overlays.errorGeneric")} onRetry={onRetry} />}

      {/* Controls layer from parent */}
      {children}
    </div>
  );
}
