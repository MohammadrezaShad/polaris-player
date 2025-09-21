// src/player/adapters/engine/universal-adapter.ts
import type { EnginePort, SourceDescriptor, EngineEvent, EngineEventType } from '../../ports';

/** Delegates to HLS.js or Shaka based on SourceDescriptor.type (DRM → DASH/Shaka) */
export class UniversalEngineAdapter implements EnginePort {
  private impl: EnginePort | undefined;
  private video?: HTMLVideoElement;
  private listeners = new Map<EngineEventType, Set<(e: any) => void>>();

  // keep current playback rate across engine swaps/reloads
  private currentRate: number = 1;

  attach(videoEl: HTMLVideoElement) {
    this.video = videoEl;
    this.impl?.attach(videoEl);
    try {
      this.impl?.setPlaybackRate?.(this.currentRate);
    } catch {}
  }

  detach() {
    this.impl?.detach();
    this.impl = undefined;
    this.video = undefined;
  }

  private async makeAdapter(src: SourceDescriptor): Promise<EnginePort> {
    const needDash = src.type === 'dash' || !!src.drm;
    if (needDash) {
      const { ShakaAdapter } = await import('../dash/shaka-adapter'); // ⬅️ lazy
      return new ShakaAdapter();
    } else {
      const { HlsJsAdapter } = await import('./hls-js-adapter'); // ⬅️ lazy
      return new HlsJsAdapter();
    }
  }

  async load(src: SourceDescriptor) {
    // choose + create the engine only when needed
    this.impl = await this.makeAdapter(src);

    if (this.video) this.impl.attach(this.video);
    this.bridge();

    await this.impl.load(src);

    try {
      this.impl.setPlaybackRate?.(this.currentRate);
    } catch {}
  }

  destroy() {
    try {
      this.impl?.destroy();
    } catch {}
    this.impl = undefined;
  }

  async play() {
    await this.impl?.play();
  }
  pause() {
    this.impl?.pause();
  }
  seekTo(seconds: number) {
    this.impl?.seekTo(seconds);
  }
  setVolume(value: number) {
    this.impl?.setVolume(value);
  }
  setMuted(muted: boolean) {
    this.impl?.setMuted(muted);
  }
  setPlaybackRate(rate: number) {
    this.currentRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    this.impl?.setPlaybackRate?.(this.currentRate);
  }

  getLevels() {
    return this.impl?.getLevels?.() ?? [];
  }
  setLevel(by: any) {
    this.impl?.setLevel?.(by);
  }
  getAudioTracks() {
    return this.impl?.getAudioTracks?.() ?? [];
  }
  setAudioTrack(id: string) {
    this.impl?.setAudioTrack?.(id);
  }
  getTextTracks() {
    return this.impl?.getTextTracks?.() ?? [];
  }
  setTextTrack(id?: string) {
    this.impl?.setTextTrack?.(id);
  }
  getCurrentTime() {
    return this.impl?.getCurrentTime?.() ?? 0;
  }
  getBufferedEnd() {
    return this.impl?.getBufferedEnd?.() ?? 0;
  }
  getDuration() {
    return this.impl?.getDuration?.() ?? 0;
  }
  getBufferedRanges?() {
    return this.impl?.getBufferedRanges?.() ?? [];
  }
  getBandwidthEstimate?() {
    return this.impl?.getBandwidthEstimate?.() as number;
  }
  getDroppedFrames?() {
    return this.impl?.getDroppedFrames?.() as number;
  }

  // optional ABR pass-through
  setMaxResolution?(h?: number) {
    (this.impl as any)?.setMaxResolution?.(h);
  }
  setMinResolution?(h?: number) {
    (this.impl as any)?.setMinResolution?.(h);
  }
  configureAbr?(opts: any) {
    (this.impl as any)?.configureAbr?.(opts);
  }

  on<T extends EngineEventType>(type: T, cb: (e: Extract<EngineEvent, { type: T }>) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(cb as any);
    this.listeners.set(type, set);
    return () => set.delete(cb as any);
  }
  private emit(e: EngineEvent) {
    this.listeners.get(e.type)?.forEach((fn) => (fn as any)(e));
  }
  private bridge() {
    const forward = (type: EngineEventType) => this.impl?.on(type, (e: any) => this.emit(e));
    [
      'engine_media_attached',
      'engine_manifest_loaded',
      'engine_loadedmetadata',
      'engine_canplay',
      'engine_level_switched',
      'engine_audio_changed',
      'engine_text_changed',
      'engine_buffering_start',
      'engine_buffering_end',
      'engine_seek_start',
      'engine_seek_end',
      'engine_error',
      'engine_ended',
    ].forEach((t) => forward(t as any));
  }
}
