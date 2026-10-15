import type { Track } from '../domain/track.ts';
import { fallbackQualities, normalizeQuality, type Quality } from '../domain/quality.ts';
import type { MediaResolver, ResolvedMedia } from '../playback/controller.ts';
import { makeLXRequest } from './lx.ts';
import { type SourceState, SourceRegistry } from './sourceRegistry.ts';
import { bounded, DeadlineError, throwIfAborted } from './async.ts';

export interface LXTransport {
  request(source: SourceState, payload: ReturnType<typeof makeLXRequest>, signal: AbortSignal): Promise<unknown>;
}
export interface RoutedMedia extends ResolvedMedia {
  sourceId: string; sourceRevision: number; requestedQuality: Quality; quality: Quality; scriptQuality: string;
}
export interface RouteAttempt { sourceId: string; quality: Quality; reason: 'failed' | 'timeout' | 'invalid-url' | 'source-changed' }
export class RoutingError extends Error {
  readonly attempts: readonly RouteAttempt[];
  constructor(attempts: readonly RouteAttempt[]) { super('已启用音源未能返回可用地址，请检查音源或更换歌曲'); this.attempts = attempts; }
}

function mediaURL(result: unknown): string | undefined {
  const value = typeof result === 'string' ? result : result && typeof result === 'object' ? (result as { url?: unknown }).url : undefined;
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (url.hostname && ['https:', 'http:'].includes(url.protocol)) return url.toString(); }
  catch { /* No script output/URL in diagnostics. */ }
}

export class MultiSourceResolver implements MediaResolver {
  private registry: SourceRegistry; private transport: LXTransport; private preference: () => Quality;
  private timeoutMs: number;
  constructor(registry: SourceRegistry, transport: LXTransport, preference: () => Quality, timeoutMs = 8000) {
    this.registry = registry; this.transport = transport; this.preference = preference; this.timeoutMs = timeoutMs;
  }
  async resolve(track: Track, signal: AbortSignal, excluded: ReadonlySet<string> = new Set()): Promise<RoutedMedia> {
    throwIfAborted(signal);
    if (track.origin.kind !== 'online') throw new Error('LX仅处理在线平台歌曲');
    const platform = track.origin.platform;
    const preference = this.preference();
    const sources = this.registry.getSnapshot().filter(source => this.registry.isCurrent(source));
    const attempts: RouteAttempt[] = [];
    for (const quality of fallbackQualities(preference)) {
      for (const source of sources) {
        throwIfAborted(signal);
        if (!this.registry.isCurrent(source)) continue;
        const routeKey = JSON.stringify([source.id, source.revision, quality]);
        if (excluded.has(routeKey)) continue;
        const capability = source.capabilities.find(item => item.platform === platform && item.actions.includes('musicUrl'));
        const scriptQuality = capability?.qualities.find(type => normalizeQuality(type) === quality);
        if (!capability || !scriptQuality) continue;
        try {
          const result = await bounded(child => this.transport.request(source, makeLXRequest(track, scriptQuality, capability), child), signal, this.timeoutMs);
          throwIfAborted(signal);
          if (!this.registry.isCurrent(source)) { attempts.push({ sourceId: source.id, quality, reason: 'source-changed' }); continue; }
          const url = mediaURL(result);
          if (!url) { attempts.push({ sourceId: source.id, quality, reason: 'invalid-url' }); continue; }
          return { url, routeKey, sourceId: source.id, sourceRevision: source.revision, requestedQuality: preference, quality, scriptQuality };
        } catch (error) {
          throwIfAborted(signal);
          attempts.push({ sourceId: source.id, quality, reason: error instanceof DeadlineError ? 'timeout' : 'failed' });
        }
      }
    }
    throw new RoutingError(attempts);
  }
}
