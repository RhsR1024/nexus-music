// Account-first direct playback resolver for signed-in music platform accounts.
// When `preferAccountPlayback` is enabled and the user holds a valid account session
// for the track's platform, attempts official full-track resolution directly using
// the user's own account privileges; rejects preview/trial clips and returns null
// so NexusMusic seamlessly falls back to custom LX sources.
// Protocol reference only (zero code copied): Wow-CaiCai/Coda 22bc58e (AGPL-3.0/GPL-3.0)
// and Nshpiter/Q-music 5db858f (Apache-2.0).
import type { Quality } from '../domain/quality.ts';
import { fallbackQualities } from '../domain/quality.ts';
import { trackKey, type OnlinePlatform, type Track } from '../domain/track.ts';
import type { PlaybackTraceSink } from '../playback/diagnostics.ts';
import { bounded, throwIfAborted } from './async.ts';
import type { BodianAccountStore, BodianProvider } from './bodian.ts';
import { queryURL, requestJSON, type HTTPClient } from './http.ts';
import { validKugouDailySession } from './kugouDaily.ts';
import type { MusicAccounts } from './musicAccounts.ts';
import type { RoutedMedia } from './multiSourceResolver.ts';
import { neteaseSessionAuth, neteaseWeapiRequest } from './neteaseSession.ts';
import { parseQQCookiePayload, qqMusicIdentity } from './qqAccountProfile.ts';
import type { QishuiAccountStore, QishuiProvider } from './qishui.ts';

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

