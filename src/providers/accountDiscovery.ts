// Authenticated NetEase account feeds (recent songs/playlists, play record,
// cloud drive, subscribed artists) + QQ / Kugou new song feeds for Discovery.
import type { Track } from '../domain/track.ts';
import type { ArtistItem } from './artists.ts';
import type { BrowseItem } from './discovery.ts';
import { queryURL, requestJSON, type HTTPClient } from './http.ts';
import type { MusicAccount, MusicAccounts } from './musicAccounts.ts';
import { neteaseSessionAuth, neteaseWeapiRequest } from './neteaseSession.ts';
import type { NeteaseAccountProfileClient } from './neteaseAccountProfile.ts';
import { onlineTrack } from './online.ts';
import { qqSignature } from './qqSignature.ts';
import { safePublicURL } from '../storage/cleanTrack.ts';

type Row = Record<string, unknown>;
const row = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown) =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : '';
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
function cleanArt(v: unknown): string | undefined {
  const raw = text(v).trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw.replace(/^\/\//, 'https://'));
    if (u.protocol === 'http:') u.protocol = 'https:';
    return safePublicURL(u.href) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export class AccountDiscoveryError extends Error {
  readonly kind: 'login_required' | 'unavailable' | 'cancelled' | 'account_changed';
  constructor(kind: 'login_required' | 'unavailable' | 'cancelled' | 'account_changed', message?: string) {
    super(
      message ??
        (kind === 'login_required'
          ? '登录状态已失效，请重新登录账号'
          : kind === 'cancelled'
            ? '读取已取消'
            : kind === 'account_changed'
              ? '平台账号已更改，请重试'
              : '暂时无法读取平台数据，请稍后重试'),
    );
    this.kind = kind;
  }
}

export interface PlayRecordRow {
  readonly track: Track;
  readonly playCount?: number;
  readonly score?: number;
}

export interface AccountDiscoveryDeps {
  readonly http?: HTTPClient;
  readonly sha1: (value: string) => Promise<string>;
  readonly accounts?: Pick<MusicAccounts, 'getSnapshot' | 'session'>;
  readonly neteaseProfile?: Pick<NeteaseAccountProfileClient, 'fetch'>;
}

export function parseNeteaseRecentSongs(raw: unknown): readonly Track[] {
  const r = row(raw);
  if (r.code !== 200) {
    throw new AccountDiscoveryError([301, 401, 403].includes(Number(r.code)) ? 'login_required' : 'unavailable');
  }
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const entry of list(row(r.data).list)) {
    const song = row(entry).data ?? entry;
    try {
      const track = onlineTrack('wy', song);
      if (track.origin.kind !== 'online' || seen.has(track.origin.id)) continue;
      seen.add(track.origin.id);
      tracks.push(track);
    } catch {}
    if (tracks.length >= 200) break;
  }
  return tracks;
}

export function parseNeteaseRecentPlaylists(raw: unknown): readonly BrowseItem[] {
  const r = row(raw);
  if (r.code !== 200) {
    throw new AccountDiscoveryError([301, 401, 403].includes(Number(r.code)) ? 'login_required' : 'unavailable');
  }
  const seen = new Set<string>();
  const items: BrowseItem[] = [];
  for (const entry of list(row(r.data).list)) {
    const pl = row(row(entry).data ?? entry);
    const id = text(pl.id).trim();
    const title = text(pl.name).trim();
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const artwork = cleanArt(pl.coverImgUrl ?? pl.picUrl);
    const author = text(row(pl.creator).nickname).trim();
    const count = num(pl.trackCount);
    items.push({
      id,
      title,
      ...(artwork ? { artwork } : {}),
      ...(author ? { author } : {}),
      ...(count !== undefined ? { count } : {}),
    });
  }
  return items;
}

export function parseNeteasePlayRecord(raw: unknown, type: 0 | 1): readonly PlayRecordRow[] {
  const r = row(raw);
  if (r.code !== 200) {
    throw new AccountDiscoveryError([301, 401, 403].includes(Number(r.code)) ? 'login_required' : 'unavailable');
  }
  const rows = list(type === 1 ? r.weekData ?? r.allData : r.allData ?? r.weekData);
  const out: PlayRecordRow[] = [];
  const seen = new Set<string>();
  for (const entry of rows) {
    const item = row(entry);
    const song = item.song ?? item;
    try {
      const track = onlineTrack('wy', song);
      if (track.origin.kind !== 'online' || seen.has(track.origin.id)) continue;
      seen.add(track.origin.id);
      out.push({
        track,
        ...(num(item.playCount) !== undefined ? { playCount: num(item.playCount) } : {}),
        ...(num(item.score) !== undefined ? { score: num(item.score) } : {}),
      });
    } catch {}
    if (out.length >= 100) break;
  }
  return out;
}

export function parseNeteaseCloudDrive(raw: unknown): { items: readonly Track[]; hasMore: boolean; count: number } {
  const r = row(raw);
  if (r.code !== 200) {
    throw new AccountDiscoveryError([301, 401, 403].includes(Number(r.code)) ? 'login_required' : 'unavailable');
  }
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const entry of list(r.data)) {
    const item = row(entry);
    const simple = row(item.simpleSong);
    const songId = text(simple.id ?? item.songId).trim();
    const title = text(simple.name ?? item.songName ?? item.fileName).trim();
    if (!songId || !title || seen.has(songId)) continue;
    seen.add(songId);
    try {
      const track = Object.keys(simple).length
        ? onlineTrack('wy', {
            ...simple,
            id: songId,
            name: title,
            ar: Array.isArray(simple.ar) && simple.ar.length ? simple.ar : [{ name: text(item.artist) || '云盘歌手' }],
            al: Object.keys(row(simple.al)).length ? simple.al : { name: text(item.album) || '我的云盘' },
          })
        : {
            origin: { kind: 'online' as const, platform: 'wy' as const, id: songId },
            title,
            artist: text(item.artist) || '云盘歌手',
            album: text(item.album) || '我的云盘',
            metadata: { cloudDrive: true },
            qualities: [],
          };
      tracks.push(track);
    } catch {}
  }
  return {
    items: tracks,
    hasMore: r.hasMore === true,
    count: num(r.count) ?? tracks.length,
  };
}

