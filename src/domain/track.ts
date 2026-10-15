export type OnlinePlatform = 'wy' | 'tx' | 'kw' | 'kg' | 'mg';

export type TrackOrigin =
  | { kind: 'online'; platform: OnlinePlatform; id: string }
  | { kind: 'imported'; platform: 'qishui'; id: string }
  | { kind: 'navidrome'; accountId: string; id: string };

export interface Track {
  origin: TrackOrigin;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  artwork?: string;
  // Provider-specific identifiers/quality/lyric metadata must survive conversion.
  metadata: Readonly<Record<string, unknown>>;
  qualities: readonly { id: string; sizeBytes?: number }[];
}

export function trackKey(origin: TrackOrigin): string {
  if (!origin || (origin.kind !== 'online' && origin.kind !== 'navidrome' && origin.kind !== 'imported') ||
      (origin.kind === 'imported' && origin.platform !== 'qishui') ||
      (origin.kind === 'online' && !['wy','tx','kw','kg','mg'].includes(origin.platform))) throw new Error('歌曲来源无效');
  const namespace = origin.kind === 'navidrome' ? origin.accountId : origin.platform;
  if (typeof namespace !== 'string' || !namespace || typeof origin.id !== 'string' || !origin.id) {
    throw new Error('歌曲来源和 ID 必须是非空字符串');
  }
  // JSON encoding prevents collisions when provider IDs contain separators.
  return JSON.stringify([origin.kind, namespace, origin.id]);
}

export function validateTrack(track: Track): void {
  if (!track || typeof track !== 'object') throw new Error('歌曲数据无效');
  trackKey(track.origin);
  if (typeof track.title !== 'string' || typeof track.artist !== 'string') {
    throw new Error('歌曲名称与歌手必须是字符串');
  }
  if ((track.album!==undefined&&typeof track.album!=='string')||(track.artwork!==undefined&&typeof track.artwork!=='string'))throw new Error('歌曲专辑或封面格式无效');
  if (track.durationMs !== undefined &&
      (!Number.isFinite(track.durationMs) || track.durationMs < 0)) {
    throw new Error('歌曲时长无效');
  }
  if (!track.metadata || typeof track.metadata !== 'object' || Array.isArray(track.metadata) || !Array.isArray(track.qualities) ||
      track.qualities.some(item => !item || typeof item.id !== 'string' || !item.id || (item.sizeBytes !== undefined && (!Number.isFinite(item.sizeBytes) || item.sizeBytes < 0)))) throw new Error('歌曲元数据无效');
}
