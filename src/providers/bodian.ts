// Clean-room TypeScript implementation of the Bodian Music (波点音乐) HTTPS API,
// QR code login coordinator, account store, catalog browser, direct playback rights,
// and Kuwo/Bodian word-timed lyric decoder.
// Protocol reference only (zero code/assets copied): Wow-CaiCai/Coda commit 22bc58e (AGPL-3.0/GPL-3.0).
import { encodeQrPngDataUri } from '../domain/qrPng.ts';
import type { Quality } from '../domain/quality.ts';
import type { Track } from '../domain/track.ts';
import { cleanTrack, safePublicURL } from '../storage/cleanTrack.ts';
import type { Repository } from '../storage/repository.ts';
import { bounded, throwIfAborted } from './async.ts';
import { HTTPResponseError, requestJSON, type HTTPClient } from './http.ts';
import type { MusicSecretStore } from './musicAccounts.ts';

type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : '';
const num = (value: unknown): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const safeHTTPS = (raw: unknown): string | undefined => {
  const s = text(raw)
    .replace(/^\/\//, 'https://')
    .replace(/^http:\/\//i, 'https://')
    .replace(/^(https:\/\/img[1-4])\.kwcdn(\.kuwo\.cn\/)/i, '$1$2');
  return s && safePublicURL(s) ? s : undefined;
};

const BODIAN_BASE = 'https://bd-api.kuwo.cn';
const BODIAN_SECRET_KEY = 'nexus.music.bodian.v1';
const BODIAN_ACCOUNT_KEY = 'bodian.account.v1';
const BODIAN_SIGN_SALT = 'kuwotest';
const BODIAN_UA = 'Dart/3.3 (dart:io)';

export interface BodianSession {
  readonly userId: string;
  readonly token: string;
  readonly deviceId: string;
}

export interface BodianAccountSnapshot {
  readonly loggedIn: boolean;
  readonly userId?: string;
  readonly nickname: string;
  readonly avatar?: string;
  readonly isVip?: boolean;
  readonly vipLabel?: string;
  readonly deviceId: string;
  readonly loggedInAt?: number;
}

export interface BodianPlaylistSummary {
  readonly id: string;
  readonly title: string;
  readonly artwork?: string;
  readonly source: number;
  readonly trackCount?: number;
  readonly subtitle?: string;
}

export interface BodianChartSummary {
  readonly id: string;
  readonly title: string;
  readonly artwork?: string;
  readonly description?: string;
  readonly previewTracks: readonly Track[];
}

export interface BodianAlbumSummary {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly artwork?: string;
  readonly trackCount?: number;
  readonly releaseDate?: string;
}

export interface BodianArtistSummary {
  readonly id: string;
  readonly name: string;
  readonly artwork?: string;
  readonly songCount?: number;
}

export interface BodianHomeModule {
  readonly id: string;
  readonly title: string;
  readonly kind: 'songs' | 'playlists' | 'aiPlaylists';
  readonly songs?: readonly Track[];
  readonly playlists?: readonly BodianPlaylistSummary[];
}

export interface BodianDirectStream {
  readonly url: string;
  readonly quality: Quality;
  readonly format: string;
  readonly bitrate?: number;
}

export interface BodianQr {
  readonly key: string;
  readonly url: string;
  readonly image: string;
  readonly expiresAt: number;
}

export type BodianQrPollResult =
  | { readonly status: 'waiting' | 'scanned' | 'expired' }
  | {
      readonly status: 'connected';
      readonly userId: string;
      readonly token: string;
      readonly nickname: string;
      readonly avatar?: string;
    };

export type BodianQrStatus =
  | 'idle'
  | 'loading'
  | 'waiting'
  | 'scanned'
  | 'saving'
  | 'succeeded'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface BodianQrSnapshot {
  readonly status: BodianQrStatus;
  readonly generation: number;
  readonly image?: string;
  readonly expiresAt?: number;
  readonly sameDevice?: boolean;
  readonly detail?: string;
}

export const bodianQrBusy = (status: BodianQrStatus): boolean =>
  status === 'loading' || status === 'waiting' || status === 'scanned' || status === 'saving';

export const BODIAN_PLAYLIST_CATEGORIES: readonly { readonly id: number; readonly name: string }[] = [
  { id: 88, name: '流行' },
  { id: 77, name: '网红' },
  { id: 84, name: '动漫' },
  { id: 79, name: '古风' },
  { id: 86, name: '金曲' },
  { id: 90, name: '民谣' },
  { id: 89, name: '摇滚' },
  { id: 122, name: '电音' },
  { id: 91, name: '嘻哈' },
  { id: 85, name: '老歌' },
];

export function stableSortedJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSortedJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableSortedJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function formEncodeEntry(key: string, value: string): string {
  const enc = (s: string) =>
    encodeURIComponent(s)
      .replace(/%20/g, '+')
      .replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${enc(key)}=${enc(value)}`;
}

export async function signBodianRequest(params: {
  path: string;
  query: Record<string, string>;
  bodyText?: string;
  md5: (value: string) => Promise<string>;
}): Promise<{ readonly queryString: string; readonly sign: string }> {
  const pairs = Object.entries(params.query)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => formEncodeEntry(k, v));
  const queryString = pairs.join('&');
  const sortedAlnum = queryString.replace(/[^A-Za-z0-9]/g, '').split('').sort().join('');
  const bodyDigest = params.bodyText ? (await params.md5(params.bodyText + BODIAN_SIGN_SALT)).toLowerCase() : '';
  const sign = (await params.md5(`${BODIAN_SIGN_SALT}${sortedAlnum}${bodyDigest}${params.path}`)).toLowerCase();
  return { queryString, sign };
}

function makeDeviceId(seed: string): string {
  const hex = seed.replace(/[^a-f0-9]/gi, '').toLowerCase();
  if (hex.length >= 32) return hex.slice(0, 32);
  return (hex + '0123456789abcdef0123456789abcdef').slice(0, 32);
}

function parseBodianTrack(rawValue: unknown): Track | null {
  const item = row(rawValue);
  const id = text(item.id ?? item.musicId ?? item.rid);
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const title = text(item.songName ?? item.name ?? item.title) || '未知歌曲';
  const artist =
    text(item.artist ?? item.artistName ?? item.singerName) ||
    list(item.artists)
      .map(a => text(row(a).name))
      .filter(Boolean)
      .join(' / ') ||
    '未知歌手';
  const album = text(item.album ?? item.albumName);
  const rawDuration = num(item.duration);
  const durationMs = rawDuration > 0 ? (rawDuration > 10_000 ? rawDuration : rawDuration * 1000) : undefined;
  const artwork = safeHTTPS(item.pic ?? item.cover ?? item.img ?? item.albumPic);
  const freeSign = text(item.freeSign ?? item.free_sign);
  const pay = num(item.pay);
  const artistId = text(item.artistId ?? item.artistid);
  const albumId = text(item.albumId ?? item.albumid);
  const hasLossless = Boolean(item.hasLossless ?? item.haslossless ?? item.isLossless);
  const qualities: { id: string }[] = hasLossless
    ? [{ id: 'flac' }, { id: '320k' }, { id: '128k' }]
    : [{ id: '320k' }, { id: '128k' }];
  return cleanTrack({
    origin: { kind: 'imported', platform: 'bodian', id },
    title,
    artist,
    ...(album ? { album } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(artwork ? { artwork } : {}),
    metadata: {
      originalPlatform: 'bodian',
      originalId: id,
      ...(freeSign ? { freeSign } : {}),
      ...(artistId ? { artistId } : {}),
      ...(albumId ? { albumId } : {}),
      ...(pay ? { pay } : {}),
    },
    qualities,
  });
}

function parseBodianPlaylist(rawValue: unknown, defaultSource = 5): BodianPlaylistSummary | null {
  const item = row(rawValue);
  const id = text(item.id ?? item.playlistId ?? item.pid ?? item.sourceId);
  if (!id) return null;
  const title = text(item.name ?? item.title ?? item.playlistName) || '波点歌单';
  const firstSong = row(list(item.songs ?? item.musicList)[0]);
  const artwork = safeHTTPS(
    item.pic ?? item.img ?? item.cover ?? item.coverImgUrl ?? item.headImg ?? firstSong.albumPic ?? firstSong.pic,
  );
  const source = num(item.source ?? item.sourceType) || defaultSource;
  const count = num(item.musicCount ?? item.musicNum ?? item.total ?? item.songNum ?? item.trackCount);
  const subtitle = text(item.info ?? item.desc ?? item.description ?? item.creatorName ?? item.uname);
  return {
    id,
    title,
    ...(artwork ? { artwork } : {}),
    source,
    ...(count > 0 ? { trackCount: count } : {}),
    ...(subtitle ? { subtitle } : {}),
  };
}

function encodeBase64Ascii(input: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const cp = input.charCodeAt(i);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const n = (a << 16) | (b << 8) | c;
    out +=
      alphabet[(n >> 18) & 63]! +
      alphabet[(n >> 12) & 63]! +
      (i + 1 < bytes.length ? alphabet[(n >> 6) & 63]! : '=') +
      (i + 2 < bytes.length ? alphabet[n & 63]! : '=');
  }
  return out;
}

function decodeBase64Utf8(raw: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = raw.replace(/\s+/g, '');
  if (!clean || clean.length % 4 !== 0) return '';
  let bits = 0;
  let count = 0;
  let percent = '';
  for (const ch of clean) {
    if (ch === '=') break;
    const idx = alphabet.indexOf(ch);
    if (idx < 0) return '';
    bits = (bits << 6) | idx;
    count += 6;
    if (count >= 8) {
      count -= 8;
      percent += '%' + ((bits >> count) & 0xff).toString(16).padStart(2, '0');
    }
  }
  try {
    return decodeURIComponent(percent);
  } catch {
    return '';
  }
}

function formatLrcTimestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const min = Math.floor(safe / 60_000);
  const sec = Math.floor((safe % 60_000) / 1000);
  const cent = Math.floor((safe % 1000) / 10);
  return `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cent).padStart(2, '0')}]`;
}

/**
 * Decodes Bodian / Kuwo `lrcx=1` lyric text containing `[kuwo:NN]` octal scaling
 * factors and `<offset,len>` per-syllable timing tags into standard LRC + YRC + translation.
 */
export function decodeBodianLyricContent(rawText: string): { readonly lyric: string; readonly tlyric?: string; readonly yrc?: string } {
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');
  let startFactor = 0;
  let durationFactor = 0;
  for (const line of lines) {
    const km = line.match(/^\s*\[kuwo:(\d+)\]\s*$/i);
    if (km && km[1]) {
      const octal = parseInt(km[1], 8);
      if (Number.isFinite(octal) && octal > 0) {
        startFactor = Math.floor(octal / 10);
        durationFactor = octal % 10;
      }
      break;
    }
  }
  interface ParsedRow {
    timeMs: number;
    text: string;
    words?: { startMs: number; durationMs: number; text: string }[];
  }
  const timed: ParsedRow[] = [];
  for (const rawLine of lines) {
    const m = rawLine.match(/^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
    if (!m) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const frac = m[3] ? Number(m[3].padEnd(3, '0')) : 0;
    const timeMs = min * 60_000 + sec * 1000 + frac;
    const body = m[4] ?? '';
    if (startFactor > 0 && durationFactor > 0 && /<-?\d+,-?\d+(?:,-?\d+)?>/.test(body)) {
      const tokenRe = /<(-?\d+),(-?\d+)(?:,-?\d+)?>([^<]*)/g;
      const words: { startMs: number; durationMs: number; text: string }[] = [];
      let plain = '';
      let tok: RegExpExecArray | null;
      while ((tok = tokenRe.exec(body)) !== null) {
        const a = Number(tok[1]);
        const b = Number(tok[2]);
        const wordText = tok[3] ?? '';
        const wordOffset = Math.round(Math.abs(a + b) / (2 * startFactor));
        const wordStart = timeMs + wordOffset;
        const wordDur = Math.max(0, Math.round(Math.abs(a - b) / (2 * durationFactor)));
        if (wordText) {
          words.push({ startMs: wordStart, durationMs: wordDur, text: wordText });
          plain += wordText;
        }
      }
      if (plain.trim()) timed.push({ timeMs, text: plain, words });
    } else {
      const clean = body.replace(/<-?\d+,-?\d+(?:,-?\d+)?>/g, '').trim();
      if (clean) timed.push({ timeMs, text: clean });
    }
  }
  if (!timed.length) return { lyric: rawText };
  // Separate duplicate timestamps: when consecutive lines share an identical timestamp,
  // the second entry is usually the translation line.
  const mainRows: ParsedRow[] = [];
  const transRows: ParsedRow[] = [];
  for (const entry of timed) {
    const prev = mainRows[mainRows.length - 1];
    if (prev && Math.abs(prev.timeMs - entry.timeMs) <= 20 && !entry.words?.length) {
      transRows.push(entry);
    } else {
      mainRows.push(entry);
    }
  }
  const lyric = mainRows.map(r => `${formatLrcTimestamp(r.timeMs)}${r.text}`).join('\n');
  const tlyric = transRows.length ? transRows.map(r => `${formatLrcTimestamp(r.timeMs)}${r.text}`).join('\n') : undefined;
  const hasWords = mainRows.some(r => r.words && r.words.length > 0);
  const yrc = hasWords
    ? mainRows
        .map((r, idx) => {
          const nextStart = mainRows[idx + 1]?.timeMs ?? r.timeMs + 4000;
          const lineDur = Math.max(200, nextStart - r.timeMs);
          if (r.words?.length) {
            const segments = r.words
              .map(w => `(${w.startMs},${Math.max(40, w.durationMs)},0)${w.text}`)
              .join('');
            return `[${r.timeMs},${lineDur}]${segments}`;
          }
          return `[${r.timeMs},${lineDur}](${r.timeMs},${lineDur},0)${r.text}`;
        })
        .join('\n')
    : undefined;
  return { lyric, ...(tlyric ? { tlyric } : {}), ...(yrc ? { yrc } : {}) };
}

export class BodianProvider {
  private readonly http: HTTPClient;
  private readonly md5: (value: string) => Promise<string>;
  private readonly now: () => number;
  private readonly defaultDeviceId: string;

  constructor(options: {
    http?: HTTPClient;
    md5: (value: string) => Promise<string>;
    deviceId?: string;
    now?: () => number;
  }) {
    this.http = options.http ?? requestJSON;
    this.md5 = options.md5;
    this.now = options.now ?? Date.now;
    this.defaultDeviceId = makeDeviceId(options.deviceId ?? 'nexusmusicbodian0000000000000001');
  }

  private async request(options: {
    path: string;
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | undefined>;
    body?: Record<string, unknown>;
    signed?: boolean;
    session?: BodianSession | null;
    anonymous?: boolean;
    signal: AbortSignal;
    timeoutMs?: number;
  }): Promise<Row> {
    return bounded(async child => {
      throwIfAborted(child);
      const sess = options.anonymous ? null : options.session ?? null;
      const uid = sess?.userId || '-1';
      const token = sess?.token || '';
      const deviceId = sess?.deviceId || this.defaultDeviceId;
      const query: Record<string, string> = {};
      for (const [k, v] of Object.entries(options.query ?? {})) {
        if (v !== undefined) query[k] = String(v);
      }
      query.uid = uid;
      query.token = token;
      if (options.signed) {
        query.timestamp = String(this.now());
      }
      const bodyText = options.body ? stableSortedJson(options.body) : undefined;
      let fullQuery: string;
      if (options.signed) {
        const { queryString, sign } = await signBodianRequest({
          path: options.path,
          query,
          bodyText,
          md5: this.md5,
        });
        fullQuery = queryString ? `${queryString}&sign=${sign}` : `sign=${sign}`;
      } else {
        fullQuery = Object.entries(query)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => formEncodeEntry(k, v))
          .join('&');
      }
      throwIfAborted(child);
      const url = `${BODIAN_BASE}${options.path}${fullQuery ? `?${fullQuery}` : ''}`;
      const headers: Record<string, string> = {
        'User-Agent': BODIAN_UA,
        plat: 'win',
        channel: 'W1',
        ver: '1.1.7',
        svrver: '13',
        'api-ver': 'application/json',
        brand: 'Windows',
        net: 'wifi',
        devid: deviceId,
        qimei36: deviceId,
        'Content-Type': 'application/json',
        ...(sess?.userId ? { uid: sess.userId } : {}),
        ...(sess?.token ? { token: sess.token } : {}),
      };
      const raw = row(
        await this.http(
          url,
          {
            method: options.method ?? (bodyText ? 'POST' : 'GET'),
            credentials: 'omit',
            headers,
            ...(bodyText ? { body: bodyText } : {}),
          },
          child,
        ),
      );
      throwIfAborted(child);
      return raw;
    }, options.signal, options.timeoutMs ?? 12_000);
  }

  async createQr(signal: AbortSignal): Promise<BodianQr> {
    const expiresAt = this.now() + 180_000;
    const res = await this.request({
      path: '/api/ucenter/login/qrCode',
      signed: true,
      anonymous: true,
      signal,
    });
    const code = num(res.code);
    const key = text(row(res.data).qrCode ?? res.qrCode);
    if ((code && code !== 200) || !key || key.length > 256) {
      throw new Error('获取波点登录二维码失败，请重试');
    }
    const url = `https://bodian-oia.kuwo.cn/bodian/download.html?pageName=login_pc&pt=3&id=${encodeURIComponent(key)}`;
    const image = encodeQrPngDataUri(url);
    return { key, url, image, expiresAt };
  }

  async pollQr(qr: BodianQr, signal: AbortSignal): Promise<BodianQrPollResult> {
    if (this.now() >= qr.expiresAt) return { status: 'expired' };
    const statusRes = await this.request({
      path: '/api/ucenter/login/qrCodeStatus',
      query: { qrCode: qr.key },
      signed: true,
      anonymous: true,
      signal,
    });
    const status = num(row(statusRes.data).status);
    if (status === 1) return { status: 'waiting' };
    if (status === 2) return { status: 'expired' };
    if (status !== 3) return { status: 'waiting' };

    const loginRes = await this.request({
      path: '/api/ucenter/users/login',
      method: 'POST',
      body: { authType: 10, qrCode: qr.key },
      signed: true,
      anonymous: true,
      signal,
    });
    const code = num(loginRes.code);
    if (code === 11027) return { status: 'scanned' };
    if (code !== 200) throw new Error('波点扫码授权未完成');
    const data = row(loginRes.data);
    const userInfo = row(data.userInfo);
    const token = text(data.token);
    const userId = text(data.id ?? userInfo.id ?? userInfo.uid);
    if (!token || !userId) throw new Error('波点登录凭据不完整');
    const nickname = text(userInfo.nickname ?? data.nickname) || '波点音乐用户';
    const avatar = safeHTTPS(userInfo.headImg ?? userInfo.avatar ?? data.headImg);
    return { status: 'connected', userId, token, nickname, ...(avatar ? { avatar } : {}) };
  }

  async fetchProfile(session: BodianSession, signal: AbortSignal): Promise<{
    readonly nickname?: string;
    readonly avatar?: string;
    readonly isVip: boolean;
    readonly vipLabel?: string;
  }> {
    const res = await this.request({
      path: `/api/ucenter/users/pub/${encodeURIComponent(session.userId)}`,
      signed: true,
      session,
      signal,
    });
    if (num(res.code) && num(res.code) !== 200) throw new Error('波点会话已失效');
    const data = row(res.data);
    const userInfo = row(data.userInfo ?? data);
    const payInfo = row(data.payInfo ?? userInfo.payInfo);
    const isVip = Boolean(
      payInfo.isVip === true ||
        payInfo.isVip === 1 ||
        payInfo.vip === 1 ||
        num(payInfo.vipType) > 0 ||
        num(payInfo.expireTime) > this.now(),
    );
    const vipLabel = isVip ? text(payInfo.vipName ?? payInfo.levelName) || '波点会员' : undefined;
    const nickname = text(userInfo.nickname ?? data.nickname) || undefined;
    const avatar = safeHTTPS(userInfo.headImg ?? userInfo.avatar ?? data.headImg);
    return { ...(nickname ? { nickname } : {}), ...(avatar ? { avatar } : {}), isVip, ...(vipLabel ? { vipLabel } : {}) };
  }

  async homeModules(signal: AbortSignal, session?: BodianSession | null): Promise<readonly BodianHomeModule[]> {
    const res = await this.request({
      path: '/api/service/home/index',
      session,
      signal,
    });
    const moduleList = list(row(res.data).moduleList ?? res.data);
    const out: BodianHomeModule[] = [];
    const toFetch: { id: string; title: string; type: number }[] = [];
    for (const rawMod of moduleList) {
      const m = row(rawMod);
      const id = text(m.id ?? m.moduleId);
      const title = text(m.name ?? m.title);
      const type = num(m.type ?? m.moduleType);
      const rawItems = list(m.dataList ?? m.list ?? m.musics ?? m.musicList ?? m.songList ?? m.playlists ?? m.playLists);
      if (rawItems.length) {
        if (type === 3 || type === 10) {
          const songs = rawItems.map(parseBodianTrack).filter((t): t is Track => !!t);
          if (songs.length) out.push({ id: id || `mod-${out.length}`, title: title || '心动单曲', kind: 'songs', songs });
        } else if (type === 4 || type === 11) {
          const playlists = rawItems.map(x => parseBodianPlaylist(x, 4)).filter((p): p is BodianPlaylistSummary => !!p);
          if (playlists.length) out.push({ id: id || `mod-${out.length}`, title: title || '个性歌单', kind: 'aiPlaylists', playlists });
        } else if (type === 5) {
          const playlists = rawItems.map(x => parseBodianPlaylist(x, 5)).filter((p): p is BodianPlaylistSummary => !!p);
          if (playlists.length) out.push({ id: id || `mod-${out.length}`, title: title || '宝藏歌单', kind: 'playlists', playlists });
        }
      } else if (id && [3, 4, 5, 10, 11].includes(type)) {
        toFetch.push({ id, title, type });
      }
    }
    // Real /api/service/home/index returns module descriptors; fetch their payloads via /api/service/home/module
    const targets = toFetch.length
      ? toFetch.slice(0, 4)
      : out.length < 2
        ? [
            { id: '3', title: '偶遇心动单曲', type: 3 },
            { id: '2', title: '宝藏歌单库', type: 5 },
          ]
        : [];
    if (targets.length) {
      const details = await Promise.all(
        targets.map(t =>
          this.request({ path: '/api/service/home/module', query: { moduleId: t.id }, session, signal })
            .then(r => ({ target: t, data: row(r.data) }))
            .catch(() => null),
        ),
      );
      for (const entry of details) {
        if (!entry) continue;
        const { target, data } = entry;
        const modType = num(data.type) || target.type;
        const modTitle = text(data.moduleName ?? data.name) || target.title;
        if (modType === 3 || modType === 10) {
          const songs = list(data.musicList ?? data.musics ?? data.dataList ?? data.list)
            .map(parseBodianTrack)
            .filter((t): t is Track => !!t);
          if (songs.length && !out.some(x => x.id === target.id)) {
            out.push({ id: target.id, title: modTitle || '偶遇心动单曲', kind: 'songs', songs });
          }
        } else if (modType === 4 || modType === 11) {
          // Type 4 personalized modules may carry inline songs inside songList items (e.g. 潮趣日推 id: 0)
          const rawSongList = list(data.songList ?? data.playLists ?? data.dataList ?? data.list);
          const aiSongs = rawSongList.flatMap(item => list(row(item).songs)).map(parseBodianTrack).filter((t): t is Track => !!t);
          const pls = rawSongList
            .filter(item => text(row(item).id) && text(row(item).id) !== '0')
            .map(x => parseBodianPlaylist(x, 4))
            .filter((p): p is BodianPlaylistSummary => !!p);
          if (pls.length && !out.some(x => x.id === target.id)) {
            out.push({ id: target.id, title: modTitle || '个性化歌单', kind: 'aiPlaylists', playlists: pls });
          } else if (aiSongs.length && !out.some(x => x.id === target.id)) {
            out.push({ id: target.id, title: modTitle || '潮趣日推', kind: 'songs', songs: aiSongs.slice(0, 12) });
          }
        } else if (modType === 5) {
          const pls = list(data.songList ?? data.playLists ?? data.dataList ?? data.list)
            .map(x => parseBodianPlaylist(x, 5))
            .filter((p): p is BodianPlaylistSummary => !!p);
          if (pls.length && !out.some(x => x.id === target.id)) {
            out.push({ id: target.id, title: modTitle || '宝藏歌单库', kind: 'playlists', playlists: pls });
          }
        }
      }
    }
    return out;
  }

  async dailyPicks(signal: AbortSignal, session?: BodianSession | null, index = 0): Promise<{ title: string; tracks: readonly Track[] }> {
    const res = await this.request({
      path: '/api/service/home/aiPlaylistDetail',
      query: { index, passRecName: '' },
      session,
      signal,
    });
    const data = row(res.data);
    const title = text(data.title ?? data.name) || '潮趣日推';
    const rawTracks = list(data.musicList ?? data.musics ?? data.list ?? res.data);
    return { title, tracks: rawTracks.map(parseBodianTrack).filter((t): t is Track => !!t) };
  }

  async personalFM(signal: AbortSignal, session?: BodianSession | null): Promise<readonly Track[]> {
    const res = await this.request({
      path: '/api/service/music/recommendList',
      session,
      signal,
    });
    const rawTracks = list(row(res.data).musicList ?? row(res.data).list ?? res.data);
    return rawTracks.map(parseBodianTrack).filter((t): t is Track => !!t);
  }

  async recommendedPlaylists(signal: AbortSignal, session?: BodianSession | null): Promise<readonly BodianPlaylistSummary[]> {
    const res = await this.request({
      path: '/api/service/finds/playlist',
      session,
      signal,
    });
    const data = row(res.data);
    const nested = list(data.lists).flatMap(g => list(row(g).playLists ?? row(g).playlists ?? row(g).list));
    const rawList = nested.length ? nested : list(data.playLists ?? data.playlists ?? data.list ?? res.data);
    return rawList.map(x => parseBodianPlaylist(x, 4)).filter((p): p is BodianPlaylistSummary => !!p);
  }

  async categoryPlaylists(
    categoryId: number,
    page: number,
    signal: AbortSignal,
    session?: BodianSession | null,
  ): Promise<{ items: readonly BodianPlaylistSummary[]; hasMore: boolean }> {
    const res = await this.request({
      path: `/api/service/category/${categoryId}/playlist`,
      query: { pn: page, rn: 30 },
      session,
      signal,
    });
    const data = row(res.data);
    const rawList = list(data.playLists ?? data.playlists ?? data.list ?? res.data);
    const items = rawList.map(x => parseBodianPlaylist(x, 4)).filter((p): p is BodianPlaylistSummary => !!p);
    const total = num(data.total);
    return { items, hasMore: total ? page * 30 < total : items.length >= 30 };
  }

  async charts(signal: AbortSignal, session?: BodianSession | null): Promise<readonly BodianChartSummary[]> {
    const res = await this.request({
      path: '/api/service/home/bangNew',
      session,
      signal,
    });
    const grouped = Array.isArray(res.data)
      ? res.data.flatMap(g => {
          const group = row(g);
          const bangs = list(group.bangList ?? group.list);
          return bangs.length ? bangs : [g];
        })
      : list(row(res.data).list ?? row(res.data).bangList);
    const out: BodianChartSummary[] = [];
    const seen = new Set<string>();
    for (const rawItem of grouped) {
      const item = row(rawItem);
      const id = text(item.id ?? item.sourceId ?? item.bangId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const title = text(item.name ?? item.title) || '波波排行榜';
      const artwork = safeHTTPS(item.pic ?? item.cover ?? item.img);
      const description = text(item.pubStr ?? item.pub ?? item.info ?? item.intro);
      const previewTracks = list(item.musics ?? item.musicList)
        .map(parseBodianTrack)
        .filter((t): t is Track => !!t)
        .slice(0, 3);
      out.push({ id, title, ...(artwork ? { artwork } : {}), ...(description ? { description } : {}), previewTracks });
    }
    return out;
  }

  async chartSongs(
    chartId: string,
    page: number,
    signal: AbortSignal,
    session?: BodianSession | null,
  ): Promise<{ items: readonly Track[]; hasMore: boolean }> {
    const res = await this.request({
      path: `/api/service/bang/${encodeURIComponent(chartId)}/musics`,
      query: { pn: page, rn: 100 },
      session,
      signal,
    });
    const data = row(res.data);
    const rawList = list(data.musics ?? data.musicList ?? data.list ?? res.data);
    const items = rawList.map(parseBodianTrack).filter((t): t is Track => !!t);
    const total = num(data.total ?? data.num);
    return { items, hasMore: total ? page * 100 < total : items.length >= 100 };
  }

  async playlistDetail(
    id: string,
    source: number,
    page: number,
    signal: AbortSignal,
    session?: BodianSession | null,
  ): Promise<{ info?: BodianPlaylistSummary; items: readonly Track[]; hasMore: boolean }> {
    const trySource = async (src: number) => {
      const [infoRes, tracksRes] = await Promise.all([
        page === 1
          ? this.request({ path: `/api/service/playlist/info/${encodeURIComponent(id)}`, query: { source: src }, session, signal }).catch(() => null)
          : Promise.resolve(null),
        this.request({
          path: `/api/service/playlist/${encodeURIComponent(id)}/musicList`,
          query: { source: src, pn: page, rn: 100 },
          session,
          signal,
        }),
      ]);
      const info = infoRes ? parseBodianPlaylist(infoRes.data, src) ?? undefined : undefined;
      const data = row(tracksRes.data);
      const rawList = list(data.list ?? data.musicList ?? data.musics ?? tracksRes.data);
      const items = rawList.map(parseBodianTrack).filter((t): t is Track => !!t);
      const total = num(data.total ?? data.musicNum);
      return { ...(info ? { info } : {}), items, hasMore: total ? page * 100 < total : items.length >= 100 };
    };
    const first = await trySource(source);
    if (first.items.length || page > 1) return first;
    // Bodian discovery playlists use source=4 while curated home playlists use source=5; retry alternate automatically
    const altSource = source === 5 ? 4 : 5;
    try {
      const alt = await trySource(altSource);
      if (alt.items.length) return alt;
    } catch {
      // keep first result
    }
    return first;
  }

  async searchSongs(
    keyword: string,
    page: number,
    signal: AbortSignal,
    session?: BodianSession | null,
  ): Promise<{ items: readonly Track[]; hasMore: boolean }> {
    const q = keyword.trim();
    if (!q) return { items: [], hasMore: false };
    const res = await this.request({
      path: '/api/search/music/list',
      query: { keyword: q, correct: 1, pn: Math.max(0, page - 1), rn: 30 },
      session,
      signal,
    });
    const data = row(res.data);
    const rawList = list(data.resultList ?? data.dataList ?? data.list ?? data.musicList ?? res.data);
    const items = rawList.map(parseBodianTrack).filter((t): t is Track => !!t);
    const total = num(data.total);
    return { items, hasMore: total ? page * 30 < total : items.length >= 30 };
  }

  async favorites(session: BodianSession, signal: AbortSignal): Promise<{ playlist?: BodianPlaylistSummary; tracks: readonly Track[] }> {
    const res = await this.request({
      path: '/api/service/playlist/fond',
      query: { userId: session.userId, fromUid: session.userId },
      session,
      signal,
    });
    const data = row(res.data);
    const playlist = parseBodianPlaylist(data, 4) ?? undefined;
    const inlineTracks = list(data.musicList ?? data.musics).map(parseBodianTrack).filter((t): t is Track => !!t);
    if (inlineTracks.length || !playlist) return { ...(playlist ? { playlist } : {}), tracks: inlineTracks };
    const detail = await this.playlistDetail(playlist.id, playlist.source || 4, 1, signal, session);
    return { playlist: detail.info ?? playlist, tracks: detail.items };
  }

  async userCollections(session: BodianSession, signal: AbortSignal): Promise<{
    readonly created: readonly BodianPlaylistSummary[];
    readonly collectedPlaylists: readonly BodianPlaylistSummary[];
    readonly collectedAlbums: readonly BodianAlbumSummary[];
  }> {
    const [createdRes, collectRes] = await Promise.all([
      this.request({
        path: '/api/service/playlist/userCreate',
        query: { userId: session.userId, fromUid: session.userId },
        session,
        signal,
      }).catch(() => ({} as Row)),
      this.request({
        path: '/api/service/collect/4/list',
        query: { userId: session.userId, fromUid: session.userId, pn: 1, rn: 100 },
        session,
        signal,
      }).catch(() => ({} as Row)),
    ]);
    const created = list(row(createdRes.data).list ?? row(createdRes.data).playlists ?? createdRes.data)
      .map(x => parseBodianPlaylist(x, 4))
      .filter((p): p is BodianPlaylistSummary => !!p);
    const collectItems = list(row(collectRes.data).list ?? row(collectRes.data).dataList ?? collectRes.data);
    const collectedPlaylists: BodianPlaylistSummary[] = [];
    const collectedAlbums: BodianAlbumSummary[] = [];
    for (const rawItem of collectItems) {
      const item = row(rawItem);
      const sourceType = num(item.sourceType ?? item.type);
      if (sourceType === 6) {
        const id = text(item.id ?? item.albumId ?? item.sourceId);
        if (!id) continue;
        collectedAlbums.push({
          id,
          title: text(item.name ?? item.albumName ?? item.title) || '收藏专辑',
          artist: text(item.artist ?? item.artistName) || '',
          artwork: safeHTTPS(item.pic ?? item.cover ?? item.img),
          trackCount: num(item.musicNum ?? item.total) || undefined,
          releaseDate: text(item.releaseDate ?? item.publishTime) || undefined,
        });
      } else {
        const pl = parseBodianPlaylist(item, sourceType || 5);
        if (pl) collectedPlaylists.push(pl);
      }
    }
    return { created, collectedPlaylists, collectedAlbums };
  }

  async followedArtists(session: BodianSession, signal: AbortSignal): Promise<readonly BodianArtistSummary[]> {
    const res = await this.request({
      path: '/api/service/collect/7/list',
      query: { userId: session.userId, fromUid: session.userId, pn: 1, rn: 100 },
      session,
      signal,
    });
    const rawList = list(row(res.data).list ?? row(res.data).dataList ?? res.data);
    const out: BodianArtistSummary[] = [];
    for (const rawItem of rawList) {
      const item = row(rawItem);
      const id = text(item.id ?? item.artistId ?? item.sourceId);
      const name = text(item.name ?? item.artistName);
      if (!id || !name) continue;
      out.push({
        id,
        name,
        artwork: safeHTTPS(item.pic ?? item.avatar ?? item.img),
        songCount: num(item.musicNum ?? item.songNum) || undefined,
      });
    }
    return out;
  }

  async recentPlays(session: BodianSession, signal: AbortSignal): Promise<readonly Track[]> {
    const res = await this.request({
      path: '/api/playlist/history/page',
      query: { sourceType: 1, pn: 1, rn: 200 },
      signed: true,
      session,
      signal,
    });
    const data = row(res.data);
    const rawList = list(data.list ?? data.records ?? data.musicList ?? res.data);
    return rawList
      .map(entry => parseBodianTrack(row(entry).music ?? row(entry).song ?? entry))
      .filter((t): t is Track => !!t);
  }

  async albumSongs(albumId: string, signal: AbortSignal, session?: BodianSession | null): Promise<readonly Track[]> {
    const res = await this.request({
      path: `/api/service/album/${encodeURIComponent(albumId)}/musics`,
      query: { pn: 1, rn: 100 },
      session,
      signal,
    });
    const data = row(res.data);
    return list(data.musicList ?? data.list ?? res.data).map(parseBodianTrack).filter((t): t is Track => !!t);
  }

  async artistSongs(artistId: string, signal: AbortSignal, session?: BodianSession | null): Promise<readonly Track[]> {
    const res = await this.request({
      path: `/api/service/artist/${encodeURIComponent(artistId)}/musics`,
      query: { pn: 1, rn: 100 },
      session,
      signal,
    });
    const data = row(res.data);
    return list(data.musicList ?? data.list ?? res.data).map(parseBodianTrack).filter((t): t is Track => !!t);
  }

  async directPlayback(
    track: Track,
    preferredQuality: Quality,
    session: BodianSession | null,
    signal: AbortSignal,
  ): Promise<BodianDirectStream | null> {
    if (track.origin.kind !== 'imported' || track.origin.platform !== 'bodian') return null;
    const musicId = track.origin.id;
    const freeSign = text(track.metadata.freeSign);
    // Step 1: check official full-track right; status 3 = preview-only, status 7 = unavailable
    const rightRes = await this.request({
      path: '/api/play/music/v2/checkRight',
      query: { musicId, ...(freeSign ? { freeSign } : {}) },
      signed: true,
      session,
      signal,
      timeoutMs: 8_000,
    });
    const rightStatus = num(row(rightRes.data).status);
    if (rightStatus === 3 || rightStatus === 7) return null;

    const candidates: { quality: Quality; format: string; br: string }[] =
      preferredQuality === '128k'
        ? [{ quality: '128k', format: 'mp3', br: '128kmp3' }]
        : preferredQuality === '320k'
          ? [
              { quality: '320k', format: 'mp3', br: '320kmp3' },
              { quality: '128k', format: 'mp3', br: '128kmp3' },
            ]
          : [
              { quality: 'flac', format: 'flac', br: '2000kflac' },
              { quality: '320k', format: 'mp3', br: '320kmp3' },
              { quality: '128k', format: 'mp3', br: '128kmp3' },
            ];
    const devId = session?.deviceId || this.defaultDeviceId;
    for (const candidate of candidates) {
      try {
        const audioRes = await this.request({
          path: '/api/play/music/v2/audioUrl',
          query: {
            devId,
            musicId,
            format: candidate.format,
            br: candidate.br,
            ...(freeSign ? { freeSign } : {}),
          },
          signed: true,
          session,
          signal,
          timeoutMs: 8_000,
        });
        const data = row(audioRes.data);
        if (num(data.isTry) === 1 || num(data.status) === 3) continue;
        const url = safeHTTPS(data.audioHttpsUrl ?? data.audioUrl ?? data.url);
        if (url) {
          return {
            url,
            quality: candidate.quality,
            format: text(data.format) || candidate.format,
            bitrate: num(data.bitrate) || undefined,
          };
        }
      } catch (err) {
        if (signal.aborted) throw err;
      }
    }
    return null;
  }

  async lyric(track: Track, signal: AbortSignal): Promise<{ readonly lyric: string; readonly tlyric?: string; readonly yrc?: string } | string> {
    if (track.origin.kind !== 'imported' || track.origin.platform !== 'bodian') return '';
    const rid = track.origin.id;
    const payload = `type=lyric&req=2&lrcx=1&rid=${rid}&songname=&artist=&corp=kuwo&fromchannel=bodian`;
    const q = encodeBase64Ascii(payload);
    try {
      const res = row(
        await this.http(
          `https://mlyric.kuwo.cn/mobi.s?f=bodian&q=${encodeURIComponent(q)}`,
          { method: 'GET', credentials: 'omit', headers: { 'User-Agent': BODIAN_UA } },
          signal,
        ),
      );
      const encoded = text(row(res.data).content);
      if (!encoded) return '';
      const decoded = decodeBase64Utf8(encoded);
      if (!decoded) return '';
      return decodeBodianLyricContent(decoded);
    } catch (err) {
      if (signal.aborted) throw err;
      return '';
    }
  }
}

