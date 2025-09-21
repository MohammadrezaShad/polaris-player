'use client';
import * as React from 'react';

export function useMobileExtras(params: {
  statePlaying: boolean;
  pipActive: boolean;
  togglePiP: () => void;
  fsActive: boolean;
  toggleFullscreen: () => void;
  adActive: boolean;
}) {
  const { fsActive, toggleFullscreen } = params;

  // Rotate-to-Fullscreen
  const autoFsRef = React.useRef(false);
  React.useEffect(() => {
    const handler = () => {
      const isLandscape =
        (screen.orientation && (screen.orientation as any).type?.includes('landscape')) ||
        Math.abs((window as any).orientation ?? 0) === 90;
      if (isLandscape && !fsActive) {
        autoFsRef.current = true;
        toggleFullscreen();
      } else if (!isLandscape && fsActive && autoFsRef.current) {
        autoFsRef.current = false;
        toggleFullscreen();
      }
    };
    (screen.orientation as any)?.addEventListener?.('change', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      try {
        (screen.orientation as any)?.removeEventListener?.('change', handler);
      } catch {}
      window.removeEventListener('orientationchange', handler);
    };
  }, [fsActive, toggleFullscreen]);
}
