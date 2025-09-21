/** src/player/adapters/dash/shaka-adapter.ts */
import type { EnginePort, SourceDescriptor, Level, Track, EngineEvent, EngineEventType } from '../../ports';
import { fetchServerCertificate, deriveFairPlayContentId } from './fairplay';

// Lazy-load cache
let ShakaNS: any | null = null;
let shakaLoadPromise: Promise<any> | null = null;

// Split Shaka into its own async chunk, only in the browser.
async function getShakaNS() {
  if (typeof window === 'undefined') return null;
  if (ShakaNS) return ShakaNS;
  if (!shakaLoadPromise) {
    shakaLoadPromise = import(
      /* webpackChunkName: "shaka" */
      'shaka-player/dist/shaka-player.compiled.js' as any
    ).then((m) => (ShakaNS = (m as any).default ?? m));
  }
  return shakaLoadPromise;
}

export class ShakaAdapter implements EnginePort {
  private player: any | undefined;
  private video?: HTMLVideoElement;
  private listeners = new Map<EngineEventType, Set<(e: any) => void>>();
  private maxHeight: number | undefined;
  private minHeight: number | undefined;
  private capToViewport = true;

  attach(videoEl: HTMLVideoElement) {
    this.video = videoEl;
  }

  detach() {
    if (this.player) {
      try {
        this.player.destroy();
      } catch {}
      this.player = undefined;
    }
    this.video = undefined;
  }

  async load(src: SourceDescriptor) {
    if (!this.video) throw new Error('attach() first');

    const shaka = await getShakaNS();
    if (!shaka) {
      this.emit({ type: 'engine_error', fatal: true, code: 'drm_unavailable', message: 'Shaka unavailable' } as any);
      throw new Error('Shaka Player not available');
    }

    if (this.player) {
      try {
        await this.player.destroy();
      } catch {}
      this.player = undefined;
    }

    this.player = new shaka.Player(this.video);

    // Core events + error mapping
    this.player.addEventListener('loading', () => this.emit({ type: 'engine_manifest_loaded' } as any));
    this.player.addEventListener('adaptation', () => this.emit({ type: 'engine_level_switched' } as any));
    this.player.addEventListener('buffering', (e: any) => {
      if (e.buffering) this.emit({ type: 'engine_buffering_start' } as any);
      else this.emit({ type: 'engine_buffering_end' } as any);
    });
    this.player.addEventListener('error', (e: any) => {
      const code =
        e?.detail?.category === 3 ? 'drm_error' : e?.detail?.category === 1 ? 'network_error' : 'shaka_error';
      this.emit({
        type: 'engine_error',
        fatal: !!e?.detail?.fatal,
        code,
        message: String(e?.detail?.message || code),
      } as any);
    });

    this.video?.addEventListener('loadedmetadata', () => this.emit({ type: 'engine_loadedmetadata' } as any));
    this.video?.addEventListener('canplay', () => this.emit({ type: 'engine_canplay' } as any));
    this.video?.addEventListener('ended', () => this.emit({ type: 'engine_ended' } as any));
    this.video?.addEventListener('seeking', () => this.emit({ type: 'engine_seek_start' } as any));
    this.video?.addEventListener('seeked', () => this.emit({ type: 'engine_seek_end' } as any));
    this.video?.addEventListener('error', () =>
      this.emit({ type: 'engine_error', fatal: false, code: 'MEDIA_ERR', message: 'Media error' } as any),
    );

    // DRM config (Widevine/PlayReady/FairPlay)
    if (src.drm) {
      const adv: any = {};
      if (src.drm.type === 'widevine') {
        adv['com.widevine.alpha'] = { videoRobustness: 'SW_SECURE_DECODE', audioRobustness: 'SW_SECURE_CRYPTO' };
      } else if (src.drm.type === 'playready') {
        adv['com.microsoft.playready'] = {};
      } else if (src.drm.type === 'fairplay') {
        adv['com.apple.fps.1_0'] = {};
        if (src.drm.certificateUrl) {
          try {
            const cert = await fetchServerCertificate(src.drm.certificateUrl);
            adv['com.apple.fps.1_0'].serverCertificate = cert;
          } catch (e: any) {
            this.emit({
              type: 'engine_error',
              fatal: true,
              code: 'fairplay_cert',
              message: String(e?.message || e),
            } as any);
          }
        }
      }

      const servers: any = {};
      if (src.drm.type === 'widevine') servers['com.widevine.alpha'] = src.drm.licenseUrl;
      if (src.drm.type === 'playready') servers['com.microsoft.playready'] = src.drm.licenseUrl;
      if (src.drm.type === 'fairplay') servers['com.apple.fps.1_0'] = src.drm.licenseUrl;

      this.player.configure({
        drm: {
          servers,
          advanced: adv,
          updateExpirationTime: true,
        },
      });

      // License headers/body customization
      const net = this.player.getNetworkingEngine?.();
      if (net) {
        net.clearAllRequestFilters();
        net.clearAllResponseFilters();

        net.registerRequestFilter((type: any, request: any) => {
          const T = shaka.net.NetworkingEngine.RequestType;

          // Add custom headers for license requests
          if (type === T.LICENSE && src.drm?.headers) {
            for (const [k, v] of Object.entries(src.drm.headers)) request.headers[k] = String(v);
          }

          // FairPlay: append contentId if your KMS expects it
          if (type === T.LICENSE && src.drm?.type === 'fairplay') {
            const cid = deriveFairPlayContentId(src.url);
            try {
              const u = new URL(request.uris[0]);
              if (!u.searchParams.has('contentId')) {
                u.searchParams.set('contentId', cid);
                request.uris[0] = u.toString();
              }
            } catch {}
          }
        });

        net.registerResponseFilter((_type: any, _response: any) => {
          // left as-is; transform CKC here if your KMS needs it
          return;
        });
      }
    }

    // Restrictions + ABR config
    const restr: any = {};
    if (this.maxHeight) restr.maxHeight = this.maxHeight;
    if (this.minHeight) restr.minHeight = this.minHeight;
    if (Object.keys(restr).length) this.player.configure({ restrictions: restr });

    this.player.configure({
      abr: { enabled: true },
      streaming: { lowLatencyMode: false },
      textDisplayFactory: undefined, // keep custom overlay
    });

    await this.player.load(src.url);
  }

