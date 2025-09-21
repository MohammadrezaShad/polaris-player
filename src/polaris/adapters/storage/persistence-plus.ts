/** src/player/adapters/storage/persistence-plus.ts */
'use client';

import type { StoragePort, UserPrefs } from '../../ports';

type Options = {
  namespace?: string; // key prefix
  version?: number; // storage schema version
  ttlPrefsSec?: number; // TTL for prefs
  ttlResumeSec?: number; // TTL for resume time
  enabled?: boolean; // allow writes
  consent?: () => boolean; // CMP gating
};

/** Create an SSR-safe StoragePort with TTL + quota fallback + opt-in writes */
export function createPersistencePlus(opts: Options = {}): StoragePort & {
  setEnabled(e: boolean): void;
  clearAll(): Promise<void>;
} {
  // ✅ NEVER assume window exists at module scope
  const isBrowser = typeof window !== 'undefined' && !!window.localStorage;

  const namespace = opts.namespace ?? 'player';
  const ver = opts.version ?? 1;
  const ttlPrefs = opts.ttlPrefsSec ?? 365 * 24 * 3600; // 1y
  const ttlResume = opts.ttlResumeSec ?? 30 * 24 * 3600; // 30d
  let enabled = opts.enabled ?? true;

  // In-memory fallback (SSR or quota exceeded)
  const mem = new Map<string, string>();
  const nowSec = () => Math.floor(Date.now() / 1000);

  const kPrefs = (key: string) => `${namespace}:v${ver}:prefs:${key}`;
  const kResume = (key: string) => `${namespace}:v${ver}:resume:${key}`;

  const read = async (k: string): Promise<any | null> => {
    const raw = isBrowser ? window.localStorage.getItem(k) : mem.get(k);
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      if (typeof obj.exp === 'number' && obj.exp < nowSec()) {
        // expired → delete
        if (isBrowser) window.localStorage.removeItem(k);
        else mem.delete(k);
        return null;
      }
      return obj.v;
    } catch {
      return null;
    }
  };

  const write = async (k: string, v: any, ttlSec: number) => {
    if (!enabled) return;
    if (opts.consent && !opts.consent()) return;
    const payload = JSON.stringify({ v, exp: nowSec() + ttlSec });
    if (isBrowser) {
      try {
        window.localStorage.setItem(k, payload);
      } catch {
        // Quota / Safari private → fallback to memory
        mem.set(k, payload);
      }
    } else {
      mem.set(k, payload);
    }
  };

  const api: StoragePort & { setEnabled(e: boolean): void; clearAll(): Promise<void> } = {
    async getPrefs(key: string): Promise<UserPrefs | null> {
      return (await read(kPrefs(key))) as UserPrefs | null;
    },
    async setPrefs(key: string, prefs: UserPrefs): Promise<void> {
      await write(kPrefs(key), prefs, ttlPrefs);
    },
    async getResume(key: string): Promise<number | null> {
      return (await read(kResume(key))) as number | null;
    },
    async setResume(key: string, seconds: number): Promise<void> {
      await write(kResume(key), seconds, ttlResume);
    },
    setEnabled(e: boolean) {
      enabled = !!e;
    },
    async clearAll() {
      if (isBrowser) {
        const prefix = `${namespace}:v${ver}:`;
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(prefix)) window.localStorage.removeItem(k);
        }
      }
      mem.clear();
    },
  };

  // Cross-tab sync (guarded; safe on SSR)
  if (isBrowser && typeof window.addEventListener === 'function') {
    try {
      window.addEventListener('storage', () => {
        // hook for future: could emit a bus event to refresh UI
      });
    } catch {}
  }

  return api;
}
