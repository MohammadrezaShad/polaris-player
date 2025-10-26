// src/player/adapters/engine/hls-js-adapter.ts
import type { EnginePort, SourceDescriptor, Level, Track, EngineEvent, EngineEventType } from "../../ports";
import { buildSubtitleCacheLoader } from "../utils/hls-sub-cache-loader";

export class HlsJsAdapter implements EnginePort {
  private maxHeight: number | undefined;
  private minHeight: number | undefined;
  private capToViewport = true;

  private hls: any | undefined;
  private video?: HTMLVideoElement;
  private listeners = new Map<EngineEventType, Set<(e: any) => void>>();

  // teardown state
  private tearingDown = false;
  private teardownToken = 0;

  // remember desired playbackRate and re-assert on attach/load
  private desiredRate = 1;

  // subtitle dedupe guards
  private lastSubtitleIdx: number = -2; // -2 = unknown; -1 = off; >=0 = specific track
  private lastSubtitleDisplay = false;

  private async loadHlsLight() {
    const mod = await import("hls.js");
    const Hls = (mod as any).default ?? mod;
    return Hls;
  }

  private async sleep(ms = 0) {
    await new Promise((r) => setTimeout(r, ms));
  }

  private async quiesce() {
    if (!this.hls) return;
    try {
      this.hls.stopLoad?.();
    } catch {}
    await this.sleep(0);
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
  }

  private async safeTearDownAsync() {
    if (!this.hls) return;
    const token = ++this.teardownToken;
    this.tearingDown = true;

    try {
      await this.quiesce();
      if (token !== this.teardownToken) return;

      try {
        this.hls.detachMedia?.();
      } catch {}
      await this.sleep(0);
      if (token !== this.teardownToken) return;

      try {
        this.hls.destroy?.();
      } catch {}
    } finally {
      if (token === this.teardownToken) {
        this.hls = undefined;
        this.tearingDown = false;
        this.lastSubtitleIdx = -2;
        this.lastSubtitleDisplay = false;
      }
    }
  }

  private safeTearDown() {
    void this.safeTearDownAsync();
    if (this.video) {
      try {
        this.video.onwaiting = null;
        this.video.onplaying = null;
        this.video.onstalled = null;
        this.video.onended = null;
        this.video.onloadedmetadata = null;
        this.video.oncanplay = null;
        this.video.onseeking = null;
        this.video.onseeked = null;
        this.video.removeAttribute("src");
        this.video.load?.();
      } catch {}
    }
  }

  private reapplyPlaybackRateSoon() {
    const v = this.video;
    if (!v) return;
    try {
      v.defaultPlaybackRate = this.desiredRate;
      v.playbackRate = this.desiredRate;
    } catch {}
    setTimeout(() => {
      const vv = this.video;
      if (!vv) return;
      if (Math.abs((vv.playbackRate ?? 1) - this.desiredRate) > 1e-3) {
        try {
          vv.defaultPlaybackRate = this.desiredRate;
          vv.playbackRate = this.desiredRate;
        } catch {}
      }
    }, 0);
  }

  attach(videoEl: HTMLVideoElement) {
    this.video = videoEl;
    videoEl.onwaiting = () => this.emit({ type: "engine_buffering_start" });
    videoEl.onplaying = () => this.emit({ type: "engine_buffering_end" });
    videoEl.onstalled = () => this.emit({ type: "engine_buffering_start" });
    videoEl.onended = () => this.emit({ type: "engine_ended" });
    videoEl.onloadedmetadata = () => {
      this.emit({ type: "engine_loadedmetadata" });
      this.reapplyPlaybackRateSoon();
    };
    videoEl.oncanplay = () => {
      this.emit({ type: "engine_canplay" });
      this.reapplyPlaybackRateSoon();
    };
    videoEl.onseeking = () => this.emit({ type: "engine_seek_start" });
    videoEl.onseeked = () => {
      this.emit({ type: "engine_seek_end" });
      this.reapplyPlaybackRateSoon();
    };
    this.reapplyPlaybackRateSoon();
    this.emit({ type: "engine_media_attached" });
  }

