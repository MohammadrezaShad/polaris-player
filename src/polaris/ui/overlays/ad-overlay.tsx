// src/player/ui/overlays/ad-overlay.tsx
'use client';

import * as React from 'react';
import { Button } from '../../../vendor/ui/button';
import { Volume2, VolumeX, ExternalLink } from 'lucide-react';

import { useT } from '../../providers/i18n/i18n';

const ICONS_Z = 60; // Icons sit under controls
const CONTROLS_Z = 90; // Bottom controls on top
const TOPBAR_Z = 90; // "{t('ads.learnMore')}" button on top
const CONTROLS_SAFE_BOTTOM = 64; // Lift bottom icons to avoid visual overlap with controls

type AdIconUI = {
  _idx: number;
  src: string;
  width: number;
  height: number;
  xPosition: 'left' | 'right' | number;
  yPosition: 'top' | 'bottom' | number;
  margin?: number;
  program?: string | null;
};

export function AdOverlay({
  remainingSec,
  skipCountdownSec,
  canSkip,
  muted,
  onToggleMute,
  onSkip,
  onClickThrough,
  icons = [],
  onIconClick,
}: {
  remainingSec: number;
  skipCountdownSec?: number;
  canSkip?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onSkip: () => void;
  onClickThrough: () => void;
  icons?: AdIconUI[];
  onIconClick?: (idx: number) => void;
}) {
  const t = useT();
  const fmtTime = (s: number) => {
    const clamped = Math.max(0, Math.floor(s));
    const m = Math.floor(clamped / 60);
    const sec = clamped % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const skipText = canSkip ? t('ads.skip') : t('ads.skipIn', { s: Math.max(0, Math.ceil(skipCountdownSec ?? 0)) });

  // Compute absolute positioning for each icon and keep them under the control bar
  const placeIcon = (it: AdIconUI): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'absolute',
      zIndex: ICONS_Z,
      width: it.width ? `${it.width}px` : undefined,
      height: it.height ? `${it.height}px` : undefined,
      touchAction: 'manipulation', // mobile tap responsiveness
    };
    const m = it.margin ?? 0;

    if (typeof it.xPosition === 'number') style.left = it.xPosition;
    else (style as any)[it.xPosition] = m; // 'left' | 'right'

    if (typeof it.yPosition === 'number') {
      style.top = it.yPosition;
    } else {
      // If bottom-aligned, lift by the controls height to avoid visual overlap
      const lift = it.yPosition === 'bottom' ? CONTROLS_SAFE_BOTTOM : 0;
      (style as any)[it.yPosition] = m + lift; // 'top' | 'bottom'
    }
    return style;
  };

  // Prevent icon/CTA clicks from bubbling to parent layers or the <video>
  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent?.stopImmediatePropagation?.();
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[70] grid grid-rows-[auto_1fr_auto] text-white"
      aria-label={t('ads.ad')}
      role="group"
    >
      {/* Top: main clickthrough (CTA) */}
      <div
        className="pointer-events-auto flex items-center justify-end gap-2 p-2 md:p-3"
        style={{ zIndex: TOPBAR_Z }}
        onPointerDownCapture={stopAll}
      >
        <button
          type="button"
          onClick={onClickThrough}
          className="group inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label={t('ads.learnMore')}
          title={t('ads.learnMore')}
        >
          <ExternalLink className="h-3.5 w-3.5 opacity-80 group-hover:opacity-100" />
          <span className="opacity-90 group-hover:opacity-100">{t('ads.learnMore')}</span>
        </button>
      </div>

      {/* Icons (no wrapper with pointer-events:none) — each button is positioned absolutely */}
      {icons.map((it) => (
        <button
          key={it._idx}
          type="button"
          className="pointer-events-auto absolute"
          style={placeIcon(it)}
          aria-label={it.program ?? t('ads.ad')}
          title={it.program ?? t('ads.ad')}
          onPointerDownCapture={stopAll}
          onClick={() => onIconClick?.(it._idx)}
        >
          <img
            src={it.src}
            alt={it.program ?? t('ads.ad')}
            draggable={false}
            className="block"
            width={it.width || undefined}
            height={it.height || undefined}
          />
        </button>
      ))}

      {/* Spacer row to keep the grid layout (doesn't need pointer events) */}
      <div />

      {/* Bottom: remaining time + mute + skip — always above icons */}
      <div
        className="pointer-events-auto flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-3 md:p-4"
        style={{ zIndex: CONTROLS_Z }}
        onPointerDownCapture={stopAll}
      >
        <div className="min-w-0 text-xs md:text-sm" aria-live="polite" aria-atomic="true">
          {t('ads.remaining', { time: fmtTime(remainingSec) })}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label={muted ? t('ads.unmute') : t('ads.mute')}
            title={muted ? t('ads.unmute') : t('ads.mute')}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          <Button
            type="button"
            onClick={onSkip}
            disabled={!canSkip}
            className="rounded-lg bg-white/20 px-3 py-2 text-xs text-white hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50"
            title={t('ads.skip')}
            aria-disabled={!canSkip}
            aria-label={t('ads.skip')}
          >
            {skipText}
          </Button>
        </div>
      </div>
    </div>
  );
}
