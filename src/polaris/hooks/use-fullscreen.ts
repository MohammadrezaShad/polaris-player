/** src/player/hooks/use-fullscreen.ts */
'use client';
import * as React from 'react';

type UseFullscreen = {
  active: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
  /** true if we successfully locked orientation to landscape */
  orientationLocked: boolean;
  /** in fullscreen but device is portrait (use for “rotate” hint on iOS) */
  needsRotateHint: boolean;
};

export function useFullscreen(
  containerRef: React.RefObject<HTMLElement>,
  videoRef?: React.RefObject<HTMLVideoElement>,
): UseFullscreen {
  const [active, setActive] = React.useState(false);
  const [orientationLocked, setOrientationLocked] = React.useState(false);
  const [needsRotateHint, setNeedsRotateHint] = React.useState(false);

  const isIOS = React.useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const iOSDevice = /iPad|iPhone|iPod/.test(ua);
    const iPadOS13Plus = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
    return iOSDevice || iPadOS13Plus;
  }, []);

  const supportsOrientationLock = React.useCallback(() => {
    return typeof window !== 'undefined' && !!(screen as any)?.orientation?.lock;
  }, []);

  const isPortrait = React.useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(orientation: portrait)')?.matches ?? false;
  }, []);

  const enter = React.useCallback(async () => {
    const el: any = containerRef.current;
    const v: any = videoRef?.current;
    if (!el) return;

    try {
      // iOS: use video’s native fullscreen; cannot programmatically lock orientation.
      if (isIOS() && v && typeof v.webkitEnterFullscreen === 'function') {
        v.webkitEnterFullscreen();
        setActive(true);
        setOrientationLocked(false);
        setNeedsRotateHint(isPortrait()); // show hint if they’re in portrait
        return;
      }

      // Other browsers: request element fullscreen.
      await (el.requestFullscreen?.() || el.webkitRequestFullscreen?.());
      setActive(true);

      // Try to lock to landscape where supported.
      if (supportsOrientationLock()) {
        try {
          await (screen as any).orientation.lock('landscape');
          setOrientationLocked(true);
        } catch {
          setOrientationLocked(false);
        }
      } else {
        setOrientationLocked(false);
      }

      setNeedsRotateHint(false);
    } catch {
      // ignore
    }
  }, [containerRef, videoRef, isIOS, supportsOrientationLock, isPortrait]);

  const exit = React.useCallback(async () => {
    const v: any = videoRef?.current;
    try {
      // If in document fullscreen, exit.
      if ((document as any).fullscreenElement || (document as any).webkitFullscreenElement) {
        // Try to unlock orientation first (if we locked it).
        if (orientationLocked && (screen as any)?.orientation?.unlock) {
          try {
            (screen as any).orientation.unlock();
          } catch {
            // ignore
          }
        }
        await ((document as any).exitFullscreen?.() || (document as any).webkitExitFullscreen?.());
        setActive(false);
        setOrientationLocked(false);
        setNeedsRotateHint(false);
        return;
      }

      // iOS video fullscreen exit.
      if (isIOS() && v && typeof v.webkitExitFullscreen === 'function') {
        v.webkitExitFullscreen();
        setActive(false);
        setOrientationLocked(false);
        setNeedsRotateHint(false);
      }
    } catch {
      // ignore
    }
  }, [videoRef, isIOS, orientationLocked]);

  const toggle = React.useCallback(async () => {
    return active ? exit() : enter();
  }, [active, enter, exit]);

  React.useEffect(() => {
    const v: any = videoRef?.current;

    const onDocFs = () => {
      const inFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setActive(inFs);
      if (!inFs) {
        setOrientationLocked(false);
        setNeedsRotateHint(false);
      }
    };

    const onWB = () => {
      setActive(true);
      setNeedsRotateHint(isIOS() && isPortrait());
    };
    const onWE = () => {
      setActive(false);
      setOrientationLocked(false);
      setNeedsRotateHint(false);
    };

    const onOrientationChange = () => {
      // Update rotate hint if we’re in fullscreen and can’t lock (iOS case)
      if (active && isIOS()) {
        setNeedsRotateHint(isPortrait());
      }
    };

    document.addEventListener('fullscreenchange', onDocFs);
    document.addEventListener('webkitfullscreenchange', onDocFs as any);

    // iOS video-specific events
    v?.addEventListener?.('webkitbeginfullscreen', onWB);
    v?.addEventListener?.('webkitendfullscreen', onWE);

    // Orientation listeners
    (screen as any)?.orientation?.addEventListener?.('change', onOrientationChange);
    window.addEventListener('orientationchange', onOrientationChange);

    return () => {
      document.removeEventListener('fullscreenchange', onDocFs);
      document.removeEventListener('webkitfullscreenchange', onDocFs as any);
      v?.removeEventListener?.('webkitbeginfullscreen', onWB);
      v?.removeEventListener?.('webkitendfullscreen', onWE);
      (screen as any)?.orientation?.removeEventListener?.('change', onOrientationChange);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, [videoRef, active, isIOS, isPortrait]);

  return { active, enter, exit, toggle, orientationLocked, needsRotateHint };
}
