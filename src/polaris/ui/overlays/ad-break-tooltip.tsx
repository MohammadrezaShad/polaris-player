'use client';
import { useI18n } from '../../providers/i18n/i18n';
import * as React from 'react';

export function AdBreakTooltip({ show }: { show: boolean }) {
  const { t } = useI18n();
  if (!show) return null;
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full rounded bg-black/80 px-2 py-1 text-xs text-white">
      {t('adBreak')}
    </div>
  );
}
