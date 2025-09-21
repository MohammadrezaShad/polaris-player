'use client';
import { useI18n } from '../../providers/i18n/i18n';
import * as React from 'react';

export function LiveBadge({
  latencySec,
  atLiveEdge,
  onGoLive,
}: {
  latencySec: number;
  atLiveEdge: boolean;
  onGoLive: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        {t('live.badge')}
      </span>
      <span aria-live="polite">{latencySec.toFixed(1)}s</span>
      {!atLiveEdge && (
        <button onClick={onGoLive} className="rounded bg-black/60 px-2 py-0.5 text-white hover:bg-black/80">
          {t('live.goLive')}
        </button>
      )}
    </div>
  );
}
