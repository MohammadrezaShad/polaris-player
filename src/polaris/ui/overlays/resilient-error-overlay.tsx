/** src/player/ui/overlays/resilient-error-overlay.tsx */
'use client';
import * as React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

import { useT } from '../../providers/i18n/i18n';

type ErrorInfo = {
  code?: string;
  message?: string;
  fatal?: boolean;
};

type Props = {
  error: ErrorInfo | null;
  retryLabel?: string;
  retryPendingMs?: number | null; // show a subtle countdown if auto retry is planned
  onRetry: () => void;
  onDismiss?: () => void;
};

export function ResilientErrorOverlay({ error, retryLabel, retryPendingMs, onRetry, onDismiss }: Props) {
  const t = useT();
  if (!error) return null;

  const pending = typeof retryPendingMs === 'number' && retryPendingMs > 0;

  return (
    <div
      className="absolute inset-0 z-[1050] grid place-items-center"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
    >
      <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-5 text-white shadow-2xl backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            {t('overlays.errorGeneric')}
          </div>
          {!!onDismiss && !error.fatal && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label={t('overlays.dismiss')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mb-4 max-w-[420px] text-xs text-white/80">
          {error.message ?? t('overlays.genericIssue')}
          {error.code && (
            <div className="mt-1.5 text-[11px] text-white/50">{t('overlays.codeLabel', { code: error.code })}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs text-white ring-1 ring-white/20 transition hover:bg-white/25"
          >
            <RotateCcw className="h-4 w-4" /> {retryLabel || t('overlays.retry')}
          </button>

          {pending && (
            <span className="text-[11px] text-white/60">
              {t('overlays.autoRetryIn', { s: Math.ceil(retryPendingMs! / 1000) })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