  destroy() {
    try {
      this.player?.destroy();
    } catch {}
    this.player = undefined;
  }
  async play() {
    await this.video?.play();
  }
  pause() {
    this.video?.pause();
  }
  seekTo(seconds: number) {
    if (this.video) this.video.currentTime = seconds;
  }
  setVolume(value: number) {
    if (this.video) this.video.volume = value;
  }
  setMuted(muted: boolean) {
    if (this.video) this.video.muted = muted;
  }
  setPlaybackRate(rate: number) {
    if (this.video) this.video.playbackRate = rate;
  }

  getLevels(): Level[] {
    const list: Level[] = [];
    const variants = this.player?.getVariantTracks?.() || [];
    for (const v of variants) list.push({ id: String(v.id), height: v.height || 0, bandwidth: v.bandwidth });
    return list.sort((a, b) => a.height - b.height);
  }
  setLevel(by: { id?: string; height?: number } | 'auto') {
    if (!this.player) return;
    if (by === 'auto') {
      this.player.configure({ abr: { enabled: true } });
      return;
    }
    this.player.configure({ abr: { enabled: false } });
    const variants = this.player.getVariantTracks();
    let target: any;
    if (by.id) target = variants.find((t: any) => String(t.id) === String(by.id));
    else if (by.height) {
      const sorted = variants.slice().sort((a: any, b: any) => a.height - b.height);
      target = sorted.find((t: any) => t.height >= (by!.height as number)) || sorted[sorted.length - 1];
    }
    if (target) this.player.selectVariantTrack(target, /* clearBuffer= */ true, /* safeMargin= */ 0);
  }

  getAudioTracks(): Track[] {
    const list: Track[] = [];
    const variants = this.player?.getVariantTracks?.() || [];
    const uniq = new Map<string, any>();
    for (const v of variants) {
      const id = `${v.language || 'und'}:${v.channelsCount || ''}:${v.id}`;
      if (!uniq.has(id)) uniq.set(id, v);
    }
    for (const [, v] of uniq) {
      list.push({ id: String(v.id), kind: 'audio', label: v.language?.toUpperCase?.() || 'Audio', lang: v.language });
    }
    return list;
  }
  setAudioTrack(id: string) {
    if (!this.player) return;
    const variants = this.player.getVariantTracks();
    const t = variants.find((v: any) => String(v.id) === String(id));
    if (t) this.player.selectVariantTrack(t, /* clearBuffer= */ true, /* safeMargin= */ 0);
  }

  getTextTracks(): Track[] {
    const list: Track[] = [];
    const texts = this.player?.getTextTracks?.() || [];
    for (const t of texts) {
      const mime: string = (t as any).mimeType || '';
      const kind: 'subtitle' | 'caption' =
        mime.includes('application/ttml') || mime.includes('application/ims') ? 'subtitle' : 'subtitle';
      list.push({ id: String(t.id), kind, label: t.language?.toUpperCase?.() || 'CC', lang: t.language });
    }
    return list;
  }
  setTextTrack(id?: string) {
    if (!this.player) return;
    if (!id) {
      this.player.setTextTrackVisibility(false);
      return;
    }
    const texts = this.player.getTextTracks();
    const t = texts.find((v: any) => String(v.id) === String(id));
    if (t) {
      this.player.setTextTrackVisibility(true);
      this.player.selectTextTrack(t);
    }
  }

  getCurrentTime(): number {
    return this.video?.currentTime ?? 0;
  }
  getBufferedEnd(): number {
    return this.video?.buffered?.length ? this.video.buffered.end(this.video.buffered.length - 1) : 0;
  }
  getDuration(): number {
    return this.video?.duration ?? 0;
  }
  getBufferedRanges?(): { start: number; end: number }[] {
    const out: { start: number; end: number }[] = [];
    if (!this.video) return out;
    const b = this.video.buffered;
    for (let i = 0; i < b.length; i++) out.push({ start: b.start(i), end: b.end(i) });
    return out;
  }
  getBandwidthEstimate?(): number {
    try {
      return this.player?.getStats?.()?.estimatedBandwidth ?? undefined;
    } catch {
      return 0;
    }
  }
  getDroppedFrames?(): number {
    const v: any = this.video;
    if (v?.getVideoPlaybackQuality) return v.getVideoPlaybackQuality().droppedVideoFrames ?? undefined;
    return 0;
  }

  // ABR tuning (optional)
  setMaxResolution(h?: number) {
    this.maxHeight = h;
    if (this.player) this.player.configure({ restrictions: { maxHeight: h } });
  }
  setMinResolution(h?: number) {
    this.minHeight = h;
    if (this.player) this.player.configure({ restrictions: { minHeight: h } });
  }
  configureAbr(opts: { capToViewport?: boolean }) {
    this.capToViewport = !!opts.capToViewport;
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
}
