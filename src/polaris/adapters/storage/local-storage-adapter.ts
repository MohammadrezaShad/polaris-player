// src/player/adapters/storage/local-storage-adapter.ts
const KEY = (k: string) => `player:${k}`;
const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const dispatchSync = () => window.dispatchEvent(new Event('player:persistence_sync'));

function canUseStorage() {
  try {
    const t = '__t__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

async function read<T>(k: string): Promise<T | null> {
  if (!canUseStorage()) return null;
  try {
    const s = localStorage.getItem(KEY(k));
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
async function write<T>(k: string, v: T) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEY(k), JSON.stringify(v));
    dispatchSync();
  } catch {}
}

export class LocalStorageAdapter {
  isConsentGranted() {
    if (!canUseStorage()) return false;
    return localStorage.getItem(KEY('consent')) !== 'false';
  }
  setEnabled(on: boolean) {
    if (!canUseStorage()) return;
    localStorage.setItem(KEY('consent'), on ? 'true' : 'false');
    dispatchSync();
  }
  clearAll() {
    if (!canUseStorage()) return;
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('player:') && k !== KEY('consent')) localStorage.removeItem(k);
    });
    dispatchSync();
  }

  async getPrefs(k: string) {
    if (!this.isConsentGranted()) return null;
    return await read<any>(`prefs:${k}`);
  }
  async setPrefs(k: string, v: any) {
    if (!this.isConsentGranted()) return;
    await write(`prefs:${k}`, v);
  }

  async getResume(k: string) {
    if (!this.isConsentGranted()) return null;
    return safeNum((await read<any>(`resume:${k}`))?.t) ?? null;
  }
  async setResume(k: string, t: number) {
    if (!this.isConsentGranted()) return;
    await write(`resume:${k}`, { t: Math.max(0, Math.floor(t)) });
  }
}
