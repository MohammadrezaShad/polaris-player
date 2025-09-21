'use client';
import * as React from 'react';

export type CaptionStyle = {
  size: 's' | 'm' | 'l';
  bg: 'none' | 'semi' | 'solid';
  font: 'system' | 'serif' | 'mono';
  weight: 'regular' | 'bold';
  outline: 'none' | 'thin' | 'thick';
  shadow: 'none' | 'soft' | 'heavy';
};

type Props = {
  video: HTMLVideoElement | null;
  active: boolean;
  /** prefer this */
  selectedTrackId?: string;
  /** fallbacks if id is missing on TextTrack */
  selectedLang?: string;
  selectedLabel?: string;
  style: CaptionStyle;
  safeBottomPx?: number;
};

const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF]/; // Hebrew + Arabic blocks
const isRTL = (t: string) => RTL_RE.test(t);

// Tiny sanitizer for cue HTML
function sanitizeCueHTML(input: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
    const allowed = new Set(['B', 'I', 'U', 'BR', 'RUBY', 'RB', 'RT', 'RP', 'SPAN', 'EM', 'STRONG']);
    const walk = (n: Node): Node | null => {
      if (n.nodeType === Node.TEXT_NODE) return n.cloneNode(true);
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        if (!allowed.has(el.tagName)) {
          const frag = doc.createDocumentFragment();
          el.childNodes.forEach((c) => {
            const w = walk(c);
            if (w) frag.appendChild(w);
          });
          return frag;
        }
        const clone = doc.createElement(el.tagName);
        // only carry safe attributes
        ['dir', 'lang'].forEach((a) => {
          const v = el.getAttribute(a);
          if (v) clone.setAttribute(a, v);
        });
        el.childNodes.forEach((c) => {
          const w = walk(c);
          if (w) clone.appendChild(w);
        });
        return clone;
      }
      return null;
    };
    const container = doc.body.firstElementChild as HTMLElement | null;
    if (!container) return '';
    const out = doc.createElement('div');
    container.childNodes.forEach((n) => {
      const w = walk(n);
      if (w) out.appendChild(w);
    });
    return out.innerHTML;
  } catch {
    // extremely defensive fallback
    return input.replace(/[<>]/g, (m) => (m === '<' ? '&lt;' : '&gt;'));
  }
}

function styleToInline(style: CaptionStyle): React.CSSProperties {
  const fontFamily =
    style.font === 'system'
      ? 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"'
      : style.font === 'serif'
        ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
        : 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

  const fontWeight = style.weight === 'bold' ? 700 : 500;
  const fontSize = style.size === 's' ? '0.875rem' : style.size === 'm' ? '1rem' : '1.25rem';
  const lineHeight = style.size === 'l' ? 1.35 : 1.3;

  const shadows: string[] = [];
  if (style.outline === 'thin') shadows.push('0 0 1px rgba(0,0,0,0.85)', '0 0 2px rgba(0,0,0,0.7)');
  else if (style.outline === 'thick')
    shadows.push('0 0 2px rgba(0,0,0,0.9)', '0 0 4px rgba(0,0,0,0.8)', '0 0 6px rgba(0,0,0,0.65)');
  if (style.shadow === 'soft') shadows.push('0 2px 6px rgba(0,0,0,0.4)');
  else if (style.shadow === 'heavy') shadows.push('0 4px 12px rgba(0,0,0,0.6)');

  return { fontFamily, fontWeight, fontSize, lineHeight, textShadow: shadows.join(', ') };
}

/** Try to find the selected TextTrack by id, then label/lang, then currently showing/hidden one. */
function pickTrack(video: HTMLVideoElement, opts: { id?: string; lang?: string; label?: string }) {
  const tracks = Array.from(video.textTracks ?? []);
  const byId = tracks.find((t) => (t as any).id && (t as any).id === opts.id);
  if (byId) return byId as TextTrack;

  if (opts.label) {
    const byLabel = tracks.find((t) => (t as any).label && String((t as any).label).trim() === opts.label?.trim());
    if (byLabel) return byLabel as TextTrack;
  }
  if (opts.lang) {
    const byLang = tracks.find(
      (t) => (t as any).language && String((t as any).language).toLowerCase() === opts.lang?.toLowerCase(),
    );
    if (byLang) return byLang as TextTrack;
  }
  const showing = tracks.find((t) => t.mode === 'showing' || t.mode === 'hidden');
  return showing ?? tracks[0];
}

export function CaptionOverlay({
  video,
  active,
  selectedTrackId,
  selectedLang,
  selectedLabel,
  style,
  safeBottomPx = 24,
}: Props) {
  const [html, setHtml] = React.useState('');
  const [dir, setDir] = React.useState<'ltr' | 'rtl'>('ltr');
  const trackRef = React.useRef<TextTrack | null>(null);

  // Hide native captions but keep cues flowing on the chosen track
  React.useEffect(() => {
    if (!video) return;
    const t = pickTrack(video, { id: selectedTrackId, lang: selectedLang, label: selectedLabel });
    trackRef.current = t ?? null;

    const tracks = Array.from(video.textTracks ?? []);
    tracks.forEach((tr) => {
      try {
        tr.mode = 'disabled';
      } catch {}
    });
    if (t) {
      try {
        t.mode = 'hidden';
      } catch {}
    }
  }, [video, selectedTrackId, selectedLang, selectedLabel]);

  // Subscribe to cue changes
  React.useEffect(() => {
    if (!video || !active) {
      setHtml('');
      return;
    }
    const t = trackRef.current ?? pickTrack(video, { id: selectedTrackId, lang: selectedLang, label: selectedLabel });
    if (!t) {
      setHtml('');
      return;
    }

    const onCue = () => {
      const cues = t.activeCues;
      if (!cues || cues.length === 0) {
        setHtml('');
        return;
      }
      const parts: string[] = [];
      let rtl = false;
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i] as VTTCue | any;
        const raw = cue.text ?? '';
        parts.push(`<div class="cue-line">${sanitizeCueHTML(raw)}</div>`);
        if (!rtl && raw && isRTL(raw)) rtl = true;
      }
      setDir(rtl ? 'rtl' : 'ltr');
      setHtml(parts.join(''));
    };

    onCue();
    t.addEventListener('cuechange', onCue as any);
    return () => {
      try {
        t.removeEventListener('cuechange', onCue as any);
      } catch {}
    };
  }, [video, active, selectedTrackId, selectedLang, selectedLabel]);

  const chipBg = style.bg === 'none' ? 'bg-transparent' : style.bg === 'semi' ? 'bg-black/55' : 'bg-black';

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none absolute inset-x-2 bottom-0 z-40 select-none"
      style={{ paddingBottom: `calc(${safeBottomPx}px + env(safe-area-inset-bottom))` }}
    >
      <div
        dir={dir}
        className="mx-auto max-w-[90%] text-center text-white drop-shadow"
        style={styleToInline(style)}
        dangerouslySetInnerHTML={{
          __html: html
            ? `<div class="${chipBg} inline-block px-2.5 ${style.size === 'l' ? 'py-2' : 'py-1.5'} rounded-md">${html}</div>`
            : '',
        }}
      />
    </div>
  );
}
