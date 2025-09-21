'use client';
import * as React from 'react';

type Chapter = { start: number; title?: string };
type ChaptersSource = Chapter[] | { url: string; type?: 'vtt' | 'json' } | string | undefined;

function parseTime(t: string): number {
  const parts = t.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const f = parseFloat(t);
  return Number.isFinite(f) ? f : 0;
}

async function loadVtt(url: string): Promise<Chapter[]> {
  const txt = await fetch(url).then((r) => r.text());
  const lines = txt.split(/\r?\n/);
  const out: Chapter[] = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (L.includes('-->')) {
      const [startStr] = L.split('-->').map((s) => s.trim());
      const title = (lines[i + 1] || '').trim();
      out.push({ start: parseTime(startStr.replace(',', '.')), title: title || undefined });
    }
  }
  return out;
}

async function loadJSON(url: string): Promise<Chapter[]> {
  const arr = await fetch(url).then((r) => r.json());
  if (Array.isArray(arr)) {
    return arr.map((c: any) => ({ start: Number(c.start) || 0, title: c.title }));
  }
  return [];
}

export function useChapters(source: { chapters?: ChaptersSource } | undefined) {
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const src = source?.chapters;
      try {
        if (!src) {
          if (alive) setChapters([]);
          return;
        }
        if (Array.isArray(src)) {
          if (alive) setChapters(src);
          return;
        }
        if (typeof src === 'string') {
          const isVtt = src.toLowerCase().endsWith('.vtt');
          const data = isVtt ? await loadVtt(src) : await loadJSON(src);
          if (alive) setChapters(data);
          return;
        }
        if (typeof src === 'object' && (src as any).url) {
          const u = (src as any).url as string;
          const type = (src as any).type || (u.toLowerCase().endsWith('.vtt') ? 'vtt' : 'json');
          const data = type === 'vtt' ? await loadVtt(u) : await loadJSON(u);
          if (alive) setChapters(data);
          return;
        }
      } catch {}
      if (alive) setChapters([]);
    })();
    return () => {
      alive = false;
    };
  }, [JSON.stringify((source as any)?.chapters || null)]);
  return chapters.sort((a, b) => a.start - b.start);
}