export class BodianAccountStore {
  private readonly repository: Pick<Repository, 'get' | 'put'>;
  private readonly secrets?: MusicSecretStore;
  private readonly listeners = new Set<() => void>();
  private snapshot: BodianAccountSnapshot;

  constructor(
    repository: Pick<Repository, 'get' | 'put'>,
    secrets: MusicSecretStore | undefined,
    uuid: () => string,
  ) {
    this.repository = repository;
    this.secrets = secrets;
    this.snapshot = {
      loggedIn: false,
      nickname: '',
      deviceId: makeDeviceId(uuid()),
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: BodianAccountSnapshot) {
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  private async commit(next: BodianAccountSnapshot) {
    await this.repository.put(BODIAN_ACCOUNT_KEY, next);
    this.publish(next);
  }

  async restore() {
    const saved = await this.repository.get<BodianAccountSnapshot>(BODIAN_ACCOUNT_KEY);
    if (!saved || typeof saved !== 'object') return;
    const deviceId = typeof saved.deviceId === 'string' && /^[a-f0-9]{32}$/i.test(saved.deviceId)
      ? saved.deviceId.toLowerCase()
      : this.snapshot.deviceId;
    const hasSecret = this.secrets
      ? Boolean(await this.secrets.get(BODIAN_SECRET_KEY).catch(() => null))
      : Boolean(saved.loggedIn);
    const avatar = safeHTTPS(saved.avatar);
    this.publish({
      loggedIn: Boolean(saved.loggedIn) && hasSecret && Boolean(saved.userId),
      ...(typeof saved.userId === 'string' && saved.userId ? { userId: saved.userId.slice(0, 64) } : {}),
      nickname: typeof saved.nickname === 'string' ? saved.nickname.trim().slice(0, 60) : '',
      ...(avatar ? { avatar } : {}),
      ...(typeof saved.isVip === 'boolean' ? { isVip: saved.isVip } : {}),
      ...(typeof saved.vipLabel === 'string' && saved.vipLabel ? { vipLabel: saved.vipLabel.slice(0, 40) } : {}),
      deviceId,
      ...(typeof saved.loggedInAt === 'number' && Number.isFinite(saved.loggedInAt) ? { loggedInAt: saved.loggedInAt } : {}),
    });
  }

  async session(): Promise<BodianSession | null> {
    if (!this.snapshot.loggedIn || !this.snapshot.userId) return null;
    if (!this.secrets) return null;
    const token = await this.secrets.get(BODIAN_SECRET_KEY).catch(() => null);
    if (!token) return null;
    return { userId: this.snapshot.userId, token, deviceId: this.snapshot.deviceId };
  }

  async saveSession(params: {
    userId: string;
    token: string;
    nickname: string;
    avatar?: string;
    isVip?: boolean;
    vipLabel?: string;
  }) {
    if (this.secrets) {
      await this.secrets.set(BODIAN_SECRET_KEY, params.token);
    }
    const avatar = safeHTTPS(params.avatar);
    await this.commit({
      loggedIn: true,
      userId: params.userId.slice(0, 64),
      nickname: params.nickname.trim().slice(0, 60) || '波点音乐用户',
      ...(avatar ? { avatar } : {}),
      ...(typeof params.isVip === 'boolean' ? { isVip: params.isVip } : {}),
      ...(params.vipLabel ? { vipLabel: params.vipLabel.slice(0, 40) } : {}),
      deviceId: this.snapshot.deviceId,
      loggedInAt: Date.now(),
    });
  }

  async updateProfile(patch: { nickname?: string; avatar?: string; isVip?: boolean; vipLabel?: string }) {
    if (!this.snapshot.loggedIn) return;
    const avatar = patch.avatar ? safeHTTPS(patch.avatar) : this.snapshot.avatar;
    await this.commit({
      ...this.snapshot,
      ...(patch.nickname ? { nickname: patch.nickname.trim().slice(0, 60) } : {}),
      ...(avatar ? { avatar } : {}),
      ...(typeof patch.isVip === 'boolean' ? { isVip: patch.isVip } : {}),
      ...(patch.vipLabel !== undefined ? { vipLabel: patch.vipLabel || undefined } : {}),
    });
  }

  async logout() {
    if (this.secrets) {
      await this.secrets.remove(BODIAN_SECRET_KEY).catch(() => {});
    }
    await this.commit({
      loggedIn: false,
      nickname: '',
      deviceId: this.snapshot.deviceId,
    });
  }
}

export class BodianQrLoginCoordinator {
  private value: BodianQrSnapshot = { status: 'idle', generation: 0 };
  private readonly listeners = new Set<() => void>();
  private controller?: AbortController;
  private deadline?: ReturnType<typeof setTimeout>;
  private foreground = true;
  private handoff?: number;
  private wake?: () => void;
  private sleepWake?: () => void;
  private readonly options: {
    provider: Pick<BodianProvider, 'createQr' | 'pollQr' | 'fetchProfile'>;
    account: Pick<BodianAccountStore, 'saveSession' | 'getSnapshot'>;
    pollMs?: number;
    now?: () => number;
  };

  constructor(options: BodianQrLoginCoordinator['options']) {
    this.options = options;
  }

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(value: BodianQrSnapshot) {
    if (this.handoff === value.generation && (value.status === 'waiting' || value.status === 'scanned')) {
      value = { ...value, sameDevice: true };
    }
    this.value = value;
    for (const l of this.listeners) l();
  }

  private stop() {
    this.handoff = undefined;
    clearTimeout(this.deadline);
    this.deadline = undefined;
    this.wake = undefined;
    this.sleepWake = undefined;
    this.controller?.abort();
    this.controller = undefined;
  }

  allowSameDeviceHandoff = (generation: number) => {
    if (
      this.value.generation !== generation ||
      !['waiting', 'scanned'].includes(this.value.status) ||
      !this.value.expiresAt ||
      this.value.expiresAt <= (this.options.now ?? Date.now)()
    ) {
      return;
    }
    this.handoff = generation;
    this.publish({ ...this.value, sameDevice: true });
  };

  setForeground = (active: boolean) => {
    this.foreground = active;
    if (!active) return;
    if (bodianQrBusy(this.value.status) && this.value.expiresAt && this.value.expiresAt <= (this.options.now ?? Date.now)()) {
      const generation = this.value.generation;
      this.stop();
      this.publish({ status: 'expired', generation });
      return;
    }
    this.wake?.();
    this.sleepWake?.();
  };

  private waitForForeground(signal: AbortSignal): Promise<void> {
    if (this.foreground) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', abort);
        if (this.wake === wake) this.wake = undefined;
      };
      const wake = () => { cleanup(); resolve(); };
      const abort = () => { cleanup(); reject(new Error('波点扫码登录已取消')); };
      this.wake = wake;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }

  cancel = () => {
    if (!bodianQrBusy(this.value.status)) return;
    this.stop();
    this.publish({ status: 'cancelled', generation: this.value.generation });
  };

  imageFailed = (generation: number) => {
    if (generation !== this.value.generation || !bodianQrBusy(this.value.status)) return;
    this.stop();
    this.publish({ status: 'failed', generation });
  };

  async login(): Promise<void> {
    this.stop();
    const generation = this.value.generation + 1;
    const controller = new AbortController();
    const signal = controller.signal;
    this.controller = controller;
    const active = () => this.controller === controller && !signal.aborted;
    const now = () => (this.options.now ?? Date.now)();
    const finish = (status: BodianQrStatus, detail?: string) => {
      if (!active()) return;
      this.stop();
      this.publish({ status, generation, ...(detail ? { detail } : {}) });
    };
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', cancel);
          if (this.sleepWake === resume) this.sleepWake = undefined;
        };
        const resume = () => { cleanup(); resolve(); };
        const timer = setTimeout(resume, ms);
        const cancel = () => { cleanup(); reject(new Error('波点扫码登录已取消')); };
        this.sleepWake = resume;
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
      });

    this.publish({ status: 'loading', generation });
    this.deadline = setTimeout(() => finish('expired'), 180_000);
    try {
      const qr = await this.options.provider.createQr(signal);
      if (!active()) return;
      if (qr.expiresAt <= now()) { finish('expired'); return; }
      clearTimeout(this.deadline);
      this.deadline = setTimeout(() => finish('expired'), Math.min(180_000, qr.expiresAt - now()));
      this.publish({ status: 'waiting', generation, image: qr.image, expiresAt: qr.expiresAt });
      let consecutiveErrors = 0;
      while (active()) {
        await this.waitForForeground(signal);
        if (!active()) return;
        if (qr.expiresAt <= now()) { finish('expired'); return; }
        let result: BodianQrPollResult;
        try {
          result = await this.options.provider.pollQr(qr, signal);
          consecutiveErrors = 0;
        } catch (err) {
          if (!active() || signal.aborted) return;
          if (!this.foreground) {
            await this.waitForForeground(signal);
            if (!active()) return;
            await sleep(Math.min(400, this.options.pollMs ?? 2000));
            continue;
          }
          consecutiveErrors++;
          if (consecutiveErrors >= 8) {
            finish('failed', err instanceof HTTPResponseError ? '波点服务暂时不可用，请重试' : '网络不稳定，请重试');
            return;
          }
          await sleep(Math.min(1200, this.options.pollMs ?? 2000));
          continue;
        }
        await this.waitForForeground(signal);
        if (!active()) return;
        if (qr.expiresAt <= now()) { finish('expired'); return; }
        if (result.status === 'expired') { finish('expired'); return; }
        if (result.status === 'connected') {
          clearTimeout(this.deadline);
          this.deadline = undefined;
          this.publish({ status: 'saving', generation });
          let isVip: boolean | undefined;
          let vipLabel: string | undefined;
          let nickname = result.nickname;
          let avatar = result.avatar;
          try {
            const devId = this.options.account.getSnapshot().deviceId;
            const prof = await this.options.provider.fetchProfile(
              { userId: result.userId, token: result.token, deviceId: devId },
              signal,
            );
            isVip = prof.isVip;
            vipLabel = prof.vipLabel;
            if (prof.nickname) nickname = prof.nickname;
            if (prof.avatar) avatar = prof.avatar;
          } catch {
            // Keep login successful even if membership enrichment fails transiently
          }
          if (!active()) return;
          await this.options.account.saveSession({
            userId: result.userId,
            token: result.token,
            nickname,
            ...(avatar ? { avatar } : {}),
            ...(isVip !== undefined ? { isVip } : {}),
            ...(vipLabel ? { vipLabel } : {}),
          });
          finish('succeeded');
          return;
        }
        if (result.status !== this.value.status) {
          this.publish({ status: result.status, generation, image: qr.image, expiresAt: qr.expiresAt });
        }
        await sleep(this.options.pollMs ?? 2000);
      }
    } catch (err) {
      finish('failed', err instanceof Error ? err.message : '波点扫码登录失败，请重试');
    }
  }
}
