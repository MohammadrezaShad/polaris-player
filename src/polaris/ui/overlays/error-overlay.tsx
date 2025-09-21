/** src/player/ui/overlays/error-overlay.tsx */
'use client';
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../vendor/ui/button';

import { useT } from '../../providers/i18n/i18n';
export function ErrorOverlay({
  message,
  onRetry,
  onReport,
  onSwitchSd,
}: {
  message: string;
  onRetry?: () => void;
  onReport?: () => void;
  onSwitchSd?: () => void;
}) {
  const t = useT();
  return (
    <div className="absolute inset-0 z-[70] grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/85 p-5 text-white shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
          <h3 className="text-base font-semibold">{t('overlays.errorGeneric')}</h3>
        </div>
        <p className="mb-4 text-sm opacity-90">{message}</p>
        <div className="flex flex-wrap gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="rounded-xl">
              {t('overlays.switchSd')}
            </Button>
          )}
          {onSwitchSd && (
            <Button variant="secondary" onClick={onSwitchSd} className="rounded-xl">
              {t('overlays.retry')}
            </Button>
          )}
          {onReport && (
            <Button variant="outline" onClick={onReport} className="rounded-xl">
              {t('overlays.report')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
