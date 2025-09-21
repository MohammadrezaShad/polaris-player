/** src/player/core/events.ts */
import type { EmbedContext, Level, Track } from '../ports';
export type DomainEvent =
  | { type: 'session_start'; ctx: EmbedContext; src: { id: string; url: string } }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek_start'; from: number; to: number }
  | { type: 'seek_end'; at: number }
  | { type: 'buffer_start' }
  | { type: 'buffer_end' }
  | { type: 'level_change'; level?: Level | 'auto' }
  | { type: 'audio_change'; track?: Track }
  | { type: 'text_change'; track?: Track }
  | { type: 'ended' }
  | { type: 'error'; code?: string; message: string; fatal?: boolean };
export interface PlaybackMetrics {
  t: number;
  position: number;
  bufferedEnd: number;
  duration: number;
  level?: Level | 'auto';
  bandwidth?: number;
  droppedFrames?: number;
  inViewport?: boolean;
  isCasting?: boolean;
}
type Unsub = () => void;
export class EventBus {
  private map = new Map<string, Set<(e: any) => void>>();
  on<T extends DomainEvent['type']>(type: T, cb: (e: Extract<DomainEvent, { type: T }>) => void): Unsub {
    const set = this.map.get(type) ?? new Set();
    set.add(cb as any);
    this.map.set(type, set);
    return () => set.delete(cb as any);
  }
  emit(e: DomainEvent) {
    this.map.get(e.type)?.forEach((cb) => cb(e));
  }
}
