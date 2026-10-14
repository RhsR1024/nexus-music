export type OnlinePlatform = 'wy' | 'tx' | 'kw' | 'kg' | 'mg';

export type TrackOrigin =
  | { kind: 'online'; platform: OnlinePlatform; id: string }
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
  const namespace = origin.kind === 'online' ? origin.platform : origin.accountId;
  if (!namespace || typeof origin.id !== 'string' || !origin.id) {
    throw new Error('歌曲来源和 ID 必须是非空字符串');
  }
  // JSON encoding prevents collisions when provider IDs contain separators.
  return JSON.stringify([origin.kind, namespace, origin.id]);
}

export function validateTrack(track: Track): void {
  trackKey(track.origin);
  if (typeof track.title !== 'string' || typeof track.artist !== 'string') {
    throw new Error('歌曲名称与歌手必须是字符串');
  }
  if (track.durationMs !== undefined &&
      (!Number.isFinite(track.durationMs) || track.durationMs < 0)) {
    throw new Error('歌曲时长无效');
  }
}
