import {advance} from '../domain/queue.ts';
import {trackKey,type Track} from '../domain/track.ts';
import type {Quality} from '../domain/quality.ts';
import type {PlaybackController,ResolvedMedia} from './controller.ts';
import type {PlaybackTraceSink} from './diagnostics.ts';

interface CachedMedia {
  media: ResolvedMedia;
  expiresAt: number;
}

export class PreloadCache {
  private entries = new Map<string, CachedMedia>();
  private maxEntries: number;
  private ttlMs: number;
  private now: () => number;
  constructor(options: {maxEntries?: number; ttlMs?: number; now?: () => number} = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 12);
    this.ttlMs = Math.max(1000, options.ttlMs ?? 180_000);
    this.now = options.now ?? Date.now;
  }
  private key(track: Track, quality: Quality, revision: string) {
    return JSON.stringify([trackKey(track.origin), quality, revision]);
  }
  get(track: Track, quality: Quality, revision: string): ResolvedMedia | undefined {
    const k = this.key(track, quality, revision);
    const entry = this.entries.get(k);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(k);
      return undefined;
    }
    this.entries.delete(k);
    this.entries.set(k, entry);
    return entry.media;
  }
  set(track: Track, quality: Quality, revision: string, media: ResolvedMedia) {
    const k = this.key(track, quality, revision);
    this.entries.delete(k);
    this.entries.set(k, {media, expiresAt: this.now() + this.ttlMs});
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
  delete(track: Track, quality: Quality, revision: string) {
    this.entries.delete(this.key(track, quality, revision));
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
}

export interface PreloadOptions {
  cache: PreloadCache;
  controller: PlaybackController;
  enabled: () => boolean;
  count: () => number;
  intervalMs?: () => number;
  repeat: () => 'off' | 'all' | 'one';
  qualityFor: (track: Track) => Quality;
  sourceRevision: () => string;
  resolve: (track: Track, signal: AbortSignal, trace?: PlaybackTraceSink) => Promise<ResolvedMedia>;
}

export function startPreloadCoordinator(options: PreloadOptions) {
  let abort = new AbortController();
  let lastTriggerKey = '';
  let disposed = false;

  const cancel = () => {
    abort.abort();
    abort = new AbortController();
  };

  const schedule = () => {
    if (disposed || !options.enabled()) {
      cancel();
      return;
    }
    const state = options.controller.getSnapshot();
    if (state.phase !== 'ready' || state.intent !== 'playing' || !state.queue.currentId) return;
    const revision = options.sourceRevision();
    const triggerKey = `${state.queue.currentId}:${state.token?.generation ?? 0}:${revision}`;
    if (triggerKey === lastTriggerKey) return;
    lastTriggerKey = triggerKey;
    cancel();
    const signal = abort.signal;
    const limit = Math.max(1, Math.min(3, Math.round(options.count())));
    const targets: Track[] = [];
    const seen = new Set<string>();
    let cursor = state.queue;
    const repeatMode = options.repeat() === 'all' ? 'all' : 'off';
    for (let i = 0; i < limit; i++) {
      const next = advance(cursor, repeatMode);
      if (!next.currentId || next.currentId === cursor.currentId) break;
      cursor = next;
      const entry = cursor.entries.find(item => item.id === cursor.currentId);
      if (!entry) break;
      if (entry.track.origin.kind !== 'online' && entry.track.origin.kind !== 'imported') continue;
      const key = trackKey(entry.track.origin);
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(entry.track);
    }
    if (!targets.length) return;
    const delayMs = Math.max(0, options.intervalMs?.() ?? 2500);
    void (async () => {
      for (let i = 0; i < targets.length; i++) {
        if (signal.aborted) return;
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, i === 0 ? Math.min(delayMs, 1500) : delayMs);
          signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, {once: true});
        });
        if (signal.aborted || !options.enabled()) return;
        const track = targets[i]!;
        const q = options.qualityFor(track);
        const rev = options.sourceRevision();
        if (options.cache.get(track, q, rev)) continue;
        try {
          const media = await options.resolve(track, signal);
          if (!signal.aborted && options.sourceRevision() === rev) {
            options.cache.set(track, q, rev, media);
          }
        } catch {
          // Best-effort background preload; failures stay silent until played.
        }
      }
    })();
  };

  const unsubscribe = options.controller.subscribe(schedule);
  return {
    invalidate() {
      lastTriggerKey = '';
      cancel();
      options.cache.clear();
    },
    refresh: schedule,
    dispose() {
      disposed = true;
      cancel();
      unsubscribe();
    },
  };
}
