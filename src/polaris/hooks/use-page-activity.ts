'use client';
import * as React from 'react';

export function usePageActivity(containerRef: React.RefObject<Element | null>) {
  const [visible, setVisible] = React.useState(true);
  const [inView, setInView] = React.useState(true);

  React.useEffect(() => {
    const onVis = () => setVisible(document.visibilityState !== 'hidden');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setInView(e?.isIntersecting ?? true);
      },
      { threshold: [0, 0.25, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [containerRef]);

  const active = visible && inView;
  return { visible, inView, active };
}
