/** src/player/ui/banners/offline-banner.tsx */
'use client';
import * as React from 'react';
import { WifiOff } from 'lucide-react';

import { useT } from '../../providers/i18n/i18n';

/** Thin top banner shown while offline. */
export function OfflineBanner() {
  const t = useT();
  return (
    <div className="pointer-events-none fixed top-0 right-0 left-0 z-[1100] mx-auto w-full max-w-screen-2xl px-3 pt-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-amber-900/80 px-3 py-2 text-amber-50 shadow-lg ring-1 ring-amber-400/30 backdrop-blur">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-xs">{t('banners.offline')}</span>
      </div>
    </div>
  );
}
