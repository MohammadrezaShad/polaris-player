'use client';
import * as React from 'react';

export function useReducedMotion(targetRef?: React.RefObject<HTMLElement>) {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(!!mq.matches);
    onChange();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    if ('onchange' in mq) {
      (mq as MediaQueryList).onchange = onChange as any;
      return () => {
        (mq as MediaQueryList).onchange = null as any;
      };
    }
    (mq as any).addListener(onChange);
    return () => (mq as any).removeListener(onChange);
  }, []);
  React.useEffect(() => {
    const el = targetRef?.current;
    if (!el) return;
    el.classList.toggle('reduced-motion', reduce);
  }, [reduce, targetRef]);
  return reduce;
}