  detach() {
    try {
      this.video?.pause?.();
    } catch {}
    this.safeTearDown();
    this.video = undefined;
  }

  async load(src: SourceDescriptor) {
    if (!this.video) throw new Error("attach() first");

    // If reloading, fully quiesce+destroy previous instance first
    await this.safeTearDownAsync();

    const isHlsSrc = src.type === "hls";
    let Hls: any | null = null;

    if (isHlsSrc && typeof window !== "undefined") {
      try {
        Hls = await this.loadHlsLight();
      } catch {
        Hls = null;
      }
    }

    const canUseHlsJs = !!Hls?.isSupported?.() && isHlsSrc;

    if (canUseHlsJs) {
      const H = Hls;

      // 👇 INSTALL the cache/single-flight loader
      const Loader = buildSubtitleCacheLoader(H);

      this.hls = new H({
        enableWorker: true,
        renderTextTracksNatively: true,
        capLevelToPlayerSize: this.capToViewport,
        backBufferLength: 30,
        progressive: false,
        loader: Loader, // <-- IMPORTANT
      });

      // We render captions ourselves (keep disabled, guarded)
      try {
        if (this.lastSubtitleDisplay !== false) {
          this.hls.subtitleDisplay = false;
          this.lastSubtitleDisplay = false;
        } else {
          this.hls.subtitleDisplay = false;
        }
      } catch {}

      const guard = () => this.hls && !this.tearingDown;

      this.hls.attachMedia(this.video);

      this.hls.on(H.Events.MANIFEST_PARSED, () => {
        if (!guard()) return;
        if (typeof this.maxHeight === "number") {
          try {
            const levels = this.hls!.levels || [];
            const idx = levels.findIndex((l: any) => (l.height || 0) > this.maxHeight!);
            this.hls!.autoLevelCapping = idx > -1 ? Math.max(0, idx - 1) : -1;
          } catch {}
        }
        this.emit({ type: "engine_manifest_loaded" });
        this.reapplyPlaybackRateSoon();
      });

      this.hls.on(H.Events.LEVEL_SWITCHED, (_: any, data: any) => {
        if (!guard()) return;
        const lvl = this.getLevels()[data.level];
        if (lvl) this.emit({ type: "engine_level_switched", level: lvl });
      });

      const fireAudio = () => {
        if (!guard()) return;
        const list = this.getAudioTracks();
        const idx = this.hls?.audioTrack;
        const t = idx != null && list[idx] ? list[idx] : undefined;
        this.emit({ type: "engine_audio_changed", track: t });
      };

      const fireText = () => {
        if (!guard()) return;
        const list = this.getTextTracks();
        let idx: number | undefined = undefined;
        if (this.hls && typeof this.hls.subtitleTrack === "number" && this.hls.subtitleTrack >= 0) idx = this.hls.subtitleTrack;

        // Track current index for dedupe
        if (typeof idx === "number") this.lastSubtitleIdx = idx;
        else this.lastSubtitleIdx = -1;

        const t = idx != null && list[idx] ? list[idx] : undefined;
        this.emit({ type: "engine_text_changed", track: t });
      };

      this.hls.on(H.Events.AUDIO_TRACK_SWITCHED, fireAudio);
      this.hls.on(H.Events.AUDIO_TRACK_SWITCH, fireAudio);
      this.hls.on(H.Events.SUBTITLE_TRACKS_UPDATED, fireText);
      this.hls.on(H.Events.SUBTITLE_TRACK_SWITCH, fireText);
      this.hls.on(H.Events.SUBTITLE_TRACK_SWITCHED, fireText);

      this.hls.on(H.Events.ERROR, (_: any, data: any) => {
        if (!guard()) return;
        const fatal = !!data?.fatal;
        const msg = data?.details || data?.reason || data?.type || "hls_error";
        if (fatal && this.hls) {
          if (data?.type === H.ErrorTypes.NETWORK_ERROR) {
            try {
              this.hls.startLoad();
            } catch {}
          } else if (data?.type === H.ErrorTypes.MEDIA_ERROR) {
            try {
              this.hls.recoverMediaError();
            } catch {}
          }
        }
        this.emit({ type: "engine_error", fatal, code: data?.details, message: msg });
      });

      this.hls.loadSource(src.url);
      this.reapplyPlaybackRateSoon();

      // Optional: quick sanity log so you can confirm the loader is installed
      try {
        console.debug("[hls] loader =", (this.hls.config?.loader as any)?.__name || this.hls.config?.loader?.name);
      } catch {}
    } else {
      // MP4 or native HLS (Safari)
      (this.video as HTMLVideoElement).src = src.url;
      this.emit({ type: "engine_manifest_loaded" });
      this.reapplyPlaybackRateSoon();
    }
  }

