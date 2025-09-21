/** src/player/ui/controls/controls-bar.tsx */
'use client';
import * as React from 'react';
import { Slider } from '../../../vendor/ui/slider';
import { Play, Pause, Volume2, VolumeX, Settings, Maximize2, Minimize2, PictureInPicture2 } from 'lucide-react';
import { cn } from '../../../vendor/helpers/cn';
import dynamic from 'next/dynamic';

import { ControlIconButton } from '../components/control-icon-button';
import { BufferedBar } from '../overlays/buffered-bar';
import { useT, useI18n } from '../../providers/i18n/i18n';
import { formatTime } from '../utils/time';
const TimelineTooltip = dynamic(() => import('../overlays/timeline-tooltip'), { ssr: false });

type Sprite = {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  naturalW?: number;
  naturalH?: number;
  isPercent?: boolean;
};
type HoverState = {
  hoverRatio: number | null;
  hoverTime: number | null;
  hoverW: number;
  hoverX: number;
  sprite?: Sprite;
};

type ControlsBarProps = {
  chapterTicks?: { at: number; title?: string }[];
  adMarkers?: { at: number }[];
  liveBadge?: React.ReactNode;

  castAvailable?: boolean;
  onCastClick?: () => void;
  airplayAvailable?: boolean;
  onAirplayClick?: () => void;

  controlsVisible: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;

  adActive?: boolean;

  seekbarRef: React.RefObject<HTMLDivElement>;
  sliderMax: number;
  buffered: { start: number; end: number }[];
  hoverState: HoverState;
  onSeekbarMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekbarLeave: () => void;
  currentTime: number;
  scrub: number | null;
  onSeekChange: (v: number[]) => void;
  onSeekCommit: (v: number[]) => void;

  playing: boolean;
  onTogglePlay: () => void;

  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (v01: number) => void;
  onVolumeCommit: () => void;
  unmuteChip?: { show: boolean; onClick: () => void };

  duration: number;
  onTogglePiP: () => void;
  onToggleFullscreen: () => void;
  fsActive: boolean;

  onOpenSettings: () => void;
  settingsBtnRef: React.RefObject<HTMLButtonElement>;
};

