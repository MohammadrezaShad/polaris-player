'use client';
import * as React from 'react';

export function useTheaterMini(containerRef: React.RefObject<HTMLElement>) {
  const [theater, setTheater] = React.useState(false);
  const [mini, setMini] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setMini(!e.isIntersecting && !document.pictureInPictureElement);
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [containerRef.current]);

  React.useEffect(() => {
    const el = containerRef.current as HTMLElement | null;
    if (!el) return;
    if (theater) el.classList.add('player-theater');
    else el.classList.remove('player-theater');
  }, [theater, containerRef.current]);

  return { theater, setTheater, mini };
}
