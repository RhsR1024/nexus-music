// Public NetEase Podcast (DJ Radio) browsing & program playback provider.
// Reuses existing NetEase WEAPI crypto and maps playable episodes into standard Tracks.
import type { Track } from '../domain/track.ts';
import { safePublicURL } from '../storage/cleanTrack.ts';
import { requestJSON, type HTTPClient } from './http.ts';
import { weapiPayload } from './neteaseCrypto.ts';
import { DESKTOP_UA } from './neteaseSession.ts';

type Row = Record<string, unknown>;
const row = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown) =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : '';
const safeArt = (v: unknown): string | undefined => {
  const raw = text(v).trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw.replace(/^\/\//, 'https://'));
    if (u.protocol === 'http:' && /\.music\.126\.net$/i.test(u.hostname)) u.protocol = 'https:';
    return safePublicURL(u.href) ? u.href : undefined;
  } catch {
    return undefined;
  }
};

export interface PodcastCategory {
  readonly id: string;
  readonly name: string;
}

export interface PodcastRadio {
  readonly id: string;
  readonly title: string;
  readonly creator: string;
  readonly category?: string;
  readonly description?: string;
  readonly artwork?: string;
  readonly programCount?: number;
  readonly subCount?: number;
}

export interface PodcastProgram {
  readonly id: string;
  readonly title: string;
  readonly radioTitle: string;
  readonly creator: string;
  readonly artwork?: string;
  readonly durationMs?: number;
  readonly listenerCount?: number;
  readonly createTime?: number;
  readonly track: Track;
}

export interface PodcastProgramPage {
  readonly programs: readonly PodcastProgram[];
  readonly total: number;
  readonly hasMore: boolean;
}

export class NeteasePodcastsProvider {
  private readonly http: HTTPClient;
  constructor(options: { http?: HTTPClient } = {}) {
    this.http = options.http ?? requestJSON;
  }

  private async weapi(path: string, data: Record<string, unknown>, signal: AbortSignal): Promise<Row> {
    const enc = weapiPayload(data);
    return row(
      await this.http(
        `https://music.163.com${path}`,
        {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Referer: 'https://music.163.com/',
            Origin: 'https://music.163.com',
            'User-Agent': DESKTOP_UA,
          },
          body: `params=${encodeURIComponent(enc.params)}&encSecKey=${encodeURIComponent(enc.encSecKey)}`,
        },
        signal,
      ),
    );
  }

  async categories(signal: AbortSignal): Promise<readonly PodcastCategory[]> {
    const raw = await this.weapi('/weapi/djradio/category/get', {}, signal);
    if (raw.code !== 200) throw new Error('播客分类暂不可用');
    return list(raw.categories)
      .map(entry => {
        const v = row(entry);
        const id = text(v.id);
        const name = text(v.name).trim();
        return id && name ? { id, name } : null;
      })
      .filter((x): x is PodcastCategory => x !== null);
  }

  async radios(categoryId: string | undefined, page: number, signal: AbortSignal, limit = 20): Promise<{ items: readonly PodcastRadio[]; hasMore: boolean }> {
    const offset = Math.max(0, (page - 1) * limit);
    const raw = categoryId && /^\d+$/.test(categoryId)
      ? await this.weapi('/weapi/dj/radio/hot', { cateId: Number(categoryId), limit, offset }, signal)
      : await this.weapi('/weapi/djradio/hot/v1', { limit, offset }, signal);
    if (raw.code !== 200) throw new Error('播客列表暂不可用');
    const items = list(raw.djRadios)
      .map(entry => {
        const v = row(entry);
        const id = text(v.id);
        const title = text(v.name).trim();
        if (!id || !title) return null;
        const dj = row(v.dj);
        const programCount = typeof v.programCount === 'number' && v.programCount >= 0 ? v.programCount : undefined;
        const subCount = typeof v.subCount === 'number' && v.subCount >= 0 ? v.subCount : undefined;
        const artwork = safeArt(v.picUrl);
        const description = text(v.rcmdtext ?? v.desc).trim().slice(0, 300) || undefined;
        const category = text(v.category).trim() || undefined;
        return {
          id,
          title,
          creator: text(dj.nickname).trim() || '网易云播客',
          ...(category ? { category } : {}),
          ...(description ? { description } : {}),
          ...(artwork ? { artwork } : {}),
          ...(programCount !== undefined ? { programCount } : {}),
          ...(subCount !== undefined ? { subCount } : {}),
        } as PodcastRadio;
      })
      .filter((x): x is PodcastRadio => x !== null);
    return { items, hasMore: raw.hasMore === true || items.length >= limit };
  }

  async programs(radioId: string, page: number, signal: AbortSignal, limit = 30): Promise<PodcastProgramPage> {
    if (!/^\d{1,30}$/.test(radioId)) throw new Error('播客 ID 无效');
    const offset = Math.max(0, (page - 1) * limit);
    const raw = await this.weapi('/weapi/dj/program/byradio', { radioId: Number(radioId), limit, offset, asc: false }, signal);
    if (raw.code !== 200) throw new Error('播客节目列表暂不可读取');
    const total = typeof raw.count === 'number' && Number.isSafeInteger(raw.count) && raw.count >= 0 ? raw.count : 0;
    const programs: PodcastProgram[] = [];
    for (const entry of list(raw.programs)) {
      const v = row(entry);
      const id = text(v.id);
      const mainSong = row(v.mainSong);
      const songId = text(mainSong.id || v.mainTrackId);
      const title = text(v.name || mainSong.name).trim();
      if (!id || !songId || !/^\d+$/.test(songId) || !title) continue;
      const radio = row(v.radio);
      const dj = row(v.dj);
      const radioTitle = text(radio.name).trim() || '网易云播客';
      const creator = text(dj.nickname).trim() || radioTitle;
      const artwork = safeArt(v.coverUrl ?? radio.picUrl);
      const durationMs = typeof v.duration === 'number' && v.duration > 0 ? v.duration : undefined;
      const listenerCount = typeof v.listenerCount === 'number' && v.listenerCount >= 0 ? v.listenerCount : undefined;
      const createTime = typeof v.createTime === 'number' && v.createTime > 0 ? v.createTime : undefined;
      const track: Track = {
        origin: { kind: 'online', platform: 'wy', id: songId },
        title,
        artist: creator,
        album: radioTitle,
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(artwork ? { artwork } : {}),
        metadata: { podcastId: radioId, programId: id, mediaKind: 'podcast' },
        qualities: [{ id: '128k' }, { id: '320k' }],
      };
      programs.push({
        id,
        title,
        radioTitle,
        creator,
        ...(artwork ? { artwork } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(listenerCount !== undefined ? { listenerCount } : {}),
        ...(createTime !== undefined ? { createTime } : {}),
        track,
      });
    }
    return {
      programs,
      total: Math.max(total, programs.length),
      hasMore: raw.more === true || offset + programs.length < total,
    };
  }
}
