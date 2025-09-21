/** src/player/ui/hooks/use-abr-tuner.ts */
'use client';
import * as React from 'react';

import type { EnginePort, AnalyticsPort } from '../ports';
import { startAbrTuner } from '../adapters/abr/abr-tuner';

export type UseAbrOptions = {
  initialLevel?: 'low' | 'auto' | { height: number };
  minBufferSec?: number;
  capToViewport?: boolean;
  netAwareCap?: boolean;
  autoRevertMs?: number;
  emaAlpha?: number;
  bwSampleMs?: number;
};

export type AbrHandle = {
  manualSelection: (sel: 'auto' | number, opts?: { revertMs?: number }) => void;
};

export function useAbrTuner(
  engine: EnginePort | undefined,
  analytics?: AnalyticsPort,
  options: UseAbrOptions = {},
): AbrHandle {
  const ctrlRef = React.useRef<ReturnType<typeof startAbrTuner> | null>(null);

  React.useEffect(() => {
    if (!engine) return;
    // start
    ctrlRef.current = startAbrTuner(engine, {
      analytics,
      initialLevel: options.initialLevel ?? 'low',
      minBufferSec: options.minBufferSec ?? 3,
      capToViewport: options.capToViewport ?? true,
      netAwareCap: options.netAwareCap ?? true,
      autoRevertMs: options.autoRevertMs ?? 10 * 60 * 1000,
      emaAlpha: options.emaAlpha ?? 0.25,
      bwSampleMs: options.bwSampleMs ?? 1000,
    });
    // stop
    return () => {
      try {
        ctrlRef.current?.stop();
      } catch {}
      ctrlRef.current = null;
    };
  }, [
    engine,
    analytics,
    options.initialLevel,
    options.minBufferSec,
    options.capToViewport,
    options.netAwareCap,
    options.autoRevertMs,
    options.emaAlpha,
    options.bwSampleMs,
  ]);

  const manualSelection = React.useCallback((sel: 'auto' | number, opts?: { revertMs?: number }) => {
    ctrlRef.current?.manualSelection(sel, opts);
  }, []);

  return { manualSelection };
}
