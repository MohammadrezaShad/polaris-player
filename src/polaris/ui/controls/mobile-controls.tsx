/** src/player/ui/controls/mobile-controls.tsx
 * ≤500px: Full-player overlay (outside slider) with single time bar over image.
 * >500px: Regular compact tooltip inside the slider (ControlsBar parity).
 * Slider is ALWAYS above tooltip (higher z-index).
 */
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Slider } from '../../../vendor/ui/slider';
import { Settings, Maximize2, Minimize2, Pause, Play, PictureInPicture2 } from 'lucide-react';

import { BufferedBar } from '../overlays/buffered-bar';
import { formatTime } from '../utils/time';
import { useI18n } from '../../providers/i18n/i18n';
import { ControlIconButton } from '../components/control-icon-button';

const TimelineTooltip = dynamic(() => import('../overlays/timeline-tooltip'), { ssr: false });

type BufferedRange = { start: number; end: number };

type HoverState = {
  hoverRatio: number | null;
  hoverTime: number | null;
  hoverW: number;
  hoverX: number;
  sprite?: any;
};

type Props = {
  controlsVisible: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;

  onToggleControls: () => void;

  adActive?: boolean;

  // timeline
  seekbarRef: React.RefObject<HTMLDivElement>;
  sliderMax: number;
  buffered: BufferedRange[];

  hoverState?: HoverState;
  onSeekbarMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekbarLeave?: () => void;

  currentTime: number;
  scrub: number | null;
  onSeekChange: (value: number[]) => void;
  onSeekCommit: (value: number[]) => void;

  updateFromRatio?: (ratio01: number, containerW: number, anchorX: number) => void;

  // playback
  playing: boolean;
  onTogglePlay: () => void;

  // misc
  duration: number;
  onTogglePiP: () => void;
  onToggleFullscreen: () => void;
  fsActive: boolean;

  // settings
  onOpenSettings: () => void;
  settingsBtnRef: React.RefObject<HTMLButtonElement>;

  castAvailable?: boolean;
  onCastClick?: () => void;
  airplayAvailable?: boolean;
  onAirplayClick?: () => void;

  isLoading?: boolean;

  /** Kept for API parity; ignored in this version (we use pointer-arming instead). */
  revealGuardUntil?: number;
};

const WIDE_BREAKPOINT = 500;

