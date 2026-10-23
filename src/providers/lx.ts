import type { Track, OnlinePlatform } from '../domain/track.ts';

const platforms = ['wy', 'tx', 'kw', 'kg', 'mg'] as const;
const actions = ['musicUrl', 'lyric', 'pic'] as const;
// Local budgets, not an LX protocol constant: native ScriptRuntime rejects any
// event over 1 MiB of UTF-8, so initialization must be bounded before JSON.parse.
export const LX_INITIALIZE_MAX_BYTES = 1024 * 1024;
export const LX_NAME_MAX_LENGTH = 256;
export const LX_DECLARATION_MAX_LENGTH = 128;
export const LX_DECLARATION_MAX_ITEMS = 64;
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

function utf8Length(value: string) {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function declaration(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length > LX_DECLARATION_MAX_ITEMS) throw new Error(`音源${label}声明超出数量上限`);
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > LX_DECLARATION_MAX_LENGTH) throw new Error(`音源${label}声明格式无效`);
  }
  return value as string[];
}

export function readLXInitialize(payload: string): LXSource[] {
  if (typeof payload !== 'string' || utf8Length(payload) > LX_INITIALIZE_MAX_BYTES) throw new Error('音源初始化响应超出上限');
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { throw new Error('音源初始化响应格式无效'); }
  return readLXCapabilities(parsed);
}

export function readLXCapabilities(payload: unknown): LXSource[] {
  const declared = object(object(payload).sources);
  const result: LXSource[] = [];
  for (const platform of platforms) {
    const source = declared[platform];
    if (source === undefined) continue;
    const value = object(source);
    const declaredActions = declaration(value.actions, '动作');
    const declaredQualities = declaration(value.qualitys, '音质');
    const declaredName = value.name;
    if (declaredName !== undefined && (typeof declaredName !== 'string' || declaredName.length > LX_NAME_MAX_LENGTH)) throw new Error('音源名称声明格式无效');
    result.push({
      platform,
      name: declaredName ? declaredName as string : platform,
      actions: actions.filter(action => (declaredActions as readonly string[]).includes(action)),
      qualities: [...new Set(declaredQualities)],
    });
  }
  return result;
}

export function makeLXRequest(track: Track, quality: string, source: LXSource) {
  return makeLXActionRequest(track, 'musicUrl', source, quality);
}
export function makeLXActionRequest(track: Track, action: LXAction, source: LXSource, quality = '') {
  if (track.origin.kind !== 'online' || track.origin.platform !== source.platform) {
    throw new Error('歌曲平台与音源能力不匹配');
  }
  if (!source.actions.includes(action) || (action === 'musicUrl' && !source.qualities.includes(quality))) {
    throw new Error('音源未声明该播放动作或音质');
  }
  const seconds = track.durationMs === undefined ? undefined : Math.floor(track.durationMs / 1000);
  const interval = seconds === undefined ? null : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const meta: Record<string, unknown> & { songId: string; albumName: string } = {
    ...track.metadata,
    songId: typeof track.metadata.songId === 'string' && track.metadata.songId ? track.metadata.songId : track.origin.id,
    albumName: track.album ?? '',
    qualitys: track.qualities.map(item => ({ type: item.id, ...(item.sizeBytes !== undefined ? { size: `${(item.sizeBytes/1048576).toFixed(2)}MB` } : {}) })),
    _qualitys: track.metadata._qualitys ?? track.metadata._types ?? {},
    ...(track.artwork ? { picUrl: track.artwork } : {}),
  };
  return {
    source: track.origin.platform,
    action,
    info: {
      type: quality,
      musicInfo: {
        id: track.origin.platform === 'kg' ? track.origin.id : `${track.origin.platform}_${track.origin.id}`,
        name: track.title,
        singer: track.artist,
        source: track.origin.platform,
        interval,
        meta,
      },
    },
  };
}
