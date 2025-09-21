'use client';
import { startQoSHeartbeat } from '../adapters/analytics/qos-heartbeat';
import * as React from 'react';

export function useQoSHeartbeat(params: {
  videoRef: React.RefObject<HTMLVideoElement>;
  engine: any;
  analytics: any;
  embedCtx: any;
  playerVersion: string;
  sourceId: string | number;
  pageActive: boolean;
}) {
  const { videoRef, engine, analytics, embedCtx, playerVersion, sourceId, pageActive } = params;

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v || !pageActive) return;
    const stop = startQoSHeartbeat({
      video: v,
      engine,
      emit: (evt: any) =>
        analytics.emit({
          event: 'qos_heartbeat',
          common: {
            sessionId: embedCtx.sessionId,
            multimediaId: embedCtx.multimediaId,
            streamingId: embedCtx.streamingId,
            playerVersion,
            sourceId,
          },
          payload: evt?.sample ? { sample: evt.sample } : (evt?.payload ?? evt),
        }),
      intervalMs: 5000,
    });
    return () => {
      try {
        stop?.();
      } catch {}
    };
  }, [videoRef, engine, analytics, embedCtx, playerVersion, sourceId, pageActive]);
}
