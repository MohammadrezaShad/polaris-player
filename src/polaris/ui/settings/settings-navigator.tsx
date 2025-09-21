/** src/player/ui/settings/settings-navigator.tsx */
'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight, Captions, Languages, Gauge, Rabbit } from 'lucide-react';
import { ScrollArea } from '../../../vendor/ui/scroll-area';
import { cn } from '../../../vendor/helpers/cn';

import type { Level, Track } from '../../ports';
import type { CaptionStyle } from '../overlays/caption-overlay';
import { useI18n, useT } from '../../providers/i18n/i18n';

export type SettingsNavigatorProps = {
  open: boolean;
  onRequestClose?: () => void;
  dir?: 'ltr' | 'rtl';
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
  onChangeCaptionStyle?: (s: CaptionStyle) => void;
  disabledDuringAd?: boolean;
};

type PageId = 'root' | 'quality' | 'captions' | 'audio' | 'speed' | 'caption-style';

const PageHeader: React.FC<{ title: string; onBack?: () => void; dir?: 'ltr' | 'rtl' }> = ({
  title,
  onBack,
  dir = 'ltr',
}) => {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3" dir={dir}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none"
          aria-label={dir === 'rtl' ? 'بازگشت' : 'Back'}
        >
          <ChevronLeft className={cn('h-5 w-5 opacity-80', dir === 'rtl' && 'rotate-180')} />
        </button>
      ) : (
        <div className="h-9 w-9" />
      )}
      <div className="flex-1 truncate text-center text-sm font-medium">{title}</div>
      <div className="h-9 w-9" />
    </div>
  );
};

const Row: React.FC<{
  leading?: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
}> = ({ leading, label, value, onClick, disabled, dir = 'ltr' }) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full cursor-pointer rounded-2xl px-4 py-3 text-start',
        'hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'flex items-center justify-between gap-3',
      )}
      dir={dir}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading && <div className="shrink-0 opacity-80">{leading}</div>}
        <div className="min-w-0">
          <div className="truncate text-sm">{label}</div>
          {value ? <div className="truncate text-xs opacity-75">{value}</div> : null}
        </div>
      </div>
      <ChevronRight className={cn('h-4 w-4 opacity-60', dir === 'rtl' && 'rotate-180')} />
    </button>
  );
};

function levelLabel(l: Level): string {
  if (!l) return '';
  if (l.height) return `${l.height}p`;
  return l.id;
}

function languageLabel(t: Track): string {
  const code = t.lang ? t.lang.toUpperCase() : '';
  const lab = t.label || '';
  return lab || code || 'Unknown';
}

