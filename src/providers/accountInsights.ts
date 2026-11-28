// Multi-platform account membership (VIP / non-VIP) and profile statistics service.
// Clean-room TypeScript implementation inspecting official platform account/VIP endpoints
// for NetEase, QQ Music, Kugou, Qishui, and Bodian. Only non-sensitive public summary
// fields are persisted in the local repository (never credentials or cookies).

import type { Repository } from '../storage/repository.ts';
import { bounded, throwIfAborted } from './async.ts';
import { queryURL, requestJSON, type HTTPClient } from './http.ts';
import type { MusicAccount, MusicAccounts, MusicSession } from './musicAccounts.ts';
import { neteaseSessionAuth, neteaseWeapiRequest } from './neteaseSession.ts';
import { parseQQCookiePayload, qqMusicIdentity } from './qqAccountProfile.ts';
import type { BodianAccountStore, BodianProvider } from './bodian.ts';
import type { QishuiAccountStore, QishuiProvider } from './qishui.ts';

export type AccountInsightPlatform = 'wy' | 'tx' | 'kg' | 'qishui' | 'bodian';

export type AccountMembershipTier =
  | 'unknown'
  | 'none'
  | 'wy_package'
  | 'wy_vip'
  | 'wy_svip'
  | 'tx_green'
  | 'tx_deluxe'
  | 'tx_super'
  | 'kg_vip'
  | 'kg_deluxe'
  | 'kg_super'
  | 'qishui_vip'
  | 'bodian_vip'
  | 'bodian_big';

export const MEMBERSHIP_LABELS: Readonly<Record<AccountMembershipTier, string>> = {
  unknown: '会员状态未知',
  none: '非会员',
  wy_package: '音乐包',
  wy_vip: '黑胶VIP',
  wy_svip: '黑胶SVIP',
  tx_green: '绿钻',
  tx_deluxe: '豪华绿钻',
  tx_super: '超级会员',
  kg_vip: 'VIP会员',
  kg_deluxe: '豪华VIP',
  kg_super: '超级VIP',
  qishui_vip: '汽水会员',
  bodian_vip: '波点会员',
  bodian_big: '波点大会员',
};

export function isMemberTier(tier: AccountMembershipTier): boolean {
  return tier !== 'unknown' && tier !== 'none';
}

export function membershipLabel(tier: AccountMembershipTier): string {
  return MEMBERSHIP_LABELS[tier] ?? '会员状态未知';
}

export interface AccountInsight {
  readonly accountKey: string;
  readonly platform: AccountInsightPlatform;
  readonly membership: AccountMembershipTier;
  readonly isMember: boolean;
  readonly membershipLabel: string;
  readonly expireAt?: number;
  readonly level?: number;
  readonly listenSongs?: number;
  readonly follows?: number;
  readonly followeds?: number;
  readonly playlistCount?: number;
  readonly checkedAt: number;
}

export interface AccountInsightsState {
  readonly byKey: Readonly<Record<string, AccountInsight>>;
  readonly refreshing: Readonly<Record<string, boolean>>;
}

type Row = Record<string, unknown>;
const row = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : '';
const intOrUndef = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isSafeInteger(n) ? n : undefined;
  }
  return undefined;
};
const nonNegInt = (v: unknown): number | undefined => {
  const n = intOrUndef(v);
  return n !== undefined && n >= 0 ? n : undefined;
};

/** Parses Unix seconds/milliseconds or China-local date strings into epoch ms. */
export function parseExpiryMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value > 100_000_000_000 ? Math.trunc(value) : Math.trunc(value * 1000);
  }
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  if (!s) return undefined;
  if (/^\d{9,13}$/.test(s)) {
    const n = Number(s);
    if (n <= 0) return undefined;
    return n > 100_000_000_000 ? n : n * 1000;
  }
  // yyyy-MM-dd HH:mm:ss | yyyy-MM-dd | yyyyMMdd (Asia/Shanghai +08:00)
  const full = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (full) {
    const y = Number(full[1]);
    const m = Number(full[2]);
    const d = Number(full[3]);
    const hh = full[4] ? Number(full[4]) : 23;
    const mm = full[5] ? Number(full[5]) : 59;
    const ss = full[6] ? Number(full[6]) : 59;
    if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return Date.UTC(y, m - 1, d, hh - 8, mm, ss);
    }
  }
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const y = Number(compact[1]);
    const m = Number(compact[2]);
    const d = Number(compact[3]);
    if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return Date.UTC(y, m - 1, d, 15, 59, 59);
    }
  }
  return undefined;
}

