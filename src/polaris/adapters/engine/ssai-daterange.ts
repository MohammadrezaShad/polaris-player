'use client';
// Minimal SSAI cue handling via text tracks carrying EXT-X-DATERANGE (engine must expose or inject as cues)
export type SsaiRange = { id: string; classId?: string; start: number; end?: number };

export function parseDateRangeCue(cueText: string): Partial<SsaiRange> | null {
  // crude parser: ID="...",CLASS="...",START-DATE,END-DATE etc.
  try {
    const id = /ID="([^"]+)"/.exec(cueText)?.[1];
    const cls = /CLASS="([^"]+)"/.exec(cueText)?.[1];
    if (!id) return null;
    return { id, classId: cls };
  } catch {
    return null;
  }
}
