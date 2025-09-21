'use client';
import * as React from 'react';

type CastState = 'idle' | 'connecting' | 'connected' | 'error';

export function useCast(videoRef: React.RefObject<HTMLVideoElement>, opts?: { source?: { url?: string; title?: string; poster?: string } }) {
  const [available, setAvailable] = React.useState(false);
  const [state, setState] = React.useState<CastState>('idle');
  const sessionRef = React.useRef<any>(null);
  const saved = React.useRef<{ time: number; wasPlaying: boolean; muted: boolean; volume: number }>({
    time: 0, wasPlaying: false, muted: false, volume: 1
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasCAF = !!(window as any).cast && !!(window as any).chrome && !!(window as any).cast.framework;
    setAvailable(hasCAF);
    if (!hasCAF) return;
    const ctx = (window as any).cast.framework.CastContext.getInstance();
    ctx.setOptions?.({ receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID });
    const onSession = () => {
      const s = ctx.getCurrentSession?.();
      sessionRef.current = s || null;
    };
    ctx.addEventListener?.((window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED, onSession);
    onSession();
    return () => {
      try { ctx.removeEventListener?.((window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED, onSession); } catch {}
    };
  }, []);

  const start = React.useCallback(async () => {
    if (!available) return;
    try {
      setState('connecting');
      const ctx = (window as any).cast.framework.CastContext.getInstance();
      const v = videoRef.current as HTMLVideoElement | null;
      if (v) {
        saved.current = { time: v.currentTime || 0, wasPlaying: !v.paused, muted: v.muted, volume: v.volume };
        v.pause();
      }
      const ses = await ctx.requestSession();
      sessionRef.current = ses;
      if (ses && opts?.source?.url) {
        const mediaInfo = new (window as any).chrome.cast.media.MediaInfo(opts.source.url);
        mediaInfo.metadata = new (window as any).chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = opts.source.title || 'Video';
        mediaInfo.metadata.images = opts.source.poster ? [{ url: opts.source.poster }] : [];
        const req = new (window as any).chrome.cast.media.LoadRequest(mediaInfo);
        await ses.loadMedia(req);
      }
      setState('connected');
    } catch (e) {
      setState('error');
    }
  }, [available, videoRef, JSON.stringify(opts?.source || null)]);

  const stop = React.useCallback(async () => {
    try {
      const ses = sessionRef.current;
      if (ses) await ses.endSession(true);
    } catch {}
    sessionRef.current = null;
    setState('idle');
    const v = videoRef.current as HTMLVideoElement | null;
    if (v) {
      const s = saved.current;
      v.currentTime = s.time || 0;
      v.muted = s.muted;
      v.volume = s.volume;
      if (s.wasPlaying) v.play?.();
    }
  }, [videoRef]);

  return { available, state, start, stop };
}
