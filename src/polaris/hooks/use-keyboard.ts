'use client';
import * as React from 'react';

export function useKeyboardShortcuts(params: {
  adActive: boolean;
  engine: any;
  currentTime: number;
  texts: any[];
  textId?: string;
  setTextId: (id?: string) => void;
  togglePlay: () => void;
  seekBy: (delta: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  togglePiP: () => void;
  announce?: (s: string) => void;
  t: (k: string, vars?: any) => string;
  chapters?: { start: number; title?: string }[];
}) {
  const {
    adActive,
    engine,
    currentTime,
    texts,
    textId,
    setTextId,
    togglePlay,
    seekBy,
    toggleMute,
    toggleFullscreen,
    togglePiP,
    announce,
    t,
    chapters,
  } = params;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key.toLowerCase();

    if (e.altKey && (key === 'arrowleft' || key === 'arrowright')) {
      e.preventDefault();
      const list = (chapters ?? []).slice().sort((a, b) => a.start - b.start);
      const tcur = engine.getCurrentTime?.() ?? currentTime;
      if (list.length) {
        if (key === 'arrowleft') {
          let target = 0;
          for (const c of list) {
            if (c.start < tcur - 0.3) target = c.start;
            else break;
          }
          engine.seekTo?.(target);
          announce?.(t('a11y.chapterJumpPrev'));
        } else {
          let target: number | null = null;
          for (const c of list) {
            if (c.start > tcur + 0.3) {
              target = c.start;
              break;
            }
          }
          if (target != null) {
            engine.seekTo?.(target);
            announce?.(t('a11y.chapterJumpNext'));
          }
        }
      }
      return;
    }
    if (e.defaultPrevented) return;
    if (adActive) {
      if (key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
      return;
    }

    if (key === ' ' || key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (key === 'j') {
      e.preventDefault();
      seekBy(-10);
    } else if (key === 'l') {
      e.preventDefault();
      seekBy(+10);
    } else if (key === 'arrowleft') {
      e.preventDefault();
      seekBy(-5);
    } else if (key === 'arrowright') {
      e.preventDefault();
      seekBy(+5);
    } else if (key === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (key === 'f') {
      e.preventDefault();
      toggleFullscreen();
    } else if (key === 'p') {
      e.preventDefault();
      togglePiP();
    } else if (key === 'c') {
      e.preventDefault();
      if (texts.length === 0) return;
      if (!textId) {
        const id = texts[0].id;
        setTextId(id);
        engine.setTextTrack?.(id);
      } else {
        const idx = texts.findIndex((t: any) => t.id === textId);
        const next = (idx + 1) % (texts.length + 1);
        if (next === texts.length) {
          setTextId(undefined);
          engine.setTextTrack?.(undefined as any);
        } else {
          const id = texts[next].id;
          setTextId(id);
          engine.setTextTrack?.(id);
        }
      }
    }
  };

  return { onKeyDown };
}
