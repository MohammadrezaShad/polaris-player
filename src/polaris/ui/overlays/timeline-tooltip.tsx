/** src/player/ui/timeline-tooltip.tsx */
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
  anchorX: number; // desktop only
  containerWidth: number; // video width (px)
  containerHeight?: number; // video height (px) for fullWidth (mobile)
  timeLabel: string;
  sprite?: Sprite | null; // null = explicitly "no preview"
  margin?: number;
};

type ClassicProps = BaseProps & { fullWidth?: false; width?: number; height?: number };
type FullWidthProps = BaseProps & { fullWidth: true };
type Props = ClassicProps | FullWidthProps;

function isFullWidth(p: Props): p is FullWidthProps {
  return (p as any).fullWidth === true;
}

export default function TimelineTooltip(props: Props) {
  const t = useT();
  const sprite = props.sprite;

  // We rely on adapter-provided natural sizes — no extra <img> preloads here.
  const natW = sprite?.naturalW ?? 0;
  const natH = sprite?.naturalH ?? 0;

  // ── MOBILE (full-width) ─────────────────────────────────────────────────────
  if (isFullWidth(props)) {
    const { containerWidth, containerHeight, timeLabel, margin = 0 } = props;

    const displayW = Math.max(60, containerWidth - margin * 2);
    // Full-height if provided; else maintain 16:9 by width
    const displayH = Math.max(60, Math.round(containerHeight ?? (displayW * 9) / 16));

    const noPreview = sprite === null;
    const hasDims = Number.isFinite(sprite?.w) && Number.isFinite(sprite?.h);
    const ready = !!sprite && !!sprite.url && hasDims && natW > 0 && natH > 0;

    if (noPreview || !ready) {
      return <div role="tooltip" className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] select-none" aria-label={t("a11y.tooltipTime", { time: timeLabel })} />;
    }

    const pxW = sprite!.isPercent ? (sprite!.w / 100) * natW : sprite!.w;
    const pxH = sprite!.isPercent ? (sprite!.h / 100) * natH : sprite!.h;
    const pxXr = sprite!.isPercent ? (sprite!.x / 100) * natW : sprite!.x;
    const pxYr = sprite!.isPercent ? (sprite!.y / 100) * natH : sprite!.y;

    const col = Math.round(pxXr / Math.max(1, pxW));
    const row = Math.round(pxYr / Math.max(1, pxH));
    const pxX = col * pxW;
    const pxY = row * pxH;

    const s = Math.max(displayW / Math.max(1, pxW), displayH / Math.max(1, pxH));
    const dw = Math.ceil(pxW * s);
    const dh = Math.ceil(pxH * s);

    const cx = Math.round((displayW - dw) / 2);
    const cy = Math.round((displayH - dh) / 2);

    const bgSizeW = Math.ceil(natW * s);
    const bgSizeH = Math.ceil(natH * s);
    const bgPosX = cx - Math.round(pxX * s);
    const bgPosY = cy - Math.round(pxY * s);

    return (
      <div role="tooltip" className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] select-none" aria-label={t("a11y.tooltipTime", { time: props.timeLabel })}>
        <div
          className="relative overflow-hidden bg-black"
          style={{
            width: "100%",
            height: displayH,
            backgroundImage: `url(${sprite!.url})`, // Blob URL from adapter/hook
            backgroundRepeat: "no-repeat",
            backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
            backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          }}
        />
      </div>
    );
  }

  // ── DESKTOP (classic tooltip) ────────────────────────────────────────────────
  const { anchorX, containerWidth, timeLabel, width = 160, height = 90, margin = 8 } = props as ClassicProps;

  const boxW = Math.max(60, Math.min(width, containerWidth - margin * 2));
  const boxH = Math.round((height / width) * boxW);
  const half = boxW / 2;
  const clampedLeft = Math.max(half + margin, Math.min(containerWidth - half - margin, anchorX));

  const noPreview = sprite === null;
  const hasDims = Number.isFinite(sprite?.w) && Number.isFinite(sprite?.h);
  const ready = !!sprite && !!sprite.url && hasDims && natW > 0 && natH > 0;

  let innerStyle: React.CSSProperties | undefined;
  if (ready && sprite) {
    const pxW = sprite.isPercent ? (sprite.w / 100) * natW : sprite.w;
    const pxH = sprite.isPercent ? (sprite.h / 100) * natH : sprite.h;
    const pxXr = sprite.isPercent ? (sprite.x / 100) * natW : sprite.x;
    const pxYr = sprite.isPercent ? (sprite.y / 100) * natH : sprite.y;

    const col = Math.round(pxXr / Math.max(1, pxW));
    const row = Math.round(pxYr / Math.max(1, pxH));
    const pxX = col * pxW;
    const pxY = row * pxH;

    const s = Math.max(boxW / Math.max(1, pxW), boxH / Math.max(1, pxH));
    const dw = Math.ceil(pxW * s);
    const dh = Math.ceil(pxH * s);

    const bgSizeW = Math.ceil(natW * s);
    const bgSizeH = Math.ceil(natH * s);
    const bgPosX = -Math.round(pxX * s);
    const bgPosY = -Math.round(pxY * s);

    innerStyle = {
      width: `${dw}px`,
      height: `${dh}px`,
      backgroundImage: `url(${sprite.url})`, // Blob URL from adapter/hook
      backgroundRepeat: "no-repeat",
      backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
      backgroundPosition: `${bgPosX}px ${bgPosY}px`,
    };
  }

  return (
    <div role="tooltip" className="pointer-events-none absolute -top-[150px] z-[650] select-none" aria-label={t("a11y.tooltipTime", { time: timeLabel })} style={{ left: `${clampedLeft}px`, transform: "translateX(-50%)" }}>
      <div className="flex flex-col items-center">
        <div className={cn("grid place-items-center overflow-hidden rounded-md border border-white/10 bg-black opacity-0 shadow-lg", !noPreview && ready && innerStyle && "opacity-100")} style={{ width: boxW, height: boxH }}>
          {/* do NOT set a changing key here; it forces remount/reload */}
          <div style={innerStyle} />
        </div>

        <div className="mt-2 w-max rounded-md border border-white/10 bg-zinc-950/80 px-2 py-1 text-[11px] text-white shadow backdrop-blur">{timeLabel}</div>
      </div>
    </div>
  );
}
