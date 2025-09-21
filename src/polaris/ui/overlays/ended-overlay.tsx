/** src/player/ui/overlays/ended-overlay.tsx */
'use client';
import * as React from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '../../../vendor/ui/button';

import { useT } from '../../providers/i18n/i18n';
export function EndedOverlay({ onReplay }: { onReplay: () => void }) {
  const t = useT();
  return (
    <div
      className="absolute inset-0 z-45 grid place-items-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ended-title"
    >
      <div className="rounded-2xl border border-white/10 bg-zinc-950/85 p-4 text-white shadow-xl">
        <Button onClick={onReplay} className="rounded-xl" aria-label={t('overlays.replay')}>
          <RotateCw className="mr-2 h-4 w-4" />
          {t('overlays.replay')}
        </Button>
      </div>
    </div>
  );
}
