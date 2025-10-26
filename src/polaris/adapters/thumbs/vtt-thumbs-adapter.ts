/** src/player/adapters/thumbs/vtt-thumbs-adapter.ts */
"use client";

export type ThumbRegionPx = { x: number; y: number; w: number; h: number };
export type ThumbRegion = (ThumbRegionPx & { isPercent?: false }) | { x: number; y: number; w: number; h: number; isPercent: true };
export type ThumbCue = { start: number; end: number; src: string; region: ThumbRegion };

export interface VttThumbs {
  at(t: number): Promise<{ img: HTMLImageElement; cue: ThumbCue } | undefined>;
  warmup(t: number, span?: number): void;
  dispose(): void;
}

function parseTime(s: string): number {
  const parts = s.trim().split(":");
  let sec = 0;
  if (parts.length === 3) sec = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  else if (parts.length === 2) sec = Number(parts[0]) * 60 + Number(parts[1]);
  else sec = Number(parts[0]);
  return sec;
}

function parseRegion(hash: string): { x: number; y: number; w: number; h: number; isPercent: boolean } | null {
  const m = /#.*?xywh=([^\s]+)/i.exec(hash);
  if (!m) return null;
  const val = m[1];
  let isPercent = false;
  let nums: string;
  if (/^percent[: ,]/i.test(val)) {
    isPercent = true;
    nums = val.replace(/^percent[: ,]*/i, "");
  } else if (/^pixels?[: ]/i.test(val)) {
    nums = val.replace(/^pixels?[: ]*/i, "");
  } else {
    nums = val;
  }
  const parts = nums.split(/[ ,]/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = parts;
  return { x, y, w, h, isPercent };
}

export async function createVttThumbs(vttUrl: string, opts?: { baseUrl?: string }): Promise<VttThumbs> {
  const text = await fetchTextCached(vttUrl, { stripParams: ["cb", "ts", "t"] });
  const cues: ThumbCue[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line) continue;
    if (line.startsWith("WEBVTT") || line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION")) continue;
    let startLine = line;
    if (!/-->/.test(startLine) && i < lines.length) {
      startLine = lines[i].trim();
      i++;
    }
    const m = /([\d:.]+)\s*-->\s*([\d:.]+)/.exec(startLine);
    if (!m) continue;
    const start = parseTime(m[1]);
    const end = parseTime(m[2]);
    let payload = "";
    while (i < lines.length && lines[i].trim() !== "") {
      const pl = lines[i].trim();
      payload += (payload ? " " : "") + pl;
      i++;
    }
    const srcMatch = /(.*?)(#.*)?$/.exec(payload);
    if (!srcMatch) continue;
    const srcRaw = (srcMatch[1] || "").trim();
    const hash = (srcMatch[2] || "").trim();
    const region = parseRegion(hash || "");
    if (!srcRaw || !region) continue;
    const base = opts?.baseUrl || vttUrl;
    const resolved = new URL(srcRaw, base).toString();
    cues.push({ start, end, src: resolved, region });
  }

  const imgCache = new Map<string, HTMLImageElement>();
  let disposed = false;

  function loadImg(src: string): Promise<HTMLImageElement> {
    if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!disposed) {
          imgCache.set(src, img);
          resolve(img);
        }
      };
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  const cuesSorted = cues.slice().sort((a, b) => a.start - b.start);
  function findCue(t: number): ThumbCue | undefined {
    return cuesSorted.find((c) => t >= c.start && t < c.end);
  }

  async function at(t: number) {
    if (disposed) return undefined;
    const cue = findCue(t);
    if (!cue) return undefined;
    const img = await loadImg(cue.src);
    return { img, cue };
  }
  function warmup(t: number, span: number = 10) {
    const start = t - span / 2;
    const end = t + span / 2;
    for (const c of cuesSorted) {
      if (c.end < start) continue;
      if (c.start > end) break;
      loadImg(c.src).catch(() => {});
    }
  }
  function dispose() {
    disposed = true;
    imgCache.clear();
  }

  return { at, warmup, dispose };
}
const textCache = new Map<string, Promise<string>>();

/** Fetches a text (VTT) once, returns the same promise thereafter. */
export function fetchTextCached(url: string, { stripParams = [] as string[] } = {}) {
  const key = normalizeKey(url, stripParams);
  if (!textCache.has(key)) {
    const p = fetch(url, { method: "GET", cache: "force-cache", credentials: "omit" }).then(async (r) => {
      if (!r.ok) throw new Error(`VTT fetch failed: ${r.status}`);
      return await r.text();
    });
    textCache.set(key, p);
  }
  return textCache.get(key)!;
}

function normalizeKey(raw: string, strip: string[]) {
  try {
    const u = new URL(raw, typeof window !== "undefined" ? window.location.href : "http://local");
    for (const p of strip) u.searchParams.delete(p);
    u.hash = "";
    if ([...u.searchParams.keys()].length > 1) {
      const entries = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
      u.search = "";
      for (const [k, v] of entries) u.searchParams.append(k, v);
    }
    return u.href;
  } catch {
    return raw;
  }
}
