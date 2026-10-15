import {PlaybackMessageError} from './errors.ts';
import { currentEntry, advance, type QueueState } from '../domain/queue.ts';
import type { Track } from '../domain/track.ts';

export interface ResolvedMedia {
  deviceMedia?:boolean;
  url: string;
  headers?: Readonly<Record<string, string>>;
  quality?: string;
  routeKey?: string;
  startPosition?: number;
  cacheKey?: string;
}

export interface MediaResolver {
  resolve(track: Track, signal: AbortSignal, excluded?: ReadonlySet<string>): Promise<ResolvedMedia>;
}

export interface PlaybackToken { entryId: string; generation: number }

// Native adapters must atomically ignore commands/events older than generation.
// These commands enqueue synchronously; native completion arrives as tagged events.
export interface PlaybackBackend {
  stop(generation: number): void;
  load(media: ResolvedMedia, token: PlaybackToken): void;
  play(token: PlaybackToken): void;
  pause(generation: number): void;
  seek?(seconds: number, token: PlaybackToken): void;
}

export interface PlaybackState {
  queue: QueueState;
  intent: 'playing' | 'paused';
  phase: 'idle' | 'resolving' | 'ready' | 'error';
  error: string | null;
  token: PlaybackToken | null;
  position: number;
  duration: number;
  buffering: boolean;
  media: ResolvedMedia | null;
}

export class PlaybackController {
  private generation = 0;
  private pending: AbortController | undefined;
  private disposed = false;
  private listeners = new Set<() => void>();
  private state: PlaybackState;
  private resolver: MediaResolver;
  private backend: PlaybackBackend;
  private playable = false;
  private loadedTrack: Track | undefined;
  private rejectedRoutes = new Set<string>();
  private cursor: {entryId:string;seconds:number}|undefined;

  constructor(resolver: MediaResolver, backend: PlaybackBackend, queue: QueueState) {
    this.resolver = resolver;
    this.backend = backend;
    this.state = { queue, intent: 'paused', phase: 'idle', error: null, token: null, position: 0, duration: 0, buffering: false, media: null };
  }

  getSnapshot = (): PlaybackState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private invalidate(minimum = 0): number {
    this.pending?.abort();
    this.pending = undefined;
    this.generation = Math.max(this.generation + 1, minimum);
    return this.generation;
  }

  async play(queue = this.state.queue): Promise<void> {
    if (this.disposed) throw new Error('播放器已释放');
    this.rejectedRoutes.clear();
    if (this.playable && this.state.intent === 'paused' && queue.currentId === this.state.queue.currentId && currentEntry(queue)?.track === this.loadedTrack) {
      const token = { entryId: queue.currentId!, generation: this.generation };
      this.update({ queue, intent: 'playing', phase: 'ready', token, error: null }); this.backend.play(token); return;
    }
    await this.start(queue);
  }
  private async start(queue: QueueState): Promise<void> {
    if (this.disposed) throw new Error('播放器已释放');
    this.playable = false; this.loadedTrack = undefined;
    const generation = this.invalidate();
    this.backend.stop(generation);
    const entry = currentEntry(queue);
    if (!entry) {
      this.update({ queue, intent: 'paused', phase: 'idle', token: null, error: null });
      return;
    }
    const token = { entryId: entry.id, generation };
    const pending = new AbortController();
    this.pending = pending;
    this.update({ queue, intent: 'playing', phase: 'resolving', error: null, token, position: this.cursor?.entryId===entry.id?this.cursor.seconds:0, duration: 0, media: null });
    try {
      const resolved = await this.resolver.resolve(entry.track, pending.signal, this.rejectedRoutes);
      if (pending.signal.aborted || generation !== this.generation || this.disposed) return;
      const media = this.cursor?.entryId === entry.id ? {...resolved,startPosition:this.cursor.seconds} : resolved;
      const url = new URL(media.url);
      if (!['https:', 'http:', 'file:'].includes(url.protocol)) throw new Error('音频地址协议不支持');
      this.backend.load(media, token);
      if (this.state.intent === 'playing' && generation === this.generation) this.backend.play(token);
      this.update({ phase: 'ready', media });
    } catch (error) {
      if (pending.signal.aborted || generation !== this.generation || this.disposed) return;
      // Resolver errors can contain private tokens/URLs; do not surface raw messages.
      this.update({ phase: 'error', intent: 'paused', error: error instanceof PlaybackMessageError?error.displayMessage:'无法获取或加载歌曲，请重试或检查来源配置' });
    }
  }