export function formatExpireDate(ms: number | undefined): string | undefined {
  if (!ms || !Number.isFinite(ms) || ms <= 0 || ms > 4_102_444_800_000) return undefined;
  const d = new Date(ms + 8 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseNeteaseVipInfo(raw: unknown, now = Date.now()): { tier: AccountMembershipTier; expireAt?: number } {
  const root = row(raw);
  if (intOrUndef(root.code) !== 200) return { tier: 'unknown' };
  const data = row(root.data);
  const checks: readonly [string, AccountMembershipTier][] = [
    ['redplus', 'wy_svip'],
    ['associator', 'wy_vip'],
    ['musicPackage', 'wy_package'],
  ];
  let recognized = false;
  for (const [key, tier] of checks) {
    const prod = row(data[key]);
    if (!Object.keys(prod).length) continue;
    const rawExp = prod.expireTime;
    const exp = rawExp === 0 || rawExp === '0' ? 0 : parseExpiryMs(rawExp);
    if (exp === undefined) continue;
    recognized = true;
    if (exp > now) return { tier, expireAt: exp };
  }
  return { tier: recognized ? 'none' : 'unknown' };
}

export function parseNeteaseUserDetail(raw: unknown): {
  level?: number;
  listenSongs?: number;
  follows?: number;
  followeds?: number;
  playlistCount?: number;
  fallbackVipType?: number;
} {
  const root = row(raw);
  if (intOrUndef(root.code) !== 200) return {};
  const profile = row(root.profile);
  return {
    ...(nonNegInt(root.level) !== undefined ? { level: nonNegInt(root.level) } : {}),
    ...(nonNegInt(root.listenSongs) !== undefined ? { listenSongs: nonNegInt(root.listenSongs) } : {}),
    ...(nonNegInt(profile.follows) !== undefined ? { follows: nonNegInt(profile.follows) } : {}),
    ...(nonNegInt(profile.followeds) !== undefined ? { followeds: nonNegInt(profile.followeds) } : {}),
    ...(nonNegInt(profile.playlistCount) !== undefined ? { playlistCount: nonNegInt(profile.playlistCount) } : {}),
    ...(nonNegInt(profile.vipType) !== undefined ? { fallbackVipType: nonNegInt(profile.vipType) } : {}),
  };
}

export function parseQQVipInfo(raw: unknown, now = Date.now()): { tier: AccountMembershipTier; expireAt?: number } {
  const root = row(raw);
  if (intOrUndef(root.code) !== 0) return { tier: 'unknown' };
  const rpc = row(root.req_0 ?? root.vip);
  if (intOrUndef(rpc.code) !== 0) return { tier: 'unknown' };
  const identity = row(row(rpc.data).identity);
  if (!Object.keys(identity).length) return { tier: 'unknown' };

  const active = (flagKey: string, endKey: string): { ok: boolean; expireAt?: number } => {
    const flag = intOrUndef(identity[flagKey]) ?? 0;
    if (flag <= 0) return { ok: false };
    const exp = parseExpiryMs(identity[endKey]);
    if (exp !== undefined) return { ok: exp > now, expireAt: exp };
    return { ok: true };
  };

  const huge = active('HugeVip', 'HugeVipEnd');
  if (huge.ok) return { tier: 'tx_super', ...(huge.expireAt ? { expireAt: huge.expireAt } : {}) };
  const lm = active('LMFlag', 'LMEnd');
  if (lm.ok) return { tier: 'tx_deluxe', ...(lm.expireAt ? { expireAt: lm.expireAt } : {}) };
  const svip = active('svip', 'overdate');
  if (svip.ok) return { tier: 'tx_deluxe', ...(svip.expireAt ? { expireAt: svip.expireAt } : {}) };
  const vip = active('vip', 'overdate');
  if (vip.ok) return { tier: 'tx_green', ...(vip.expireAt ? { expireAt: vip.expireAt } : {}) };

  const hasAnyFlag = ['HugeVip', 'LMFlag', 'svip', 'vip'].some(k => intOrUndef(identity[k]) !== undefined);
  return { tier: hasAnyFlag ? 'none' : 'unknown' };
}

export function parseKugouVipInfo(raw: unknown, now = Date.now()): { tier: AccountMembershipTier; expireAt?: number } {
  const root = row(raw);
  if (intOrUndef(root.status) !== 1) return { tier: 'unknown' };
  const data = row(root.data);
  const type = intOrUndef(data.vip_type);
  if (type === undefined) return { tier: 'unknown' };
  if (type === 0) return { tier: 'none' };
  const exp = parseExpiryMs(data.expire_time ?? data.vip_end_time);
  if (exp !== undefined && exp <= now) return { tier: 'none' };
  const name = text(data.vip_name).trim();
  if (name === '超级VIP' || type === 6) return { tier: 'kg_super', ...(exp ? { expireAt: exp } : {}) };
  if (name === '豪华VIP' || type === 11) return { tier: 'kg_deluxe', ...(exp ? { expireAt: exp } : {}) };
  return { tier: 'kg_vip', ...(exp ? { expireAt: exp } : {}) };
}

export function parseBodianVipInfo(payInfoRaw: unknown, now = Date.now()): { tier: AccountMembershipTier; expireAt?: number } {
  const pay = row(payInfoRaw);
  if (!Object.keys(pay).length) return { tier: 'unknown' };
  const numField = (k: string) => intOrUndef(pay[k]) ?? 0;
  const boolField = (k: string) => pay[k] === true || pay[k] === 'true' || numField(k) > 0;
  const member =
    boolField('isVipBoolean') ||
    boolField('isVip') ||
    boolField('isPayVipBoolean') ||
    boolField('isBigVipBoolean') ||
    boolField('isActVipBoolean') ||
    boolField('isBigPayVipBoolean') ||
    boolField('isCtVipBoolean') ||
    numField('vipType') > 0 ||
    numField('payVipType') > 0 ||
    numField('actVipType') > 0;
  if (!member) return { tier: 'none' };

  const expiryKeys = [
    'expireDate',
    'expireTime',
    'vipExpireTime',
    'payExpireDate',
    'bigExpireDate',
    'bigPayExpireDate',
    'ctExpireDate',
    'ctPayExpireDate',
    'actExpireDate',
  ];
  const validExpiries = expiryKeys
    .map(k => parseExpiryMs(pay[k]))
    .filter((v): v is number => v !== undefined && v > 0 && v < 4_102_444_800_000);
  const latest = validExpiries.length ? Math.max(...validExpiries) : undefined;
  if (latest !== undefined && latest <= now) return { tier: 'none' };

  if (numField('vipType') === 1 && numField('payVipType') === 2) {
    return { tier: 'bodian_vip', ...(latest ? { expireAt: latest } : {}) };
  }
  return { tier: 'bodian_big', ...(latest ? { expireAt: latest } : {}) };
}

export function parseQishuiVipInfo(infoRaw: unknown): { tier: AccountMembershipTier } {
  const info = row(infoRaw);
  const v = info.is_vip ?? info.isVip ?? row(info.vip_info).is_vip ?? row(info.vip_info).isVip;
  if (v === true || v === 1 || v === '1' || v === 'true') return { tier: 'qishui_vip' };
  if (v === false || v === 0 || v === '0' || v === 'false') return { tier: 'none' };
  const status = intOrUndef(info.vip_status ?? row(info.vip_info).status);
  if (status !== undefined) return { tier: status > 0 ? 'qishui_vip' : 'none' };
  return { tier: 'unknown' };
}

const STORAGE_KEY = 'accountInsights.v1';
export const ACCOUNT_INSIGHTS_VERSION = 1;
const KUGOU_ANDROID_SALT = 'OIlwieks28dk2k092lksi2UIkp';

export interface AccountInsightsDeps {
  readonly repository?: Pick<Repository, 'get' | 'put'>;
  readonly http?: HTTPClient;
  readonly md5: (value: string) => Promise<string>;
  readonly musicAccounts: Pick<MusicAccounts, 'getSnapshot' | 'session'>;
  readonly qishui: Pick<QishuiProvider, 'fetchUserPlaylists'>;
  readonly qishuiAccount: Pick<QishuiAccountStore, 'getSnapshot' | 'sessionCookieHeader'>;
  readonly bodian: Pick<BodianProvider, 'fetchProfile' | 'userCollections'>;
  readonly bodianAccount: Pick<BodianAccountStore, 'getSnapshot' | 'session'>;
  readonly now?: () => number;
}

function makeInsight(
  accountKey: string,
  platform: AccountInsightPlatform,
  tier: AccountMembershipTier,
  checkedAt: number,
  extra: Partial<Omit<AccountInsight, 'accountKey' | 'platform' | 'membership' | 'isMember' | 'membershipLabel' | 'checkedAt'>> = {},
): AccountInsight {
  return Object.freeze({
    accountKey,
    platform,
    membership: tier,
    isMember: isMemberTier(tier),
    membershipLabel: membershipLabel(tier),
    checkedAt,
    ...(extra.expireAt !== undefined ? { expireAt: extra.expireAt } : {}),
    ...(extra.level !== undefined ? { level: extra.level } : {}),
    ...(extra.listenSongs !== undefined ? { listenSongs: extra.listenSongs } : {}),
    ...(extra.follows !== undefined ? { follows: extra.follows } : {}),
    ...(extra.followeds !== undefined ? { followeds: extra.followeds } : {}),
    ...(extra.playlistCount !== undefined ? { playlistCount: extra.playlistCount } : {}),
  });
}

export class AccountInsightsStore {
  private readonly deps: AccountInsightsDeps;
  private readonly http: HTTPClient;
  private readonly now: () => number;
  private state: AccountInsightsState = { byKey: {}, refreshing: {} };
  private readonly listeners = new Set<() => void>();
  private readonly inFlight = new Map<string, Promise<AccountInsight | null>>();

  constructor(deps: AccountInsightsDeps) {
    this.deps = deps;
    this.http = deps.http ?? requestJSON;
    this.now = deps.now ?? Date.now;
  }

  getSnapshot = (): AccountInsightsState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: AccountInsightsState) {
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  get(accountKey: string): AccountInsight | undefined {
    return this.state.byKey[accountKey];
  }

  async restore(): Promise<void> {
    if (!this.deps.repository) return;
    try {
      const saved = await this.deps.repository.get<{ version?: number; byKey?: Record<string, AccountInsight> }>(STORAGE_KEY);
      if (saved && saved.byKey && typeof saved.byKey === 'object') {
        const clean: Record<string, AccountInsight> = {};
        for (const [k, v] of Object.entries(saved.byKey)) {
          if (!v || typeof v !== 'object') continue;
          const tier = (v.membership in MEMBERSHIP_LABELS ? v.membership : 'unknown') as AccountMembershipTier;
          const platform = v.platform;
          if (!['wy', 'tx', 'kg', 'qishui', 'bodian'].includes(platform)) continue;
          clean[k] = makeInsight(k, platform, tier, nonNegInt(v.checkedAt) ?? 0, {
            expireAt: nonNegInt(v.expireAt),
            level: nonNegInt(v.level),
            listenSongs: nonNegInt(v.listenSongs),
            follows: nonNegInt(v.follows),
            followeds: nonNegInt(v.followeds),
            playlistCount: nonNegInt(v.playlistCount),
          });
        }
        this.publish({ ...this.state, byKey: clean });
      }
    } catch {}
  }

  private async persist() {
    if (!this.deps.repository) return;
    try {
      await this.deps.repository.put(STORAGE_KEY, {
        version: ACCOUNT_INSIGHTS_VERSION,
        byKey: this.state.byKey,
      });
    } catch {}
  }

  private setRefreshing(key: string, busy: boolean) {
    const next = { ...this.state.refreshing };
    if (busy) next[key] = true;
    else delete next[key];
    this.publish({ ...this.state, refreshing: next });
  }

  private saveInsight(insight: AccountInsight) {
    const nextByKey = { ...this.state.byKey, [insight.accountKey]: insight };
    this.publish({ ...this.state, byKey: nextByKey });
    void this.persist();
  }

  private async fetchNetease(account: MusicAccount, session: MusicSession, signal: AbortSignal): Promise<AccountInsight> {
    const auth = neteaseSessionAuth(session);
    const uid = text(session.userId).trim() || account.username.replace(/^netease:/i, '').trim();
    if (!auth || !/^\d+$/.test(uid)) {
      return makeInsight(account.id, 'wy', 'unknown', this.now());
    }

    const postWeapi = async (url: string, data: Record<string, unknown>) => {
      const first = await this.http(url, { ...neteaseWeapiRequest(data, auth), credentials: 'omit' }, signal);
      if (intOrUndef(row(first).code) === 301 && !/(?:^|;\s*)os=/i.test(auth.cookie)) {
        const pcAuth = { cookie: `${auth.cookie}; os=pc; appver=3.1.17.204416; channel=netease`, csrf: auth.csrf };
        try {
          const retry = await this.http(url, { ...neteaseWeapiRequest(data, pcAuth), credentials: 'omit' }, signal);
          if (intOrUndef(row(retry).code) === 200) return retry;
        } catch {}
      }
      return first;
    };

    const [vipRes, detailRes] = await Promise.allSettled([
      postWeapi('https://music.163.com/weapi/music-vip-membership/client/vip/info', { userId: uid }),
      postWeapi(`https://music.163.com/weapi/v1/user/detail/${uid}`, {}),
    ]);
    throwIfAborted(signal);

    const vip = vipRes.status === 'fulfilled' ? parseNeteaseVipInfo(vipRes.value, this.now()) : { tier: 'unknown' as AccountMembershipTier };
    const detail = detailRes.status === 'fulfilled' ? parseNeteaseUserDetail(detailRes.value) : {};

    let tier = vip.tier;
    if (tier === 'unknown' && detail.fallbackVipType !== undefined) {
      tier = detail.fallbackVipType > 0 ? 'wy_vip' : 'none';
    }

    return makeInsight(account.id, 'wy', tier, this.now(), {
      expireAt: vip.expireAt,
      level: detail.level,
      listenSongs: detail.listenSongs,
      follows: detail.follows,
      followeds: detail.followeds,
      playlistCount: detail.playlistCount,
    });
  }

  private async fetchQQ(account: MusicAccount, session: MusicSession, signal: AbortSignal): Promise<AccountInsight> {
    let cookies: Readonly<Record<string, string>>;
    let uin: string;
    let authst: string;
    let tmeLoginType: 1 | 2;
    try {
      cookies = parseQQCookiePayload(JSON.stringify(row(session.cookies)), 'music');
      ({ uin, authst, tmeLoginType } = qqMusicIdentity(cookies));
    } catch {
      return makeInsight(account.id, 'tx', 'unknown', this.now());
    }
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    const headers = {
      Cookie: cookieHeader,
      Referer: 'https://y.qq.com/',
      Origin: 'https://y.qq.com',
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    };

    const payload = {
      comm: { uin, authst, ct: 24, cv: 0, format: 'json', tmeAppID: 'qqmusic', tmeLoginType },
      req_0: { module: 'VipLogin.VipLoginInter', method: 'vip_login_base', param: {} },
      playlists: { module: 'music.musicasset.PlaylistBaseRead', method: 'GetPlaylistByUin', param: { uin } },
    };

    let vip: { tier: AccountMembershipTier; expireAt?: number } = { tier: 'unknown' };
    let playlistCount: number | undefined;

    try {
      const raw = row(
        await this.http(
          'https://u.y.qq.com/cgi-bin/musicu.fcg',
          { method: 'POST', credentials: 'omit', headers, body: JSON.stringify(payload) },
          signal,
        ),
      );
      vip = parseQQVipInfo(raw, this.now());
      const plData = row(row(raw.playlists).data);
      const plList = list(plData.v_playlist ?? plData.disslist ?? plData.list);
      const declaredTotal = nonNegInt(plData.total ?? plData.num);
      if (declaredTotal !== undefined) playlistCount = declaredTotal;
      else if (plList.length > 0) playlistCount = plList.length;
    } catch {
      throwIfAborted(signal);
    }

    if (playlistCount === undefined) {
      try {
        const home = row(
          await this.http(
            `https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?ct=20&cv=4747474&cid=205360838&userid=${uin}`,
            { method: 'GET', credentials: 'omit', headers },
            signal,
          ),
        );
        if (intOrUndef(home.code) === 0) {
          const data = row(home.data);
          const mydiss = list(row(data.mydiss).list);
          const numDiss = nonNegInt(row(data.mydiss).num) ?? mydiss.length;
          // Include "我喜欢" if present in mymusic
          const hasFav = list(data.mymusic).length > 0 ? 1 : 0;
          if (numDiss > 0 || hasFav > 0) playlistCount = numDiss + hasFav;
        }
      } catch {
        throwIfAborted(signal);
      }
    }

    return makeInsight(account.id, 'tx', vip.tier, this.now(), {
      expireAt: vip.expireAt,
      playlistCount,
    });
  }

  private async fetchKugou(account: MusicAccount, session: MusicSession, signal: AbortSignal): Promise<AccountInsight> {
    const userId = text(session.userId ?? session.userid).trim() || account.username.replace(/^kugou:/i, '').trim();
    const token = text(session.token).trim();
    const mid = text(session.mid).trim() || '-';
    if (!userId || !token) {
      return makeInsight(account.id, 'kg', 'unknown', this.now());
    }

    const clienttime = Math.floor(this.now() / 1000);
    const vipParams: Record<string, string | number> = {
      appid: 1005,
      clientver: 20489,
      clienttime,
      mid,
      dfid: '-',
      uuid: '-',
      busi_type: 'concept',
      product_type: 'svip',
      opt_product_types: 'dvip,qvip',
      userid: userId,
      token,
    };
    const signInput =
      KUGOU_ANDROID_SALT +
      Object.keys(vipParams)
        .sort()
        .map(k => `${k}=${vipParams[k]}`)
        .join('') +
      KUGOU_ANDROID_SALT;
    const signature = await this.deps.md5(signInput);
    throwIfAborted(signal);

    const listBody = JSON.stringify({
      total_ver: 979,
      type: 2,
      page: 1,
      pagesize: 200,
      userid: Number(userId) || userId,
      token,
    });
    const listParams: Record<string, string | number> = {
      appid: 1005,
      clientver: 20489,
      clienttime,
      mid,
      dfid: '-',
      uuid: '-',
      total_ver: 979,
      type: 2,
      page: 1,
      pagesize: 200,
      userid: userId,
      token,
    };
    const listSig = await this.deps.md5(
      KUGOU_ANDROID_SALT +
        Object.keys(listParams)
          .sort()
          .map(k => `${k}=${listParams[k]}`)
          .join('') +
        listBody +
        KUGOU_ANDROID_SALT,
    );
    throwIfAborted(signal);

    const [vipRes, plRes] = await Promise.allSettled([
      this.http(
        queryURL('https://kugouvip.kugou.com/v1/get_union_vip', { ...vipParams, signature }),
        { method: 'GET', credentials: 'omit', headers: { mid, dfid: '-', 'User-Agent': 'Android16-1070-11440-130-0-LOGIN-wifi' } },
        signal,
      ),
      this.http(
        queryURL('https://gateway.kugou.com/v7/get_all_list', { ...listParams, signature: listSig }),
        {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            'x-router': 'cloudlist.service.kugou.com',
            mid,
            dfid: '-',
          },
          body: listBody,
        },
        signal,
      ),
    ]);
    throwIfAborted(signal);

    const vip = vipRes.status === 'fulfilled' ? parseKugouVipInfo(vipRes.value, this.now()) : { tier: 'unknown' as AccountMembershipTier };
    let playlistCount: number | undefined;
    if (plRes.status === 'fulfilled') {
      const root = row(plRes.value);
      const info = list(row(root.data).info);
      if (intOrUndef(root.status) === 1) {
        playlistCount = info.filter(item => {
          const r = row(item);
          return r.is_del !== 1 && r.status !== 2;
        }).length;
      }
    }

    return makeInsight(account.id, 'kg', vip.tier, this.now(), {
      expireAt: vip.expireAt,
      playlistCount,
    });
  }

  private async fetchQishui(signal: AbortSignal): Promise<AccountInsight> {
    const snap = this.deps.qishuiAccount.getSnapshot();
    const key = 'qishui:default';
    if (!snap.loggedIn) {
      return makeInsight(key, 'qishui', 'unknown', this.now(), { playlistCount: snap.playlists.length });
    }
    const cookieHeader = await this.deps.qishuiAccount.sessionCookieHeader();
    throwIfAborted(signal);

    let tier: AccountMembershipTier =
      snap.isVip === true ? 'qishui_vip' : snap.isVip === false ? 'none' : 'unknown';
    let playlistCount: number | undefined = snap.playlists.length > 0 ? snap.playlists.length : undefined;

    if (cookieHeader) {
      const [profileRes, plRes] = await Promise.allSettled([
        this.http(
          queryURL('https://api.qishui.com/luna/pc/user/info', {
            aid: '386088',
            app_name: 'luna_pc',
            device_platform: 'windows',
            version_code: '30030000',
          }),
          {
            method: 'GET',
            credentials: 'omit',
            headers: {
              Accept: 'application/json',
              Cookie: cookieHeader,
              Referer: 'https://music.douyin.com/',
            },
          },
          signal,
        ),
        this.deps.qishui.fetchUserPlaylists(cookieHeader, signal),
      ]);
      throwIfAborted(signal);

      if (profileRes.status === 'fulfilled') {
        const root = row(profileRes.value);
        const info = row(root.user_info ?? row(root.data).user_info ?? root.data ?? root);
        const parsed = parseQishuiVipInfo(info);
        if (parsed.tier !== 'unknown') tier = parsed.tier;
      }
      if (plRes.status === 'fulfilled') {
        playlistCount = Math.max(plRes.value.length, snap.playlists.length);
      }
    }

    return makeInsight(key, 'qishui', tier, this.now(), { playlistCount });
  }

  private async fetchBodian(signal: AbortSignal): Promise<AccountInsight> {
    const snap = this.deps.bodianAccount.getSnapshot();
    const key = 'bodian:default';
    if (!snap.loggedIn) {
      return makeInsight(key, 'bodian', 'unknown', this.now());
    }
    const sess = await this.deps.bodianAccount.session();
    throwIfAborted(signal);
    if (!sess) {
      const fallbackTier: AccountMembershipTier =
        snap.isVip === true ? (snap.vipLabel?.includes('大会员') ? 'bodian_big' : 'bodian_vip') : snap.isVip === false ? 'none' : 'unknown';
      return makeInsight(key, 'bodian', fallbackTier, this.now());
    }

    const [profRes, colRes] = await Promise.allSettled([
      this.deps.bodian.fetchProfile(sess, signal),
      this.deps.bodian.userCollections(sess, signal),
    ]);
    throwIfAborted(signal);

    let tier: AccountMembershipTier =
      snap.isVip === true ? (snap.vipLabel?.includes('大会员') ? 'bodian_big' : 'bodian_vip') : snap.isVip === false ? 'none' : 'unknown';
    let expireAt: number | undefined;
    if (profRes.status === 'fulfilled') {
      const prof = profRes.value as {
        isVip?: boolean;
        vipLabel?: string;
        vipTier?: AccountMembershipTier;
        expireAt?: number;
      };
      if (prof.vipTier && prof.vipTier !== 'unknown') {
        tier = prof.vipTier;
      } else if (prof.isVip === true) {
        tier = prof.vipLabel?.includes('大会员') ? 'bodian_big' : 'bodian_vip';
      } else if (prof.isVip === false) {
        tier = 'none';
      }
      expireAt = prof.expireAt;
    }

    let playlistCount: number | undefined;
    if (colRes.status === 'fulfilled') {
      const ids = new Set([
        ...colRes.value.created.map(p => p.id),
        ...colRes.value.collectedPlaylists.map(p => p.id),
      ]);
      playlistCount = ids.size;
    }

    return makeInsight(key, 'bodian', tier, this.now(), { expireAt, playlistCount });
  }

  async refreshAccount(account: MusicAccount, signal?: AbortSignal): Promise<AccountInsight | null> {
    const existingFlight = this.inFlight.get(account.id);
    if (existingFlight) return existingFlight;
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    this.setRefreshing(account.id, true);
    const task = bounded(async child => {
      const session = await this.deps.musicAccounts.session(account.id);
      throwIfAborted(child);
      if (account.platform === 'wy') return this.fetchNetease(account, session, child);
      if (account.platform === 'tx') return this.fetchQQ(account, session, child);
      return this.fetchKugou(account, session, child);
    }, ctrl.signal, 14_000)
      .then(insight => {
        // Only merge non-unknown data over an older cached insight so transient errors never wipe known VIP status
        const prev = this.state.byKey[account.id];
        const merged: AccountInsight =
          insight.membership === 'unknown' && prev && prev.membership !== 'unknown'
            ? makeInsight(account.id, account.platform, prev.membership, insight.checkedAt, {
                expireAt: insight.expireAt ?? prev.expireAt,
                level: insight.level ?? prev.level,
                listenSongs: insight.listenSongs ?? prev.listenSongs,
                follows: insight.follows ?? prev.follows,
                followeds: insight.followeds ?? prev.followeds,
                playlistCount: insight.playlistCount ?? prev.playlistCount,
              })
            : insight;
        this.saveInsight(merged);
        return merged;
      })
      .catch(() => null)
      .finally(() => {
        signal?.removeEventListener('abort', onAbort);
        this.inFlight.delete(account.id);
        this.setRefreshing(account.id, false);
      });

    this.inFlight.set(account.id, task);
    return task;
  }

  async refreshSpecialPlatform(platform: 'qishui' | 'bodian', signal?: AbortSignal): Promise<AccountInsight | null> {
    const key = `${platform}:default`;
    const existingFlight = this.inFlight.get(key);
    if (existingFlight) return existingFlight;
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    this.setRefreshing(key, true);
    const task = bounded(
      child => (platform === 'qishui' ? this.fetchQishui(child) : this.fetchBodian(child)),
      ctrl.signal,
      14_000,
    )
      .then(insight => {
        this.saveInsight(insight);
        return insight;
      })
      .catch(() => null)
      .finally(() => {
        signal?.removeEventListener('abort', onAbort);
        this.inFlight.delete(key);
        this.setRefreshing(key, false);
      });

    this.inFlight.set(key, task);
    return task;
  }

  async refreshAll(signal?: AbortSignal): Promise<void> {
    const accounts = this.deps.musicAccounts.getSnapshot();
    const jobs: Promise<unknown>[] = accounts.map(a => this.refreshAccount(a, signal));
    if (this.deps.qishuiAccount.getSnapshot().loggedIn) {
      jobs.push(this.refreshSpecialPlatform('qishui', signal));
    }
    if (this.deps.bodianAccount.getSnapshot().loggedIn) {
      jobs.push(this.refreshSpecialPlatform('bodian', signal));
    }
    await Promise.allSettled(jobs);
  }
}
