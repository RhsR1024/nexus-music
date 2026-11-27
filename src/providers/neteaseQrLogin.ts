// Official NetEase QR login protocol (/weapi/login/qrcode/unikey & /weapi/login/qrcode/client/login)
// matching Sollin's _NeteaseQrLoginPageState, with 100% local QR PNG rendering (no third-party QR image server).
import { encodeQrPngDataUri } from '../domain/qrPng.ts';
import { bounded, throwIfAborted } from './async.ts';
import { HTTPResponseError, parseProviderJSON, type HTTPRequest } from './http.ts';
import type { MusicAccounts } from './musicAccounts.ts';
import { parseNeteaseCookiePayload } from './musicWebLogin.ts';
import type { NeteaseAccountProfileClient } from './neteaseAccountProfile.ts';
import { weapiPayload } from './neteaseCrypto.ts';
import { DESKTOP_UA } from './neteaseSession.ts';

export interface NeteaseQr {
  readonly key: string;
  readonly url: string;
  readonly image: string;
  readonly expiresAt: number;
}

export type NeteaseQrPollResult =
  | { readonly status: 'waiting' | 'expired' }
  | { readonly status: 'scanned'; readonly nickname?: string }
  | { readonly status: 'connected'; readonly cookies: Readonly<Record<string, string>> };

export type NeteaseQrStatus = 'idle' | 'loading' | 'waiting' | 'scanned' | 'saving' | 'succeeded' | 'cancelled' | 'expired' | 'failed';

export interface NeteaseQrSnapshot {
  readonly status: NeteaseQrStatus;
  readonly generation: number;
  readonly image?: string;
  readonly expiresAt?: number;
  readonly sameDevice?: boolean;
  readonly nickname?: string;
  readonly detail?: string;
}

export const neteaseQrBusy = (status: NeteaseQrStatus) => ['loading', 'waiting', 'scanned', 'saving'].includes(status);

export class NeteaseQrLoginError extends Error {
  readonly kind: 'cancelled' | 'unavailable';
  constructor(kind: 'cancelled' | 'unavailable' = 'unavailable') {
    super(kind === 'cancelled' ? '网易云扫码登录已取消' : '网易云扫码服务暂时不可用，请重试');
    this.kind = kind;
  }
}

export interface NeteaseQrHTTPResponse {
  readonly body: unknown;
  readonly setCookies: readonly string[];
}

export type NeteaseQrHTTPClient = (url: string, request: HTTPRequest, signal: AbortSignal) => Promise<NeteaseQrHTTPResponse>;

export const requestNeteaseQrHTTP: NeteaseQrHTTPClient = (url, request, signal) => bounded(async child => {
  const response = await fetch(url, { ...request, credentials: 'omit', signal: child });
  if (!response.ok) throw new HTTPResponseError(response.status);
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new Error('服务响应过大');
  const headersWithList = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headersWithList.getSetCookie === 'function'
    ? headersWithList.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : []);
  return { body: parseProviderJSON(text), setCookies };
}, signal, 12_000);

const row = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const COOKIE_CAPTURE = /(?:^|[,;\s])(MUSIC_U|MUSIC_A_T|MUSIC_R_T|MUSIC_SNS|__csrf|NMTID|_ntes_nuid)=([^;,\r\n]+)/g;

export function extractNeteaseSetCookies(setCookies: readonly string[], bodyCookie?: unknown): Readonly<Record<string, string>> {
  const captured: Record<string, string> = {};
  const sources = [...setCookies, ...(typeof bodyCookie === 'string' ? [bodyCookie] : [])];
  for (const source of sources) {
    COOKIE_CAPTURE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = COOKIE_CAPTURE.exec(source)) !== null) {
      const name = match[1];
      const value = match[2]?.trim();
      if (name && value && value.length <= 4096) captured[name] = value;
    }
  }
  return parseNeteaseCookiePayload(JSON.stringify(captured));
}

export type NeteaseQrNativeRequest = (path: string, formBody: string, cookieHeader: string) => Promise<string>;

export function createNativeNeteaseQrHTTP(nativeRequest: NeteaseQrNativeRequest): NeteaseQrHTTPClient {
  return (url, request, signal) => bounded(async child => {
    throwIfAborted(child);
    const parsedUrl = new URL(url);
    const raw = await nativeRequest(parsedUrl.pathname, request.body ?? '', request.headers?.Cookie ?? '');
    throwIfAborted(child);
    const envelope = row(JSON.parse(raw));
    const bodyText = typeof envelope.bodyText === 'string' ? envelope.bodyText : '';
    const setCookies = Array.isArray(envelope.setCookies)
      ? envelope.setCookies.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    return { body: parseProviderJSON(bodyText), setCookies };
  }, signal, 14_000);
}

