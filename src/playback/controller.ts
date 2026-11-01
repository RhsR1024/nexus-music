import {PlaybackMessageError} from './errors.ts';
import type {
  PlaybackTraceEventInput,
  PlaybackTraceRun,
  PlaybackTraceRunStatus,
  PlaybackTraceSink,
} from './diagnostics.ts';
import {safePlaybackTraceText} from './diagnostics.ts';
import {trackKey,validateTrack} from '../domain/track.ts';
import { currentEntry, advance, type QueueState } from '../domain/queue.ts';
import type { Track } from '../domain/track.ts';

const MAXIMUM_DIAGNOSTIC_RUNS = 6;

export interface ResolvedMedia {
  matchedTrack?:Track;
  resolvedTrack?:Track;
  redirectRoot?:string;cacheOnly?:boolean;
  deviceMedia?:boolean;
  url: string;
  headers?: Readonly<Record<string, string>>;
  quality?: string;
  requestedQuality?: string;
  sourceId?: string;
  sourceName?: string;
  routeKey?: string;
  startPosition?: number;
  cacheKey?: string;
}

export interface MediaResolver {
  resolve(track: Track, signal: AbortSignal, excluded?: ReadonlySet<string>): Promise<ResolvedMedia>;
  resolveWithTrace?(track: Track, signal: AbortSignal, excluded: ReadonlySet<string> | undefined, trace: PlaybackTraceSink): Promise<ResolvedMedia>;
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
  diagnostics: readonly PlaybackTraceRun[];
  // Page-scoped queue lock (Sollin §5): hides per-row queue edits. Only an
  // external rebuild — a play() with different entries — restores editing;
  // natural advancement and in-queue selection keep the lock.
  queueLocked: boolean;
}

