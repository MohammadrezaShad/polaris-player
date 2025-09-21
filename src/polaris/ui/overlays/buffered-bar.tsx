/** src/player/ui/overlays/buffered-bar.tsx */
'use client';
import * as React from 'react';

export function BufferedBar({ ranges, duration }: { ranges: { start: number; end: number }[]; duration: number }) {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return (
    <div
      className="absolute right-0 bottom-0 left-0 -z-10 overflow-hidden rounded-full bg-white/10"
      style={{ height: 5 }}
      aria-hidden
      role="presentation"
    >
      {ranges.map((r, i) => {
        const left = (r.start / duration) * 100;
        const width = Math.max(0, (r.end - r.start) / duration) * 100;
        return (
          <div key={i} className="absolute inset-y-0 bg-white/30" style={{ left: `${left}%`, width: `${width}%` }} />
        );
      })}
    </div>
  );
}
