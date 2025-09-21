/** src/player/ads/vast.ts */
import type { VastResponse, AdCreativeLinear, AdMediaFile, VastTrackingEvent } from './types';

const T = (el: Element | null) => (el?.textContent ?? '').trim();
const S = (s?: string | null) => (s ?? '').trim();

export async function fetchVast(url: string): Promise<VastResponse> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`VAST HTTP ${res.status}`);
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const errorUrls = Array.from(doc.querySelectorAll('Error')).map((n) => T(n));
  const wrapperImpressions = Array.from(doc.querySelectorAll('Wrapper Impression'))
    .map((n) => T(n))
    .filter(Boolean);
  const wrapperTracking: Record<string, string[]> = {};
  Array.from(doc.querySelectorAll('Wrapper Tracking')).forEach((t) => {
    const ev = (t.getAttribute('event') ?? '').trim();
    (wrapperTracking[ev] ||= []).push(T(t));
  });
  const wrapperClickTracking = Array.from(doc.querySelectorAll('Wrapper VideoClicks > ClickTracking'))
    .map((n) => T(n))
    .filter(Boolean);

  // Wrapper? follow VASTAdTagURI
  const wrapperUri =
    doc.querySelector('VAST Ad Wrapper VASTAdTagURI') || doc.querySelector('VAST > Ad > Wrapper > VASTAdTagURI');

  if (wrapperUri) {
    const next = await fetchVast(T(wrapperUri));
    // merge wrapper → inline
    next.errorUrls = [...errorUrls, ...next.errorUrls];
    next.impressions = [...wrapperImpressions, ...next.impressions];

    if (next.linear) {
      // merge tracking
      for (const [ev, urls] of Object.entries(wrapperTracking)) {
        (next.linear.tracking as any)[ev] = [...((next.linear.tracking as any)[ev] ?? []), ...urls];
      }
      // merge clickTracking
      (next.linear.clickTrackingUrls as any) = [
        ...wrapperClickTracking,
        ...((next.linear.clickTrackingUrls as any) ?? []),
      ];
    }
    return next;
  }

  const impressions = Array.from(doc.querySelectorAll('Impression'))
    .map((n) => T(n))
    .filter(Boolean);

  const linear = doc.querySelector('Linear');
  if (!linear) return { impressions, linear: undefined, errorUrls };

  const duration = toSec(T(linear.querySelector('Duration')));
  const skipOffsetAttr = linear.getAttribute('skipoffset') ?? '';
  const skipOffsetSec = parseSkipOffset(skipOffsetAttr, duration);

  // generic tracking map
  const tracking: Record<VastTrackingEvent, string[]> = {} as any;
  Array.from(linear.querySelectorAll('Tracking')).forEach((t) => {
    const ev = (t.getAttribute('event') ?? '') as VastTrackingEvent;
    if (!tracking[ev]) tracking[ev] = [];
    tracking[ev].push(T(t));
  });

  // progress offsets with seconds (support HH:MM:SS(.mmm) or %)
  const progress = Array.from(linear.querySelectorAll('Tracking[event="progress"]'))
    .map((t) => {
      const raw = t.getAttribute('offset') || '';
      const off = raw.endsWith('%') ? Math.floor((parseFloat(raw) / 100) * duration) : toSec(raw);
      return { url: T(t), offsetSec: Number.isFinite(off) ? off : undefined };
    })
    .filter((p) => p.url && typeof p.offsetSec === 'number');

  const clickThroughUrl = T(linear.querySelector('VideoClicks > ClickThrough'));
  const clickTrackingUrls = Array.from(linear.querySelectorAll('VideoClicks > ClickTracking'))
    .map((n) => T(n))
    .filter(Boolean);

  const mediaFiles: AdMediaFile[] = Array.from(linear.querySelectorAll('MediaFile'))
    .map((m) => ({
      url: T(m),
      type: S(m.getAttribute('type')),
      width: toInt(m.getAttribute('width')),
      height: toInt(m.getAttribute('height')),
      bitrate: toInt(m.getAttribute('bitrate')),
    }))
    .filter((m) => !!m.url);

  const companions = Array.from(doc.querySelectorAll('Companion'))
    .map((c) => {
      const staticRes = c.querySelector('StaticResource');
      const resUrl = staticRes ? T(staticRes) : '';
      return {
        width: toInt(c.getAttribute('width')) ?? 0,
        height: toInt(c.getAttribute('height')) ?? 0,
        resource: resUrl,
        clickThroughUrl: T(c.querySelector('CompanionClickThrough')) || undefined,
      };
    })
    .filter((c) => !!c.resource);

  function toNumberOrKeyword(value: string | null, a: string, b: string): 'left' | 'right' | 'top' | 'bottom' | number {
    const s = (value ?? '').trim().toLowerCase();
    if (s === a || s === b) return s as any;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : (a as any); // default to 'left' or 'top'
  }

  function parseIconTime(raw: string | null, totalDur: number): number | undefined {
    if (!raw) return undefined;
    const v = raw.trim();
    if (!v) return undefined;
    if (v.endsWith('%')) {
      const p = parseFloat(v);
      return Number.isFinite(p) ? Math.max(0, Math.floor((p / 100) * totalDur)) : undefined;
    }
    const s = toSec(v);
    return s || undefined;
  }

  const icons = Array.from(linear.querySelectorAll('Icons > Icon'))
    .map((ic) => {
      const w = toInt(ic.getAttribute('width')) ?? 0;
      const h = toInt(ic.getAttribute('height')) ?? 0;
      const xPos = toNumberOrKeyword(ic.getAttribute('xPosition'), 'left', 'right');
      const yPos = toNumberOrKeyword(ic.getAttribute('yPosition'), 'top', 'bottom');
      const margin = toInt(ic.getAttribute('margin')) ?? undefined;

      // timing (optional in spec)
      const offsetSec = parseIconTime(ic.getAttribute('offset'), duration);
      const durationSec = parseIconTime(ic.getAttribute('duration'), duration);

      const staticRes = ic.querySelector('StaticResource');
      const src = staticRes ? T(staticRes) : '';

      const clickThroughUrl = T(ic.querySelector('IconClicks > IconClickThrough')) || null;
      const clickTrackingUrls = Array.from(ic.querySelectorAll('IconClicks > IconClickTracking'))
        .map((n) => T(n))
        .filter(Boolean);

      const viewTrackingUrls = Array.from(ic.querySelectorAll('IconViewTracking'))
        .map((n) => T(n))
        .filter(Boolean);

      return {
        program: ic.getAttribute('program'),
        src,
        width: w,
        height: h,
        xPosition: xPos as any,
        yPosition: yPos as any,
        margin,
        offsetSec,
        durationSec,
        clickThroughUrl,
        clickTrackingUrls,
        viewTrackingUrls,
      };
    })
    .filter((i) => !!i.src);

  const linearCreative: AdCreativeLinear = {
    durationSec: duration,
    skipOffsetSec: skipOffsetSec ?? undefined,
    mediaFiles,
    clickThroughUrl: clickThroughUrl || undefined,
    clickTrackingUrls,
    tracking,
    companions,
    icons,
  };

  // attach progress without widening your types
  (linearCreative as any).progress = progress;

  return { impressions, linear: linearCreative, errorUrls };
}

