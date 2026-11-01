export type PlaybackTraceStage = 'resolution' | 'offline' | 'match' | 'source' | 'cache' | 'native';
export type PlaybackTraceStatus = 'info' | 'success' | 'fallback' | 'failed' | 'cancelled';
export type PlaybackTraceRunStatus = 'running' | 'ready' | 'error' | 'cancelled';

export interface PlaybackTraceEvent {
  readonly sequence: number;
  readonly at: number;
  readonly stage: PlaybackTraceStage;
  readonly status: PlaybackTraceStatus;
  readonly title: string;
  readonly detail?: string;
  readonly sourceId?: string;
  readonly sourceName?: string;
  readonly platform?: string;
  readonly quality?: string;
}

export interface PlaybackTraceEventInput extends Omit<PlaybackTraceEvent, 'sequence' | 'at'> {}

export interface PlaybackTraceRun {
  readonly version: 1;
  readonly id: string;
  readonly entryId: string;
  readonly generation: number;
  readonly trackTitle: string;
  readonly trackArtist: string;
  readonly startedAt: number;
  readonly finishedAt?: number;
  readonly status: PlaybackTraceRunStatus;
  readonly events: readonly PlaybackTraceEvent[];
}

export type PlaybackTraceSink = (event: PlaybackTraceEventInput) => void;

/**
 * Playback diagnostics are intentionally structured and bounded. URLs,
 * headers, script output and resolver exception text never enter this model.
 */
export function safePlaybackTraceText(value: unknown, maximum = 180): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\b(?:https?|file|ipod-library):\/\/\S+/gi, '[地址隐藏]')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, maximum) : undefined;
}
