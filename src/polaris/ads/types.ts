/** src/player/ads/types.ts */
export type VastTrackingEvent =
  | 'impression'
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  | 'mute'
  | 'unmute'
  | 'pause'
  | 'resume'
  | 'rewind'
  | 'fullscreen'
  | 'exitFullscreen'
  | 'expand'
  | 'collapse'
  | 'acceptInvitationLinear'
  | 'closeLinear'
  | 'skip'
  | 'error'
  | 'clickTracking'
  | 'progress';

export type AdMediaFile = {
  url: string;
  type?: string;
  width?: number;
  height?: number;
  bitrate?: number;
};

export type AdIcon = {
  program?: string | null;
  src: string; // from <StaticResource>
  width: number;
  height: number;
  xPosition: 'left' | 'right' | number; // VAST allows keyword or absolute px
  yPosition: 'top' | 'bottom' | number;
  margin?: number;
  offsetSec?: number; // when to appear (optional)
  durationSec?: number; // how long to stay visible (optional)
  clickThroughUrl?: string | null;
  clickTrackingUrls?: string[];
  viewTrackingUrls?: string[];
};

export type AdCreativeLinear = {
  durationSec: number;
  skipOffsetSec?: number;
  mediaFiles: AdMediaFile[];
  clickThroughUrl?: string;
  clickTrackingUrls: string[];
  tracking: Record<VastTrackingEvent, string[]>;
  companions?: { width: number; height: number; resource: string; clickThroughUrl?: string }[];
  icons?: AdIcon[];
};

export type VastResponse = {
  impressions: string[];
  linear?: AdCreativeLinear;
  errorUrls: string[];
};

export type AdBreakKind = 'preroll' | 'midroll' | 'postroll';
export type AdBreak = {
  id: string;
  kind: AdBreakKind;
  timeOffsetSec?: number;
  served?: boolean;
  vastTagUrl: string;
};

export type AdSchedule = { breaks: AdBreak[] };

export type AdState =
  | { phase: 'idle' }
  | { phase: 'loading'; break: AdBreak }
  | {
      phase: 'playing';
      break: AdBreak;
      /** seconds left in ad */
      remainingSec: number;
      /** static skip offset (sec) from VAST */
      skipOffsetSec?: number;
      /** live countdown (sec) until skip becomes enabled */
      skipCountdownSec?: number;
      /** whether skip button is enabled */
      canSkip?: boolean;
    }
  | { phase: 'paused'; break: AdBreak; remainingSec: number }
  | { phase: 'error'; break: AdBreak; message: string }
  | { phase: 'completed'; break: AdBreak };
