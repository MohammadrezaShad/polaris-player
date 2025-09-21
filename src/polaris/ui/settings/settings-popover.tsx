/* eslint-disable @typescript-eslint/no-unused-expressions */
/** src/player/ui/settings/settings-popover.tsx */
'use client';
import * as React from 'react';

import { FloatingLayerPortal } from '../floating/floating-layer-portal';
import { SettingsNavigatorContent } from './settings-navigator';
import type { Level, Track } from '../../ports';
import type { CaptionStyle } from '../overlays/caption-overlay';
import { useI18n } from '../../providers/i18n/i18n';

type CommonProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  anchorRef: React.RefObject<HTMLElement | any>;
  levels: Level[];
  levelSelection: 'auto' | { id: string };
  onChangeLevel: (s: 'auto' | { id: string }) => void;
  textTracks: Track[];
  textId?: string;
  onChangeText: (id?: string) => void;
  audioTracks: Track[];
  audioId?: string;
  onChangeAudio: (id?: string) => void;
  rate: number;
  onChangeRate: (r: number) => void;
  captionStyle: CaptionStyle;
  onChangeCaptionStyle: (s: CaptionStyle) => void;
  dataSaverEnabled?: boolean;
  onToggleDataSaver?: (enabled: boolean) => void;
  persistenceEnabled?: boolean;
  onTogglePersistence?: (enabled: boolean) => void;
  disabledDuringAd?: boolean;
};

export default function SettingsPopover(props: CommonProps) {
  const { dir } = useI18n();
  const panelRef = React.useRef<HTMLDivElement>(null);

  // position relative to container (no scroll jitter)
  const [pos, setPos] = React.useState<{ topRel: number; inlineStartRel: number } | null>(null);

  const interactiveAtRef = React.useRef(0);
  React.useLayoutEffect(() => {
    if (props.open) interactiveAtRef.current = performance.now() + 220;
  }, [props.open]);

  const swallowIfEarly = (e: React.SyntheticEvent | Event) => {
    if (performance.now() < interactiveAtRef.current) {
      (e as any).preventDefault?.();
      (e as any).stopPropagation?.();
    }
  };

  // guard window to ignore the first outside pointerdown right after opening (mobile synthetic mouse)
  const ignoreOutsideUntilRef = React.useRef<number>(0);
  React.useLayoutEffect(() => {
    if (props.open) ignoreOutsideUntilRef.current = performance.now() + 220;
  }, [props.open]);

  const snapToDPR = (v: number) => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return Math.round(v * dpr) / dpr;
  };

  const measure = React.useCallback(() => {
    const anchor = props.anchorRef?.current as HTMLElement | null;
    const container = props.containerRef?.current as HTMLElement | null;
    const panel = panelRef.current;
    if (!anchor || !container || !panel) return;

    const a = anchor.getBoundingClientRect();
    const c = container.getBoundingClientRect();

    const topRel = a.top - c.top;
    const containerWidth = c.width;

    const w = panel.getBoundingClientRect().width;
    const pad = 8;

    const rawInlineRel = dir === 'rtl' ? a.right - c.left : a.left - c.left;

    const inlineStartRel =
      dir === 'rtl'
        ? Math.max(pad + w, Math.min(containerWidth - pad, rawInlineRel))
        : Math.max(pad, Math.min(containerWidth - w - pad, rawInlineRel));

    setPos({ topRel: snapToDPR(topRel), inlineStartRel: snapToDPR(inlineStartRel) });
  }, [props.anchorRef, props.containerRef, dir]);

  // initial + settle passes
  React.useLayoutEffect(() => {
    if (!props.open) return;
    setPos(null);
    let raf = 0,
      tries = 0;
    const tick = () => {
      tries += 1;
      measure();
      if (tries < 3) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.open, measure]);

  // re-measure on size/fullscreen (not scrolling)
  React.useEffect(() => {
    if (!props.open) return;
    const container = props.containerRef?.current;
    const anchor = props.anchorRef?.current;
    const panel = panelRef.current;
    const ro = new ResizeObserver(() => measure());
    container && ro.observe(container);
    anchor && ro.observe(anchor);
    panel && ro.observe(panel);
    window.addEventListener('resize', measure);
    document.addEventListener('fullscreenchange', measure);
    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener('resize', measure);
      document.removeEventListener('fullscreenchange', measure);
    };
  }, [props.open, measure, props.containerRef, props.anchorRef]);

  // outside close — one pointerdown in capture; ignore first 220ms after open
  React.useEffect(() => {
    if (!props.open) return;
    const onDoc = (e: PointerEvent) => {
      if (performance.now() < ignoreOutsideUntilRef.current) return;

      const panel = panelRef.current;
      const anchor = props.anchorRef?.current as HTMLElement | null;
      const t = e.target as Node | null;
      const path = (e as any).composedPath?.() as EventTarget[] | undefined;

      const contains = (el: HTMLElement | null | undefined) =>
        !!el && (path ? path.includes(el) : el.contains(t as Node));

      if (contains(panel) || contains(anchor)) return;
      props.onOpenChange(false);
    };
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, [props.open, props.onOpenChange, props.anchorRef]);

  if (!props.open) return null;

  const gap = 8;
  const xShift = dir === 'rtl' ? '-100%' : '0';
  const style = pos
    ? {
        left: 0,
        top: 0,
        transform: `translate3d(${pos.inlineStartRel}px, ${pos.topRel}px, 0) translateX(${xShift}) translateY(calc(-100% - ${gap}px))`,
        willChange: 'transform',
      }
    : { left: -99999, top: -99999 };

  return (
    <FloatingLayerPortal
      open={props.open}
      onOpenChange={props.onOpenChange}
      focusTrap
      within={props.containerRef?.current || null}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        dir={dir}
        className="absolute z-[1000] w-[360px] max-w-[92vw] rounded-2xl border border-white/10 bg-zinc-950/80 text-white shadow-2xl backdrop-blur-xl"
        style={style as React.CSSProperties}
        // ⬇️ Swallow the first tap inside the panel so list items don't get "tap-through"
        onPointerDownCapture={swallowIfEarly}
        onClickCapture={swallowIfEarly}
      >
        <div className="max-h-[70vh]">
          <SettingsNavigatorContent
            open={props.open}
            onRequestClose={() => props.onOpenChange(false)}
            dir={dir}
            levels={props.levels}
            levelSelection={props.levelSelection}
            onChangeLevel={props.onChangeLevel}
            textTracks={props.textTracks}
            textId={props.textId}
            onChangeText={props.onChangeText}
            audioTracks={props.audioTracks}
            audioId={props.audioId}
            onChangeAudio={props.onChangeAudio}
            rate={props.rate}
            onChangeRate={props.onChangeRate}
            captionStyle={props.captionStyle}
            onChangeCaptionStyle={props.onChangeCaptionStyle}
            disabledDuringAd={props.disabledDuringAd}
          />
        </div>
      </div>
    </FloatingLayerPortal>
  );
}
