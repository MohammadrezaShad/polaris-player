/** src/player/ads/vmap.ts */
import type { AdSchedule, AdBreak } from './types';

const T = (el: Element | null) => (el?.textContent ?? '').trim();

export async function fetchVmapToSchedule(url: string): Promise<AdSchedule> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`VMAP HTTP ${res.status}`);
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const breaks: AdBreak[] = [];
  Array.from(doc.querySelectorAll('vmap\\:AdBreak, AdBreak')).forEach((b, i) => {
    const timeOffset = b.getAttribute('timeOffset') ?? 'start';
    const kind = timeOffset === 'start' ? 'preroll' : timeOffset === 'end' ? 'postroll' : 'midroll';
    const vastTag = T(b.querySelector('vmap\\:AdSource > vmap\\:AdTagURI, AdSource > AdTagURI'));
    const timeOffsetSec = kind === 'midroll' ? parseTimeOffsetToSec(timeOffset) : undefined;
    if (vastTag) {
      breaks.push({
        id: b.getAttribute('breakId') ?? `break_${i}`,
        kind: kind as any,
        timeOffsetSec,
        vastTagUrl: vastTag,
      });
    }
  });

  return { breaks };
}

function parseTimeOffsetToSec(val: string): number {
  if (val.endsWith('%')) {
    // percentage midroll—we'll resolve later using duration
    return -1; // mark as percentage; scheduler will compute
  }
  const m = val.match(/^(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  const [, hh, mm, ss] = m;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}
