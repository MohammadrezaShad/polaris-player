'use client';
import * as React from 'react';

import { useT } from '../../providers/i18n/i18n';

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

type BaseProps = {
  anchorX: number; // px within container
  containerWidth: number; // px
  timeLabel: string;
  sprite?: Sprite;
  margin?: number;
};

type ClassicProps = BaseProps & {
  fullWidth?: false;
  width?: number;
  height?: number;
};

type FullWidthProps = BaseProps & { fullWidth: true };

type Props = ClassicProps | FullWidthProps;

export default function TimelineTooltip(props: Props) {
  const t = useT();

  // ── FULL-WIDTH (mobile ≤500px) ───────────────────────────────────────────────
  if ((props as FullWidthProps).fullWidth) {
    const { anchorX, containerWidth, timeLabel, sprite, margin = 0 } = props as FullWidthProps;

    const displayW = Math.max(60, containerWidth - margin * 2);

    if (!sprite || !sprite.url || !sprite.w || !sprite.h) {
      return (
        <div
          role="tooltip"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] select-none"
          aria-label={t('a11y.tooltipTime', { time: timeLabel })}
        />
      );
    }

    // Compute crop → scale to full width
    const naturalW = sprite.naturalW ?? 0;
    const naturalH = sprite.naturalH ?? 0;
    const x = sprite.isPercent ? (sprite.x / 100) * naturalW : sprite.x;
    const y = sprite.isPercent ? (sprite.y / 100) * naturalH : sprite.y;
    const w = sprite.isPercent ? (sprite.w / 100) * naturalW : sprite.w;
    const h = sprite.isPercent ? (sprite.h / 100) * naturalH : sprite.h;

    const regionAspect = h / (w || 1);
    const displayH = Math.max(1, Math.round(displayW * regionAspect));

    const scale = displayW / (w || 1);
    const bgSizeW = Math.round(naturalW * scale);
    const bgSizeH = Math.round(naturalH * scale);
    const bgPosX = -Math.round(x * scale);
    const bgPosY = -Math.round(y * scale);

    const clampedAnchor = Math.max(margin, Math.min(containerWidth - margin, anchorX));

    return (
      <div
        role="tooltip"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] select-none"
        aria-label={t('a11y.tooltipTime', { time: timeLabel })}
      >
        {/* Full-width preview (below slider in z-order) */}
        <div
          className="relative overflow-hidden bg-black/40"
          style={{
            width: '100%',
            height: displayH,
            backgroundImage: `url(${sprite.url})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
            backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          }}
        />
      </div>
    );
  }

  // ── CLASSIC (desktop/wide >500px) ────────────────────────────────────────────
  const { anchorX, containerWidth, timeLabel, sprite, width = 160, height = 90, margin = 8 } = props as ClassicProps;

  const minWidth = Math.max(60, Math.min(width, containerWidth - margin * 2));
  const scale = minWidth / width;
  const tw = Math.max(60, Math.min(width, minWidth));
  const th = Math.round(height * scale);

  const half = tw / 2;
  const clampedLeft = Math.max(half + margin, Math.min(containerWidth - half - margin, anchorX));

  let bgStyle: React.CSSProperties | undefined;
  if (sprite && sprite.url) {
    const naturalW = sprite.naturalW ?? 0;
    const naturalH = sprite.naturalH ?? 0;
    const x = sprite.isPercent ? (sprite.x / 100) * naturalW : sprite.x;
    const y = sprite.isPercent ? (sprite.y / 100) * naturalH : sprite.y;
    bgStyle = {
      backgroundImage: `url(${sprite.url})`,
      backgroundPosition: `-${x}px -${y}px`,
      backgroundSize: `${naturalW}px ${naturalH}px`,
      width: `${tw}px`,
      height: `${th}px`,
    };
  }

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute -top-[150px] z-[650] select-none"
      aria-label={t('a11y.tooltipTime', { time: timeLabel })}
      style={{ left: `${clampedLeft}px`, transform: 'translateX(-50%)' }}
    >
      <div className="flex flex-col items-center">
        <div
          className="overflow-hidden rounded-md border border-white/10 bg-black/40 shadow-lg"
          style={{ width: tw, height: th }}
        >
          {bgStyle ? (
            <div style={bgStyle as any} />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-white/80">{t('overlays.noPreview')}</div>
          )}
        </div>
        <div className="mt-2 w-max rounded-md border border-white/10 bg-zinc-950/80 px-2 py-1 text-[11px] text-white shadow backdrop-blur">
          {timeLabel}
        </div>
      </div>
    </div>
  );
}