export class NeteaseQrLoginClient {
  private readonly http: NeteaseQrHTTPClient;
  private readonly now: () => number;
  private sessionCookies: Record<string, string> = {};
  constructor(options: { http?: NeteaseQrHTTPClient; nativeRequest?: NeteaseQrNativeRequest; now?: () => number } = {}) {
    this.http = options.http ?? (options.nativeRequest ? createNativeNeteaseQrHTTP(options.nativeRequest) : requestNeteaseQrHTTP);
    this.now = options.now ?? Date.now;
  }

  private captureAuxiliaryCookies(setCookies: readonly string[]) {
    for (const source of setCookies) {
      COOKIE_CAPTURE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = COOKIE_CAPTURE.exec(source)) !== null) {
        const name = match[1];
        const value = match[2]?.trim();
        if (name && value && value.length <= 4096) this.sessionCookies[name] = value;
      }
    }
  }

  private weapiPost(path: string, data: Record<string, unknown>, signal: AbortSignal) {
    const encrypted = weapiPayload(data);
    const auxCookie = ['os=pc', 'appver=2.10.13', 'channel=netease',
      ...Object.entries(this.sessionCookies).filter(([k]) => k === 'NMTID' || k === '_ntes_nuid').map(([k, v]) => `${k}=${v}`),
    ].join('; ');
    return this.http(`https://music.163.com${path}`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: 'https://music.163.com/',
        Origin: 'https://music.163.com',
        Cookie: auxCookie,
        'User-Agent': DESKTOP_UA,
      },
      body: `params=${encodeURIComponent(encrypted.params)}&encSecKey=${encodeURIComponent(encrypted.encSecKey)}`,
    }, signal);
  }

  async create(signal: AbortSignal): Promise<NeteaseQr> {
    throwIfAborted(signal);
    this.sessionCookies = {};
    try {
      const expiresAt = this.now() + 180_000;
      const res = await this.weapiPost('/weapi/login/qrcode/unikey', { type: 3 }, signal);
      throwIfAborted(signal);
      this.captureAuxiliaryCookies(res.setCookies);
      const data = row(res.body);
      const key = typeof data.unikey === 'string' ? data.unikey.trim() : '';
      if (data.code !== 200 || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new NeteaseQrLoginError();
      const url = `https://music.163.com/login?codekey=${key}`;
      const image = encodeQrPngDataUri(url);
      return { key, url, image, expiresAt };
    } catch (error) {
      if (signal.aborted) throw new NeteaseQrLoginError('cancelled');
      if (error instanceof NeteaseQrLoginError) throw error;
      throw new NeteaseQrLoginError();
    }
  }

  async poll(qr: NeteaseQr, signal: AbortSignal): Promise<NeteaseQrPollResult> {
    throwIfAborted(signal);
    if (this.now() >= qr.expiresAt) return { status: 'expired' };
    try {
      const res = await this.weapiPost('/weapi/login/qrcode/client/login', { key: qr.key, type: 3 }, signal);
      throwIfAborted(signal);
      this.captureAuxiliaryCookies(res.setCookies);
      if (this.now() >= qr.expiresAt) return { status: 'expired' };
      const body = row(res.body);
      const code = Number(body.code);
      if (code === 800) return { status: 'expired' };
      if (code === 801) return { status: 'waiting' };
      if (code === 802) {
        const nickname = typeof body.nickname === 'string' && body.nickname.trim() && body.nickname.length <= 120 ? body.nickname.trim() : undefined;
        return { status: 'scanned', ...(nickname ? { nickname } : {}) };
      }
      if (code === 803) {
        const cookies = extractNeteaseSetCookies(res.setCookies, body.cookie);
        return { status: 'connected', cookies };
      }
      throw new NeteaseQrLoginError();
    } catch (error) {
      if (signal.aborted) throw new NeteaseQrLoginError('cancelled');
      if (error instanceof NeteaseQrLoginError) throw error;
      throw new NeteaseQrLoginError();
    }
  }
}

export class NeteaseQrLoginCoordinator {
  private value: NeteaseQrSnapshot = { status: 'idle', generation: 0 };
  private readonly listeners = new Set<() => void>();
  private controller?: AbortController;
  private deadline?: ReturnType<typeof setTimeout>;
  private foreground = true;
  private handoff?: number;
  private wake?: () => void;
  private sleepWake?: () => void;
  private readonly options: {
    client: Pick<NeteaseQrLoginClient, 'create' | 'poll'>;
    profile: Pick<NeteaseAccountProfileClient, 'fetch'>;
    accounts: Pick<MusicAccounts, 'save'>;
    hash?: (value: string) => Promise<string>;
    pollMs?: number;
    now?: () => number;
  };

  constructor(options: NeteaseQrLoginCoordinator['options']) {
    this.options = options;
  }

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(value: NeteaseQrSnapshot) {
    if (this.handoff === value.generation && ['waiting', 'scanned'].includes(value.status)) {
      value = { ...value, sameDevice: true };
    }
    this.value = value;
    for (const listener of this.listeners) listener();
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
    if (this.value.generation !== generation || !['waiting', 'scanned'].includes(this.value.status) || !this.value.expiresAt || this.value.expiresAt <= (this.options.now ?? Date.now)()) return;
    this.handoff = generation;
    this.publish({ ...this.value, sameDevice: true });
  };

