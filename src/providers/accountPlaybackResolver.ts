// Account-first & official-public direct playback resolver for music platforms.
// Clean-room TypeScript implementation:
// 1. Attempts origin-platform direct playback using signed-in account privileges first,
//    or anonymous official public playback for free full-length tracks when signed out.
// 2. Strictly rejects 30s preview/trial clips and undecrypted encrypted streams.
// 3. Supports cross-platform official fallback: tries the user's other signed-in official
//    accounts before custom LX sources, and unsigned-in public free catalogs when no LX
//    source is available or LX resolution fails.
// Protocol references only (zero code copied): Wow-CaiCai/Coda 22bc58e and Nshpiter/Q-music 5db858f.

import { scoreCandidate } from '../domain/matching.ts';
import type { Quality } from '../domain/quality.ts';
import { fallbackQualities, normalizeQuality } from '../domain/quality.ts';
import { trackKey, type OnlinePlatform, type Track } from '../domain/track.ts';
import type { PlaybackTraceSink } from '../playback/diagnostics.ts';
import { bounded, throwIfAborted } from './async.ts';
import type { BodianAccountStore, BodianProvider } from './bodian.ts';
import type { CrossPlatformMatcher } from './crossPlatformMatcher.ts';
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

function validPlaybackUrl(raw: unknown, keepHttp = false): string | undefined {
  const s = keepHttp ? text(raw) : text(raw).replace(/^http:\/\//i, 'https://');
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

function withNeteaseCookieOverrides(cookie: string, overrides: Readonly<Record<string, string>>): string {
  const map = new Map<string, string>();
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k && v) map.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    map.set(k, v);
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function inferNeteaseQuality(item: Row, fallback: Quality): Quality {
  const level = text(item.level).toLowerCase();
  if (level === 'jymaster') return 'master';
  if (level === 'sky') return 'atmos_plus';
  if (level === 'jyeffect') return 'atmos';
  if (level === 'hires') return 'hires';
  if (level === 'lossless') return 'flac';
  if (level === 'exhigh') return '320k';
  if (level === 'higher') return '192k';
  if (level === 'standard') return '128k';
  const type = text(item.type).toLowerCase();
  const br = num(item.br);
  if (type === 'flac' || br >= 700_000) return br >= 1_400_000 ? 'hires' : 'flac';
  if (br >= 256_000) return '320k';
  if (br >= 160_000) return '192k';
  if (br > 0) return '128k';
  return fallback;
}

function inferKugouQuality(payload: Row, fallback: Quality): Quality {
  const ext = text(payload.extName ?? payload.extname ?? payload.format).toLowerCase();
  const br = num(payload.bitRate ?? payload.bitrate ?? payload.bit_rate);
  const bps = br > 0 && br < 4_000 ? br * 1000 : br;
  if (ext === 'flac' || ext === 'ape' || bps >= 700_000) return bps >= 1_500_000 ? 'hires' : 'flac';
  if (bps >= 256_000) return '320k';
  if (bps > 0) return '128k';
  const reported = normalizeQuality(text(payload.quality ?? payload.audio_quality));
  return reported ?? fallback;
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
  { br: 'C400', ext: 'm4a', quality: '128k' },
];

const KUGOU_QUALITY_CANDIDATES: readonly { wire: string; quality: Quality }[] = [
  { wire: 'high', quality: 'hires' },
  { wire: 'flac', quality: 'flac' },
  { wire: '320', quality: '320k' },
  { wire: '128', quality: '128k' },
];

const IOS_NETEASE_OVERRIDES: Readonly<Record<string, string>> = {
  os: 'ios',
  appver: '9.0.90',
  osver: '16.2',
  channel: 'distribution',
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0';

async function defaultProbeUrl(
  url: string,
  headers: Readonly<Record<string, string>>,
  signal: AbortSignal,
): Promise<'ok' | 'forbidden' | 'unknown'> {
  try {
    const res = await bounded(
      child =>
        fetch(url, {
          method: 'GET',
          credentials: 'omit',
          headers: { ...headers, Range: 'bytes=0-63' },
          signal: child,
        }),
      signal,
      3_000,
    );
    try {
      await res.body?.cancel?.();
    } catch {}
    if (res.status === 200 || res.status === 206) return 'ok';
    if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410) return 'forbidden';
    return 'unknown';
  } catch (err) {
    throwIfAborted(signal);
    void err;
    return 'unknown';
  }
}

export interface AccountPlaybackResolverDeps {
  readonly enabled: () => boolean;
  readonly quality: () => Quality;
  readonly qualityForPlatform?: (platform: OnlinePlatform) => Quality;
  readonly musicAccounts: Pick<MusicAccounts, 'getSnapshot' | 'session'>;
  readonly bodian?: Pick<BodianProvider, 'directPlayback'> & Partial<Pick<BodianProvider, 'searchSongs'>>;
  readonly bodianAccount?: Pick<BodianAccountStore, 'getSnapshot' | 'session'>;
  readonly qishui?: Pick<QishuiProvider, 'directPlayback'>;
  readonly qishuiAccount?: Pick<QishuiAccountStore, 'getSnapshot' | 'sessionCookieHeader'>;
  readonly matcher?: Pick<CrossPlatformMatcher, 'candidates'>;
  readonly autoMatch?: () => boolean;
  readonly http?: HTTPClient;
  readonly probeUrl?: (url: string, headers: Readonly<Record<string, string>>, signal: AbortSignal) => Promise<'ok' | 'forbidden' | 'unknown'>;
  readonly md5: (value: string) => Promise<string>;
  readonly hash: (value: string) => Promise<string>;
  readonly now?: () => number;
}

export class AccountPlaybackResolver {
  private readonly deps: AccountPlaybackResolverDeps;
  private readonly http: HTTPClient;
  private readonly now: () => number;
  private readonly qqMediaMidCache = new Map<string, string>();

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
    matchedTrack?: Track,
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
      ...(matchedTrack ? { matchedTrack } : {}),
    };
  }

  private shouldProbe(): boolean {
    return Boolean(this.deps.probeUrl) || this.deps.http === undefined || this.deps.http === requestJSON;
  }

  private async runProbe(
    url: string,
    headers: Readonly<Record<string, string>>,
    signal: AbortSignal,
  ): Promise<'ok' | 'forbidden' | 'unknown'> {
    if (!this.shouldProbe()) return 'unknown';
    const probe = this.deps.probeUrl ?? defaultProbeUrl;
    return probe(url, headers, signal);
  }

  /**
   * Primary entry: tries origin-platform official direct playback (signed-in account
   * or anonymous free track), then tries the user's OTHER signed-in official accounts
   * before falling back to custom LX sources.
   */
  async resolve(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string> = new Set(),
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    throwIfAborted(signal);
    if (!this.deps.enabled()) return null;

    const originHit = await this.resolveDirect(track, signal, excluded, trace);
    if (originHit) return originHit;

    // Cross-platform signed-in official account fallback (matching Coda's multi-account priority)
    if (this.deps.autoMatch?.() ?? true) {
      const signedInCross = await this.resolveCrossPlatform(track, 'signedInOnly', signal, excluded, trace);
      if (signedInCross) return signedInCross;
    }

    return null;
  }

  /**
   * Secondary entry invoked ONLY when custom LX sources are unavailable or failed:
   * tries remaining unsigned-in official platforms for free full-length recordings.
   */
  async resolvePublicFallback(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string> = new Set(),
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    throwIfAborted(signal);
    if (!this.deps.enabled()) return null;
    if (!(this.deps.autoMatch?.() ?? true)) return null;
    return this.resolveCrossPlatform(track, 'publicOnly', signal, excluded, trace);
  }

  private async resolveDirect(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
    matchedFrom?: Track,
  ): Promise<RoutedMedia | null> {
    if (track.origin.kind === 'imported' && track.origin.platform === 'bodian') {
      return this.resolveBodian(track, signal, excluded, trace, matchedFrom);
    }
    if (track.origin.kind === 'imported' && track.origin.platform === 'qishui') {
      return this.resolveQishui(track, signal, excluded, trace, matchedFrom);
    }
    if (track.origin.kind !== 'online') return null;

    const platform = track.origin.platform;
    const preferred = this.deps.qualityForPlatform?.(platform) ?? this.deps.quality();

    if (platform === 'wy') return this.resolveNetease(track, preferred, signal, excluded, trace, matchedFrom);
    if (platform === 'tx') return this.resolveQQ(track, preferred, signal, excluded, trace, matchedFrom);
    if (platform === 'kg') return this.resolveKugou(track, preferred, signal, excluded, trace, matchedFrom);
    return null;
  }

  private async resolveCrossPlatform(
    original: Track,
    mode: 'signedInOnly' | 'publicOnly',
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
  ): Promise<RoutedMedia | null> {
    if (original.origin.kind !== 'online' && original.origin.kind !== 'imported') return null;

    const originTag =
      original.origin.kind === 'online' ? original.origin.platform : original.origin.platform;
    const accounts = this.deps.musicAccounts.getSnapshot();
    const signedInSet = new Set<string>(accounts.map(a => a.platform));
    if (this.deps.bodianAccount?.getSnapshot().loggedIn) signedInSet.add('bodian');

    const candidateOnline: OnlinePlatform[] = (['wy', 'tx', 'kg'] as const).filter(p => {
      if (p === originTag) return false;
      return mode === 'signedInOnly' ? signedInSet.has(p) : !signedInSet.has(p);
    });
    const includeBodian =
      originTag !== 'bodian' &&
      Boolean(this.deps.bodian?.searchSongs) &&
      (mode === 'signedInOnly' ? signedInSet.has('bodian') : !signedInSet.has('bodian'));

    if (!candidateOnline.length && !includeBodian) return null;

    if (candidateOnline.length && this.deps.matcher) {
      try {
        trace?.({
          stage: 'match',
          status: 'info',
          title:
            mode === 'signedInOnly'
              ? '原平台受限，尝试已登录的其他官方平台直连'
              : '尝试其他官方平台公开免费直连',
          detail: candidateOnline.join(' / '),
        });
        const found = await this.deps.matcher.candidates(original, signal, candidateOnline);
        throwIfAborted(signal);
        const triedPlatforms = new Set<string>();
        for (const item of found.items) {
          if (!item.automatic || item.track.origin.kind !== 'online') continue;
          const plat = item.track.origin.platform;
          if (triedPlatforms.has(plat) || !candidateOnline.includes(plat)) continue;
          triedPlatforms.add(plat);
          const hit = await this.resolveDirect(item.track, signal, excluded, trace, item.track);
          if (hit) {
            return {
              ...hit,
              routeKey: JSON.stringify([trackKey(original.origin), hit.routeKey]),
              matchedTrack: item.track,
            };
          }
        }
      } catch {
        throwIfAborted(signal);
      }
    }

    if (includeBodian && this.deps.bodian?.searchSongs) {
      try {
        const keyword = `${original.title} ${original.artist}`.trim();
        const bodianSession = this.deps.bodianAccount?.getSnapshot().loggedIn
          ? await this.deps.bodianAccount.session().catch(() => null)
          : null;
        const hits = await bounded(
          child => this.deps.bodian!.searchSongs!(keyword, 1, child, bodianSession),
          signal,
          6_000,
        );
        throwIfAborted(signal);
        const best = hits.items
          .map(candidate => ({ candidate, score: scoreCandidate(original, candidate) }))
          .filter(x => x.score.automatic)
          .sort((a, b) => b.score.score - a.score.score)[0]?.candidate;
        if (best) {
          const hit = await this.resolveBodian(best, signal, excluded, trace, best);
          if (hit) {
            return {
              ...hit,
              routeKey: JSON.stringify([trackKey(original.origin), hit.routeKey]),
              matchedTrack: best,
            };
          }
        }
      } catch {
        throwIfAborted(signal);
      }
    }

    return null;
  }

  private async resolveNetease(
    track: Track,
    preferred: Quality,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
    matchedTrack?: Track,
  ): Promise<RoutedMedia | null> {
    const songId = track.origin.id;
    if (!/^\d{1,20}$/.test(songId)) return null;

    const account = this.deps.musicAccounts.getSnapshot().find(a => a.platform === 'wy');
    let baseAuth: ReturnType<typeof neteaseSessionAuth> = undefined;
    if (account) {
      try {
        const session = await this.deps.musicAccounts.session(account.id);
        baseAuth = neteaseSessionAuth(session);
      } catch {
        baseAuth = undefined;
      }
    }
    const signedIn = Boolean(baseAuth);
    const sourceName = signedIn ? '网易云账号直连' : '网易云官方免费直连';
    const allTiers = NETEASE_LEVEL_MAP[preferred] ?? NETEASE_LEVEL_MAP.flac;
    // Anonymous requests only succeed on free lossy tiers; skip wasted Hi-Res/FLAC probes when signed out.
    const tiers = signedIn ? allTiers : allTiers.filter(t => ['320k', '192k', '128k'].includes(t.quality));
    if (!tiers.length) return null;

    const authVariants = signedIn && baseAuth
      ? [
          { cookie: withNeteaseCookieOverrides(baseAuth.cookie, IOS_NETEASE_OVERRIDES), csrf: baseAuth.csrf },
          baseAuth,
        ]
      : [{ cookie: withNeteaseCookieOverrides('', IOS_NETEASE_OVERRIDES), csrf: '' }];

    trace?.({
      stage: 'source',
      status: 'info',
      title: signedIn ? '尝试网易云账号权限直连播放' : '尝试网易云官方免费直连播放',
      sourceName,
      platform: 'wy',
      quality: preferred,
    });

    for (const tier of tiers) {
      throwIfAborted(signal);
      if (excluded.has(this.routeKeyFor(track, 'wy', tier.quality))) continue;
      for (const auth of authVariants) {
        try {
          const req = neteaseWeapiRequest(
            {
              ids: `[${songId}]`,
              level: tier.level,
              encodeType: 'flac',
              ...(tier.level === 'sky' ? { immerseType: 'c51' } : {}),
            },
            auth,
          );
          const res = row(
            await bounded(
              child => this.http('https://music.163.com/weapi/song/enhance/player/url/v1', { ...req, credentials: 'omit' }, child),
              signal,
              8_000,
            ),
          );
          // On -460 anti-abuse code, retry the same tier with the secondary client profile.
          if (num(res.code) === -460) continue;
          const item = row(list(res.data)[0]);
          if (num(item.code) !== 200) break;
          // Strictly reject 30-second VIP preview / trial clips so LX sources can provide the full track.
          if (item.freeTrialInfo != null) break;
          const url = validPlaybackUrl(item.url);
          if (!url) break;
          const actualQuality = inferNeteaseQuality(item, tier.quality);
          if (excluded.has(this.routeKeyFor(track, 'wy', actualQuality))) break;
          trace?.({
            stage: 'source',
            status: 'success',
            title: `${sourceName}命中 · ${actualQuality}`,
            sourceName,
            platform: 'wy',
            quality: actualQuality,
          });
          return this.buildMedia(
            track,
            'wy',
            sourceName,
            url,
            preferred,
            actualQuality,
            { Referer: 'https://music.163.com/' },
            matchedTrack,
          );
        } catch (err) {
          throwIfAborted(signal);
          void err;
        }
      }
    }
    trace?.({
      stage: 'source',
      status: 'fallback',
      title: signedIn ? '网易云账号无完整播放权限，继续后续回退' : '网易云公开直连无完整免费流，继续后续回退',
      sourceName,
      platform: 'wy',
    });
    return null;
  }

  private async resolveQQMediaMid(songmid: string, cookieHeader: string, signal: AbortSignal): Promise<string> {
    const cached = this.qqMediaMidCache.get(songmid);
    if (cached) return cached;
    try {
      const res = row(
        await bounded(
          child =>
            this.http(
              'https://u.y.qq.com/cgi-bin/musicu.fcg',
              {
                method: 'POST',
                credentials: 'omit',
                headers: {
                  'Content-Type': 'application/json;charset=UTF-8',
                  Referer: 'https://y.qq.com/',
                  Origin: 'https://y.qq.com',
                  Cookie: cookieHeader,
                  'User-Agent': BROWSER_UA,
                },
                body: JSON.stringify({
                  comm: { ct: 24, cv: 0, format: 'json', uin: 0 },
                  songinfo: {
                    module: 'music.pf_song_detail_svr',
                    method: 'get_song_detail_yqq',
                    param: { song_mid: songmid, song_type: 0 },
                  },
                }),
              },
              child,
            ),
          signal,
          4_000,
        ),
      );
      const mediaMid = text(row(row(row(row(res.songinfo).data).track_info).file).media_mid);
      if (mediaMid && /^[A-Za-z0-9]{4,32}$/.test(mediaMid)) {
        if (this.qqMediaMidCache.size >= 200) {
          const oldest = this.qqMediaMidCache.keys().next().value;
          if (oldest) this.qqMediaMidCache.delete(oldest);
        }
        this.qqMediaMidCache.set(songmid, mediaMid);
        return mediaMid;
      }
    } catch {
      throwIfAborted(signal);
    }
    return songmid;
  }

  private async resolveQQ(
    track: Track,
    preferred: Quality,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
    matchedTrack?: Track,
  ): Promise<RoutedMedia | null> {
    const songmid = text(track.metadata.songmid ?? track.metadata.songId ?? track.origin.id);
    if (!songmid || !/^[A-Za-z0-9]{4,32}$/.test(songmid)) return null;

    const account = this.deps.musicAccounts.getSnapshot().find(a => a.platform === 'tx');
    let uin = '0';
    let authst = '';
    let tmeLoginType: 1 | 2 | undefined;
    let cookieHeader = 'uin=0; qqmusic_fromtag=66';
    let signedIn = false;

    if (account) {
      try {
        const session = await this.deps.musicAccounts.session(account.id);
        const cookies = parseQQCookiePayload(JSON.stringify(row(session.cookies)), 'music');
        const identity = qqMusicIdentity(cookies);
        uin = identity.uin;
        authst = identity.authst;
        tmeLoginType = identity.tmeLoginType;
        cookieHeader = Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
        signedIn = true;
      } catch {
        signedIn = false;
      }
    }

    const sourceName = signedIn ? 'QQ账号直连' : 'QQ官方免费直连';
    const gtk = authst ? qqGtk(authst) : 5381;
    const allowedQualities = new Set(fallbackQualities(preferred));
    const tiers = QQ_BR_CANDIDATES.filter(t => {
      if (!allowedQualities.has(t.quality)) return false;
      return signedIn ? true : ['320k', '128k'].includes(t.quality);
    });
    if (!tiers.length) return null;

    const providedMediaMid = text(track.metadata.strMediaMid ?? track.metadata.mediaMid);
    const mediaMid = providedMediaMid || (await this.resolveQQMediaMid(songmid, cookieHeader, signal));
    const guid = '1429839143';

    trace?.({
      stage: 'source',
      status: 'info',
      title: signedIn ? '尝试 QQ 音乐账号权限直连播放' : '尝试 QQ 音乐官方免费直连播放',
      sourceName,
      platform: 'tx',
      quality: preferred,
    });

    for (const tier of tiers) {
      throwIfAborted(signal);
      if (excluded.has(this.routeKeyFor(track, 'tx', tier.quality))) continue;
      const filenames = [
        ...new Set([
          `${tier.br}${songmid}${mediaMid}.${tier.ext}`,
          `${tier.br}${mediaMid}.${tier.ext}`,
          `${tier.br}${songmid}${songmid}.${tier.ext}`,
          `${tier.br}${songmid}.${tier.ext}`,
        ]),
      ];
      const comm: Record<string, unknown> = {
        uin: Number(uin) || 0,
        format: 'json',
        ct: signedIn ? 19 : 24,
        cv: 0,
        g_tk: gtk,
        ...(signedIn ? { authst, tmeAppID: 'qqmusic', ...(tmeLoginType ? { tmeLoginType } : {}) } : {}),
      };
      const payload = {
        comm,
        req_0: {
          module: 'vkey.GetVkeyServer',
          method: 'CgiGetVkey',
          param: {
            filename: filenames,
            guid,
            songmid: filenames.map(() => songmid),
            songtype: filenames.map(() => 0),
            uin,
            loginflag: signedIn ? 1 : 0,
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
                    'User-Agent': BROWSER_UA,
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
        const sips = list(reqData.sip).map(text).filter(Boolean);
        const bases = [
          ...new Set([
            ...sips.map(s => s.replace(/^http:\/\//i, 'https://')),
            'https://ws.stream.qqmusic.qq.com/',
          ]),
        ];

        for (const info of infos) {
          const purl = text(info.purl);
          if (!purl || /trial|tryplay/i.test(purl)) continue;
          const candidateUrls = purl.startsWith('http')
            ? [validPlaybackUrl(purl)].filter((u): u is string => !!u)
            : bases
                .map(base => validPlaybackUrl(`${base.replace(/\/?$/, '/')}${purl.replace(/^\/+/, '')}`))
                .filter((u): u is string => !!u);

          for (const fullUrl of candidateUrls) {
            const mediaHeaders = { Referer: 'https://y.qq.com/' };
            // Verify high-tier vkey URLs so 403/404 fake FLAC/Hi-Res vkeys cleanly downgrade to playable tiers.
            if (tier.br === 'RS01' || tier.br === 'F000' || tier.br === 'M800') {
              const probeResult = await this.runProbe(
                fullUrl,
                { ...mediaHeaders, ...(signedIn ? { Cookie: cookieHeader } : {}) },
                signal,
              );
              if (probeResult === 'forbidden') continue;
            }
            trace?.({
              stage: 'source',
              status: 'success',
              title: `${sourceName}命中 · ${tier.quality}`,
              sourceName,
              platform: 'tx',
              quality: tier.quality,
            });
            return this.buildMedia(track, 'tx', sourceName, fullUrl, preferred, tier.quality, mediaHeaders, matchedTrack);
          }
        }
      } catch {
        throwIfAborted(signal);
      }
    }
    trace?.({
      stage: 'source',
      status: 'fallback',
      title: signedIn ? 'QQ 音乐账号无完整播放权限，继续后续回退' : 'QQ 音乐公开直连无完整免费流，继续后续回退',
      sourceName,
      platform: 'tx',
    });
    return null;
  }

  private async resolveKugou(
    track: Track,
    preferred: Quality,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
    matchedTrack?: Track,
  ): Promise<RoutedMedia | null> {
    const baseHash = text(track.metadata.hash ?? track.origin.id).toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(baseHash)) return null;

    const account = this.deps.musicAccounts.getSnapshot().find(a => a.platform === 'kg');
    let userId = '';
    let token = '';
    let mid = '';
    let dfid = '-';
    let signedIn = false;

    if (account) {
      try {
        const session = row(await this.deps.musicAccounts.session(account.id));
        if (validKugouDailySession(account, session)) {
          userId = text(session.userId);
          token = text(session.token);
          mid = text(session.mid) || '-';
          dfid = text(session.dfid ?? session.DFID) || '-';
          signedIn = Boolean(userId && token);
        }
      } catch {
        signedIn = false;
      }
    }
    if (!mid || mid === '-') {
      mid = (await this.deps.md5('nexus-kugou-anon-device')).toLowerCase();
    }

    const sourceName = signedIn ? '酷狗账号直连' : '酷狗官方免费直连';
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
    const tiers = KUGOU_QUALITY_CANDIDATES.filter(t => {
      if (!allowedQualities.has(t.quality)) return false;
      return signedIn ? true : ['320k', '128k'].includes(t.quality);
    });
    if (!tiers.length) return null;

    trace?.({
      stage: 'source',
      status: 'info',
      title: signedIn ? '尝试酷狗账号权限直连播放' : '尝试酷狗官方免费直连播放',
      sourceName,
      platform: 'kg',
      quality: preferred,
    });

    const extractKugouUrl = (res: Row): string | undefined => {
      const data = row(res.data);
      if (
        num(res.is_try) === 1 ||
        num(data.is_try) === 1 ||
        num(res.is_free_part) === 1 ||
        num(data.is_free_part) === 1 ||
        num(data.privilege) === 10
      ) {
        return undefined;
      }
      for (const candidate of [res.url, data.play_url, data.url, data.play_backup_url, res.backup_url]) {
        if (Array.isArray(candidate)) {
          const hit = candidate.map(v => validPlaybackUrl(v)).find((u): u is string => !!u);
          if (hit) return hit;
        } else {
          const hit = validPlaybackUrl(candidate);
          if (hit) return hit;
        }
      }
      return undefined;
    };

    const appids: readonly ('3116' | '1005')[] = signedIn ? ['3116', '1005'] : ['1005'];

    // Stage 1: Gateway v5/url (signed concept 3116 + standard 1005)
    for (const tier of tiers) {
      throwIfAborted(signal);
      if (excluded.has(this.routeKeyFor(track, 'kg', tier.quality))) continue;
      const fileHash = hashFor(tier.quality);
      for (const appid of appids) {
        const concept = appid === '3116';
        const keySalt = concept ? '185672dd44712f60bb1736df5a377e82' : '57ae12eb6890223e355ccfcb74edf70d';
        const signSalt = concept ? 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA' : 'OIlwieks28dk2k092lksi2UIkp';
        const ts = String(Math.floor(this.now() / 1000));
        try {
          const key = (await this.deps.md5(`${fileHash}${keySalt}${appid}${mid}${userId || '0'}`)).toLowerCase();
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
            dfid,
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
            ...(signedIn ? { token, userid: userId } : {}),
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
                      dfid,
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
          if (num(res.status) !== 1) continue;
          const url = extractKugouUrl(res);
          if (!url) continue;
          const actualQuality = inferKugouQuality(row(res.data).extName ? row(res.data) : res, tier.quality);
          trace?.({
            stage: 'source',
            status: 'success',
            title: `${sourceName}命中 · ${actualQuality}`,
            sourceName,
            platform: 'kg',
            quality: actualQuality,
          });
          return this.buildMedia(track, 'kg', sourceName, url, preferred, actualQuality, undefined, matchedTrack);
        } catch {
          throwIfAborted(signal);
        }
      }
    }

    // Stage 2: Legacy trackercdn /i/v2/ fallback (covers tracks where v5/url returns 20006/20018)
    try {
      const upperHash = hashFor(tiers[tiers.length - 1]!.quality).toUpperCase();
      const v2Key = (await this.deps.md5(`${upperHash}57ae12eb6890223e355ccfcb74edf70d1005${mid}${userId || '0'}`)).toLowerCase();
      const v2Res = row(
        await bounded(
          child =>
            this.http(
              queryURL('https://trackercdn.kugou.com/i/v2/', {
                cmd: '26',
                hash: upperHash,
                behavior: 'play',
                appid: '1005',
                pid: '2',
                mid,
                userid: userId || '0',
                version: '11430',
                vipType: signedIn ? '6' : '0',
                token: token || '0',
                key: v2Key,
                ...(albumId !== '0' ? { album_id: albumId } : {}),
                ...(albumAudioId !== '0' ? { album_audio_id: albumAudioId } : {}),
              }),
              { method: 'GET', credentials: 'omit' },
              child,
            ),
          signal,
          6_000,
        ),
      );
      if (num(v2Res.status) === 1) {
        const url = extractKugouUrl(v2Res);
        if (url) {
          const actualQuality = inferKugouQuality(v2Res, '128k');
          trace?.({ stage: 'source', status: 'success', title: `${sourceName}命中 · ${actualQuality}`, sourceName, platform: 'kg', quality: actualQuality });
          return this.buildMedia(track, 'kg', sourceName, url, preferred, actualQuality, undefined, matchedTrack);
        }
      }
    } catch {
      throwIfAborted(signal);
    }

    // Stage 3: Kugou web play/getdata fallback when signed in
    if (signedIn) {
      try {
        const webRes = row(
          await bounded(
            child =>
              this.http(
                queryURL('https://wwwapi.kugou.com/yy/index.php', {
                  r: 'play/getdata',
                  hash: baseHash.toUpperCase(),
                  appid: '1014',
                  platid: '4',
                  mid,
                  dfid,
                  userid: userId,
                  token,
                  ...(albumId !== '0' ? { album_id: albumId } : {}),
                  ...(albumAudioId !== '0' ? { album_audio_id: albumAudioId } : {}),
                }),
                {
                  method: 'GET',
                  credentials: 'omit',
                  headers: {
                    Referer: 'https://www.kugou.com/',
                    'User-Agent': BROWSER_UA,
                    Cookie: `kg_mid=${mid}; kg_dfid=${dfid}; KuGoo=KugooID=${userId}&t=${token}`,
                  },
                },
                child,
              ),
            signal,
            6_000,
          ),
        );
        if (num(webRes.status) === 1) {
          const url = extractKugouUrl(webRes);
          if (url) {
            const actualQuality = inferKugouQuality(row(webRes.data), '128k');
            trace?.({ stage: 'source', status: 'success', title: `${sourceName}命中 · ${actualQuality}`, sourceName, platform: 'kg', quality: actualQuality });
            return this.buildMedia(track, 'kg', sourceName, url, preferred, actualQuality, { Referer: 'https://www.kugou.com/' }, matchedTrack);
          }
        }
      } catch {
        throwIfAborted(signal);
      }
    }

    trace?.({
      stage: 'source',
      status: 'fallback',
      title: signedIn ? '酷狗账号无完整播放权限，继续后续回退' : '酷狗公开直连无完整免费流，继续后续回退',
      sourceName,
      platform: 'kg',
    });
    return null;
  }

  private async resolveBodian(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
    matchedTrack?: Track,
  ): Promise<RoutedMedia | null> {
    if (!this.deps.bodian) return null;
    const loggedIn = Boolean(this.deps.bodianAccount?.getSnapshot().loggedIn);
    const session = loggedIn ? await this.deps.bodianAccount?.session().catch(() => null) : null;
    const preferred = this.deps.quality();
    const sourceName = session ? '波点账号直连' : '波点官方免费直连';
    if (excluded.has(this.routeKeyFor(track, 'bodian', preferred))) return null;
    trace?.({
      stage: 'source',
      status: 'info',
      title: session ? '尝试波点账号权限直连播放' : '尝试波点官方免费直连播放',
      sourceName,
      quality: preferred,
    });
    try {
      const stream = await this.deps.bodian.directPlayback(track, preferred, session ?? null, signal);
      if (stream && !excluded.has(this.routeKeyFor(track, 'bodian', stream.quality))) {
        trace?.({
          stage: 'source',
          status: 'success',
          title: `${sourceName}命中 · ${stream.quality}`,
          sourceName,
          quality: stream.quality,
        });
        return this.buildMedia(track, 'bodian', sourceName, stream.url, preferred, stream.quality, undefined, matchedTrack);
      }
    } catch {
      throwIfAborted(signal);
    }
    trace?.({
      stage: 'source',
      status: 'fallback',
      title: session ? '波点账号无完整播放权限，继续后续回退' : '波点公开直连无完整免费流，继续后续回退',
      sourceName,
    });
    return null;
  }

  private async resolveQishui(
    track: Track,
    signal: AbortSignal,
    excluded: ReadonlySet<string>,
    trace?: PlaybackTraceSink,
    matchedTrack?: Track,
  ): Promise<RoutedMedia | null> {
    if (!this.deps.qishui) return null;
    // Only native Qishui numeric track IDs can resolve via official Qishui track_v2 / seo_track.
    if (!/^\d{5,30}$/.test(track.origin.id)) return null;
    const loggedIn = Boolean(this.deps.qishuiAccount?.getSnapshot().loggedIn);
    const cookieHeader = loggedIn ? await this.deps.qishuiAccount?.sessionCookieHeader().catch(() => undefined) : undefined;
    const preferred = this.deps.quality();
    const sourceName = cookieHeader ? '汽水账号直连' : '汽水官方免费直连';
    if (
      excluded.has(this.routeKeyFor(track, 'qishui', 'flac')) &&
      excluded.has(this.routeKeyFor(track, 'qishui', '320k')) &&
      excluded.has(this.routeKeyFor(track, 'qishui', '192k')) &&
      excluded.has(this.routeKeyFor(track, 'qishui', '128k'))
    ) {
      return null;
    }
    trace?.({
      stage: 'source',
      status: 'info',
      title: cookieHeader ? '尝试汽水账号权限直连播放' : '尝试汽水官方免费直连播放',
      sourceName,
      quality: preferred,
    });
    try {
      const stream = await this.deps.qishui.directPlayback(track, cookieHeader, signal, preferred);
      if (stream && !excluded.has(this.routeKeyFor(track, 'qishui', stream.quality))) {
        trace?.({
          stage: 'source',
          status: 'success',
          title: `${sourceName}命中 · ${stream.quality}`,
          sourceName,
          quality: stream.quality,
        });
        return this.buildMedia(
          track,
          'qishui',
          sourceName,
          stream.url,
          preferred,
          stream.quality,
          { Referer: 'https://music.douyin.com/' },
          matchedTrack,
        );
      }
    } catch {
      throwIfAborted(signal);
    }
    trace?.({
      stage: 'source',
      status: 'fallback',
      title: cookieHeader ? '汽水账号无未加密完整直连流，继续后续回退' : '汽水公开直连无未加密完整流，继续后续回退',
      sourceName,
    });
    return null;
  }
}
