// Audio Match (听歌识曲): native mic WAV capture + optional cloud audio-clip recognition
// (ACRCloud / AudD with user-supplied personal free-tier keys) + multi-platform lyric/phrase search.
import type { OnlinePlatform, Track } from '../domain/track.ts';
import { cleanTrack } from '../storage/cleanTrack.ts';
import type { Repository } from '../storage/repository.ts';
import type { MusicSecretStore } from './musicAccounts.ts';

export interface AudioMatchCaptureResult {
  readonly durationMs: number;
  readonly sampleRate: number;
  readonly avgLevel: number;
  readonly peakLevel: number;
  readonly zeroCrossings: number;
  readonly energySignature: string;
  readonly cancelled: boolean;
  readonly audioBase64?: string;
  readonly mimeType?: string;
}

export type AudioMatchCloudProvider = 'off' | 'acrcloud' | 'audd';

export interface AudioMatchCloudConfig {
  readonly provider: AudioMatchCloudProvider;
  readonly acrHost: string;
  readonly acrAccessKey: string;
  readonly acrAccessSecret: string;
  readonly auddToken: string;
}

export interface AudioMatchCloudResult {
  readonly provider: 'acrcloud' | 'audd';
  readonly title: string;
  readonly artist: string;
  readonly album?: string;
  readonly releaseDate?: string;
  readonly score?: number;
}

export interface AudioMatchHistoryEntry {
  readonly id: string;
  readonly track: Track;
  readonly matchedAt: number;
  readonly method: 'acoustic-search' | 'lyric-phrase' | 'cloud-clip';
  readonly signature?: string;
}

export interface AudioMatchNativeBridge {
  audioMatchPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  audioMatchRequestPermission(): Promise<boolean>;
  audioMatchStart(durationMs: number): Promise<AudioMatchCaptureResult>;
  audioMatchStop(): Promise<void>;
  addListener?(event: string, listener: (payload: { level?: number; peak?: number; elapsedMs?: number }) => void): { remove(): void };
}

export interface AudioMatchState {
  readonly listening: boolean;
  readonly identifying: boolean;
  readonly level: number;
  readonly elapsedMs: number;
  readonly lastCapture: AudioMatchCaptureResult | null;
  readonly lastCloudMatch: AudioMatchCloudResult | null;
  readonly cloudConfig: AudioMatchCloudConfig;
  readonly results: readonly Track[];
  readonly history: readonly AudioMatchHistoryEntry[];
  readonly searching: boolean;
  readonly hint: string;
  readonly error: string;
}

const STORAGE_KEY = 'audioMatch.v1';
const SECRETS_KEY = 'nexus.audiomatch.keys.v1';
export const MAX_UPLOAD_CLIP_BYTES = 1_500_000; // 1.5 MiB bounded upload clip

export const DEFAULT_CLOUD_CONFIG: AudioMatchCloudConfig = {
  provider: 'off',
  acrHost: 'identify-cn-north-1.acrcloud.cn',
  acrAccessKey: '',
  acrAccessSecret: '',
  auddToken: '',
};

// Pure TypeScript UTF-8 / Base64 / SHA-1 / HMAC-SHA1 (Hermes & Node compatible)
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1]! : 0;
    const c = hasC ? bytes[i + 2]! : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out += B64_CHARS[(triplet >>> 18) & 63];
    out += B64_CHARS[(triplet >>> 12) & 63];
    out += hasB ? B64_CHARS[(triplet >>> 6) & 63] : '=';
    out += hasC ? B64_CHARS[triplet & 63] : '=';
  }
  return out;
}

