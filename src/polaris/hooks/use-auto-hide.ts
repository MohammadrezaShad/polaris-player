/** src/player/hooks/use-auto-hide.ts */
'use client';
import * as React from 'react';

type Opts = { idleMs?: number };

export function useAutoHide({ idleMs = 2500 }: Opts) {
  const [visible, setVisible] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [interactionLock, setInteractionLock] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const activePointers = React.useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const armTimer = () => {
    clearTimer();
    if (menuOpen || interactionLock || activePointers.current > 0) return;
    timerRef.current = window.setTimeout(() => setVisible(false), idleMs);
  };

  const ping = React.useCallback(() => {
    setVisible(true);
    armTimer();
  }, [idleMs, menuOpen, interactionLock]);

  // Programmatic visibility control
  const toggleVisible = React.useCallback(() => {
    setVisible((v) => {
      const next = !v;
      if (next) armTimer();
      else clearTimer();
      return next;
    });
  }, [idleMs, menuOpen, interactionLock]);

  const setVisibleProgrammatic = React.useCallback(
    (next: boolean) => {
      setVisible((prev) => {
        if (prev === next) return prev;
        if (next) armTimer();
        else clearTimer();
        return next;
      });
    },
    [idleMs, menuOpen, interactionLock],
  );

  // pointer/hover handlers
  const onPointerMove = React.useCallback(() => {
    setVisible(true);
    armTimer();
  }, [idleMs, menuOpen, interactionLock]);
  const onPointerEnter = React.useCallback(() => {
    setInteractionLock(true);
    setVisible(true);
    clearTimer();
  }, []);
  const onPointerLeave = React.useCallback(() => {
    setInteractionLock(false);
    armTimer();
  }, []);
  const onPointerDown = React.useCallback(() => {
    activePointers.current += 1;
    setInteractionLock(true);
    setVisible(true);
    clearTimer();
  }, []);
  const onPointerUp = React.useCallback(() => {
    activePointers.current = Math.max(0, activePointers.current - 1);
    if (activePointers.current === 0) {
      setInteractionLock(false);
      armTimer();
    }
  }, []);

  // global up (mobile)
  React.useEffect(() => {
    const up = () => onPointerUp();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchend', up);
    };
  }, [onPointerUp]);

  React.useEffect(() => {
    armTimer();
    return clearTimer;
  }, [menuOpen, interactionLock]);

  return {
    visible,
    setVisible: setVisibleProgrammatic,
    toggleVisible,
    setMenuOpen,
    setInteractionLock,
    ping,
    onPointerMove,
    onControlsPointerEnter: onPointerEnter,
    onControlsPointerLeave: onPointerLeave,
    onControlsPointerDown: onPointerDown,
  };
}