export function parseNeteaseSubscribedArtists(raw: unknown): { items: readonly ArtistItem[]; hasMore: boolean } {
  const r = row(raw);
  if (r.code !== 200) {
    throw new AccountDiscoveryError([301, 401, 403].includes(Number(r.code)) ? 'login_required' : 'unavailable');
  }
  const items: ArtistItem[] = [];
  const seen = new Set<string>();
  for (const entry of list(r.data)) {
    const v = row(entry);
    const id = text(v.id).trim();
    const title = text(v.name).trim();
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const artwork = cleanArt(v.picUrl ?? v.img1v1Url);
    const albumCount = num(v.albumSize);
    const songCount = num(v.musicSize);
    items.push({
      id,
      title,
      ...(artwork ? { artwork } : {}),
      ...(albumCount !== undefined ? { albumCount } : {}),
      ...(songCount !== undefined ? { songCount } : {}),
    });
  }
  return { items, hasMore: r.hasMore === true };
}

export function parseQQNewSongs(raw: unknown): readonly Track[] {
  const root = row(raw);
  const req = row(root.req);
  if (root.code !== 0 || req.code !== 0) {
    throw new AccountDiscoveryError('unavailable', 'QQ 音乐新歌推荐暂时不可用');
  }
  const songList = list(row(req.data).songlist);
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const entry of songList) {
    try {
      const track = onlineTrack('tx', entry);
      if (track.origin.kind !== 'online' || seen.has(track.origin.id)) continue;
      seen.add(track.origin.id);
      tracks.push(track);
    } catch {}
    if (tracks.length >= 60) break;
  }
  return tracks;
}

export function parseKugouNewSongs(raw: unknown): readonly Track[] {
  const r = row(raw);
  const rows = list(r.data);
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const entry of rows) {
    const v = row(entry);
    const hash = text(v.hash).trim();
    if (!hash || seen.has(hash)) continue;
    const filename = text(v.filename).trim();
    const split = filename.indexOf(' - ');
    const songName = split >= 0 ? filename.slice(split + 3).trim() : filename;
    const singerName = split >= 0 ? filename.slice(0, split).trim() : '';
    try {
      const track = onlineTrack('kg', {
        ...v,
        FileHash: hash,
        SongName: songName || filename,
        SingerName: singerName || '酷狗音乐',
        AlbumID: v.album_id,
        AlbumName: v.remark || '',
        Duration: v.duration,
        FileSize: v.filesize,
        HQFileHash: v['320hash'],
        HQFileSize: v['320filesize'],
        SQFileHash: v.sqhash,
        SQFileSize: v.sqfilesize,
      });
      seen.add(hash);
      tracks.push(track);
    } catch {}
    if (tracks.length >= 60) break;
  }
  return tracks;
}

