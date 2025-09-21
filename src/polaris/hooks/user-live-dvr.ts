'use client';
import * as React from 'react';

export type LiveInfo = {
  isLive: boolean;
  isDvr: boolean;
  latencySec: number | null; // behind live edge; null if VOD
  behindLiveSec: number | null;
  atLiveEdge: boolean;
  goLive: () => void;
};

type Engine = {
  getCurrentTime?: () => number;
  getDuration?: () => number; // for DVR, duration is sliding window length
  // Optional LL-HLS helpers exposed by your adapter (guarded at runtime):
  getLiveSyncPosition?: () => number | undefined; // hls.js live sync position
  isLive?: () => boolean;
  seekTo?: (t: number) => void;
};

export function useLiveDvr(engine: Engine, videoRef: React.RefObject<HTMLVideoElement>): LiveInfo {
  const [isLive, setIsLive] = React.useState(false);
  const [isDvr, setIsDvr] = React.useState(false);
  const [latency, setLatency] = React.useState<number | null>(null);
  const [behind, setBehind] = React.useState<number | null>(null);
  const [atEdge, setAtEdge] = React.useState(true);

  const compute = React.useCallback(() => {
    const v = videoRef.current;
    const t = engine.getCurrentTime?.() ?? v?.currentTime ?? 0;

    // Live detection (engine preferred)
    const live = engine.isLive?.() ?? (!!v && !Number.isFinite(v.duration));
    setIsLive(!!live);

    // DVR detection: live with finite duration often = DVR window length from engine
    const dur = engine.getDuration?.();
    const dvr = !!live && !!dur && Number.isFinite(dur) && dur > 60; // >60s window considered DVR
    setIsDvr(dvr);

    if (!live) {
      setLatency(null);
      setBehind(null);
      setAtEdge(true);
      return;
    }

    // live edge via engine (hls.js liveSyncPosition) else estimate as max buffered end
    let liveEdge = engine.getLiveSyncPosition?.();
    if (liveEdge == null && v) {
      const br = v.buffered;
      if (br.length > 0) liveEdge = br.end(br.length - 1);
    }

    if (liveEdge == null) {
      setLatency(null);
      setBehind(null);
      setAtEdge(true);
      return;
    }

    const behindLive = Math.max(0, liveEdge - t);
    setBehind(behindLive);
    setLatency(behindLive);
    setAtEdge(behindLive < 1.0);
  }, [engine, videoRef]);

  React.useEffect(() => {
    const id = setInterval(compute, 500);
    return () => clearInterval(id);
  }, [compute]);

  const goLive = React.useCallback(() => {
    const v = videoRef.current;
    let target = engine.getLiveSyncPosition?.();
    if (target == null && v) {
      const br = v.buffered;
      if (br.length > 0) target = br.end(br.length - 1);
    }
    if (target != null) engine.seekTo?.(target - 0.05);
  }, [engine, videoRef]);

  return { isLive, isDvr, latencySec: latency, behindLiveSec: behind, atLiveEdge: atEdge, goLive };
}
