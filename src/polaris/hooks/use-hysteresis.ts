/** src/player/hooks/use-hysteresis.ts */
'use client';
import * as React from 'react';

export function useHysteresis(active: boolean, showDelay = 120, hideDelay = 100) {
  const [vis, setVis] = React.useState(false);
  const t = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (t.current) {
      window.clearTimeout(t.current);
      t.current = null;
    }
    if (active) t.current = window.setTimeout(() => setVis(true), showDelay) as unknown as number;
    else t.current = window.setTimeout(() => setVis(false), hideDelay) as unknown as number;
    return () => {
      if (t.current) window.clearTimeout(t.current);
    };
  }, [active, showDelay, hideDelay]);
  return vis;
}