  /** Switching to NetEase Music App (via screenshot, saved photo, or direct app switch)
   * pauses new polls while in background without cancelling the active QR attempt.
   * Returning to foreground resumes polling immediately until the QR expires or the user cancels. */
  setForeground = (active: boolean) => {
    this.foreground = active;
    if (!active) return;
    if (neteaseQrBusy(this.value.status) && this.value.expiresAt && this.value.expiresAt <= (this.options.now ?? Date.now)()) {
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
      const abort = () => { cleanup(); reject(new NeteaseQrLoginError('cancelled')); };
      this.wake = wake;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }

  cancel = () => {
    if (!neteaseQrBusy(this.value.status)) return;
    this.stop();
    this.publish({ status: 'cancelled', generation: this.value.generation });
  };

  imageFailed = (generation: number) => {
    if (generation !== this.value.generation || !neteaseQrBusy(this.value.status)) return;
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
    const finish = (status: NeteaseQrStatus, detail?: string) => {
      if (!active()) return;
      this.stop();
      this.publish({ status, generation, ...(detail ? { detail } : {}) });
    };
    const sleep = (ms: number) => new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        if (this.sleepWake === resumeNow) this.sleepWake = undefined;
      };
      const resumeNow = () => { cleanup(); resolve(); };
      const timer = setTimeout(resumeNow, ms);
      const cancel = () => { cleanup(); reject(new NeteaseQrLoginError('cancelled')); };
      this.sleepWake = resumeNow;
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
    this.publish({ status: 'loading', generation });
    this.deadline = setTimeout(() => finish('expired'), 180_000);
    try {
      const qr = await this.options.client.create(signal);
      if (!active()) return;
      if (qr.expiresAt <= now()) { finish('expired'); return; }
      clearTimeout(this.deadline);
      this.deadline = setTimeout(() => finish('expired'), Math.min(180_000, qr.expiresAt - now()));
      this.publish({ status: 'waiting', generation, image: qr.image, expiresAt: qr.expiresAt });
      let consecutivePollErrors = 0;
      while (active()) {
        await this.waitForForeground(signal);
        if (!active()) return;
        if (qr.expiresAt <= now()) { finish('expired'); return; }
        let result: NeteaseQrPollResult;
        try {
          result = await this.options.client.poll(qr, signal);
          consecutivePollErrors = 0;
        } catch (pollError) {
          if (!active() || signal.aborted) return;
          // iOS suspends in-flight sockets when switching to NetEase Music App to scan.
          // Do not terminate the QR session on background/transient transport drops;
          // wait until foreground resumes and retry until expiry.
          if (!this.foreground) {
            await this.waitForForeground(signal);
            if (!active()) return;
            await sleep(Math.min(400, this.options.pollMs ?? 2000));
            continue;
          }
          consecutivePollErrors++;
          if (consecutivePollErrors >= 8) {
            finish('failed', pollError instanceof NeteaseQrLoginError ? undefined : '网络不稳定，请重试或改用网页登录');
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
          let profile: Awaited<ReturnType<NeteaseAccountProfileClient['fetch']>> | undefined;
          for (let attempt = 0; attempt < 3; attempt++) {
            await this.waitForForeground(signal);
            if (!active()) return;
            try {
              profile = await this.options.profile.fetch({ platform: 'wy', cookies: result.cookies }, signal);
              break;
            } catch {
              if (!active() || signal.aborted) return;
              if (attempt === 2) { finish('failed', '扫码已确认，但读取网易云账号资料失败，请重试'); return; }
              await sleep(600);
            }
          }
          if (!active() || !profile) return;
          const username = `netease:${profile.userId}`;
          const accountId = this.options.hash ? await this.options.hash(JSON.stringify(['wy', username])) : undefined;
          if (!active()) return;
          await this.options.accounts.save({
            platform: 'wy',
            label: '网易云音乐',
            username,
            displayName: profile.nickname,
            ...(profile.avatar ? { avatar: profile.avatar } : {}),
            capabilities: ['daily', 'fm'],
          }, {
            version: 1,
            platform: 'wy',
            ...(accountId ? { accountId } : {}),
            userId: profile.userId,
            cookies: result.cookies,
          }, signal);
          finish('succeeded');
          return;
        }
        if (result.status !== this.value.status || (result.status === 'scanned' && result.nickname !== this.value.nickname)) {
          this.publish({
            status: result.status,
            generation,
            image: qr.image,
            expiresAt: qr.expiresAt,
            ...(result.status === 'scanned' && result.nickname ? { nickname: result.nickname } : {}),
          });
        }
        await sleep(this.options.pollMs ?? 2000);
      }
    } catch {
      finish('failed');
    }
  }
}
