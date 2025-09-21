'use client';
import * as React from 'react';

export function useLive(videoRef: React.RefObject<HTMLVideoElement>) {
  const [isLive, setIsLive] = React.useState(false);
  const [latencySec, setLatency] = React.useState(0);
  const [atLiveEdge, setEdge] = React.useState(true);

  React.useEffect(() => {
    const v = videoRef.current; if (!v) return;
    let raf = 0;
    const tick = () => {
      try {
        const S = v.seekable;
        if (S && S.length) {
          const end = S.end(S.length - 1);
          const cur = v.currentTime;
          const lat = Math.max(0, end - cur);
          setIsLive(true);
          setLatency(lat);
          setEdge(lat < 1.0);
        } else { setIsLive(false); setLatency(0); setEdge(true); }
      } catch {}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  const goLive = React.useCallback(() => {
    const v = videoRef.current; if (!v) return;
    const S = v.seekable; if (S && S.length) {
      const end = S.end(S.length - 1);
      v.currentTime = Math.max(0, end - 0.1);
      v.play?.();
    }
  }, [videoRef]);

  React.useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (isLive && latencySec > 4) {
      const prev = v.playbackRate;
      v.playbackRate = Math.min(1.08, Math.max(1.03, 1 + (latencySec - 4) * 0.01));
      const t = setTimeout(() => (v.playbackRate = prev), 1500);
      return () => clearTimeout(t);
    }
  }, [isLive, latencySec, videoRef]);

  return { isLive, latencySec, atLiveEdge, goLive };
}