export function base64ToBytes(raw: string): Uint8Array {
  const clean = raw.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  if (!len || len % 4 !== 0) return new Uint8Array(0);
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((len / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_CHARS.indexOf(clean[i]!);
    const b = B64_CHARS.indexOf(clean[i + 1]!);
    const c = clean[i + 2] === '=' ? 0 : B64_CHARS.indexOf(clean[i + 2]!);
    const d = clean[i + 3] === '=' ? 0 : B64_CHARS.indexOf(clean[i + 3]!);
    const t = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (t >>> 16) & 0xff;
    if (clean[i + 2] !== '=') out[o++] = (t >>> 8) & 0xff;
    if (clean[i + 3] !== '=') out[o++] = t & 0xff;
  }
  return out;
}

function utf8Bytes(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i++;
      }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >>> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) out.push(0xe0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
    else out.push(0xf0 | (code >>> 18), 0x80 | ((code >>> 12) & 0x3f), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(out);
}

function sha1Bytes(input: Uint8Array): Uint8Array {
  const bitLenHi = Math.floor((input.length * 8) / 0x100000000);
  const bitLenLo = (input.length * 8) >>> 0;
  const paddedLen = Math.ceil((input.length + 9) / 64) * 64;
  const msg = new Uint8Array(paddedLen);
  msg.set(input);
  msg[input.length] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(paddedLen - 8, bitLenHi, false);
  dv.setUint32(paddedLen - 4, bitLenLo, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rol = (n: number, c: number) => ((n << c) | (n >>> (32 - c))) >>> 0;

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f = 0;
      let k = 0;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rol(a, 5) + f + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const digest = new Uint8Array(20);
  const outDv = new DataView(digest.buffer);
  outDv.setUint32(0, h0, false);
  outDv.setUint32(4, h1, false);
  outDv.setUint32(8, h2, false);
  outDv.setUint32(12, h3, false);
  outDv.setUint32(16, h4, false);
  return digest;
}

export function hmacSha1Base64(secret: string, message: string): string {
  const blockSize = 64;
  let keyBytes = utf8Bytes(secret);
  if (keyBytes.length > blockSize) keyBytes = sha1Bytes(keyBytes);
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyBytes);

  const oPad = new Uint8Array(blockSize);
  const iPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oPad[i] = paddedKey[i]! ^ 0x5c;
    iPad[i] = paddedKey[i]! ^ 0x36;
  }
  const msgBytes = utf8Bytes(message);
  const inner = new Uint8Array(blockSize + msgBytes.length);
  inner.set(iPad);
  inner.set(msgBytes, blockSize);
  const innerHash = sha1Bytes(inner);

  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(oPad);
  outer.set(innerHash, blockSize);
  return bytesToBase64(sha1Bytes(outer));
}

