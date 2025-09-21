'use client';
import * as React from 'react';

export function useTimeAndBuffer(
  engine: any,
  opts: { pageActive: boolean; videoRef: React.RefObject<HTMLVideoElement> },
) {
  const { pageActive, videoRef } = opts;
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [buffered, setBuffered] = React.useState<{ start: number; end: number }[]>([]);

  React.useEffect(() => {
    if (!pageActive) return;
    let lastT = -1;
    let lastD = -1;
    let lastRanges: { start: number; end: number }[] = [];
    const same = (a: any[], b: any[]) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i].start - b[i].start) > 0.05 || Math.abs(a[i].end - b[i].end) > 0.05) return false;
      }
      return true;
    };
    const id = window.setInterval(() => {
      const t = engine.getCurrentTime?.() ?? 0;
      if (Math.abs(t - lastT) >= 0.05) {
        setCurrentTime(t);
        lastT = t;
      }
      const d = engine.getDuration?.() ?? 0;
      if (Number.isFinite(d) && Math.abs(d - lastD) >= 0.25) {
        setDuration(d);
        lastD = d;
      }
      let ranges: { start: number; end: number }[] = [];
      if (engine.getBufferedRanges) ranges = engine.getBufferedRanges();
      else if (videoRef.current) {
        const br = videoRef.current.buffered;
        for (let i = 0; i < br.length; i++) ranges.push({ start: br.start(i), end: br.end(i) });
      }
      if (!same(ranges, lastRanges)) {
        setBuffered(ranges);
        lastRanges = ranges;
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [engine, pageActive, videoRef]);

  return { currentTime, setCurrentTime, duration, setDuration, buffered };
}
