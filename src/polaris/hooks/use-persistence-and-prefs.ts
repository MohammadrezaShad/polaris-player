'use client';
import { Level, Track } from '../ports';
import * as React from 'react';

type AnyEngine = {
  setVolume?: (v: number) => void;
  setMuted?: (m: boolean) => void;
  setPlaybackRate?: (r: number) => void;
  getLevels?: () => Level[];
  getAudioTracks?: () => Track[];
  getTextTracks?: () => Track[];
  setMaxResolution?: (h?: number) => void;
  configureAbr?: (o: any) => void;
  setTextTrack?: (id?: string) => void;
  setAudioTrack?: (id?: string) => void;
  setLevel?: (sel: 'auto' | { id: string }) => void;
};

type CaptionStyle = {
  size: 's' | 'm' | 'l';
  bg: 'none' | 'semi' | 'solid';
  font: 'system' | 'serif' | 'mono';
  weight: 'regular' | 'bold';
  outline: 'none' | 'thin' | 'thick';
  shadow: 'none' | 'soft' | 'heavy';
};

export type PrefsState = {
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  rate: number;
  setRate: (r: number) => void;
  dataSaver: boolean;
  setDataSaver: (v: boolean) => void;
  persistOn: boolean;
  setPersistOn: (v: boolean) => void;
  levels: Level[];
  audios: Track[];
  texts: Track[];
  textId?: string;
  setTextId: (id?: string) => void;
  cc: CaptionStyle;
  setCc: (cc: CaptionStyle) => void;
  audioId?: string;
  setAudioId: (id?: string) => void;
  levelSel: 'auto' | { id: string };
  setLevelSel: (s: 'auto' | { id: string }) => void;
  refreshTracks: () => void;
};

