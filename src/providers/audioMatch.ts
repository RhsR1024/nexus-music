// Audio Match (听歌识曲) microphone sampling + lyric/hum quick-match coordinator (Item #7).
import type { OnlinePlatform, Track } from '../domain/track.ts';
import { cleanTrack } from '../storage/cleanTrack.ts';
import type { Repository } from '../storage/repository.ts';

export interface AudioMatchCaptureResult {
  readonly durationMs: number;
  readonly sampleRate: number;
  readonly avgLevel: number;
  readonly peakLevel: number;
  readonly zeroCrossings: number;
  readonly energySignature: string;
  readonly cancelled: boolean;
}

export interface AudioMatchHistoryEntry {
  readonly id: string;
  readonly track: Track;
  readonly matchedAt: number;
  readonly method: 'acoustic-search' | 'lyric-phrase';
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
  readonly level: number;
  readonly elapsedMs: number;
  readonly lastCapture: AudioMatchCaptureResult | null;
  readonly results: readonly Track[];
  readonly history: readonly AudioMatchHistoryEntry[];
  readonly searching: boolean;
  readonly hint: string;
  readonly error: string;
}

const STORAGE_KEY = 'audioMatch.v1';

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
      summary: '环境音过弱，请靠近扬声器重试，或在下方输入听到的歌词片段秒搜',
    };
  }
  if (capture.peakLevel > 0.85) {
    return {
      quality: 'loud',
      summary: `已采集 ${(capture.durationMs / 1000).toFixed(1)}s 声纹特征（信号较强，指纹 ${capture.energySignature.slice(0, 8)}）`,
    };
  }
  return {
    quality: 'good',
    summary: `已采集 ${(capture.durationMs / 1000).toFixed(1)}s 声纹特征（${capture.sampleRate}Hz · 指纹 ${capture.energySignature.slice(0, 8)}）`,
  };
}

const initialState: AudioMatchState = {
  listening: false,
  level: 0,
  elapsedMs: 0,
  lastCapture: null,
  results: [],
  history: [],
  searching: false,
  hint: '轻触麦克风采样周围音乐声纹，或直接输入听到的歌词/旋律关键词跨平台秒搜',
  error: '',
};

export class AudioMatchCoordinator {
  private state: AudioMatchState = initialState;
  private listeners = new Set<() => void>();
  private native: AudioMatchNativeBridge | null;
  private repo?: Pick<Repository, 'get' | 'put'>;
  private searchFn: (platform: OnlinePlatform, query: string, page: number, signal: AbortSignal, limit?: number) => Promise<{ items: readonly Track[] }>;
  private levelSub: { remove(): void } | null = null;

  constructor(deps: {
    native: AudioMatchNativeBridge | null;
    repository?: Pick<Repository, 'get' | 'put'>;
    search: (platform: OnlinePlatform, query: string, page: number, signal: AbortSignal, limit?: number) => Promise<{ items: readonly Track[] }>;
  }) {
    this.native = deps.native;
    this.repo = deps.repository;
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
    if (!this.repo) return;
    try {
      const saved = await this.repo.get<{ version?: number; history?: AudioMatchHistoryEntry[] }>(STORAGE_KEY);
      if (saved && Array.isArray(saved.history)) {
        this.setState({ history: saved.history.slice(0, 30) });
      }
    } catch {}
  }

  async startListening(durationMs = 6000): Promise<AudioMatchCaptureResult | null> {
    if (!this.native) {
      this.setState({ error: '当前环境不支持原生麦克风识曲采样' });
      return null;
    }
    this.setState({ error: '', hint: '正在检查麦克风权限…' });
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
      this.setState({
        listening: false,
        level: 0,
        lastCapture: result,
        hint: `${assessment.summary}。当前为离线隐私声纹模式（未连接第三方商业闭源识曲云库），可输入任意一句歌词立即定位原曲。`,
      });
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
      await this.repo.put(STORAGE_KEY, { version: 1, history: next }).catch(() => {});
    }
  }

  async clearHistory(): Promise<void> {
    this.setState({ history: [] });
    if (this.repo) {
      await this.repo.put(STORAGE_KEY, { version: 1, history: [] }).catch(() => {});
    }
  }
}
