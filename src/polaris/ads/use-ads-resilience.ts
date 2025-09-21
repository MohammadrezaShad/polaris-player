'use client';
import * as React from 'react';

type OnError = (e: unknown) => void;

type Backoff = { nextMs: number; failCount: number };

export function useAdsResilience(onError?: OnError) {
  const ref = React.useRef<Backoff>({ nextMs: 1000, failCount: 0 });
  const [blocked, setBlocked] = React.useState(false);

  const failed = React.useCallback(
    (e?: unknown) => {
      const st = ref.current;
      st.failCount += 1;
      st.nextMs = Math.min(30000, st.nextMs * 2);
      if (st.failCount >= 3) setBlocked(true);
      onError?.(e);
    },
    [onError],
  );

  const reset = React.useCallback(() => {
    ref.current = { nextMs: 1000, failCount: 0 };
    setBlocked(false);
  }, []);

  return { backoffMs: ref.current.nextMs, fails: ref.current.failCount, blocked, failed, reset };
}
