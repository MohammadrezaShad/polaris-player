'use client';
import * as React from 'react';

import type { EnginePort } from '../ports';
export function useSSAI(engine: EnginePort) {
  const [ranges, setR] = React.useState<{ start: number; end: number }[]>([]);
  React.useEffect(() => {
    const off = engine.on?.('engine_ssai_ranges' as any, (e: any) => {
      if (Array.isArray(e?.ranges)) setR(e.ranges);
    });
    return () => {
      try {
        (off as any)?.();
      } catch {}
    };
  }, [engine]);
  const isInAd = React.useCallback((t: number) => ranges.some((r) => t >= r.start && t <= r.end), [ranges]);
  const snapSeek = React.useCallback(
    (t: number) => {
      for (const r of ranges) {
        if (t >= r.start && t <= r.end) return r.end + 0.01;
      }
      return t;
    },
    [ranges],
  );
  return { ranges, isInAd, snapSeek };
}
