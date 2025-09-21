'use client';
import * as React from 'react';

type CastState = 'idle' | 'connecting' | 'connected' | 'unavailable' | 'error';

export function useCasting(videoRef: React.RefObject<HTMLVideoElement>) {
  const [state, setState] = React.useState<CastState>('idle');
  const [airplayAvailable, setAirplayAvailable] = React.useState(false);

  // AirPlay availability (Safari/iOS)
  React.useEffect(() => {
    const v = videoRef.current as any;
    setAirplayAvailable(!!v && typeof v.webkitShowPlaybackTargetPicker === 'function');
  }, [videoRef.current]);

  const showAirPlayPicker = React.useCallback(() => {
    const v = videoRef.current as any;
    if (!v || typeof v.webkitShowPlaybackTargetPicker !== 'function') return;
    try {
      v.webkitShowPlaybackTargetPicker();
    } catch {}
  }, [videoRef]);

  // Chromecast (CAF) – lazy detection; requires sender libs on page.
  const castAvailable = React.useMemo(() => !!(window as any).chrome?.cast && (window as any).cast?.framework, []);

  const startCast = React.useCallback(async () => {
    if (!castAvailable) {
      setState('unavailable');
      return;
    }
    try {
      setState('connecting');
      const cast = (window as any).cast;
      const ctx = cast.framework.CastContext.getInstance();
      ctx.setOptions({ receiverApplicationId: cast.framework.CastContext.SESSION_STATE_CHANGED });
      const sess = await ctx.requestSession();
      if (sess) setState('connected');
    } catch {
      setState('error');
    }
  }, [castAvailable]);

  const stopCast = React.useCallback(() => {
    try {
      const cast = (window as any).cast;
      cast.framework.CastContext.getInstance().endCurrentSession(true);
      setState('idle');
    } catch {}
  }, []);

  return { state, airplayAvailable, showAirPlayPicker, castAvailable, startCast, stopCast };
}
