/** src/player/hooks/use-media-query.ts */
'use client';
import * as React from 'react';

/**
 * SSR-safe media query hook.
 * - Returns `null` on the server / before mount, then `true|false` on the client.
 * - Use: const mq = useMediaQuery('(min-width: 768px)');
 *        if (mq === null) render nothing that depends on it to avoid hydration mismatch.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setMatches(m.matches);
    update(); // set initial on mount
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);

  return matches;
}
