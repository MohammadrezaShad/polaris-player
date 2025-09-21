/** src/player/ui/overlays/center-play-overlay.tsx */
'use client';
import * as React from 'react';
import { Play } from 'lucide-react';

import { useT } from '../../providers/i18n/i18n';

export function CenterPlayOverlay({ onPlay }: { onPlay: () => void }) {
  const t = useT();
  return (
    <div className="absolute inset-0 z-45 grid place-items-center">
      <button
        aria-label={t('overlays.play')}
        onClick={onPlay}
        className="group rounded-full bg-black/60 text-white shadow-2xl backdrop-blur transition hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none active:scale-95"
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 transition group-hover:bg-white/15 max-md:h-14 max-md:w-14">
          <Play className="ml-0.5 h-10 w-10 max-md:h-8 max-md:w-8" />
        </div>
      </button>
    </div>
  );
}
