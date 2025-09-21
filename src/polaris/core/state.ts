/** src/player/core/state.ts */
import type { SourceDescriptor, UserPrefs } from '../ports';
export type PlayerState =
  | 'idle'
  | 'loading'
  | 'ad_loading'
  | 'ad_playing'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'ended'
  | 'error';
export interface PlayerContext {
  src?: SourceDescriptor;
  prefs: UserPrefs;
  state: PlayerState;
  lastError?: { code?: string; message: string };
  intentPlaying?: boolean;
}
