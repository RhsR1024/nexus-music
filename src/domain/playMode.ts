export type RepeatMode = 'off' | 'all' | 'one';
export type PlayMode = 'list' | 'one' | 'shuffle' | 'order';

export function currentPlayMode(repeat: RepeatMode, shuffle: boolean): PlayMode {
  if (shuffle) return 'shuffle';
  if (repeat === 'one') return 'one';
  if (repeat === 'all') return 'list';
  return 'order';
}

export function nextPlayModePatch(
  repeat: RepeatMode,
  shuffle: boolean,
): { repeat: RepeatMode; shuffle: boolean; mode: PlayMode; label: string } {
  const cur = currentPlayMode(repeat, shuffle);
  if (cur === 'list') return { repeat: 'one', shuffle: false, mode: 'one', label: '单曲循环' };
  if (cur === 'one') return { repeat: 'all', shuffle: true, mode: 'shuffle', label: '随机播放' };
  if (cur === 'shuffle') return { repeat: 'off', shuffle: false, mode: 'order', label: '顺序播放' };
  return { repeat: 'all', shuffle: false, mode: 'list', label: '列表循环' };
}

export function playModeLabel(repeat: RepeatMode, shuffle: boolean): string {
  const mode = currentPlayMode(repeat, shuffle);
  if (mode === 'one') return '单曲循环';
  if (mode === 'shuffle') return '随机播放';
  if (mode === 'list') return '列表循环';
  return '顺序播放';
}
