'use client';
import * as React from 'react';

import { useT } from '../../providers/i18n/i18n';

export function OfflineBanner({ online }: { online: boolean }) {
  const t = useT();
  if (online) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center">
      <div className="pointer-events-auto mt-3 rounded-full bg-yellow-500/90 px-3 py-1 text-xs font-medium text-black shadow">
        {t('overlays.offline') || 'You are offline. We will retry when connection is back.'}
      </div>
    </div>
  );
}
