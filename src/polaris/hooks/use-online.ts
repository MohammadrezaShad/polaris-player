/** src/player/hooks/use-online.ts */
'use client';
import * as React from 'react';

/** Simple online/offline hook. */
export function useOnline() {
  const get = () => (typeof navigator === 'undefined' ? true : navigator.onLine);
  const [online, setOnline] = React.useState<boolean>(get());

  React.useEffect(() => {
    const upd = () => setOnline(get());
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    return () => {
      window.removeEventListener('online', upd);
      window.removeEventListener('offline', upd);
    };
  }, []);

  return online;
}
