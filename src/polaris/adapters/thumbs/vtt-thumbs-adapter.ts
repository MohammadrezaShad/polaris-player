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
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  return Number(parts[0]);
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

export async function createVttThumbs(
  vttUrl: string,
  opts?: {
    baseUrl?: string;
    /** query params to strip for text + (default) images key normalization */
    stripParams?: string[];
    /** override which params to strip for images only */
    imageStripParams?: string[];
    /** 'blob' (default) prevents repeat network hits even with no-store CDNs */
    imageCacheMode?: "blob" | "image";
  }
): Promise<VttThumbs> {
  const text = await fetchTextCached(vttUrl, { stripParams: opts?.stripParams ?? ["cb", "ts", "t"] });

  // ---- parse cues
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

  // ---- image loader with Blob URL cache
  const imageStrip = opts?.imageStripParams ?? opts?.stripParams ?? ["cb", "ts", "t", "token", "sig", "signature", "exp", "expires", "Key-Pair-Id", "Policy"];

  type ImgEntry = { img: HTMLImageElement; objectUrl?: string };
  const imgCache = new Map<string, ImgEntry>();
  let disposed = false;

  function normalize(src: string) {
    return normalizeKey(src, imageStrip);
  }

  async function loadImg(src: string): Promise<HTMLImageElement> {
    const key = normalize(src);
    const cached = imgCache.get(key);
    if (cached) return cached.img;

    if ((opts?.imageCacheMode ?? "blob") === "blob") {
      try {
        const r = await fetch(src, { mode: "cors", credentials: "omit", cache: "no-store" });
        if (!r.ok) throw new Error(`image blob fetch failed: ${r.status}`);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
        imgCache.set(key, { img, objectUrl: url });
        return img;
      } catch {
        // fallback to standard img load
      }
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    imgCache.set(key, { img });
    return img;
  }

  const cuesSorted = cues.slice().sort((a, b) => a.start - b.start);
  const findCue = (t: number) => cuesSorted.find((c) => t >= c.start && t < c.end);

  async function at(t: number) {
    if (disposed) return undefined;
    const cue = findCue(t);
    if (!cue) return undefined;
    const img = await loadImg(cue.src);
    return { img, cue };
  }

  function warmup(t: number, span = 10) {
    const start = t - span / 2;
    const end = t + span / 2;
    for (const c of cuesSorted) {
      if (c.end < start) continue;
      if (c.start > end) break;
      void loadImg(c.src).catch(() => {});
    }
  }

  function dispose() {
    disposed = true;
    for (const entry of imgCache.values()) {
      if (entry.objectUrl) {
        try {
          URL.revokeObjectURL(entry.objectUrl);
        } catch {}
      }
    }
    imgCache.clear();
  }

  return { at, warmup, dispose };
}

// ---- VTT text cache (key normalized)
const textCache = new Map<string, Promise<string>>();

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