export function MobileControls({
  controlsVisible,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onToggleControls,
  adActive = false,
  seekbarRef,
  sliderMax,
  buffered,
  onSeekbarMouseMove,
  onSeekbarLeave,
  hoverState,
  currentTime,
  scrub,
  onSeekChange,
  onSeekCommit,
  updateFromRatio,
  playing,
  onTogglePlay,
  duration,
  onTogglePiP,
  onToggleFullscreen,
  fsActive,
  onOpenSettings,
  settingsBtnRef,
  castAvailable = false,
  onCastClick,
  airplayAvailable = false,
  onAirplayClick,
  isLoading = false,
}: Props) {
  const { t, dir } = useI18n?.() ?? { t: (k: string) => k, dir: 'ltr' as const };

  const timeNow = scrub ?? currentTime;
  const max = Number.isFinite(sliderMax) && sliderMax > 0 ? sliderMax : 0;

  // Refs
  const sliderContainerRef = React.useRef<HTMLDivElement | null>(null);
  const playerRef = React.useRef<HTMLElement | null>(null);

  // Live dimensions (kept in state so layout updates respond to rotation/resize)
  const [playerW, setPlayerW] = React.useState(0);
  const [sliderW, setSliderW] = React.useState(0);

  // Measure function
  const measure = React.useCallback(() => {
    const sliderEl = sliderContainerRef.current;
    if (!sliderEl) return;

    const playerEl = sliderEl.closest('.player-v2') as HTMLElement | null;
    playerRef.current = playerEl ?? null;

    const pRect = playerEl?.getBoundingClientRect();
    const sRect = sliderEl.getBoundingClientRect();

    setPlayerW(Math.max(0, pRect?.width ?? sRect.width ?? 0));
    setSliderW(Math.max(0, sRect.width ?? 0));
  }, []);

  // Keep measurements fresh with ResizeObserver (plus window fallback)
  React.useEffect(() => {
    measure();
    const sliderEl = sliderContainerRef.current;
    const playerEl = sliderEl?.closest('.player-v2') as HTMLElement | null;

    const roSupported = typeof window !== 'undefined' && 'ResizeObserver' in window;
    let ro1: ResizeObserver | null = null;
    let ro2: ResizeObserver | null = null;

    if (roSupported) {
      if (playerEl) {
        ro1 = new ResizeObserver(measure);
        ro1.observe(playerEl);
      }
      if (sliderEl) {
        ro2 = new ResizeObserver(measure);
        ro2.observe(sliderEl);
      }
    } else {
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', measure as any);
    }

    return () => {
      if (ro1) ro1.disconnect();
      if (ro2) ro2.disconnect();
      if (!roSupported) {
        window.removeEventListener('resize', measure);
        window.removeEventListener('orientationchange', measure as any);
      }
    };
  }, [measure]);

  // Wide/narrow switch
  const isWide = playerW > WIDE_BREAKPOINT;

  // Anchors
  const ratio =
    hoverState?.hoverRatio ?? (hoverState && hoverState.hoverW > 0 ? hoverState.hoverX / hoverState.hoverW : 0);
  const safeR = Math.max(0, Math.min(1, Number.isFinite(ratio as number) ? (ratio as number) : 0));

  const playerAnchorX = Math.max(0, Math.min(playerW, safeR * playerW));
  const sliderAnchorX = Math.max(0, Math.min(sliderW, safeR * sliderW));

  // Tooltip visibility — gate by controlsVisible so they never show when hidden
  const showTooltipNarrow = controlsVisible && hoverState && hoverState.hoverTime !== null && !adActive && !isWide;
  const showTooltipWide = controlsVisible && hoverState && hoverState.hoverTime !== null && !adActive && isWide;

  // ─────────────────────────────────────────────────────────────────────────────
  // Pointerdown arming (ref-based, synchronous)
  // ─────────────────────────────────────────────────────────────────────────────
  const armedRef = React.useRef(false);

  React.useEffect(() => {
    if (controlsVisible) armedRef.current = false; // disarm on every show
  }, [controlsVisible]);

  // Guard helper reads the ref synchronously
  const guard =
    <E extends { preventDefault(): void; stopPropagation(): void }>(fn?: () => void) =>
    (e: E) => {
      e.preventDefault();
      e.stopPropagation();
      if (!controlsVisible || adActive || !armedRef.current) return;
      fn?.();
    };

  // Slider handlers that drive the preview on mobile
  const handleSeekChange = (vals: number[]) => {
    if (!controlsVisible || !armedRef.current) return;
    onSeekChange(vals);
    if (!updateFromRatio || !Number.isFinite(sliderMax) || sliderMax <= 0) return;

    const v = vals?.[0] ?? 0;
    const r = Math.min(1, Math.max(0, v / sliderMax));

    const w = isWide ? sliderW : playerW;
    if (w <= 0) return;

    updateFromRatio(r, w, r * w);
  };

  const clearPreview = React.useCallback(() => {
    updateFromRatio?.(Number.NaN, 0, 0);
    onSeekbarLeave?.();
  }, [onSeekbarLeave, updateFromRatio]);

  const handleSeekCommit = (vals: number[]) => {
    if (!controlsVisible || !armedRef.current) return;
    onSeekCommit(vals);
    clearPreview();
  };

  // Also clear any lingering preview whenever controls are hidden
  React.useEffect(() => {
    if (!controlsVisible) clearPreview();
  }, [controlsVisible, clearPreview]);

  // Hard-disable slider if hidden / in ad / no input (we also mount-guard anyway)
  const sliderDisabled = !controlsVisible || adActive;

  // If hidden, unmount all controls so no event can land on them
  if (!controlsVisible) {
    return <div className="pointer-events-none absolute inset-0 isolate z-50 select-none" />;
  }

  return (
    // isolate => deterministic stacking; we control z-indexes below
    <div
      className="pointer-events-none absolute inset-0 isolate z-50 select-none"
      // Arm on the first *real* pointerdown that happens after reveal
      onPointerDownCapture={() => {
        if (!armedRef.current) armedRef.current = true;
      }}
      // Swallow the trailing "ghost click" that has no preceding pointerdown
      onClickCapture={(e) => {
        if (!armedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {/* ≤500px: OUTSIDE the slider — full-player overlay, slider will stay above (z) */}
      {showTooltipNarrow && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute inset-x-0 bottom-0">
            <TimelineTooltip
              fullWidth
              anchorX={playerAnchorX}
              containerWidth={playerW}
              timeLabel={formatTime(hoverState!.hoverTime!)}
              sprite={hoverState!.sprite}
              margin={0}
            />
          </div>
        </div>
      )}

      {/* Dim backdrop (tap to toggle controls ONLY, never toggle play) */}
      <div
        className="pointer-events-auto absolute inset-0 opacity-100 transition-opacity duration-200"
        style={{ background: 'rgba(0,0,0,0.25)' }}
        data-controls-root="true"
        onPointerUpCapture={(e) => {
          e.stopPropagation();
          onToggleControls();
        }}
      />

      {/* Top bar */}
      <div
        className="pointer-events-auto absolute top-0 left-0 z-30 opacity-100 transition-opacity duration-200"
        data-controls-root="true"
      >
        <div
          className="pointer-events-auto flex items-center justify-between px-2 pt-2 pb-6"
          onPointerEnter={armedRef.current ? onPointerEnter : undefined}
          onPointerLeave={armedRef.current ? onPointerLeave : undefined}
          onPointerDown={armedRef.current ? onPointerDown : undefined}
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
          dir={dir}
        >
          <div className="w-10" />
          <ControlIconButton
            ref={settingsBtnRef as any}
            aria-haspopup="dialog"
            ariaLabel={t('controls.settings')}
            className="[WebkitTapHighlightColor:transparent] pointer-events-auto h-9 w-9 cursor-pointer [touch-action:manipulation] select-none md:h-11 md:w-11"
            onPointerDownCapture={guard(onOpenSettings)}
            onPointerUpCapture={(e) => e.stopPropagation()}
            onClick={(e) => e.preventDefault()}
          >
            <Settings className="mx-auto h-5 w-5 md:h-6 md:w-6" aria-hidden />
          </ControlIconButton>
        </div>
      </div>

      {/* Center Play/Pause */}
      <div className="pointer-events-auto absolute inset-0 grid place-items-center opacity-100 transition-opacity duration-150">
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-black/40 backdrop-blur"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onPointerUpCapture={(e) => e.stopPropagation()}
          onClick={onTogglePlay}
          aria-label={playing ? t('controls.pause') : t('controls.play')}
          title={playing ? t('controls.pause') : t('controls.play')}
          aria-busy={isLoading || undefined}
        >
          <div className="relative grid h-16 w-16 place-items-center rounded-full bg-white/10">
            {isLoading ? (
              <span
                aria-hidden
                className="h-8 w-8 animate-spin rounded-full border-2 border-white/70 border-r-transparent"
              />
            ) : playing ? (
              <Pause className="h-10 w-10 text-white" />
            ) : (
              <Play className="ml-0.5 h-10 w-10 text-white" />
            )}
          </div>
        </button>
      </div>

      {/* Bottom bar — HIGH z so slider stays above any preview */}
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 translate-y-0 opacity-100 transition-all duration-200"
        data-controls-root="true"
      >
        <div
          className="pointer-events-auto relative z-[800] bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-2"
          onPointerEnter={armedRef.current ? onPointerEnter : undefined}
          onPointerLeave={armedRef.current ? onPointerLeave : undefined}
          onPointerDown={armedRef.current ? onPointerDown : undefined}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)' }}
          dir={dir}
        >
          {/* Row above slider */}
          <div className="mb-2 flex flex-row-reverse items-center justify-between gap-2 text-white">
            {/* Time (always LTR for readability) */}
            <div className="mx-1 text-[11px] tabular-nums opacity-90 md:text-xs" aria-live="polite" dir="ltr">
              <span className="sr-only">{t('a11y.timeNow', { time: formatTime(timeNow) })}</span>
              {formatTime(timeNow)} <span className="opacity-70">/</span>{' '}
              <span className="sr-only">
                {Number.isFinite(duration)
                  ? t('a11y.durationTotal', { time: formatTime(duration) })
                  : t('controls.live')}
              </span>
              {Number.isFinite(duration) ? formatTime(duration) : t('controls.live')}
            </div>

            <div className="flex items-center gap-1.5 md:gap-2.5">
              {/* PiP */}
              <ControlIconButton
                className="h-9 w-9 md:h-11 md:w-11"
                onClick={guard(onTogglePiP)}
                ariaLabel={t('controls.pip')}
                aria-disabled={adActive ? true : undefined}
              >
                <PictureInPicture2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
              </ControlIconButton>

              {/* Cast (optional) */}
              {castAvailable && (
                <ControlIconButton
                  className="h-9 w-9 md:h-11 md:w-11"
                  onClick={guard(onCastClick)}
                  ariaLabel={t('controls.cast') || 'Cast'}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M1,18 L3,18 C4.66,18 6,19.34 6,21 L4,21 C4,20.45 3.55,20 3,20 L1,20 L1,18 Z M1,14 L5,14 C7.76,14 10,16.24 10,19 L8,19 C8,17.34 6.66,16 5,16 L1,16 L1,14 Z M1,10 L7,10 C10.87,10 14,13.13 14,17 L12,17 C12,14.24 9.76,12 7,12 L1,12 L1,10 Z M21,5 L3,5 C1.9,5 1,5.9 1,7 L1,8 L3,8 L3,7 L21,7 L21,17 L16,17 L16,19 L21,19 C22.1,19 23,18.1 23,17 L23,7 C23,5.9 22.1,5 21,5 Z"
                    />
                  </svg>
                </ControlIconButton>
              )}

              {/* AirPlay (optional) */}
              {airplayAvailable && (
                <ControlIconButton
                  className="h-9 w-9 md:h-11 md:w-11"
                  onClick={guard(onAirplayClick)}
                  ariaLabel={t('controls.airplay') || 'AirPlay'}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M6,22 L12,14 L18,22 L6,22 Z M21,3 C22.1,3 23,3.9 23,5 L23,15 C23,16.1 22.1,17 21,17 L17,17 L17,15 L21,15 L21,5 L3,5 L3,15 L7,15 L7,17 L3,17 C1.9,17 1,16.1 1,15 L1,5 C1,3.9 1.9,3 3,3 L21,3 Z"
                    />
                  </svg>
                </ControlIconButton>
              )}

              {/* Fullscreen */}
              <ControlIconButton
                className="h-9 w-9 md:h-11 md:w-11"
                onClick={guard(onToggleFullscreen)}
                ariaLabel={fsActive ? t('controls.exitFullscreen') : t('controls.fullscreen')}
              >
                {fsActive ? (
                  <Minimize2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
                ) : (
                  <Maximize2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
                )}
              </ControlIconButton>
            </div>
          </div>

          {/* Slider block */}
          <div className="px-1">
            <div
              ref={(node) => {
                sliderContainerRef.current = node;
                (seekbarRef as any).current = node;
              }}
              onMouseMove={armedRef.current ? onSeekbarMouseMove : undefined}
              onMouseLeave={() => onSeekbarLeave?.()}
              onPointerLeave={() => onSeekbarLeave?.()}
              onPointerCancel={() => onSeekbarLeave?.()}
              onTouchEnd={() => onSeekbarLeave?.()}
              className="relative"
            >
              {/* >500px: classic tooltip INSIDE the slider wrapper */}
              {showTooltipWide && (
                <div
                  className="pointer-events-none absolute right-0 left-0 z-[650]"
                  style={{ bottom: 'calc(100% + 8px)' }}
                >
                  <TimelineTooltip
                    anchorX={sliderAnchorX}
                    containerWidth={sliderW}
                    timeLabel={formatTime(hoverState!.hoverTime!)}
                    sprite={hoverState!.sprite}
                  />
                </div>
              )}

              {/* buffered background (far back) */}
              <div className="pointer-events-none absolute inset-0 z-0">
                <BufferedBar ranges={buffered} duration={max} />
              </div>

              {/* Slider MUST be topmost */}
              <Slider
                className="relative z-[900] w-full"
                min={0}
                max={max}
                step={0.1}
                value={[Math.min(scrub ?? currentTime, max)]}
                onValueChange={handleSeekChange}
                onValueCommit={handleSeekCommit}
                aria-label={t('controls.seek')}
                disabled={sliderDisabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
