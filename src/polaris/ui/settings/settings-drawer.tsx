/** src/player/ui/settings/settings-drawer.tsx */
'use client';
import * as React from 'react';
import { cn } from '../../../vendor/helpers/cn';

import { FloatingLayerPortal } from '../floating/floating-layer-portal';
import { SettingsNavigatorContent } from './settings-navigator';
import type { Level, Track } from '../../ports';
import type { CaptionStyle } from '../overlays/caption-overlay';
import { useI18n } from '../../providers/i18n/i18n';

type CommonProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
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

export default function SettingsDrawer(props: CommonProps) {
  const { dir } = useI18n();
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
  return (
    <FloatingLayerPortal open={props.open} onOpenChange={props.onOpenChange} lockScroll focusTrap>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        onPointerDown={(e) => {
          e.preventDefault();
          props.onOpenChange(false);
        }}
        onClick={(e) => e.stopPropagation()} // ignore delayed click from same tap
        aria-hidden
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn('fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[540px]')}
        dir={dir}
        onPointerDownCapture={swallowIfEarly}
        onClickCapture={swallowIfEarly}
      >
        <div className="mx-3 rounded-t-2xl border border-white/10 bg-zinc-950/80 text-white shadow-2xl backdrop-blur-xl">
          {/* Stable landscape height using svh; browser will clamp if unsupported */}
          <div className="min-h-[360px]" style={{ height: '68svh', maxHeight: '82svh' }}>
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
      </div>
    </FloatingLayerPortal>
  );
}