// Resolution failures while the user wants to play can skip to the next entry
// (Sollin E-1272). The session installs a handler that advances through its
// normal repeat/shuffle path; returning true suppresses the local error state.
export type ResolveFailureHandler = (queue: QueueState) => boolean | Promise<boolean>;

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
  private resolveFailureHandler: ResolveFailureHandler | undefined;
  private now: () => number;

  constructor(resolver: MediaResolver, backend: PlaybackBackend, queue: QueueState, now: () => number = Date.now) {
    this.resolver = resolver;
    this.backend = backend;
    this.now = now;
    this.state = { queue, intent: 'paused', phase: 'idle', error: null, token: null, position: 0, duration: 0, buffering: false, media: null, diagnostics: [], queueLocked: false };
  }

  setResolveFailureHandler(handler: ResolveFailureHandler | undefined): void { this.resolveFailureHandler = handler; }
  setQueueLocked(locked: boolean): void { if (this.disposed || locked === this.state.queueLocked) return; this.update({ queueLocked: locked }); }

  getSnapshot = (): PlaybackState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private traceRun(token: PlaybackToken): PlaybackTraceRun | undefined {
    return this.state.diagnostics.find(run => run.entryId === token.entryId && run.generation === token.generation);
  }

  private updateTrace(token: PlaybackToken, update: (run: PlaybackTraceRun) => PlaybackTraceRun): void {
    let changed = false;
    const diagnostics = this.state.diagnostics.map(run => {
      if (run.entryId !== token.entryId || run.generation !== token.generation) return run;
      changed = true;
      return update(run);
    });
    if (changed) this.update({diagnostics});
  }

  private trace(token: PlaybackToken): PlaybackTraceSink {
    return input => this.appendTrace(token, input);
  }

  private appendTrace(token: PlaybackToken, input: PlaybackTraceEventInput, status?: PlaybackTraceRunStatus): void {
    this.updateTrace(token, run => {
      if (run.status !== 'running' && status === undefined) return run;
      const at = this.now();
      return {
        ...run,
        finishedAt: status === undefined ? run.finishedAt : at,
        status: status ?? run.status,
        events: [...run.events, {
          sequence: run.events.length,
          at,
          stage: input.stage,
          status: input.status,
          title: safePlaybackTraceText(input.title) ?? '播放链路事件',
          detail: safePlaybackTraceText(input.detail),
          sourceId: safePlaybackTraceText(input.sourceId, 96),
          sourceName: safePlaybackTraceText(input.sourceName, 96),
          platform: safePlaybackTraceText(input.platform, 24),
          quality: safePlaybackTraceText(input.quality, 24),
        }],
      };
    });
  }

  private finishTrace(token: PlaybackToken, status: Exclude<PlaybackTraceRunStatus, 'running'>, title: string, eventStatus: PlaybackTraceEventInput['status'], detail?: string): void {
    const run = this.traceRun(token);
    if (!run || run.status !== 'running') return;
    this.appendTrace(token, {stage:'resolution',status:eventStatus,title,detail},status);
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
    if(this.state.phase==='resolving'&&this.state.token)this.finishTrace(this.state.token,'cancelled','新的播放解析已接管','cancelled');
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
    const rebuilt = queue.entries !== this.state.queue.entries;
    const diagnostics = [...this.state.diagnostics.slice(-(MAXIMUM_DIAGNOSTIC_RUNS - 1)), {
      version:1 as const,
      id:`${generation}:${entry.id}`,
      entryId:entry.id,
      generation,
      trackTitle:safePlaybackTraceText(entry.track.title) ?? '未命名歌曲',
      trackArtist:safePlaybackTraceText(entry.track.artist) ?? '未知歌手',
      startedAt:this.now(),
      status:'running' as const,
      events:[],
    }];
    this.update({ queue, intent: 'playing', phase: 'resolving', error: null, token, position: this.cursor?.entryId===entry.id?this.cursor.seconds:0, duration: 0, media: null, diagnostics, ...(rebuilt ? { queueLocked: false } : {}) });
    try {
      const trace=this.trace(token);
      const resolved = this.resolver.resolveWithTrace
        ? await this.resolver.resolveWithTrace(entry.track,pending.signal,this.rejectedRoutes,trace)
        : await this.resolver.resolve(entry.track,pending.signal,this.rejectedRoutes);
      if (pending.signal.aborted || generation !== this.generation || this.disposed) return;
      const {resolvedTrack,...baseMedia}=resolved;
      const media = this.cursor?.entryId === entry.id ? {...baseMedia,startPosition:this.cursor.seconds} : baseMedia;
      const url = new URL(media.url);
      if (!['https:', 'http:', 'file:'].includes(url.protocol) && !(url.protocol==='ipod-library:'&&entry.track.origin.kind==='device'&&media.deviceMedia===true)) throw new Error('音频地址协议不支持');
      if(resolvedTrack){
        validateTrack(resolvedTrack);if(trackKey(resolvedTrack.origin)!==trackKey(entry.track.origin))throw new Error('解析不能替换原始歌曲身份');
        const queue=this.state.queue;this.update({queue:{...queue,entries:queue.entries.map(item=>item.id===entry.id?{...item,track:resolvedTrack}:item)}});
      }
      if(pending.signal.aborted||generation!==this.generation||this.disposed)return;
      this.appendTrace(token,{
        stage:'resolution',
        status:'success',
        title:'播放地址已确定',
        sourceId:media.sourceId,
        sourceName:media.sourceName,
        quality:media.quality,
        detail:media.requestedQuality && media.quality && media.requestedQuality!==media.quality
          ? `偏好 ${media.requestedQuality}，实际请求 ${media.quality}`
          : media.quality ? `请求档位 ${media.quality}` : undefined,
      });
      if(media.cacheKey)this.appendTrace(token,{stage:'cache',status:'info',title:'已绑定原生媒体缓存身份',detail:media.cacheOnly?'仅允许缓存播放':'可检查缓存命中'});
      this.backend.load(media, token);
      if (this.state.intent === 'playing' && generation === this.generation) this.backend.play(token);
      this.update({ phase: 'ready', media });
    } catch (error) {
      if (pending.signal.aborted || generation !== this.generation || this.disposed) return;
      const message=error instanceof PlaybackMessageError?error.displayMessage:'无法获取或加载歌曲，请重试或检查来源配置';
      if (this.state.intent === 'playing') {
        this.finishTrace(token,'error','当前歌曲解析失败，正在尝试下一首','failed',message);
        const skipped=await this.resolveFailureHandler?.(queue) === true;
        if(skipped)return;
      }
      // Resolver errors can contain private tokens/URLs; do not surface raw messages.
      this.finishTrace(token,'error','解析播放地址失败','failed',message);
      this.update({ phase: 'error', intent: 'paused', error: message });
    }
  }

  pause(minimumGeneration = 0): void {
    if (this.disposed) return;
    if(this.state.phase==='resolving'&&this.state.token)this.finishTrace(this.state.token,'cancelled','播放解析已取消','cancelled');
    const generation = this.invalidate(minimumGeneration);
    this.backend.pause(generation);
    this.update({ intent: 'paused', phase: this.playable ? 'ready' : 'idle', token: this.playable && this.state.queue.currentId ? { entryId: this.state.queue.currentId, generation } : null, buffering: false });
  }
  invalidateMediaFor(track:Track):void {
    const entry=currentEntry(this.state.queue);if(this.disposed||!entry||trackKey(entry.track.origin)!==trackKey(track.origin))return;
    if(this.state.phase==='resolving'&&this.state.token)this.finishTrace(this.state.token,'cancelled','播放媒体已失效','cancelled');
    this.cursor={entryId:entry.id,seconds:this.state.position};this.playable=false;this.loadedTrack=undefined;
    this.backend.stop(this.invalidate());this.update({intent:'paused',phase:'idle',media:null,token:null,error:null,buffering:false});
  }

  setQueue(queue: QueueState): void {
    if (this.disposed) throw new Error('播放器已释放');
    const changed = queue.currentId !== this.state.queue.currentId ||
      currentEntry(queue)?.track !== currentEntry(this.state.queue)?.track;
    if (changed) {
      if(this.state.phase==='resolving'&&this.state.token)this.finishTrace(this.state.token,'cancelled','播放队列已切换','cancelled');
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
  onReady(token: PlaybackToken, detail?:{cached?:boolean;duration?:number}) {
    if (!this.matches(token)) return;
    this.playable = true; this.loadedTrack = currentEntry(this.state.queue)?.track;
    this.cursor = undefined;
    this.appendTrace(token,{
      stage:'native',
      status:'success',
      title:'原生媒体已就绪',
      detail:[detail?.cached===true?'缓存文件解码成功':detail?.cached===false?'网络媒体解码成功':undefined,
        detail?.duration&&Number.isFinite(detail.duration)&&detail.duration>0?`时长 ${detail.duration.toFixed(1)} 秒`:undefined].filter(Boolean).join(' · ')||undefined,
    },'ready');
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
      this.finishTrace(token,'error','原生媒体加载失败，正在重试其他路线','failed');
      this.rejectedRoutes.add(route); await this.start(this.state.queue); return;
    }
    this.finishTrace(token,'error','原生媒体加载失败','failed');
    this.backend.stop(this.invalidate());
    this.update({ phase: 'error', intent: 'paused', token: null, error: '音频加载失败，请重试或检查来源', buffering: false });
  }
  restoreCursor(entryId:string|null,seconds:number) {
    if(!entryId||entryId!==this.state.queue.currentId||!Number.isFinite(seconds)||seconds<0)return;
    this.cursor={entryId,seconds};this.update({position:seconds});
  }

  dispose(): void {
    if (this.disposed) return;
    if(this.state.phase==='resolving'&&this.state.token)this.finishTrace(this.state.token,'cancelled','播放器已释放','cancelled');
    this.backend.stop(this.invalidate());
    this.playable = false;
    this.disposed = true;
    this.listeners.clear();
  }
}