export class AccountDiscoveryClient {
  private readonly http: HTTPClient;
  private readonly sha1: (value: string) => Promise<string>;
  private readonly accounts?: Pick<MusicAccounts, 'getSnapshot' | 'session'>;
  private readonly neteaseProfile?: Pick<NeteaseAccountProfileClient, 'fetch'>;

  constructor(deps: AccountDiscoveryDeps) {
    this.http = deps.http ?? requestJSON;
    this.sha1 = deps.sha1;
    this.accounts = deps.accounts;
    this.neteaseProfile = deps.neteaseProfile;
  }

  private async neteasePost(
    endpoint: string,
    payload: Record<string, unknown>,
    account: MusicAccount,
    session: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
  ): Promise<unknown> {
    if (signal.aborted) throw new AccountDiscoveryError('cancelled');
    const auth = neteaseSessionAuth(session);
    if (!auth) throw new AccountDiscoveryError('login_required');
    return this.http(endpoint, neteaseWeapiRequest(payload, auth), signal);
  }

  async recentSongs(account: MusicAccount, session: Readonly<Record<string, unknown>>, signal: AbortSignal, limit = 100): Promise<readonly Track[]> {
    const raw = await this.neteasePost('https://music.163.com/weapi/record/recent/song', { limit }, account, session, signal);
    return parseNeteaseRecentSongs(raw);
  }

  async recentPlaylists(account: MusicAccount, session: Readonly<Record<string, unknown>>, signal: AbortSignal, limit = 60): Promise<readonly BrowseItem[]> {
    const raw = await this.neteasePost('https://music.163.com/weapi/record/recent/playlist', { limit }, account, session, signal);
    return parseNeteaseRecentPlaylists(raw);
  }

  async playRecord(account: MusicAccount, session: Readonly<Record<string, unknown>>, type: 0 | 1, signal: AbortSignal): Promise<readonly PlayRecordRow[]> {
    let uid = /^\d+$/.test(account.username.trim()) ? account.username.trim() : '';
    if (!uid && this.neteaseProfile) {
      const profile = await this.neteaseProfile.fetch(session, signal);
      uid = profile.userId;
    }
    if (!uid) throw new AccountDiscoveryError('login_required', '无法识别网易云用户 ID，请重新登录');
    const raw = await this.neteasePost('https://music.163.com/weapi/v1/play/record', { uid, type }, account, session, signal);
    return parseNeteasePlayRecord(raw, type);
  }

  async cloudDrive(account: MusicAccount, session: Readonly<Record<string, unknown>>, signal: AbortSignal, limit = 100, offset = 0) {
    const raw = await this.neteasePost('https://music.163.com/weapi/v1/cloud/get', { limit, offset }, account, session, signal);
    return parseNeteaseCloudDrive(raw);
  }

  async subscribedArtists(account: MusicAccount, session: Readonly<Record<string, unknown>>, signal: AbortSignal, limit = 100, offset = 0) {
    const raw = await this.neteasePost('https://music.163.com/weapi/artist/sublist', { limit, offset }, account, session, signal);
    return parseNeteaseSubscribedArtists(raw);
  }

  async qqNewSongs(signal: AbortSignal, type = 5): Promise<readonly Track[]> {
    const body = JSON.stringify({
      comm: { ct: 24, cv: 0, format: 'json', uin: 0 },
      req: { module: 'newsong.NewSongServer', method: 'get_new_song_info', param: { type } },
    });
    const raw = await this.http(
      queryURL('https://u.y.qq.com/cgi-bin/musics.fcg', { sign: await qqSignature(body, this.sha1) }),
      { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', Referer: 'https://y.qq.com/' }, body },
      signal,
    );
    return parseQQNewSongs(raw);
  }

  async kugouNewSongs(signal: AbortSignal): Promise<readonly Track[]> {
    const raw = await this.http(
      'https://m.kugou.com/?json=true',
      { method: 'GET', credentials: 'omit', headers: { Referer: 'https://m.kugou.com/' } },
      signal,
    );
    return parseKugouNewSongs(raw);
  }
}
