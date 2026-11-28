export type TrackRowPlayState = 'idle' | 'loading' | 'playing' | 'paused';

/**
 * Pure helper mapping playback snapshot + optimistic tap key onto a single row's visual state.
 */
export function resolveTrackRowPlayState(params: {
  rowKey: string;
  activeTrackKey?: string;
  pendingTrackKey?: string;
  phase: string;
  intent: 'playing' | 'paused' | 'stopped';
  buffering: boolean;
}): TrackRowPlayState {
  const { rowKey, activeTrackKey, pendingTrackKey, phase, intent, buffering } = params;
  if (pendingTrackKey && rowKey === pendingTrackKey && rowKey !== activeTrackKey) {
    return 'loading';
  }
  if (!activeTrackKey || rowKey !== activeTrackKey) return 'idle';
  if (phase === 'resolving' || (buffering && intent === 'playing')) return 'loading';
  if (intent === 'playing') return 'playing';
  return 'paused';
}