function validPlaybackUrl(raw: unknown): string | undefined {
  const s = text(raw).replace(/^http:\/\//i, 'https://');
  if (!s) return undefined;
  try {
    const parsed = new URL(s);
    if (!parsed.hostname || !['https:', 'http:'].includes(parsed.protocol)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function qqGtk(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash += (hash << 5) + key.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

const NETEASE_LEVEL_MAP: Record<Quality, readonly { level: string; quality: Quality }[]> = {
  master: [
    { level: 'jymaster', quality: 'master' },
    { level: 'hires', quality: 'hires' },
    { level: 'lossless', quality: 'flac' },
    { level: 'exhigh', quality: '320k' },
    { level: 'standard', quality: '128k' },
  ],
  atmos_plus: [
    { level: 'sky', quality: 'atmos_plus' },
    { level: 'hires', quality: 'hires' },
    { level: 'lossless', quality: 'flac' },
    { level: 'exhigh', quality: '320k' },
    { level: 'standard', quality: '128k' },
  ],
  atmos: [
    { level: 'jyeffect', quality: 'atmos' },
    { level: 'lossless', quality: 'flac' },
    { level: 'exhigh', quality: '320k' },
    { level: 'standard', quality: '128k' },
  ],
  hires: [
    { level: 'hires', quality: 'hires' },
    { level: 'lossless', quality: 'flac' },
    { level: 'exhigh', quality: '320k' },
    { level: 'standard', quality: '128k' },
  ],
  flac24bit: [
    { level: 'hires', quality: 'flac24bit' },
    { level: 'lossless', quality: 'flac' },
    { level: 'exhigh', quality: '320k' },
    { level: 'standard', quality: '128k' },
  ],
  flac: [
    { level: 'lossless', quality: 'flac' },
    { level: 'exhigh', quality: '320k' },
    { level: 'standard', quality: '128k' },
  ],
  '320k': [
    { level: 'exhigh', quality: '320k' },
    { level: 'standard', quality: '128k' },
  ],
  '192k': [
    { level: 'higher', quality: '192k' },
    { level: 'standard', quality: '128k' },
  ],
  '128k': [{ level: 'standard', quality: '128k' }],
};

const QQ_BR_CANDIDATES: readonly { br: string; ext: string; quality: Quality }[] = [
  { br: 'RS01', ext: 'flac', quality: 'hires' },
  { br: 'F000', ext: 'flac', quality: 'flac' },
  { br: 'M800', ext: 'mp3', quality: '320k' },
  { br: 'M500', ext: 'mp3', quality: '128k' },
];

const KUGOU_QUALITY_CANDIDATES: readonly { wire: string; quality: Quality }[] = [
  { wire: 'high', quality: 'hires' },
  { wire: 'flac', quality: 'flac' },
  { wire: '320', quality: '320k' },
  { wire: '128', quality: '128k' },
];

export interface AccountPlaybackResolverDeps {
  readonly enabled: () => boolean;
  readonly quality: () => Quality;
  readonly qualityForPlatform?: (platform: OnlinePlatform) => Quality;
  readonly musicAccounts: Pick<MusicAccounts, 'getSnapshot' | 'session'>;
  readonly bodian?: Pick<BodianProvider, 'directPlayback'>;
  readonly bodianAccount?: Pick<BodianAccountStore, 'getSnapshot' | 'session'>;
  readonly qishui?: Pick<QishuiProvider, 'directPlayback'>;
  readonly qishuiAccount?: Pick<QishuiAccountStore, 'getSnapshot' | 'sessionCookieHeader'>;
  readonly http?: HTTPClient;
  readonly md5: (value: string) => Promise<string>;
  readonly hash: (value: string) => Promise<string>;
  readonly now?: () => number;
}

export class AccountPlaybackResolver {
  private readonly deps: AccountPlaybackResolverDeps;
  private readonly http: HTTPClient;
  private readonly now: () => number;

  constructor(deps: AccountPlaybackResolverDeps) {
    this.deps = deps;
    this.http = deps.http ?? requestJSON;
    this.now = deps.now ?? Date.now;
  }

  private routeKeyFor(track: Track, label: string, quality: Quality): string {
    return JSON.stringify([trackKey(track.origin), 'account-direct', label, quality]);
  }

  private async buildMedia(
    track: Track,
    label: string,
    sourceName: string,
    url: string,
    requestedQuality: Quality,
    quality: Quality,
    headers?: Readonly<Record<string, string>>,
  ): Promise<RoutedMedia> {
    const routeKey = this.routeKeyFor(track, label, quality);
    const cacheKey = await this.deps.hash(JSON.stringify([trackKey(track.origin), 'account-direct', label, quality]));
    return {
      url,
      ...(headers ? { headers } : {}),
      routeKey,
      cacheKey,
      sourceId: `account:${label}`,
      sourceName,
      sourceRevision: 1,
      requestedQuality,
      quality,
      scriptQuality: quality,
    };
  }

  async resolve(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string> = new Set(),
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    throwIfAborted(signal);
    if (!this.deps.enabled()) return null;

    if (track.origin.kind === 'imported' && track.origin.platform === 'bodian') {
      return this.resolveBodian(track, signal, excluded, trace);
    }
    if (track.origin.kind === 'imported' && track.origin.platform === 'qishui') {
      return this.resolveQishui(track, signal, excluded, trace);
    }
    if (track.origin.kind !== 'online') return null;

    const platform = track.origin.platform;
    const preferred = this.deps.qualityForPlatform?.(platform) ?? this.deps.quality();

    if (platform === 'wy') return this.resolveNetease(track, preferred, signal, excluded, trace);
    if (platform === 'tx') return this.resolveQQ(track, preferred, signal, excluded, trace);
    if (platform === 'kg') return this.resolveKugou(track, preferred, signal, excluded, trace);
    return null;
  }

  private async resolveNetease(
    track: Track,
    preferred: Quality,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    const account = this.deps.musicAccounts.getSnapshot().find(a => a.platform === 'wy');
    if (!account) return null;
    const songId = track.origin.id;
    if (!/^\d{1,20}$/.test(songId)) return null;
    let auth: ReturnType<typeof neteaseSessionAuth>;
    try {
      const session = await this.deps.musicAccounts.session(account.id);
      auth = neteaseSessionAuth(session);
    } catch {
      return null;
    }
    if (!auth) return null;

    const tiers = NETEASE_LEVEL_MAP[preferred] ?? NETEASE_LEVEL_MAP.flac;
    trace?.({ stage: 'source', status: 'info', title: '尝试网易云账号权限直连播放', sourceName: '网易云账号直连', platform: 'wy', quality: preferred });

    for (const tier of tiers) {
      throwIfAborted(signal);
      if (excluded.has(this.routeKeyFor(track, 'wy', tier.quality))) continue;
      try {
        const req = neteaseWeapiRequest(
          { ids: [Number(songId)], level: tier.level, encodeType: 'flac', ...(tier.level === 'sky' ? { immerseType: 'c51' } : {}) },
          auth,
        );
        const res = row(
          await bounded(
            child => this.http('https://music.163.com/weapi/song/enhance/player/url/v1', { ...req, credentials: 'omit' }, child),
            signal,
            8_000,
          ),
        );
        const item = row(list(res.data)[0]);
        if (num(item.code) !== 200) continue;
        // Strictly reject 30-second VIP preview / trial clips so LX sources can provide the full track.
        if (item.freeTrialInfo != null) continue;
        const url = validPlaybackUrl(item.url);
        if (!url) continue;
        trace?.({ stage: 'source', status: 'success', title: `网易云账号直连命中 · ${tier.quality}`, sourceName: '网易云账号直连', platform: 'wy', quality: tier.quality });
        return this.buildMedia(track, 'wy', '网易云账号直连', url, preferred, tier.quality, {
          Referer: 'https://music.163.com/',
        });
      } catch (err) {
        throwIfAborted(signal);
        void err;
      }
    }
    trace?.({ stage: 'source', status: 'fallback', title: '网易云账号无完整播放权限，自动回退自定义 LX 音源', sourceName: '网易云账号直连', platform: 'wy' });
    return null;
  }

  private async resolveQQ(
    track: Track,
    preferred: Quality,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    const account = this.deps.musicAccounts.getSnapshot().find(a => a.platform === 'tx');
    if (!account) return null;
    const songmid = text(track.metadata.songmid ?? track.metadata.songId ?? track.origin.id);
    if (!songmid || !/^[A-Za-z0-9]{4,32}$/.test(songmid)) return null;

    let cookies: Readonly<Record<string, string>>;
    let uin: string;
    let authst: string;
    try {
      const session = await this.deps.musicAccounts.session(account.id);
      cookies = parseQQCookiePayload(JSON.stringify(row(session.cookies)), 'music');
      const identity = qqMusicIdentity(cookies);
      uin = identity.uin;
      authst = identity.authst;
    } catch {
      return null;
    }

    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    const gtk = qqGtk(authst);
    const allowedQualities = new Set(fallbackQualities(preferred));
    const tiers = QQ_BR_CANDIDATES.filter(t => allowedQualities.has(t.quality));
    const mediaMid = text(track.metadata.strMediaMid ?? track.metadata.mediaMid) || songmid;
    const guid = '1429839143';

    trace?.({ stage: 'source', status: 'info', title: '尝试 QQ 音乐账号权限直连播放', sourceName: 'QQ账号直连', platform: 'tx', quality: preferred });

    for (const tier of tiers) {
      throwIfAborted(signal);
      if (excluded.has(this.routeKeyFor(track, 'tx', tier.quality))) continue;
      const filenames = [...new Set([
        `${tier.br}${songmid}${mediaMid}.${tier.ext}`,
        `${tier.br}${mediaMid}.${tier.ext}`,
        `${tier.br}${songmid}.${tier.ext}`,
      ])];
      const payload = {
        comm: {
          uin: Number(uin) || 0,
          format: 'json',
          ct: 19,
          cv: 0,
          g_tk: gtk,
          authst,
        },
        req_0: {
          module: 'vkey.GetVkeyServer',
          method: 'CgiGetVkey',
          param: {
            filename: filenames,
            guid,
            songmid: filenames.map(() => songmid),
            songtype: filenames.map(() => 0),
            uin,
            loginflag: 1,
            platform: '20',
          },
        },
      };
      try {
        const res = row(
          await bounded(
            child =>
              this.http(
                queryURL('https://u.y.qq.com/cgi-bin/musicu.fcg', { format: 'json', data: JSON.stringify(payload) }),
                {
                  method: 'GET',
                  credentials: 'omit',
                  headers: {
                    Referer: 'https://y.qq.com/',
                    Origin: 'https://y.qq.com',
                    Cookie: cookieHeader,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0',
                  },
                },
                child,
              ),
            signal,
            8_000,
          ),
        );
        const reqData = row(row(res.req_0).data);
        const infos = list(reqData.midurlinfo).map(row);
        const hit = infos.find(info => {
          const purl = text(info.purl);
          return Boolean(purl) && !/trial|tryplay/i.test(purl);
        });
        if (!hit) continue;
        const purl = text(hit.purl);
        const sips = list(reqData.sip).map(text).filter(Boolean);
        const base = (sips.find(s => s.startsWith('https://')) ?? sips[0] ?? 'https://ws.stream.qqmusic.qq.com/').replace(/^http:\/\//i, 'https://');
        const fullUrl = purl.startsWith('http') ? validPlaybackUrl(purl) : validPlaybackUrl(`${base.replace(/\/?$/, '/')}${purl.replace(/^\/+/, '')}`);
        if (!fullUrl) continue;
        trace?.({ stage: 'source', status: 'success', title: `QQ 音乐账号直连命中 · ${tier.quality}`, sourceName: 'QQ账号直连', platform: 'tx', quality: tier.quality });
        return this.buildMedia(track, 'tx', 'QQ账号直连', fullUrl, preferred, tier.quality, {
          Referer: 'https://y.qq.com/',
        });
      } catch {
        throwIfAborted(signal);
      }
    }
    trace?.({ stage: 'source', status: 'fallback', title: 'QQ 音乐账号无完整播放权限，自动回退自定义 LX 音源', sourceName: 'QQ账号直连', platform: 'tx' });
    return null;
  }

  private async resolveKugou(
    track: Track,
    preferred: Quality,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    const account = this.deps.musicAccounts.getSnapshot().find(a => a.platform === 'kg');
    if (!account) return null;
    let session: Record<string, unknown>;
    try {
      session = row(await this.deps.musicAccounts.session(account.id));
    } catch {
      return null;
    }
    if (!validKugouDailySession(account, session)) return null;

    const userId = text(session.userId);
    const token = text(session.token);
    const mid = text(session.mid) || '-';
    const baseHash = text(track.metadata.hash ?? track.origin.id).toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(baseHash)) return null;
    const albumId = text(track.metadata.albumId) || '0';
    const albumAudioId = text(track.metadata.audioId ?? track.metadata.albumAudioId) || '0';

    const hashFor = (quality: Quality): string => {
      const m = track.metadata;
      const candidate =
        quality === 'hires'
          ? text(m.resHash ?? m.hash_high)
          : quality === 'flac'
            ? text(m.sqHash ?? m.hash_flac)
            : quality === '320k'
              ? text(m.hqHash ?? m.hash_320)
              : baseHash;
      return /^[a-f0-9]{32}$/i.test(candidate) ? candidate.toLowerCase() : baseHash;
    };

    const allowedQualities = new Set(fallbackQualities(preferred));
    const tiers = KUGOU_QUALITY_CANDIDATES.filter(t => allowedQualities.has(t.quality));
    trace?.({ stage: 'source', status: 'info', title: '尝试酷狗账号权限直连播放', sourceName: '酷狗账号直连', platform: 'kg', quality: preferred });

    for (const tier of tiers) {
      throwIfAborted(signal);
      if (excluded.has(this.routeKeyFor(track, 'kg', tier.quality))) continue;
      const fileHash = hashFor(tier.quality);
      for (const appid of ['3116', '1005'] as const) {
        const concept = appid === '3116';
        const keySalt = concept ? '185672dd44712f60bb1736df5a377e82' : '57ae12eb6890223e355ccfcb74edf70d';
        const signSalt = concept ? 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA' : 'OIlwieks28dk2k092lksi2UIkp';
        const ts = String(Math.floor(this.now() / 1000));
        try {
          const key = (await this.deps.md5(`${fileHash}${keySalt}${appid}${mid}${userId}`)).toLowerCase();
          const params: Record<string, string> = {
            album_audio_id: /^\d+$/.test(albumAudioId) ? albumAudioId : '0',
            album_id: albumId,
            appid,
            area_code: '1',
            behavior: 'play',
            cdnBackup: '1',
            clienttime: ts,
            clientver: '11430',
            cmd: '26',
            dfid: '-',
            hash: fileHash,
            IsFreePart: '0',
            key,
            mid,
            module: '',
            page_id: concept ? '967177915' : '151369488',
            pid: concept ? '411' : '2',
            pidversion: '3001',
            ppage_id: concept ? '356753938,823673182,967485191' : '463467626,350369493,788954147',
            quality: tier.wire,
            ssa_flag: 'is_fromtrack',
            token,
            userid: userId,
            uuid: '-',
            version: '11430',
          };
          const signPayload = Object.keys(params)
            .sort()
            .map(k => `${k}=${params[k]}`)
            .join('');
          const signature = (await this.deps.md5(`${signSalt}${signPayload}${signSalt}`)).toLowerCase();
          const res = row(
            await bounded(
              child =>
                this.http(
                  queryURL('https://gateway.kugou.com/v5/url', { ...params, signature }),
                  {
                    method: 'GET',
                    credentials: 'omit',
                    headers: {
                      'x-router': 'trackercdn.kugou.com',
                      mid,
                      dfid: '-',
                      clienttime: ts,
                      'kg-rc': '1',
                      'kg-thash': '5d816a0',
                    },
                  },
                  child,
                ),
              signal,
              8_000,
            ),
          );
          if (num(res.status) !== 1 || num(res.is_try) === 1 || num(row(res.data).is_try) === 1) continue;
          const urls = list(res.url ?? row(res.data).url).map(validPlaybackUrl).filter((u): u is string => !!u);
          const url = urls[0] ?? validPlaybackUrl(res.url ?? row(res.data).url);
          if (!url) continue;
          trace?.({ stage: 'source', status: 'success', title: `酷狗账号直连命中 · ${tier.quality}`, sourceName: '酷狗账号直连', platform: 'kg', quality: tier.quality });
          return this.buildMedia(track, 'kg', '酷狗账号直连', url, preferred, tier.quality);
        } catch {
          throwIfAborted(signal);
        }
      }
    }
    trace?.({ stage: 'source', status: 'fallback', title: '酷狗账号无完整播放权限，自动回退自定义 LX 音源', sourceName: '酷狗账号直连', platform: 'kg' });
    return null;
  }

  private async resolveBodian(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    if (!this.deps.bodian || !this.deps.bodianAccount) return null;
    const snap = this.deps.bodianAccount.getSnapshot();
    if (!snap.loggedIn) return null;
    const session = await this.deps.bodianAccount.session();
    if (!session) return null;
    const preferred = this.deps.quality();
    if (excluded.has(this.routeKeyFor(track, 'bodian', preferred))) return null;
    trace?.({ stage: 'source', status: 'info', title: '尝试波点账号权限直连播放', sourceName: '波点账号直连', quality: preferred });
    try {
      const stream = await this.deps.bodian.directPlayback(track, preferred, session, signal);
      if (stream && !excluded.has(this.routeKeyFor(track, 'bodian', stream.quality))) {
        trace?.({ stage: 'source', status: 'success', title: `波点账号直连命中 · ${stream.quality}`, sourceName: '波点账号直连', quality: stream.quality });
        return this.buildMedia(track, 'bodian', '波点账号直连', stream.url, preferred, stream.quality);
      }
    } catch {
      throwIfAborted(signal);
    }
    trace?.({ stage: 'source', status: 'fallback', title: '波点账号无完整播放权限，自动回退自定义 LX 音源', sourceName: '波点账号直连' });
    return null;
  }

  private async resolveQishui(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    if (!this.deps.qishui || !this.deps.qishuiAccount) return null;
    if (!this.deps.qishuiAccount.getSnapshot().loggedIn) return null;
    // Only native Qishui numeric track IDs can resolve via official Qishui track_v2.
    if (!/^\d{5,30}$/.test(track.origin.id)) return null;
    const cookieHeader = await this.deps.qishuiAccount.sessionCookieHeader();
    if (!cookieHeader) return null;
    const preferred = this.deps.quality();
    if (excluded.has(this.routeKeyFor(track, 'qishui', '320k')) && excluded.has(this.routeKeyFor(track, 'qishui', '128k'))) return null;
    trace?.({ stage: 'source', status: 'info', title: '尝试汽水账号权限直连播放', sourceName: '汽水账号直连', quality: preferred });
    try {
      const stream = await this.deps.qishui.directPlayback(track, cookieHeader, signal);
      if (stream && !excluded.has(this.routeKeyFor(track, 'qishui', stream.quality))) {
        trace?.({ stage: 'source', status: 'success', title: `汽水账号直连命中 · ${stream.quality}`, sourceName: '汽水账号直连', quality: stream.quality });
        return this.buildMedia(track, 'qishui', '汽水账号直连', stream.url, preferred, stream.quality, {
          Referer: 'https://music.douyin.com/',
        });
      }
    } catch {
      throwIfAborted(signal);
    }
    trace?.({ stage: 'source', status: 'fallback', title: '汽水账号无未加密完整直连流，自动回退自定义 LX 音源', sourceName: '汽水账号直连' });
    return null;
  }
}
