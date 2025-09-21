'use client';
import * as React from 'react';
export function useMobileTapGate(opts: {
  getIsPlaying: () => boolean;
  controlsVisible: boolean;
  revealControls: () => void;
}) {
  const lastTap = React.useRef(0);
  const onPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      const now = Date.now();
      const delta = now - lastTap.current;
      lastTap.current = now;
      if ((e.pointerType === 'touch' || e.pointerType === 'pen') && delta > 400) {
        if (opts.getIsPlaying() && !opts.controlsVisible) {
          opts.revealControls();
          e.stopPropagation();
          e.preventDefault();
        }
      }
    },
    [opts],
  );
  return { onPointerUp };
}