export function ControlsBar(props: ControlsBarProps) {
  const t = useT();
  const { announce, dir } = useI18n();
  const {
    chapterTicks,
    adMarkers,
    liveBadge,
    controlsVisible,
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
    seekbarRef,
    sliderMax,
    buffered,
    hoverState,
    onSeekbarMouseMove,
    onSeekbarLeave,
    currentTime,
    scrub,
    onSeekChange,
    onSeekCommit,
    playing,
    onTogglePlay,
    muted,
    volume,
    onToggleMute,
    onVolumeChange,
    onVolumeCommit,
    unmuteChip,
    duration,
    onTogglePiP,
    onToggleFullscreen,
    fsActive,
    onOpenSettings,
    settingsBtnRef,
    adActive,
    castAvailable,
    onCastClick,
    airplayAvailable,
    onAirplayClick,
  } = props;

  const safeMax = Number.isFinite(sliderMax) && sliderMax > 0 ? sliderMax : 0;
  const safeNow = Math.min(scrub ?? currentTime, safeMax);
  const safePercent = React.useCallback(
    (at: number) => (Number.isFinite(sliderMax) && sliderMax > 0 ? (at / sliderMax) * 100 : 0),
    [sliderMax],
  );

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-30 transition-all duration-200',
        controlsVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        adActive && 'hidden',
      )}
    >
      <div
        data-role="controls"
        className="pointer-events-auto bg-gradient-to-t from-black/70 to-black/0 px-2 pt-8 pb-2 md:px-3 md:pt-10 md:pb-3"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
      >
        {/* Timeline */}
        <div className="mb-1.5 px-1 md:mb-2">
          <div ref={seekbarRef} onMouseMove={onSeekbarMouseMove} onMouseLeave={onSeekbarLeave} className="relative">
            {/* Buffered background layer */}
            <div className="pointer-events-none absolute inset-0 z-0">
              <BufferedBar ranges={buffered} duration={safeMax} />
            </div>

            {/* Tooltip on top */}
            {hoverState.hoverRatio !== null &&
              hoverState.hoverTime !== null &&
              Number.isFinite(sliderMax) &&
              hoverState.hoverW > 0 && (
                <div className="relative z-30">
                  <TimelineTooltip
                    anchorX={hoverState.hoverX}
                    containerWidth={hoverState.hoverW}
                    timeLabel={formatTime(hoverState.hoverTime)}
                    sprite={hoverState.sprite}
                    margin={8}
                  />
                </div>
              )}

            {/* Ticks mid-layer */}
            {/* <div className="pointer-events-none relative z-10 h-3 w-full">
              {chapterTicks?.map((t, i) => (
                <div
                  key={`ch-${i}`}
                  className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white/50"
                  style={{ left: `${safePercent(t.at)}%` }}
                  title={t.title}
                />
              ))}
              {adMarkers?.map((t, i) => (
                <div
                  key={`ad-${i}`}
                  className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-red-500/70"
                  style={{ left: `${safePercent(t.at)}%` }}
                />
              ))}
            </div> */}

            {/* Slider foreground */}
            <Slider
              className="relative z-20 w-full"
              min={0}
              max={safeMax}
              step={0.1}
              value={[safeNow]}
              onValueChange={onSeekChange}
              onValueCommit={onSeekCommit}
              aria-label={t('controls.seek')}
              aria-valuemin={0}
              aria-valuemax={safeMax}
              aria-valuenow={safeNow}
              aria-valuetext={formatTime(safeNow)}
              disabled={adActive}
              aria-disabled={adActive ? true : undefined}
            />
          </div>
        </div>

        {/* Bottom row */}
        <div className={cn('flex items-center gap-1.5 text-white md:gap-2.5', dir === 'rtl' && 'flex-row-reverse')}>
          <ControlIconButton
            onClick={() => {
              announce(playing ? t('controls.pause') : t('controls.play'));
              onTogglePlay();
            }}
            ariaLabel={playing ? t('controls.pause') : t('controls.play')}
            className="h-9 w-9 md:h-11 md:w-11"
          >
            {playing ? (
              // was h-6 w-6 md:h-5 md:w-5
              <Pause className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
            ) : (
              <Play className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
            )}
          </ControlIconButton>

          <ControlIconButton
            className="h-9 w-9 md:h-11 md:w-11"
            onClick={() => {
              announce(muted ? t('controls.unmute') : t('controls.mute'));
              onToggleMute();
            }}
            ariaLabel={muted ? t('controls.unmute') : t('controls.mute')}
            pressed={muted}
          >
            {muted ? (
              <VolumeX className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
            ) : (
              <Volume2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
            )}
          </ControlIconButton>

          {/* volume slider already hidden on mobile */}
          <div className="hidden w-32 items-center md:flex">
            <Slider
              className="w-full"
              min={0}
              max={100}
              step={1}
              value={[Math.round((muted ? 0 : volume) * 100)]}
              onValueChange={(v) => onVolumeChange((v[0] ?? 100) / 100)}
              onValueCommit={onVolumeCommit}
              aria-label={t('controls.volume')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
              aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
            />
          </div>

          {unmuteChip?.show && (
            <button
              type="button"
              onClick={unmuteChip.onClick}
              className="ml-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white backdrop-blur hover:bg-white/20 md:ml-2"
              aria-label={t('controls.tapToUnmute')}
            >
              {t('controls.tapToUnmute')}
            </button>
          )}

          <div className="mx-1 text-[11px] tabular-nums opacity-90 md:mx-2 md:text-xs" aria-live="polite" dir="ltr">
            <span className="sr-only">{t('a11y.timeNow', { time: formatTime(scrub ?? currentTime) })}</span>
            {formatTime(scrub ?? currentTime)} / {/* SR */}
            <span className="sr-only">
              {Number.isFinite(duration) ? t('a11y.durationTotal', { time: formatTime(duration) }) : t('controls.live')}
            </span>
            {Number.isFinite(duration) ? formatTime(duration) : t('controls.live')}
          </div>
          <div className="ml-auto flex items-center gap-1.5 md:gap-2.5">
            <ControlIconButton
              onClick={() => {
                announce(fsActive ? t('controls.exitFullscreen') : t('controls.fullscreen'));
                onToggleFullscreen();
              }}
              ariaLabel={fsActive ? t('controls.exitFullscreen') : t('controls.fullscreen')}
              className="h-9 w-9 md:h-11 md:w-11"
            >
              {fsActive ? (
                <Minimize2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
              ) : (
                <Maximize2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
              )}
            </ControlIconButton>
            <ControlIconButton
              className="h-9 w-9 md:h-11 md:w-11"
              onClick={() => {
                if (adActive) return;
                onTogglePiP();
              }}
              ariaLabel={t('controls.pip')}
              aria-disabled={adActive ? true : undefined}
            >
              <PictureInPicture2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
            </ControlIconButton>

            {castAvailable && (
              <ControlIconButton
                className="h-9 w-9 md:h-11 md:w-11"
                onClick={onCastClick!}
                ariaLabel={t('controls.cast')}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M1,18 L3,18 C4.66,18 6,19.34 6,21 L4,21 C4,20.45 3.55,20 3,20 L1,20 L1,18 Z M1,14 L5,14 C7.76,14 10,16.24 10,19 L8,19 C8,17.34 6.66,16 5,16 L1,16 L1,14 Z M1,10 L7,10 C10.87,10 14,13.13 14,17 L12,17 C12,14.24 9.76,12 7,12 L1,12 L1,10 Z M21,5 L3,5 C1.9,5 1,5.9 1,7 L1,8 L3,8 L3,7 L21,7 L21,17 L16,17 L16,19 L21,19 C22.1,19 23,18.1 23,17 L23,7 C23,5.9 22.1,5 21,5 Z"
                  />
                </svg>
              </ControlIconButton>
            )}

            {airplayAvailable && (
              <ControlIconButton
                className="h-9 w-9 md:h-11 md:w-11"
                onClick={onAirplayClick!}
                ariaLabel={t('controls.airplay')}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M6,22 L12,14 L18,22 L6,22 Z M21,3 C22.1,3 23,3.9 23,5 L23,15 C23,16.1 22.1,17 21,17 L17,17 L17,15 L21,15 L21,5 L3,5 L3,15 L7,15 L7,17 L3,17 C1.9,17 1,16.1 1,15 L1,5 C1,3.9 1.9,3 3,3 L21,3 Z"
                  />
                </svg>
              </ControlIconButton>
            )}
            <ControlIconButton
              ref={settingsBtnRef as any}
              data-settings-trigger
              aria-haspopup="dialog"
              ariaLabel={t('controls.settings')}
              className="[WebkitTapHighlightColor:transparent] pointer-events-auto h-9 w-9 cursor-pointer [touch-action:manipulation] select-none [user-select:none] md:h-11 md:w-11"
              onPointerDownCapture={(e) => {
                if (adActive) return;
                e.preventDefault();
                e.stopPropagation();
                onOpenSettings(); // open immediately
              }}
              onPointerUpCapture={(e) => e.stopPropagation()}
              onClick={(e) => e.preventDefault()} // never rely on click on touch
            >
              <Settings className="mx-auto h-5 w-5 md:h-6 md:w-6" aria-hidden />
            </ControlIconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
