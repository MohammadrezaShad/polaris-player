/** src/player/core/machine.ts */
import * as React from 'react';

import type { PlayerContext } from './state';

export type Action =
  | { type: 'load' }
  | { type: 'engine_ready' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'buffer_start' }
  | { type: 'buffer_end' }
  | { type: 'seek_start' }
  | { type: 'seek_end' }
  | { type: 'ended' }
  | { type: 'error'; code?: string; message: string }
  | { type: 'retry' }
  | { type: 'reset' };

export function reduce(ctx: PlayerContext, a: Action): PlayerContext {
  switch (a.type) {
    case 'load':
      return { ...ctx, state: 'loading', lastError: undefined };
    case 'engine_ready':
      return { ...ctx, state: 'paused' };
    case 'play':
      return { ...ctx, state: 'playing', intentPlaying: true };
    case 'pause':
      if (ctx.state === 'ended') return ctx;
      return { ...ctx, state: 'paused', intentPlaying: false };
    case 'buffer_start':
      return { ...ctx, state: 'buffering' };
    case 'buffer_end':
      return { ...ctx, state: ctx.intentPlaying ? 'playing' : 'paused' };
    case 'seek_start':
      return { ...ctx, state: 'seeking' };
    case 'seek_end':
      return { ...ctx, state: ctx.intentPlaying ? 'playing' : 'paused' };
    case 'ended':
      return { ...ctx, state: 'ended', intentPlaying: false };
    case 'error':
      return { ...ctx, state: 'error', lastError: { code: a.code, message: a.message } };
    case 'retry':
      return { ...ctx, state: 'loading', lastError: undefined };
    case 'reset':
      return { ...ctx, state: 'idle', lastError: undefined, intentPlaying: false };
  }
}
export function usePlayerMachine(initial: PlayerContext) {
  const [state, dispatch] = React.useReducer(reduce, initial);
  return { state, dispatch };
}
