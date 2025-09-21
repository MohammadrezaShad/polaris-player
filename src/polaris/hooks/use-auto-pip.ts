'use client';
import * as React from 'react';

export function useAutoPiP(videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const onHide = async () => {
      if (
        document.hidden &&
        document.pictureInPictureEnabled &&
        videoRef.current &&
        !document.pictureInPictureElement
      ) {
        try {
          await (videoRef.current as any).requestPictureInPicture();
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [enabled, videoRef]);
}
