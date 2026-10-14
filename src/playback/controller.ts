import { currentEntry, advance, type QueueState } from '../domain/queue.ts';
import type { Track } from '../domain/track.ts';

export interface ResolvedMedia {
  url: string;
  headers?: Readonly<Record<string, string>>;
  quality?: string;
}

export interface MediaResolver {
  resolve(track: Track, signal: AbortSignal): Promise<ResolvedMedia>;
}

export interface PlaybackToken { entryId: string; generation: number }

// Native adapters must atomically ignore commands/events older than generation.
// These commands enqueue synchronously; native completion arrives as tagged events.
export interface PlaybackBackend {
  stop(generation: number): void;
  load(media: ResolvedMedia, token: PlaybackToken): void;
  play(token: PlaybackToken): void;
  pause(generation: number): void;
}

export interface PlaybackState {
  queue: QueueState;
  intent: 'playing' | 'paused';
  phase: 'idle' | 'resolving' | 'ready' | 'error';
  error: string | null;
  token: PlaybackToken | null;
}

export class PlaybackController {
  private generation = 0;
  private pending: AbortController | undefined;
  private disposed = false;
  private listeners = new Set<() => void>();
  private state: PlaybackState;
  private resolver: MediaResolver;
  private backend: PlaybackBackend;

  constructor(resolver: MediaResolver, backend: PlaybackBackend, queue: QueueState) {
    this.resolver = resolver;
    this.backend = backend;
    this.state = { queue, intent: 'paused', phase: 'idle', error: null, token: null };
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

  private invalidate(): number {
    this.pending?.abort();
    this.pending = undefined;
    return ++this.generation;
  }

  async play(queue = this.state.queue): Promise<void> {
    if (this.disposed) throw new Error('播放器已释放');
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
    this.update({ queue, intent: 'playing', phase: 'resolving', error: null, token });
    try {
      const media = await this.resolver.resolve(entry.track, pending.signal);
      if (pending.signal.aborted || generation !== this.generation || this.disposed) return;
      const url = new URL(media.url);
      if (!['https:', 'http:', 'file:'].includes(url.protocol)) throw new Error('音频地址协议不支持');
      this.backend.load(media, token);
      if (this.state.intent === 'playing' && generation === this.generation) this.backend.play(token);
      this.update({ phase: 'ready' });
    } catch {
      if (pending.signal.aborted || generation !== this.generation || this.disposed) return;
      // Resolver errors can contain private tokens/URLs; do not surface raw messages.
      this.update({ phase: 'error', intent: 'paused', error: '无法获取或加载歌曲，请重试或检查来源配置' });
    }
  }

  pause(): void {
    if (this.disposed) return;
    const generation = this.invalidate();
    this.backend.pause(generation);
    this.update({ intent: 'paused', phase: 'idle', token: null });
  }

  setQueue(queue: QueueState): void {
    if (this.disposed) throw new Error('播放器已释放');
    const changed = queue.currentId !== this.state.queue.currentId ||
      currentEntry(queue)?.track !== currentEntry(this.state.queue)?.track;
    if (changed) {
      this.backend.stop(this.invalidate());
      this.update({ queue, token: null, phase: 'idle', intent: 'paused', error: null });
    } else this.update({ queue });
  }

  async onEnded(token: PlaybackToken): Promise<void> {
    if (this.disposed || this.state.intent !== 'playing' ||
      token.generation !== this.generation || token.entryId !== this.state.queue.currentId) return;
    await this.play(advance(this.state.queue));
  }

  dispose(): void {
    if (this.disposed) return;
    this.backend.stop(this.invalidate());
    this.disposed = true;
    this.listeners.clear();
  }
}
