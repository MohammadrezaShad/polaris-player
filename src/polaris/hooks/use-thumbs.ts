/** src/player/hooks/use-thumbs.ts */
"use client";

import * as React from "react";
import { type VttThumbs, createVttThumbs } from "../adapters/thumbs/vtt-thumbs-adapter";

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

type UseThumbsOptions = {
  /** Warm nearby thumbs after a hit (seconds). 0 = disabled (default). */
  warmupSpan?: number;
};

export function useThumbs(source: any, duration: number, currentTime: number, opts: UseThumbsOptions = { warmupSpan: 0 }) {
  const seekbarRef = React.useRef<HTMLDivElement | null>(null);

  const thumbsRef = React.useRef<VttThumbs | null>(null);
  const thumbsReadyRef = React.useRef(false);
  const ensurePromiseRef = React.useRef<Promise<void> | null>(null);

  const [hoverRatio, setHoverRatio] = React.useState<number | null>(null);
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [hoverW, setHoverW] = React.useState<number>(0);
  const [hoverX, setHoverX] = React.useState<number>(0);
  const [sprite, setSprite] = React.useState<Sprite | undefined>(undefined);

  const rafRef = React.useRef<number | null>(null);

  const sliderMax = Number.isFinite(duration) ? Math.max(duration, 0) : Math.max(currentTime + 1, 1);

  // Create thumbnails index ONLY when needed (first hover/drag)
  const ensureThumbs = React.useCallback((): Promise<void> => {
    if (thumbsReadyRef.current && thumbsRef.current) return Promise.resolve();
    if (ensurePromiseRef.current) return ensurePromiseRef.current;

    const spec = source?.thumbnails;
    if (spec?.format === "vtt" && spec?.url) {
      const baseUrl = spec.baseUrl || spec.url;
      ensurePromiseRef.current = createVttThumbs(spec.url, { baseUrl })
        .then((th) => {
          thumbsRef.current = th;
          thumbsReadyRef.current = true;
        })
        .catch(() => {
          // allow retry on next hover
          ensurePromiseRef.current = null;
        });
      return ensurePromiseRef.current!;
    }
    // no thumbs
    ensurePromiseRef.current = Promise.resolve();
    return ensurePromiseRef.current!;
  }, [source?.thumbnails, source?.thumbnails?.url]);

  const resolveSpriteAt = React.useCallback(
    (t0: number) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(async () => {
        try {
          const th = thumbsRef.current;
          if (!th) return;
          const hit = await th.at(t0);
          if (hit?.img && hit.cue) {
            const { x, y, w, h, isPercent } = hit.cue.region || {};
            setSprite({
              // IMPORTANT: use the loaded image's src (Blob URL) – prevents network re-requests
              url: hit.img.src,
              x,
              y,
              w,
              h,
              naturalW: hit.img.naturalWidth,
              naturalH: hit.img.naturalHeight,
              isPercent: !!isPercent,
            });
            if ((opts.warmupSpan ?? 0) > 0) th.warmup(t0, opts.warmupSpan);
          } else {
            setSprite(undefined);
          }
        } catch {
          setSprite(undefined);
        }
      });
    },
    [opts.warmupSpan]
  );

  // Desktop hover
  const onSeekbarMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = seekbarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = rect.width || 1;
      const x = Math.min(Math.max((e.clientX ?? 0) - rect.left, 0), w);
      const ratio = x / w;
      const t0 = ratio * sliderMax;

      setHoverW(w);
      setHoverX(x);
      setHoverRatio(ratio);
      setHoverTime(t0);

      void ensureThumbs().then(() => resolveSpriteAt(t0));
    },
    [ensureThumbs, resolveSpriteAt, sliderMax]
  );

  const onSeekbarLeave = React.useCallback(() => {
    setHoverRatio(null);
    setHoverTime(null);
    setSprite(undefined);
    setHoverW(0);
    setHoverX(0);
  }, []);

  // Mobile drag
  const updateFromRatio = React.useCallback(
    (ratio01: number, containerW: number, anchorX: number) => {
      if (!Number.isFinite(ratio01) || containerW <= 0) {
        setHoverRatio(null);
        setHoverTime(null);
        setSprite(undefined);
        setHoverW(0);
        setHoverX(0);
        return;
      }
      const r = Math.min(Math.max(ratio01, 0), 1);
      const t0 = r * sliderMax;

      setHoverW(containerW);
      setHoverX(anchorX);
      setHoverRatio(r);
      setHoverTime(t0);

      void ensureThumbs().then(() => resolveSpriteAt(t0));
    },
    [ensureThumbs, resolveSpriteAt, sliderMax]
  );

  // Reset/cleanup on source change (no prefetch)
  React.useEffect(() => {
    try {
      thumbsRef.current?.dispose();
    } catch {}
    thumbsRef.current = null;
    thumbsReadyRef.current = false;
    ensurePromiseRef.current = null;
    setSprite(undefined);
    setHoverRatio(null);
    setHoverTime(null);
  }, [source?.id, source?.thumbnails?.url]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        thumbsRef.current?.dispose();
      } catch {}
    };
  }, []);

  return {
    seekbarRef,
    hoverState: { hoverRatio, hoverTime, hoverW, hoverX, sprite },
    onSeekbarMouseMove,
    onSeekbarLeave,
    sliderMax,
    updateFromRatio,
  };
}
