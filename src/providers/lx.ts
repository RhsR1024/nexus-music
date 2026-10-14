import type { Track, OnlinePlatform } from '../domain/track.ts';

const platforms = ['wy', 'tx', 'kw', 'kg', 'mg'] as const;
const actions = ['musicUrl', 'lyric', 'pic'] as const;
export type LXAction = typeof actions[number];
export interface LXSource {
  platform: OnlinePlatform;
  name: string;
  actions: readonly LXAction[];
  qualities: readonly string[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('音源声明格式无效');
  return value as Record<string, unknown>;
}

export function readLXCapabilities(payload: unknown): LXSource[] {
  const declared = object(object(payload).sources);
  const result: LXSource[] = [];
  for (const platform of platforms) {
    const source = declared[platform];
    if (source === undefined) continue;
    const value = object(source);
    const declaredActions = value.actions;
    const declaredQualities = value.qualitys;
    if (!Array.isArray(declaredActions) || !Array.isArray(declaredQualities) ||
        !declaredQualities.every(quality => typeof quality === 'string' && quality.length > 0)) {
      throw new Error('音源动作或音质声明格式无效');
    }
    result.push({
      platform,
      name: typeof value.name === 'string' ? value.name : platform,
      actions: actions.filter(action => declaredActions.includes(action)),
      qualities: [...new Set(declaredQualities as string[])],
    });
  }
  return result;
}

export function makeLXRequest(track: Track, quality: string, source: LXSource) {
  if (track.origin.kind !== 'online' || track.origin.platform !== source.platform) {
    throw new Error('歌曲平台与音源能力不匹配');
  }
  if (!source.actions.includes('musicUrl') || !source.qualities.includes(quality)) {
    throw new Error('音源未声明该播放动作或音质');
  }
  const seconds = track.durationMs === undefined ? undefined : Math.floor(track.durationMs / 1000);
  const interval = seconds === undefined ? null : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const meta: Record<string, unknown> & { songId: string; albumName: string } = {
    ...track.metadata, songId: track.origin.id, albumName: track.album ?? '',
    ...(track.artwork ? { picUrl: track.artwork } : {}),
  };
  return {
    source: track.origin.platform,
    action: 'musicUrl' as const,
    info: {
      type: quality,
      musicInfo: {
        id: track.origin.id,
        name: track.title,
        singer: track.artist,
        source: track.origin.platform,
        interval,
        meta,
      },
    },
  };
}