export function usePersistenceAndPrefs(params: {
  engine: AnyEngine;
  storage: any;
  sourceId: string | number;
  videoRef: React.RefObject<HTMLVideoElement>;
}): PrefsState {
  const { engine, storage, sourceId, videoRef } = params;
  const prefsKey = React.useMemo(() => `vod:${sourceId}`, [sourceId]);

  const [volume, setVolume] = React.useState(1);
  const [muted, setMuted] = React.useState(false);
  const [rate, setRate] = React.useState(1);
  const [dataSaver, setDataSaver] = React.useState(false);
  const [persistOn, setPersistOn] = React.useState(true);

  const [levels, setLevels] = React.useState<Level[]>([]);
  const [audios, setAudios] = React.useState<Track[]>([]);
  const [texts, setTexts] = React.useState<Track[]>([]);
  const [textId, setTextId] = React.useState<string | undefined>();
  const [audioId, setAudioId] = React.useState<string | undefined>();
  const [levelSel, setLevelSel] = React.useState<'auto' | { id: string }>('auto');

  const [cc, setCc] = React.useState<CaptionStyle>({
    size: 'm',
    bg: 'semi',
    font: 'system',
    weight: 'bold',
    outline: 'thin',
    shadow: 'soft',
  });

  const refreshTracks = React.useCallback(() => {
    setLevels(engine.getLevels?.() ?? []);
    setAudios(engine.getAudioTracks?.() ?? []);
    setTexts(engine.getTextTracks?.() ?? []);
  }, [engine]);

  // consent + cross-tab sync
  React.useEffect(() => {
    try {
      setPersistOn(storage.isConsentGranted?.() ?? true);
    } catch {}
    const onSync = async () => {
      try {
        const p = (await storage.getPrefs(prefsKey)) ?? null;
        if (!p) return;
        setVolume((p as any).volume ?? 1);
        setMuted((p as any).muted ?? false);
        setRate((p as any).speed ?? 1);
        setDataSaver(Boolean((p as any)?.dataSaver));
      } catch {}
    };
    window.addEventListener('storage', onSync);
    window.addEventListener('player:persistence_sync', onSync as any);
    return () => {
      window.removeEventListener('storage', onSync);
      window.removeEventListener('player:persistence_sync', onSync as any);
    };
  }, [prefsKey, storage]);

  // load once after engine is attached
  React.useEffect(() => {
    (async () => {
      const pRaw = (await storage.getPrefs(prefsKey)) ?? {
        volume: 1,
        muted: false,
        speed: 1,
        quality: 'auto',
        dataSaver: false,
      };
      const p = pRaw as any;
      setVolume(p.volume);
      setMuted(p.muted);
      setRate(p.speed);
      setDataSaver(Boolean(p.dataSaver));
      engine.setVolume?.(p.volume);
      engine.setMuted?.(p.muted);
      engine.setPlaybackRate?.(p.speed);

      refreshTracks();

      // restore saved quality if not 'auto'
      if (p.quality && p.quality !== 'auto') {
        const qId = String(p.quality);
        setLevelSel({ id: qId });
        try {
          engine.setLevel?.({ id: qId });
        } catch {}
      }

      if (p.captions) {
        const s = p.captions;
        setCc((prev) => ({
          size: s.size ?? prev.size,
          bg: s.bg ?? prev.bg,
          font: s.font ?? prev.font,
          weight: s.weight ?? prev.weight,
          outline: s.outline ?? prev.outline,
          shadow: s.shadow ?? prev.shadow,
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsKey]);

  // reflect to <video>
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = muted;
    } catch {}
    try {
      v.volume = volume;
    } catch {}
    try {
      v.playbackRate = rate;
    } catch {}
  }, [muted, volume, rate, videoRef]);

  // data saver ↔ engine cap
  React.useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      dataSaver ? engine.setMaxResolution?.(480) : engine.setMaxResolution?.(undefined);
    } catch {}
    engine.configureAbr?.({ capToViewport: true });
  }, [dataSaver, engine]);

  // default subtitles with memory
  const attemptedDefaultSubs = React.useRef(false);
  React.useEffect(() => {
    if (attemptedDefaultSubs.current) return;
    if (texts.length > 0) {
      attemptedDefaultSubs.current = true;
      (async () => {
        try {
          const p = (await storage.getPrefs(prefsKey)) as any;
          const storedLang = p?.captions?.lang;
          let chooseId: string | undefined;
          if (storedLang) {
            const match = texts.find((t) => t.lang?.toLowerCase() === storedLang.toLowerCase());
            if (match) chooseId = match.id;
          }
          if (!chooseId) {
            const def = (texts as any[]).find((t: any) => t.default);
            if (def) chooseId = def.id;
          }
          if (!chooseId) chooseId = texts[0].id;
          if (chooseId) {
            setTextId(chooseId);
            (engine as any).setTextTrack?.(chooseId);
          }
        } catch {}
      })();
    }
  }, [texts.length, engine, storage, prefsKey, texts]);

  // persist (debounced)
  React.useEffect(() => {
    const t = setTimeout(() => {
      storage.setPrefs(prefsKey, {
        volume,
        muted,
        speed: rate,
        quality: levelSel === 'auto' ? 'auto' : Number((levelSel as any).id),
        captions: {
          lang: textId ? texts.find((t) => t.id === textId)?.lang : undefined,
          size: cc.size,
          bg: cc.bg,
          font: cc.font,
          weight: cc.weight,
          outline: cc.outline,
          shadow: cc.shadow,
        },
        dataSaver,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [prefsKey, storage, volume, muted, rate, levelSel, textId, texts, cc, dataSaver]);

  // optional: default audio
  React.useEffect(() => {
    if (!audioId && audios.length) {
      setAudioId(audios[0].id);
      (engine as any).setAudioTrack?.(audios[0].id);
    }
  }, [audios.length]);

  return {
    volume,
    setVolume,
    muted,
    setMuted,
    rate,
    setRate,
    dataSaver,
    setDataSaver,
    persistOn,
    setPersistOn,
    levels,
    audios,
    texts,
    textId,
    setTextId,
    cc,
    setCc,
    audioId,
    setAudioId,
    levelSel,
    setLevelSel,
    refreshTracks,
  };
}