function toSec(hms: string): number {
  const m = hms.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!m) return 0;
  const [, hh, mm, ss] = m;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}
function toInt(n: string | null): number | undefined {
  const v = n ? parseInt(n, 10) : NaN;
  return Number.isFinite(v) ? v : undefined;
}
function parseSkipOffset(val: string, duration: number): number | null {
  if (!val) return null;
  if (val.endsWith('%')) {
    const p = parseFloat(val);
    if (Number.isFinite(p)) return Math.floor((p / 100) * duration);
    return null;
  }
  const s = toSec(val);
  return s || null;
}

export function fireUrls(urls?: string[]) {
  if (!urls || urls.length === 0) return;
  urls.forEach((u) => {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(u, new Blob([], { type: 'application/x-www-form-urlencoded' }));
        return;
      }
    } catch {}
    try {
      fetch(u, { mode: 'no-cors', keepalive: true });
    } catch {}
  });
}

export function fireError(errorUrls = [] as string[], code: number) {
  if (!errorUrls || errorUrls.length === 0) return;
  errorUrls.forEach((u) => {
    const url = u.replace('[ERRORCODE]', String(code));
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([], { type: 'application/x-www-form-urlencoded' }));
        return;
      }
    } catch {}
    try {
      fetch(url, { mode: 'no-cors', keepalive: true });
    } catch {}
  });
}
