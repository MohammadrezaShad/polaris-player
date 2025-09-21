/** src/player/hooks/use-pip.ts */
'use client';
import * as React from 'react';

export function usePiP(videoRef: React.RefObject<HTMLVideoElement>) {
  const [active, setActive] = React.useState(false);

  const toggle = async () => {
    const v: any = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await (document as any).exitPictureInPicture?.();
        setActive(false);
      } else {
        if ('requestPictureInPicture' in v) {
          await v.requestPictureInPicture();
          setActive(true);
        } else if ('webkitSetPresentationMode' in v) {
          v.webkitSetPresentationMode('picture-in-picture');
          setActive(true);
        }
      }
    } catch {}
  };

  React.useEffect(() => {
    const onLeave = () => setActive(false);
    document.addEventListener('leavepictureinpicture', onLeave);
    return () => document.removeEventListener('leavepictureinpicture', onLeave);
  }, []);

  return { active, toggle };
}