  destroy() {
    try {
      this.video?.pause?.();
    } catch {}
    this.safeTearDown();
  }

  play() {
    return this.video!.play();
  }
  pause() {
    this.video?.pause();
  }
  seekTo(seconds: number) {
    if (this.video) this.video.currentTime = seconds;
  }
  setVolume(value: number) {
    if (this.video) this.video.volume = Math.max(0, Math.min(1, value));
  }
  setMuted(muted: boolean) {
    if (this.video) this.video.muted = muted;
  }

  setPlaybackRate(rate: number) {
    this.desiredRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    const v = this.video;
    if (!v) return;
    try {
      v.defaultPlaybackRate = this.desiredRate;
      v.playbackRate = this.desiredRate;
    } catch {}
    setTimeout(() => {
      if (!this.video) return;
      if (Math.abs(this.video.playbackRate - this.desiredRate) > 1e-3) {
        try {
          this.video.defaultPlaybackRate = this.desiredRate;
          this.video.playbackRate = this.desiredRate;
        } catch {}
      }
    }, 0);
  }

  getLevels(): Level[] {
    if (!this.hls) return [];
    return (this.hls.levels || []).map((l: any, idx: number) => ({
      id: String(idx),
      height: l.height,
      bandwidth: l.bitrate,
      fps: l.attrs?.FRAME_RATE ? Number(l.attrs.FRAME_RATE) : undefined,
      codec: l.codec || l.attrs?.CODECS,
    }));
  }

  setLevel(by: { id?: string; height?: number } | "auto") {
    if (!this.hls || this.tearingDown) return;

    if (by === "auto") {
      try {
        this.hls.config.capLevelToPlayerSize = this.capToViewport;
        this.hls.currentLevel = -1;
      } catch {}
      return;
    }

    let idx = -1;
    if (by.id != null) {
      const n = Number(by.id);
      if (Number.isFinite(n)) idx = n;
    } else if (by.height != null) {
      const levels = this.hls.levels || [];
      idx = levels.findIndex((l: any) => l.height === by.height);
    }
    if (idx < 0) return;

    try {
      this.hls.config.capLevelToPlayerSize = false;
      this.hls.autoLevelCapping = -1;
    } catch {}

    try {
      this.hls.currentLevel = idx;
    } catch (e: any) {
      try {
        this.hls.loadLevel = idx;
      } catch {}
      this.emit({ type: "engine_error", fatal: false, code: "level_switch", message: String(e?.message || e) });
    }
  }

  getAudioTracks(): Track[] {
    if (this.hls && Array.isArray(this.hls.audioTracks)) {
      return this.hls.audioTracks.map((t: any, i: number) => ({
        id: String(i),
        kind: "audio",
        label: t.name || `Audio ${i + 1}`,
        lang: t.lang || undefined,
      }));
    }
    return [];
  }

  setAudioTrack(id: string) {
    if (!this.hls || this.tearingDown) return;
    const idx = Number(id);
    const count = (this.hls.audioTracks || []).length;
    if (!Number.isFinite(idx) || idx < 0 || idx >= count) return;
    try {
      if (this.hls.audioTrack !== idx) this.hls.audioTrack = idx;
    } catch (e: any) {
      try {
        this.hls.recoverMediaError?.();
      } catch {}
      this.emit({ type: "engine_error", fatal: false, code: "audio_switch", message: String(e?.message || e) });
    }
  }

