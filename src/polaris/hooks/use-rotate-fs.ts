'use client';
import * as React from 'react';

export function useRotateToFullscreen(containerRef: React.RefObject<HTMLElement>, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled || typeof screen === 'undefined' || !('orientation' in screen)) return;
    const onChange = async () => {
      try {
        const ang = (screen.orientation && (screen.orientation as any).angle) || window.orientation || 0;
        if (Math.abs(ang) === 90) {
          const el = containerRef.current as any;
          if (el && !document.fullscreenElement) await el.requestFullscreen?.();
        }
      } catch {}
    };
    window.addEventListener('orientationchange', onChange);
    return () => window.removeEventListener('orientationchange', onChange);
  }, [enabled, containerRef]);
}