export function SettingsNavigatorContent(props: SettingsNavigatorProps) {
  const { dir: _dir } = useI18n();
  const t = useT();
  const dir = props.dir ?? _dir ?? 'rtl';
  const [stack, setStack] = React.useState<PageId[]>(['root']);
  const page = stack[stack.length - 1];

  const qualityValue =
    props.levelSelection === 'auto'
      ? 'Auto' + (props.levels?.length ? ` • ${Math.max(...props.levels.map((l) => l.height || 0))}p` : '')
      : props.levels.find((l) => l.id === (props.levelSelection as any).id)?.height
        ? `${props.levels.find((l) => l.id === (props.levelSelection as any).id)!.height}p`
        : (props.levelSelection as any).id;

  // NOTE: use "captions" key; make sure i18n has settings.captions
  const captionsValue = props.textId
    ? languageLabel(props.textTracks.find((t) => t.id === props.textId) || ({} as any))
    : t('settings.off');

  const audioValue = props.audioId
    ? languageLabel(props.audioTracks.find((t) => t.id === props.audioId) || ({} as any))
    : t('settings.default');

  const push = (p: PageId) => setStack((s) => [...s, p]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const root = (
    <div className="space-y-2 p-3" dir={dir}>
      <Row
        leading={<Gauge className="h-5 w-5" />}
        label={t('settings.quality')}
        value={qualityValue}
        onClick={() => push('quality')}
        disabled={props.disabledDuringAd}
        dir={dir}
      />
      {props.textTracks && props.textTracks.length > 0 && (
        <Row
          leading={<Captions className="h-5 w-5" />}
          label={t('settings.captions')}
          value={captionsValue}
          onClick={() => push('captions')}
          disabled={false}
          dir={dir}
        />
      )}
      {props.audioTracks && props.audioTracks.length > 1 && (
        <Row
          leading={<Languages className="h-5 w-5" />}
          label={t('settings.audio')}
          value={audioValue}
          onClick={() => push('audio')}
          dir={dir}
        />
      )}
      <Row
        leading={<Rabbit className="h-5 w-5" />}
        label={t('settings.speed')}
        value={String(props.rate || 1) + '×'}
        onClick={() => push('speed')}
        dir={dir}
      />
    </div>
  );

  const quality = (
    <div className="p-3" dir={dir}>
      <div className="space-y-2">
        <button
          className={cn(
            'w-full cursor-pointer rounded-2xl px-4 py-3 text-start',
            'hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none',
            props.levelSelection === 'auto' && 'ring-1 ring-white/40',
          )}
          onClick={() => {
            props.onChangeLevel('auto');
            pop();
          }}
          disabled={props.disabledDuringAd}
        >
          <div className="text-sm">{t('settings.auto')}</div>
          <div className="text-xs opacity-75">{t('settings.autoHint')}</div>
        </button>
        {props.levels
          .slice()
          .sort((a, b) => (b.height || 0) - (a.height || 0))
          .map((l) => (
            <button
              key={l.id}
              className={cn(
                'w-full cursor-pointer rounded-2xl px-4 py-3 text-start hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none',
                props.levelSelection !== 'auto' && (props.levelSelection as any).id === l.id && 'ring-1 ring-white/40',
              )}
              onClick={() => {
                props.onChangeLevel({ id: l.id });
                pop();
              }}
              disabled={props.disabledDuringAd}
            >
              <div className="text-sm">{levelLabel(l)}</div>
              {l.bandwidth ? <div className="text-xs opacity-75">{Math.round(l.bandwidth / 1000)} kbps</div> : null}
            </button>
          ))}
      </div>
    </div>
  );

  const captions = (
    <div className="p-3" dir={dir}>
      <div className="space-y-2">
        <button
          className={cn(
            'w-full cursor-pointer rounded-2xl px-4 py-3 text-start hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none',
            !props.textId && 'ring-1 ring-white/40',
          )}
          onClick={() => {
            props.onChangeText(undefined);
            pop();
          }}
        >
          <div className="text-sm">{t('settings.off')}</div>
        </button>
        {props.textTracks.map((t) => (
          <button
            key={t.id}
            className={cn(
              'w-full cursor-pointer rounded-2xl px-4 py-3 text-start hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none',
              props.textId === t.id && 'ring-1 ring-white/40',
            )}
            onClick={() => {
              props.onChangeText(t.id);
              pop();
            }}
          >
            <div className="text-sm">{languageLabel(t)}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const audio = (
    <div className="p-3" dir={dir}>
      <div className="space-y-2">
        {(props.audioTracks || []).map((t) => (
          <button
            key={t.id}
            className={cn(
              'w-full cursor-pointer rounded-2xl px-4 py-3 text-start hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none',
              props.audioId === t.id && 'ring-1 ring-white/40',
            )}
            onClick={() => {
              props.onChangeAudio(t.id);
              pop();
            }}
          >
            <div className="text-sm">{languageLabel(t)}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const speed = (
    <div className="p-3" dir={dir}>
      <div className="grid grid-cols-2 gap-2">
        {speeds.map((r) => (
          <button
            key={r}
            className={cn(
              'cursor-pointer rounded-2xl px-3 py-2 text-sm hover:bg-white/[0.06] focus:ring-1 focus:ring-white/40 focus:outline-none',
              props.rate === r && 'ring-1 ring-white/40',
            )}
            onClick={() => {
              props.onChangeRate(r);
              pop();
            }}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );

  const titleMap: Record<PageId, string> = {
    root: t('settings.title'),
    quality: t('settings.quality'),
    captions: t('settings.captions'),
    audio: t('settings.audio'),
    speed: t('settings.speed'),
    'caption-style': t('settings.captionStyle'),
  };

  const pageBody =
    page === 'root'
      ? root
      : page === 'quality'
        ? quality
        : page === 'captions'
          ? captions
          : page === 'audio'
            ? audio
            : page === 'speed'
              ? speed
              : root;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col" dir={dir}>
      <PageHeader title={titleMap[page]} onBack={stack.length > 1 ? pop : undefined} dir={dir} />
      <ScrollArea className="flex-1" dir={dir}>
        {pageBody}
      </ScrollArea>
    </div>
  );
}
