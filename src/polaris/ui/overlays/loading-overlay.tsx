'use client';
import * as React from 'react';

import { useT } from '../../providers/i18n/i18n';

export function LoadingOverlay() {
  const t = useT();
  return (
    // was: z-40; add pointer-events-none so controls/timeline receive clicks
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <div className="pointer-events-none rounded-full bg-black/40 p-4 backdrop-blur">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
          role="progressbar"
          aria-valuetext="Buffering"
        />
      </div>
      <span className="sr-only" aria-live="polite">
        {t('overlays.loading')}
      </span>
    </div>
  );
}
