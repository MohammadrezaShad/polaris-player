'use client';
import * as React from 'react';

export function useStallWatch(params: {
  engine: any;
  duration: number;
  adActiveRef: React.MutableRefObject<boolean>;
  playingRef: React.MutableRefObject<boolean>;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  const { engine, duration, adActiveRef, playingRef, videoRef } = params;
  const inFlight = React.useRef(false);

  const scheduleStallWatch = React.useCallback(
    (reason: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const v = videoRef.current;
      const t0 = engine.getCurrentTime?.() ?? v?.currentTime ?? 0;

      const step = async (attempt: number) => {
        try {
          const vNow = videoRef.current;
          const cur = engine.getCurrentTime?.() ?? vNow?.currentTime ?? 0;
          const advanced = cur > t0 + 0.05;
          if (!playingRef.current || adActiveRef.current) {
            inFlight.current = false;
            return;
          }
          if (advanced) {
            inFlight.current = false;
            return;
          }

          if (attempt === 0) {
            try {
              await (engine.play?.() ?? vNow?.play?.());
            } catch {
              try {
                engine.setMuted?.(true);
                await (engine.play?.() ?? vNow?.play?.());
              } catch {}
            }
            setTimeout(() => void step(1), 800);
          } else if (attempt === 1) {
            try {
              await (engine.pause?.() ?? vNow?.pause?.());
            } catch {}
            setTimeout(async () => {
              try {
                await (engine.play?.() ?? vNow?.play?.());
              } catch {
                try {
                  engine.setMuted?.(true);
                  await (engine.play?.() ?? vNow?.play?.());
                } catch {}
              }
              setTimeout(() => void step(2), 800);
            }, 60);
          } else {
            const dur = engine.getDuration?.() ?? duration ?? 0;
            const endCap = Number.isFinite(dur) && dur > 1 ? Math.max(0, dur - 0.25) : Infinity;
            const target = Math.min(Math.max(cur + 0.1, 0), endCap);
            try {
              engine.seekTo?.(target);
            } catch {}
            setTimeout(async () => {
              try {
                await (engine.play?.() ?? vNow?.play?.());
              } catch {}
              inFlight.current = false;
            }, 120);
          }
        } catch {
          inFlight.current = false;
        }
      };
      setTimeout(() => void step(0), 1200);
    },
    [engine, duration, adActiveRef, playingRef, videoRef],
  );

  return { scheduleStallWatch };
}