function sanitizeHost(raw: string): string {
  const cleaned = raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (!/^[a-z0-9.-]{3,128}$/.test(cleaned) || cleaned.startsWith('.') || cleaned.endsWith('.')) {
    throw new Error('ACRCloud Host 地址格式无效，例如 identify-cn-north-1.acrcloud.cn');
  }
  return cleaned;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export async function identifyWithACRCloud(
  audioBytes: Uint8Array,
  filename: string,
  config: { host: string; accessKey: string; accessSecret: string },
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AudioMatchCloudResult | null> {
  const host = sanitizeHost(config.host);
  const accessKey = config.accessKey.trim();
  const accessSecret = config.accessSecret.trim();
  if (!accessKey || !accessSecret) {
    throw new Error('请先填写 ACRCloud Access Key 与 Access Secret');
  }
  const clip = audioBytes.length > MAX_UPLOAD_CLIP_BYTES ? audioBytes.slice(0, MAX_UPLOAD_CLIP_BYTES) : audioBytes;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const stringToSign = `POST\n/v1/identify\n${accessKey}\naudio\n1\n${timestamp}`;
  const signature = hmacSha1Base64(accessSecret, stringToSign);
  const boundary = `----NexusAudioMatch${timestamp}Boundary`;
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_') || 'clip.wav';

  const field = (name: string, value: string) =>
    utf8Bytes(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  const body = concatBytes([
    field('access_key', accessKey),
    field('data_type', 'audio'),
    field('signature_version', '1'),
    field('signature', signature),
    field('sample_bytes', String(clip.length)),
    field('timestamp', timestamp),
    utf8Bytes(`--${boundary}\r\nContent-Disposition: form-data; name="sample"; filename="${safeName}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    clip,
    utf8Bytes(`\r\n--${boundary}--\r\n`),
  ]);

  const resp = await fetchFn(`https://${host}/v1/identify`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: body as unknown as BodyInit,
    signal,
  });
  if (!resp.ok) throw new Error(`ACRCloud 服务返回 HTTP ${resp.status}，请检查 Host 或网络`);
  const json = (await resp.json()) as {
    status?: { code?: number; msg?: string };
    metadata?: {
      music?: Array<{
        title?: string;
        artists?: Array<{ name?: string }>;
        album?: { name?: string };
        release_date?: string;
        score?: number;
      }>;
    };
  };
  const code = json?.status?.code;
  if (code === 1001) return null;
  if (code !== 0) {
    if (code === 3001 || code === 3014) throw new Error('ACRCloud Key 或签名无效，请核对 Access Key / Secret');
    if (code === 3003 || code === 3015) throw new Error('ACRCloud 当日免费识别额度已用完');
    throw new Error(`ACRCloud 识别失败：${json?.status?.msg || `错误码 ${code}`}`);
  }
  const hit = json.metadata?.music?.[0];
  if (!hit?.title) return null;
  const artist = (hit.artists ?? []).map(a => a.name).filter(Boolean).join(' / ') || '未知歌手';
  return {
    provider: 'acrcloud',
    title: hit.title.trim(),
    artist,
    ...(hit.album?.name ? { album: hit.album.name.trim() } : {}),
    ...(hit.release_date ? { releaseDate: hit.release_date } : {}),
    ...(typeof hit.score === 'number' ? { score: hit.score } : {}),
  };
}

export async function identifyWithAudD(
  audioBase64: string,
  token: string,
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AudioMatchCloudResult | null> {
  const effectiveToken = token.trim() || 'test';
  const params = `api_token=${encodeURIComponent(effectiveToken)}&audio=${encodeURIComponent(audioBase64)}&return=apple_music`;
  const resp = await fetchFn('https://api.audd.io/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: params,
    signal,
  });
  if (!resp.ok) throw new Error(`AudD 服务返回 HTTP ${resp.status}，请稍后重试`);
  const json = (await resp.json()) as {
    status?: string;
    result?: { title?: string; artist?: string; album?: string; release_date?: string } | null;
    error?: { error_code?: number; error_message?: string };
  };
  if (json?.status === 'error') {
    const code = json.error?.error_code;
    if (code === 900 || code === 901) {
      throw new Error(
        effectiveToken === 'test'
          ? 'AudD 公共体验额度已达上限，请在下方填入免费申请的个人 AudD Token 或 ACRCloud Key'
          : 'AudD Token 无效或免费额度已用尽，请检查 Token',
      );
    }
    throw new Error(`AudD 识别失败：${json.error?.error_message || '服务暂不可用'}`);
  }
  const hit = json?.result;
  if (!hit?.title) return null;
  return {
    provider: 'audd',
    title: hit.title.trim(),
    artist: (hit.artist || '未知歌手').trim(),
    ...(hit.album ? { album: hit.album.trim() } : {}),
    ...(hit.release_date ? { releaseDate: hit.release_date } : {}),
  };
}

export function assessAcousticSignal(capture: AudioMatchCaptureResult): {
  quality: 'too-quiet' | 'good' | 'loud';
  summary: string;
} {
  if (capture.cancelled) {
    return { quality: 'too-quiet', summary: '已取消监听' };
  }
  if (capture.peakLevel < 0.015 || capture.avgLevel < 0.004) {
    return {
      quality: 'too-quiet',
      summary: '环境音过弱，请靠近扬声器重新点击识曲，或在下方输入歌词秒搜',
    };
  }
  if (capture.peakLevel > 0.85) {
    return {
      quality: 'loud',
      summary: `已采集 ${(capture.durationMs / 1000).toFixed(1)}s 声纹片段（信号较强，指纹 ${capture.energySignature.slice(0, 8)}）`,
    };
  }
  return {
    quality: 'good',
    summary: `已采集 ${(capture.durationMs / 1000).toFixed(1)}s 声纹片段（${capture.sampleRate}Hz · 指纹 ${capture.energySignature.slice(0, 8)}）`,
  };
}

const initialState: AudioMatchState = {
  listening: false,
  identifying: false,
  level: 0,
  elapsedMs: 0,
  lastCapture: null,
  lastCloudMatch: null,
  cloudConfig: DEFAULT_CLOUD_CONFIG,
  results: [],
  history: [],
  searching: false,
  hint: '选择识曲引擎后轻触麦克风，将自动录制环境片段并上传识曲；亦可直接输入歌词秒搜',
  error: '',
};

export class AudioMatchCoordinator {
  private state: AudioMatchState = initialState;
  private listeners = new Set<() => void>();
  private native: AudioMatchNativeBridge | null;
  private repo?: Pick<Repository, 'get' | 'put'>;
  private secrets?: MusicSecretStore;
  private fetchFn: typeof fetch;
  private searchFn: (platform: OnlinePlatform, query: string, page: number, signal: AbortSignal, limit?: number) => Promise<{ items: readonly Track[] }>;
  private levelSub: { remove(): void } | null = null;

  constructor(deps: {
    native: AudioMatchNativeBridge | null;
    repository?: Pick<Repository, 'get' | 'put'>;
    secrets?: MusicSecretStore;
    fetchFn?: typeof fetch;
    search: (platform: OnlinePlatform, query: string, page: number, signal: AbortSignal, limit?: number) => Promise<{ items: readonly Track[] }>;
  }) {
    this.native = deps.native;
    this.repo = deps.repository;
    this.secrets = deps.secrets;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.searchFn = deps.search;
  }

  getSnapshot = (): AudioMatchState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<AudioMatchState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  async restore(): Promise<void> {
    let history: AudioMatchHistoryEntry[] = [];
    let provider: AudioMatchCloudProvider = 'off';
    let acrHost = DEFAULT_CLOUD_CONFIG.acrHost;
    if (this.repo) {
      try {
        const saved = await this.repo.get<{
          version?: number;
          history?: AudioMatchHistoryEntry[];
          cloud?: { provider?: AudioMatchCloudProvider; acrHost?: string };
        }>(STORAGE_KEY);
        if (saved && Array.isArray(saved.history)) {
          history = saved.history.slice(0, 30);
        }
        if (saved?.cloud?.provider && ['off', 'acrcloud', 'audd'].includes(saved.cloud.provider)) {
          provider = saved.cloud.provider;
        }
        if (typeof saved?.cloud?.acrHost === 'string' && saved.cloud.acrHost.trim()) {
          acrHost = saved.cloud.acrHost.trim();
        }
      } catch {}
    }
    let acrAccessKey = '';
    let acrAccessSecret = '';
    let auddToken = '';
    if (this.secrets) {
      try {
        const raw = await this.secrets.get(SECRETS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (typeof parsed.acrAccessKey === 'string') acrAccessKey = parsed.acrAccessKey;
          if (typeof parsed.acrAccessSecret === 'string') acrAccessSecret = parsed.acrAccessSecret;
          if (typeof parsed.auddToken === 'string') auddToken = parsed.auddToken;
        }
      } catch {}
    }
    this.setState({
      history,
      cloudConfig: { provider, acrHost, acrAccessKey, acrAccessSecret, auddToken },
    });
  }

  async saveCloudConfig(patch: Partial<AudioMatchCloudConfig>): Promise<void> {
    const next: AudioMatchCloudConfig = {
      provider: patch.provider ?? this.state.cloudConfig.provider,
      acrHost: (patch.acrHost ?? this.state.cloudConfig.acrHost).trim() || DEFAULT_CLOUD_CONFIG.acrHost,
      acrAccessKey: (patch.acrAccessKey ?? this.state.cloudConfig.acrAccessKey).trim(),
      acrAccessSecret: (patch.acrAccessSecret ?? this.state.cloudConfig.acrAccessSecret).trim(),
      auddToken: (patch.auddToken ?? this.state.cloudConfig.auddToken).trim(),
    };
    if (this.secrets) {
      await this.secrets.set(
        SECRETS_KEY,
        JSON.stringify({
          acrAccessKey: next.acrAccessKey,
          acrAccessSecret: next.acrAccessSecret,
          auddToken: next.auddToken,
        }),
      );
    }
    if (this.repo) {
      await this.repo.put(STORAGE_KEY, {
        version: 2,
        history: this.state.history,
        cloud: { provider: next.provider, acrHost: next.acrHost },
      });
    }
    this.setState({
      cloudConfig: next,
      error: '',
      hint:
        next.provider === 'acrcloud'
          ? '已选择 ACRCloud：轻触麦克风将自动录制环境音频并上传识别'
          : next.provider === 'audd'
            ? next.auddToken
              ? '已选择 AudD：轻触麦克风将自动录制环境音频并上传识别'
              : '已选择 AudD（公共体验额度）：轻触麦克风即录即识，建议填入个人免费 Token'
            : '已切换为本机离线声纹 + 歌词秒搜模式',
    });
  }

  async identifyAudioClip(input: {
    bytes?: Uint8Array;
    base64?: string;
    filename?: string;
    overrideProvider?: 'acrcloud' | 'audd';
  }): Promise<AudioMatchCloudResult | null> {
    const cfg = this.state.cloudConfig;
    const provider = input.overrideProvider ?? (cfg.provider === 'off' ? 'audd' : cfg.provider);
    let rawBytes = input.bytes;
    let rawBase64 = input.base64;
    if (!rawBytes && rawBase64) {
      rawBytes = base64ToBytes(rawBase64);
    }
    if (!rawBytes || rawBytes.length < 1024) {
      this.setState({ error: '音频片段为空或过短，请选择有效音频文件或靠近声源重新采样' });
      return null;
    }
    if (rawBytes.length > MAX_UPLOAD_CLIP_BYTES) {
      rawBytes = rawBytes.slice(0, MAX_UPLOAD_CLIP_BYTES);
      rawBase64 = undefined;
    }
    if (!rawBase64) {
      rawBase64 = bytesToBase64(rawBytes);
    }

    this.setState({
      identifying: true,
      error: '',
      lastCloudMatch: null,
      hint: provider === 'acrcloud' ? '正在上传音频片段至 ACRCloud 识别…' : '正在上传音频片段至 AudD 识别…',
    });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const hit =
        provider === 'acrcloud'
          ? await identifyWithACRCloud(
              rawBytes,
              input.filename || 'clip.wav',
              { host: cfg.acrHost, accessKey: cfg.acrAccessKey, accessSecret: cfg.acrAccessSecret },
              this.fetchFn,
              ctrl.signal,
            )
          : await identifyWithAudD(rawBase64, cfg.auddToken, this.fetchFn, ctrl.signal);

      if (!hit) {
        this.setState({
          identifying: false,
          hint: '未能从该片段匹配到曲目，请尝试截取副歌/人声清晰段落或输入一句歌词秒搜',
        });
        return null;
      }

      this.setState({
        identifying: false,
        lastCloudMatch: hit,
        hint: `已识别：《${hit.title}》- ${hit.artist}，正在匹配音枢可播曲源…`,
      });
      await this.searchByLyricOrPhrase(`${hit.title} ${hit.artist}`, ['wy', 'tx', 'kg']);
      return hit;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '音频片段上传识别失败，请检查网络或 Key 配置';
      this.setState({
        identifying: false,
        error: msg,
        hint: '云端音频片段识别未成功，你仍可在下方输入听到的歌词片段跨平台秒搜',
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async startListening(durationMs = 6000): Promise<AudioMatchCaptureResult | null> {
    if (!this.native) {
      this.setState({ error: '当前环境不支持原生麦克风识曲采样' });
      return null;
    }
    this.setState({ error: '', lastCloudMatch: null, hint: '正在检查麦克风权限…' });
    try {
      let perm = await this.native.audioMatchPermission();
      if (perm !== 'granted') {
        const ok = await this.native.audioMatchRequestPermission();
        if (!ok) {
          this.setState({ error: '需要麦克风权限才能采集环境声音，请在系统设置中授权', listening: false });
          return null;
        }
        perm = 'granted';
      }
      this.levelSub?.remove();
      this.levelSub =
        this.native.addListener?.('onAudioMatchLevel', ev => {
          this.setState({
            level: typeof ev.level === 'number' && Number.isFinite(ev.level) ? ev.level : 0,
            elapsedMs: typeof ev.elapsedMs === 'number' ? ev.elapsedMs : 0,
          });
        }) ?? null;

      this.setState({ listening: true, level: 0, elapsedMs: 0, hint: '正在聆听环境音频…请靠近声源' });
      const result = await this.native.audioMatchStart(durationMs);
      this.levelSub?.remove();
      this.levelSub = null;
      const assessment = assessAcousticSignal(result);
      const canCloud =
        !result.cancelled &&
        assessment.quality !== 'too-quiet' &&
        !!result.audioBase64 &&
        this.state.cloudConfig.provider !== 'off';

      this.setState({
        listening: false,
        level: 0,
        lastCapture: result,
        hint: canCloud
          ? `${assessment.summary}，正在自动上传至 ${this.state.cloudConfig.provider === 'acrcloud' ? 'ACRCloud' : 'AudD'} 识曲…`
          : `${assessment.summary}。${
              assessment.quality !== 'too-quiet'
                ? '当前为本机离线模式，可在下方切换 AudD / ACRCloud 自动上传识曲，或输入听到的歌词秒搜。'
                : '请靠近声源重新识曲，或输入听到的歌词秒搜。'
            }`,
      });

      if (canCloud && result.audioBase64) {
        await this.identifyAudioClip({ base64: result.audioBase64, filename: 'mic-clip.wav' });
      }
      return result;
    } catch (err) {
      this.levelSub?.remove();
      this.levelSub = null;
      this.setState({
        listening: false,
        level: 0,
        error: err instanceof Error ? err.message : '麦克风采集失败，请重试',
      });
      return null;
    }
  }

  async stopListening(): Promise<void> {
    this.levelSub?.remove();
    this.levelSub = null;
    await this.native?.audioMatchStop().catch(() => {});
    this.setState({ listening: false, level: 0 });
  }

  async searchByLyricOrPhrase(phrase: string, platforms: readonly OnlinePlatform[] = ['wy', 'tx']): Promise<readonly Track[]> {
    const q = phrase.trim();
    if (!q) return [];
    this.setState({ searching: true, error: '', hint: `正在跨平台检索「${q}」…` });
    const ctrl = new AbortController();
    try {
      const batches = await Promise.all(
        platforms.map(p => this.searchFn(p, q, 1, ctrl.signal, 10).then(r => r.items).catch(() => [] as readonly Track[])),
      );
      const seen = new Set<string>();
      const merged: Track[] = [];
      for (const list of batches) {
        for (const t of list) {
          const k = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(t);
          }
        }
      }
      this.setState({
        searching: false,
        results: merged.slice(0, 20),
        hint: merged.length ? `已找到 ${merged.length} 首候选曲目，点击即可播放` : '未找到匹配曲目，请尝试更换一句更清晰的歌词',
      });
      return merged;
    } catch {
      this.setState({ searching: false, error: '跨平台识曲检索失败，请稍后重试' });
      return [];
    }
  }

  async recordMatch(track: Track, method: AudioMatchHistoryEntry['method'] = 'lyric-phrase'): Promise<void> {
    const cleaned = cleanTrack(track);
    const entry: AudioMatchHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      track: cleaned,
      matchedAt: Date.now(),
      method,
      ...(this.state.lastCapture?.energySignature ? { signature: this.state.lastCapture.energySignature } : {}),
    };
    const next = [entry, ...this.state.history.filter(h => h.track.title !== cleaned.title || h.track.artist !== cleaned.artist)].slice(0, 30);
    this.setState({ history: next });
    if (this.repo) {
      await this.repo
        .put(STORAGE_KEY, {
          version: 2,
          history: next,
          cloud: { provider: this.state.cloudConfig.provider, acrHost: this.state.cloudConfig.acrHost },
        })
        .catch(() => {});
    }
  }

  async clearHistory(): Promise<void> {
    this.setState({ history: [] });
    if (this.repo) {
      await this.repo
        .put(STORAGE_KEY, {
          version: 2,
          history: [],
          cloud: { provider: this.state.cloudConfig.provider, acrHost: this.state.cloudConfig.acrHost },
        })
        .catch(() => {});
    }
  }
}
