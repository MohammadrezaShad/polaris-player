export type SourceType = 'hls' | 'mp4' | 'dash';
export type TrackKind = 'audio' | 'subtitle' | 'caption';
export type LangCode = string;

export interface Track {
  id: string;
  kind: TrackKind;
  label: string;
  lang?: LangCode;
  default?: boolean;
}
export interface Level {
  id: string;
  height: number;
  bandwidth?: number;
  codec?: string;
  fps?: number;
}

export interface SourceDescriptor {
  id: string;
  type: SourceType;
  url: string;
  poster?: string;
  durationHint?: number;
  thumbnails?: { url: string; format: 'vtt' | 'json-sprite'; baseUrl?: string };
  chapters?: { start: number; end: number; title?: string }[];
  drm?: {
    type: 'widevine' | 'fairplay' | 'playready';
    licenseUrl: string;
    headers?: Record<string, string>;
    certificateUrl?: string;
  };
  ads?: {
    vmapUrl?: string;
    schedule?: {
      prerollTag?: string;
      postrollTag?: string;
      midrolls?: { at: number; tag: string }[]; // seconds
    };
  };
}

export interface EmbedContext {
  sessionId: string;
  origin?: string;
  iframeSrc?: string;
  multimediaId: number;
  streamingId: number;
  forbidden?: boolean;
  playerVersion: string;
}

export type CaptionPrefs = {
  lang?: string;
  size?: 's' | 'm' | 'l';
  bg?: 'none' | 'semi' | 'solid';
  font?: 'system' | 'serif' | 'mono';
  weight?: 'regular' | 'bold';
  outline?: 'none' | 'thin' | 'thick';
  shadow?: 'none' | 'soft' | 'heavy';
};

// --- user prefs stored in storage ---
export type UserPrefs = {
  volume: number; // 0..1
  muted: boolean;
  speed: number; // playbackRate
  quality: 'auto' | number;
  captions?: CaptionPrefs;
  dataSaver?: boolean;
};

export type EngineEventType =
  | 'engine_media_attached'
  | 'engine_manifest_loaded'
  | 'engine_loadedmetadata'
  | 'engine_canplay'
  | 'engine_level_switched'
  | 'engine_audio_changed'
  | 'engine_text_changed'
  | 'engine_buffering_start'
  | 'engine_buffering_end'
  | 'engine_seek_start'
  | 'engine_seek_end'
  | 'engine_error'
  | 'engine_ended';

export type EngineEvent =
  | { type: 'engine_media_attached' }
  | { type: 'engine_manifest_loaded' }
  | { type: 'engine_loadedmetadata' }
  | { type: 'engine_canplay' }
  | { type: 'engine_level_switched'; level: Level }
  | { type: 'engine_audio_changed'; track?: Track }
  | { type: 'engine_text_changed'; track?: Track }
  | { type: 'engine_buffering_start' }
  | { type: 'engine_buffering_end' }
  | { type: 'engine_seek_start' }
  | { type: 'engine_seek_end' }
  | { type: 'engine_error'; fatal: boolean; code?: string; message?: string }
  | { type: 'engine_ended' };

export interface EnginePort {
  attach(videoEl: HTMLVideoElement): void;
  detach(): void;
  load(src: SourceDescriptor): Promise<void>;
  destroy(): void;
  play(): Promise<void>;
  pause(): void;
  seekTo(seconds: number): void;
  setVolume(value: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  getLevels(): Level[];
  setLevel(by: { id?: string; height?: number } | 'auto'): void;
  getAudioTracks(): Track[];
  setAudioTrack(id: string): void;
  getTextTracks(): Track[];
  setTextTrack(id?: string): void;
  getCurrentTime(): number;
  getBufferedEnd(): number;
  getDuration(): number;
  getBufferedRanges?(): { start: number; end: number }[];
  getBandwidthEstimate?(): number;
  getDroppedFrames?(): number;

  // optional ABR tuning
  setMaxResolution?(h?: number): void;
  setMinResolution?(h?: number): void;
  configureAbr?(opts: { capToViewport?: boolean }): void;

  on<T extends EngineEventType>(event: T, cb: (e: Extract<EngineEvent, { type: T }>) => void): () => void;
}

export interface AnalyticsPort {
  emit(event: any, extras?: Record<string, any>): void;
  heartbeat?(metrics: any): void;
}

export interface StoragePort {
  getPrefs(key: string): Promise<UserPrefs | null>;
  setPrefs(key: string, prefs: UserPrefs): Promise<void>;
  getResume(key: string): Promise<number | null>;
  setResume(key: string, seconds: number): Promise<void>;

  // optional Persistence+ controls (present when using persistence-plus)
  clearAll?(): Promise<void>;
  setConsent?(v: boolean): void;
  isConsentGranted?(): boolean;
}
