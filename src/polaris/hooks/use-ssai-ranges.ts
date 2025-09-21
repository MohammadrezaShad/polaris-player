'use client';
import * as React from 'react';
export type Range = { start: number; end: number };

export function useSsaiRanges(videoRef: React.RefObject<HTMLVideoElement>) {
  const [ranges, setRanges] = React.useState<Range[]>([]);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const sync = () => {
      const acc: Range[] = [];
      const tracks = v.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const tt = tracks[i];
        if (tt.kind !== 'metadata') continue;
        try {
          const cues = (tt as any).cues as TextTrackCueList;
          for (let j = 0; j < (cues?.length ?? 0); j++) {
            const c: any = cues[j];
            const txt = (c.text || '').toUpperCase();
            if (txt.includes('EXT-X-DATERANGE') || txt.includes('SCTE') || txt.includes('AD')) {
              const s = Number(c.startTime) || 0,
                e = Number(c.endTime) || s;
              if (e > s) acc.push({ start: s, end: e });
            }
          }
        } catch {}
      }
      acc.sort((a, b) => a.start - b.start);
      const merged: Range[] = [];
      for (const r of acc) {
        const last = merged[merged.length - 1];
        if (last && r.start <= last.end + 0.01) last.end = Math.max(last.end, r.end);
        else merged.push({ ...r });
      }
      setRanges(merged);
    };

    const onAdd = () => sync();
    for (let i = 0; i < v.textTracks.length; i++) {
      const tt = v.textTracks[i];
      try {
        tt.addEventListener('cuechange', onAdd);
      } catch {}
    }
    sync();
    return () => {
      for (let i = 0; i < v.textTracks.length; i++) {
        const tt = v.textTracks[i];
        try {
          tt.removeEventListener?.('cuechange', onAdd);
        } catch {}
      }
    };
  }, [videoRef]);

  const snapSeek = React.useCallback(
    (target: number) => {
      for (const r of ranges) {
        if (target >= r.start && target <= r.end) return r.end + 0.01;
      }
      return target;
    },
    [ranges],
  );

  const isInAd = React.useCallback((t: number) => ranges.some((r) => t >= r.start && t <= r.end), [ranges]);

  return { ranges, snapSeek, isInAd };
}
