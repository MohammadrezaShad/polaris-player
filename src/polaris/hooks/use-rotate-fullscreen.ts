'use client';
import * as React from 'react';
export function useRotateFullscreen(containerRef: React.RefObject<HTMLElement>, enabled = false) {
  React.useEffect(() => {
    if (!enabled) return;
    const onChange = async () => {
      try {
        const type = (screen.orientation?.type || '').toLowerCase();
        if (type.includes('landscape')) {
          await (containerRef.current as any)?.requestFullscreen?.();
        } else if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {}
    };
    window.addEventListener('orientationchange', onChange);
    screen.orientation?.addEventListener?.('change', onChange);
    return () => {
      window.removeEventListener('orientationchange', onChange);
      screen.orientation?.removeEventListener?.('change', onChange);
    };
  }, [containerRef.current, enabled]);
}