  pause(minimumGeneration = 0): void {
    if (this.disposed) return;
    const generation = this.invalidate(minimumGeneration);
    this.backend.pause(generation);
    this.update({ intent: 'paused', phase: this.playable ? 'ready' : 'idle', token: this.playable && this.state.queue.currentId ? { entryId: this.state.queue.currentId, generation } : null, buffering: false });
  }

  setQueue(queue: QueueState): void {
    if (this.disposed) throw new Error('播放器已释放');
    const changed = queue.currentId !== this.state.queue.currentId ||
      currentEntry(queue)?.track !== currentEntry(this.state.queue)?.track;
    if (changed) {
      this.cursor = undefined;
      this.playable = false; this.loadedTrack = undefined;
      this.backend.stop(this.invalidate());
      this.update({ queue, token: null, phase: 'idle', intent: 'paused', error: null, position: 0, duration: 0, media: null });
    } else this.update({ queue });
  }

  async onEnded(token: PlaybackToken): Promise<void> {
    if (this.disposed || this.state.intent !== 'playing' ||
      token.generation !== this.generation || token.entryId !== this.state.queue.currentId) return;
    await this.play(advance(this.state.queue));
  }

  private matches(token: PlaybackToken) { return !this.disposed && token.generation === this.generation && token.entryId === this.state.queue.currentId; }
  onReady(token: PlaybackToken) {
    if (!this.matches(token)) return;
    this.playable = true; this.loadedTrack = currentEntry(this.state.queue)?.track;
    this.cursor = undefined;
    this.update({ phase: 'ready', token });
  }
  onProgress(token: PlaybackToken, position: number, duration: number, buffering: boolean) {
    if (!this.matches(token)) return;
    this.update({ position: Number.isFinite(position) ? Math.max(0, position) : 0,
      duration: Number.isFinite(duration) ? Math.max(0, duration) : 0, buffering });
  }
  seek(seconds: number) {
    if (!this.playable || !this.state.token || !Number.isFinite(seconds)) return;
    const position = Math.max(0, this.state.duration ? Math.min(this.state.duration, seconds) : seconds);
    this.backend.seek?.(position, this.state.token); this.update({ position });
  }
  async onError(token: PlaybackToken) {
    if (!this.matches(token)) return;
    const route = this.state.media?.routeKey;
    this.playable = false;
    if (route && this.state.intent === 'playing' && !this.rejectedRoutes.has(route) && this.rejectedRoutes.size < 64) {
      const seconds=this.state.position||this.state.media?.startPosition||0;
      if(seconds>0)this.cursor={entryId:token.entryId,seconds};
      this.rejectedRoutes.add(route); await this.start(this.state.queue); return;
    }
    this.backend.stop(this.invalidate());
    this.update({ phase: 'error', intent: 'paused', token: null, error: '音频加载失败，请重试或检查来源', buffering: false });
  }
  restoreCursor(entryId:string|null,seconds:number) {
    if(!entryId||entryId!==this.state.queue.currentId||!Number.isFinite(seconds)||seconds<0)return;
    this.cursor={entryId,seconds};this.update({position:seconds});
  }

  dispose(): void {
    if (this.disposed) return;
    this.backend.stop(this.invalidate());
    this.playable = false;
    this.disposed = true;
    this.listeners.clear();
  }
}
