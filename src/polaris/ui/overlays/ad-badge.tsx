/** src/player/ui/overlays/ad-badge.tsx */
'use client';
import * as React from 'react';

export function AdBadge({ text = 'Ad • Loading…' }: { text?: string }) {
  return (
    <div className="pointer-events-none absolute top-2 left-2 z-30">
      <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/90 px-3 py-1 text-xs font-medium text-black shadow">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-black/60" aria-hidden />
        <span aria-live="polite">{text}</span>
      </div>
    </div>
  );
}
