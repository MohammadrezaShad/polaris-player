"use client";
import * as React from "react";

import { useT } from "../../providers/i18n/i18n";
import { cn } from "../../../vendor/helpers/cn";

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
  anchorX: number; // px within container (desktop only)
  containerWidth: number; // px (width of the video area)
  containerHeight?: number; // ✅ px (height of the video area) — NEW
  timeLabel: string;
  sprite?: Sprite | null; // null = no preview available at all
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

  // ── MOBILE (full-width) ─────────────────────────────────────────────────────
  if ((props as FullWidthProps).fullWidth) {
    const { containerWidth, containerHeight, timeLabel, sprite, margin = 0 } = props as FullWidthProps;

    const displayW = Math.max(60, containerWidth - margin * 2);
    // ✅ Use the actual video height if provided; fallback to 16:9 estimate
    const displayH = Math.max(60, Math.round(containerHeight ?? (displayW * 9) / 16));

    const noPreview = sprite === null;
    const ready = !!sprite && !!sprite.url && Number.isFinite(sprite.w) && Number.isFinite(sprite.h) && Number.isFinite(sprite.naturalW) && Number.isFinite(sprite.naturalH);

    // Nothing while not ready or not available
    if (noPreview || !ready) {
      return <div role="tooltip" className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] select-none" aria-label={t("a11y.tooltipTime", { time: timeLabel })} />;
    }

    // --- COVER to fill the whole video area (width x height) ---
    const natW = sprite.naturalW as number;
    const natH = sprite.naturalH as number;

    const pxW = sprite.isPercent ? (sprite.w / 100) * natW : sprite.w;
    const pxXr = sprite.isPercent ? (sprite.x / 100) * natW : sprite.x;
    const pxYr = sprite.isPercent ? (sprite.y / 100) * natH : sprite.y;

    // infer true tile height from grid (handles 160x68 sheets)
    const cols = Math.max(1, Math.round(natW / Math.max(1, pxW)));
    const pxH = Math.max(1, Math.round(natH / cols));

    // snap to grid
    const col = Math.round(pxXr / Math.max(1, pxW));
    const row = Math.round(pxYr / pxH);
    const pxX = col * pxW;
    const pxY = row * pxH;

    // COVER scale: fill both width and height, then center the overflow
    const s = Math.max(displayW / Math.max(1, pxW), displayH / pxH);
    const dw = Math.ceil(pxW * s);
    const dh = Math.ceil(pxH * s);

    const cx = Math.round((displayW - dw) / 2);
    const cy = Math.round((displayH - dh) / 2);

    const bgSizeW = Math.ceil(natW * s);
    const bgSizeH = Math.ceil(natH * s);
    const bgPosX = cx - Math.round(pxX * s);
    const bgPosY = cy - Math.round(pxY * s);

    return (
      <div role="tooltip" className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] select-none" aria-label={t("a11y.tooltipTime", { time: timeLabel })}>
        <div
          className="relative overflow-hidden bg-black"
          style={{
            width: "100%",
            height: displayH, // fills full video height
            backgroundImage: `url(${sprite.url})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
            backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          }}
        />
      </div>
    );
  }

  // ── DESKTOP (classic tooltip) ────────────────────────────────────────────────
  const { anchorX, containerWidth, timeLabel, sprite, width = 160, height = 90, margin = 8 } = props as ClassicProps;

  const boxW = Math.max(60, Math.min(width, containerWidth - margin * 2));
  const boxH = Math.round((height / width) * boxW);
  const half = boxW / 2;
  const clampedLeft = Math.max(half + margin, Math.min(containerWidth - half - margin, anchorX));

  const noPreview = sprite === null;
  const ready = !!sprite && !!sprite.url && Number.isFinite(sprite.w) && Number.isFinite(sprite.h) && Number.isFinite(sprite.naturalW) && Number.isFinite(sprite.naturalH);

  let innerStyle: React.CSSProperties | undefined;
  if (ready && sprite) {
    const natW = sprite.naturalW as number;
    const natH = sprite.naturalH as number;

    const pxW = sprite.isPercent ? (sprite.w / 100) * natW : sprite.w;
    const pxXr = sprite.isPercent ? (sprite.x / 100) * natW : sprite.x;
    const pxYr = sprite.isPercent ? (sprite.y / 100) * natH : sprite.y;

    const cols = Math.max(1, Math.round(natW / Math.max(1, pxW)));
    const pxH = Math.max(1, Math.round(natH / cols));

    const col = Math.round(pxXr / Math.max(1, pxW));
    const row = Math.round(pxYr / pxH);
    const pxX = col * pxW;
    const pxY = row * pxH;

    // COVER for desktop box
    const s = Math.max(boxW / Math.max(1, pxW), boxH / pxH);
    const dw = Math.ceil(pxW * s);
    const dh = Math.ceil(pxH * s);

    const bgSizeW = Math.ceil(natW * s);
    const bgSizeH = Math.ceil(natH * s);
    const bgPosX = -Math.round(pxX * s);
    const bgPosY = -Math.round(pxY * s);

    innerStyle = {
      width: `${dw}px`,
      height: `${dh}px`,
      backgroundImage: `url(${sprite.url})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
      backgroundPosition: `${bgPosX}px ${bgPosY}px`,
    };
  }

  return (
    <div role="tooltip" className="pointer-events-none absolute -top-[150px] z-[650] select-none" aria-label={t("a11y.tooltipTime", { time: timeLabel })} style={{ left: `${clampedLeft}px`, transform: "translateX(-50%)" }}>
      <div className="flex flex-col items-center">
        {!noPreview && ready && innerStyle && (
          <div className={cn("grid place-items-center overflow-hidden rounded-md border border-white/10 bg-black shadow-lg")} style={{ width: boxW, height: boxH }}>
            <div style={innerStyle as any} />
          </div>
        )}

        <div className="mt-2 w-max rounded-md border border-white/10 bg-zinc-950/80 px-2 py-1 text-[11px] text-white shadow backdrop-blur">{timeLabel}</div>
      </div>
    </div>
  );
}