  getTextTracks(): Track[] {
    if (this.hls && Array.isArray(this.hls.subtitleTracks) && this.hls.subtitleTracks.length) {
      return this.hls.subtitleTracks.map((t: any, i: number) => ({
        id: String(i),
        kind: "subtitle",
        label: t.name || t.lang || `Sub ${i + 1}`,
        lang: t.lang || undefined,
      }));
    }
    const out: Track[] = [];
    const tracks = this.video?.textTracks ?? [];
    for (let i = 0; i < tracks.length; i++) {
      const tt = tracks[i];
      out.push({
        id: String(i),
        kind: "caption",
        label: tt.label || `Caption ${i + 1}`,
        lang: tt.language || undefined,
      });
    }
    return out;
  }

  /** Idempotent: does nothing if selecting the already-active subtitle */
  setTextTrack(id?: string) {
    if (this.tearingDown) return;

    // hls.js subtitle tracks path
    if (this.hls && Array.isArray(this.hls.subtitleTracks) && this.hls.subtitleTracks.length) {
      const targetIdx = id === undefined ? -1 : Number(id);
      if (!Number.isFinite(targetIdx)) return;
      if (targetIdx < -1 || targetIdx >= this.hls.subtitleTracks.length) return;

      const current = typeof this.hls.subtitleTrack === "number" ? this.hls.subtitleTrack : -1;
      if (current === targetIdx || this.lastSubtitleIdx === targetIdx) return;

      try {
        this.hls.subtitleTrack = targetIdx; // <-- triggers a (re)load only when it changes
        this.lastSubtitleIdx = targetIdx;
      } catch (e: any) {
        this.emit({ type: "engine_error", fatal: false, code: "subtitle_switch", message: String(e?.message || e) });
      }

      const t = targetIdx >= 0 ? this.getTextTracks()[targetIdx] : undefined;
      this.emit({ type: "engine_text_changed", track: t });
      return;
    }

    // native text tracks path (Safari / MP4 with text tracks)
    const tracks = this.video?.textTracks ?? [];
    const targetIdx = id === undefined ? -1 : Number(id);
    for (let i = 0; i < tracks.length; i++) {
      const want = targetIdx >= 0 && i === targetIdx ? "hidden" : "disabled";
      if (tracks[i].mode !== want) tracks[i].mode = want;
    }
    const t = targetIdx >= 0 ? this.getTextTracks()[targetIdx] : undefined;
    this.emit({ type: "engine_text_changed", track: t });
  }

  getCurrentTime() {
    return this.video?.currentTime ?? 0;
  }
  getBufferedEnd() {
    const v = this.video;
    if (!v) return 0;
    try {
      return v.buffered.length === 0 ? v.currentTime ?? 0 : v.buffered.end(v.buffered.length - 1);
    } catch {
      return v.currentTime ?? 0;
    }
  }
  getBufferedRanges() {
    const v = this.video;
    if (!v) return [];
    const out: { start: number; end: number }[] = [];
    try {
      for (let i = 0; i < v.buffered.length; i++) out.push({ start: v.buffered.start(i), end: v.buffered.end(i) });
    } catch {}
    return out;
  }
  getDuration() {
    return this.video?.duration ?? 0;
  }
  getDroppedFrames() {
    const v = this.video as any;
    if (v?.getVideoPlaybackQuality) return v.getVideoPlaybackQuality().droppedVideoFrames ?? undefined;
    return undefined;
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

  // ABR helpers
  setMaxResolution(h?: number) {
    this.maxHeight = h;
    if (this.hls && typeof h === "number") {
      try {
        const levels = this.hls.levels || [];
        const idx = levels.findIndex((l: any) => (l.height || 0) > h);
        this.hls.autoLevelCapping = idx > -1 ? Math.max(0, idx - 1) : -1;
      } catch {}
    }
  }
  setMinResolution(h?: number) {
    this.minHeight = h;
  }
  configureAbr(opts: { capToViewport?: boolean }) {
    this.capToViewport = !!opts.capToViewport;
    if (this.hls) this.hls.config.capLevelToPlayerSize = this.capToViewport;
  }
}
