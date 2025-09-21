'use client';
import * as React from 'react';

import type { EnginePort, SourceDescriptor } from '../ports';

type State = 'ok' | 'stall' | 'retrying' | 'offline';

export function useResilience({
  engine,
  source,
  onState,
  maxAttempts = 4,
  baseDelayMs = 800,
  stallGraceMs = 6000,
}: {
  engine: EnginePort;
  source: SourceDescriptor;
  onState: (s: State) => void;
  maxAttempts?: number;
  baseDelayMs?: number;
  stallGraceMs?: number;
}) {
  const attemptsRef = React.useRef(0);
  const retryTimerRef = React.useRef<number | null>(null);
  const retryingRef = React.useRef(false);
  const stallTimerRef = React.useRef<number | null>(null);

  const clearRetryTimer = () => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const scheduleRetry = React.useCallback(() => {
    if (retryingRef.current) return;
    retryingRef.current = true;

    if (attemptsRef.current >= maxAttempts) {
      onState('offline');
      return;
    }

    attemptsRef.current += 1;
    const delay = Math.min(10000, baseDelayMs * Math.pow(2, attemptsRef.current - 1)) + Math.floor(Math.random() * 250);
    onState('retrying');

    clearRetryTimer();
    retryTimerRef.current = window.setTimeout(async () => {
      try {
        await engine.load?.(source);
        // wait for canplay/loadedmetadata to flip back to ok
      } catch {
        // if load throws synchronously, try again next engine_error
      } finally {
        retryingRef.current = false;
      }
    }, delay) as unknown as number;
  }, [engine, source, maxAttempts, baseDelayMs, onState]);

  React.useEffect(() => {
    attemptsRef.current = 0;
    onState('ok');

    const unErr = engine.on?.('engine_error', (e) => {
      // Do not flip UI to "error" here. Let retries happen quietly.
      if (e.fatal) scheduleRetry();
      // non-fatal errors are ignored; engine should self-recover
    });

    const unMeta = engine.on?.('engine_loadedmetadata', () => {
      attemptsRef.current = 0;
      onState('ok');
    });
    const unCanPlay = engine.on?.('engine_canplay', () => {
      attemptsRef.current = 0;
      onState('ok');
    });

    const unBufStart = engine.on?.('engine_buffering_start', () => {
      if (stallTimerRef.current != null) return;
      stallTimerRef.current = window.setTimeout(() => {
        onState('stall');
      }, stallGraceMs) as unknown as number;
    });
    const unBufEnd = engine.on?.('engine_buffering_end', () => {
      if (stallTimerRef.current != null) {
        window.clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      if (!retryingRef.current) onState('ok');
    });

    const onOnline = () => {
      if (navigator.onLine && attemptsRef.current >= maxAttempts) {
        // Give it one more try on connectivity restore
        attemptsRef.current = Math.max(0, maxAttempts - 1);
        scheduleRetry();
      }
    };
    window.addEventListener('online', onOnline);

    return () => {
      clearRetryTimer();
      if (stallTimerRef.current != null) window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
      window.removeEventListener('online', onOnline);
      unErr?.();
      unMeta?.();
      unCanPlay?.();
      unBufStart?.();
      unBufEnd?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, source.id, source.url]); // resubscribe when source changes
}
