/** src/player/adapters/dash/fairplay.ts
 * Tiny helpers for FairPlay with Shaka.
 */
export async function fetchServerCertificate(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`cert_http_${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** Heuristic contentId derivation (backend usually supplies via initData); fallback to asset host. */
export function deriveFairPlayContentId(manifestUrl: string): string {
  try {
    const u = new URL(manifestUrl);
    return u.host;
  } catch {
    return 'content-id';
  }
}
