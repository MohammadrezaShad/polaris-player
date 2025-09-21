'use client';
import * as React from 'react';
import { createVttThumbs, type VttThumbs } from '../adapters/thumbs/vtt-thumbs-adapter';

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

export function useThumbs(source: any, duration: number, currentTime: number) {
  const seekbarRef = React.useRef<HTMLDivElement | null>(null);
  const thumbsRef = React.useRef<VttThumbs | null>(null);
  const thumbsReadyRef = React.useRef(false);

  const [hoverRatio, setHoverRatio] = React.useState<number | null>(null);
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [hoverW, setHoverW] = React.useState<number>(0);
  const [hoverX, setHoverX] = React.useState<number>(0);
  const [sprite, setSprite] = React.useState<Sprite | undefined>(undefined);
  const rafRef = React.useRef<number | null>(null);

  const sliderMax = Number.isFinite(duration) ? Math.max(duration, 0) : Math.max(currentTime + 1, 1);

  const ensureThumbs = React.useCallback(async () => {
    if (thumbsReadyRef.current) return;
    const spec = source?.thumbnails;
    if (spec?.format === 'vtt' && spec?.url) {
      try {
        const baseUrl = spec.baseUrl || spec.url;
        const th = await createVttThumbs(spec.url, { baseUrl });
        thumbsRef.current = th;
        thumbsReadyRef.current = true;
      } catch {
        // ignore
      }
    }
  }, [source?.thumbnails]);

  const resolveSpriteAt = React.useCallback((t0: number) => {
    if (!thumbsRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(async () => {
      try {
        const hit = await thumbsRef.current!.at(t0);
        if (hit?.img && hit.cue) {
          const { x, y, w, h, isPercent } = hit.cue.region || {};
          setSprite({
            url: hit.cue.src,
            x,
            y,
            w,
            h,
            naturalW: hit.img.naturalWidth,
            naturalH: hit.img.naturalHeight,
            isPercent: !!isPercent,
          });
          // prefetch nearby
          thumbsRef.current!.warmup(t0, 8);
        } else {
          setSprite(undefined);
        }
      } catch {
        setSprite(undefined);
      }
    });
  }, []);

  // Desktop hover
  const onSeekbarMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = seekbarRef.current;
      if (!el) return;
      void ensureThumbs();
      const rect = el.getBoundingClientRect();
      const w = rect.width || 1;
      const x = Math.min(Math.max((e.clientX ?? 0) - rect.left, 0), w);
      const ratio = x / w;
      const t0 = ratio * sliderMax;

      setHoverW(w);
      setHoverX(x);
      setHoverRatio(ratio);
      setHoverTime(t0);
      resolveSpriteAt(t0);
    },
    [ensureThumbs, resolveSpriteAt, sliderMax],
  );

  const onSeekbarLeave = React.useCallback(() => {
    setHoverRatio(null);
    setHoverTime(null);
    setSprite(undefined);
    setHoverW(0);
    setHoverX(0);
  }, []);

  // Mobile: programmatic updates during Slider drag
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
      void ensureThumbs();
      const r = Math.min(Math.max(ratio01, 0), 1);
      const t0 = r * sliderMax;

      setHoverW(containerW);
      setHoverX(anchorX);
      setHoverRatio(r);
      setHoverTime(t0);
      resolveSpriteAt(t0);
    },
    [ensureThumbs, resolveSpriteAt, sliderMax],
  );

  React.useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null; // optional: reset
      }
    };
  }, []);
  return {
    seekbarRef,
    hoverState: { hoverRatio, hoverTime, hoverW, hoverX, sprite },
    onSeekbarMouseMove,
    onSeekbarLeave,
    sliderMax,
    updateFromRatio, // ← use this on mobile (Slider onValueChange)
  };
}
