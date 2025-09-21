/** src/player/analytics/qos-heartbeat.ts */
export type HeartbeatSample = {
  t: number; // ms
  position: number; // s
  duration: number; // s
  droppedFrames?: number;
  totalFrames?: number;
  bufferedEnd?: number; // s
  bitrate?: number; // kbps (if engine exposes)
  level?: string | number; // rendition id/height
  stallCount?: number;
};

export function startQoSHeartbeat({
  video,
  engine,
  emit,
  intervalMs = 5000,
}: {
  video: HTMLVideoElement | null;
  engine: any;
  emit: (e: any) => void;
  intervalMs?: number;
}) {
  let id: number | null = null;
  let lastDropped = 0;
  let stalls = 0;

  const onStall = () => {
    stalls += 1;
  };
  engine?.on?.('engine_buffering_start', onStall);

  const tick = () => {
    if (!video) return;
    const t = Date.now();
    let dropped: number | undefined;
    let total: number | undefined;
    // playback quality (not on all browsers)
    const pq: any = (video as any).getVideoPlaybackQuality?.();
    if (pq) {
      dropped = pq.droppedVideoFrames;
      total = pq.totalVideoFrames;
    }

    const sample: HeartbeatSample = {
      t,
      position: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      droppedFrames: dropped,
      totalFrames: total,
      bufferedEnd: video.buffered?.length ? video.buffered.end(video.buffered.length - 1) : undefined,
      bitrate: engine?.getBandwidthKbps?.(),
      level: engine?.getCurrentLevel?.()?.id ?? engine?.getCurrentLevel?.()?.height,
      stallCount: stalls,
    };
    if (typeof dropped === 'number') lastDropped = dropped;
    emit({ type: 'qos_heartbeat', sample });
  };

  id = window.setInterval(tick, intervalMs);
  return () => {
    if (id) clearInterval(id);
    engine?.off?.('engine_buffering_start', onStall);
  };
}
