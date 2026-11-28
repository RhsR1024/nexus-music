import type { MusicPlatform, OnlinePlatform, Track } from '../domain/track.ts';
import { applyPlatformSourceRouting, type PlatformSourceRouting } from '../domain/platformRouting.ts';
import { fallbackQualities, normalizeQuality, type Quality } from '../domain/quality.ts';
import type { MediaResolver, ResolvedMedia } from '../playback/controller.ts';
import { makeLXRequest } from './lx.ts';
import { type SourceState, SourceRegistry } from './sourceRegistry.ts';
import { bounded, DeadlineError, throwIfAborted } from './async.ts';
import type {PlaybackTraceSink} from '../playback/diagnostics.ts';
import {safePlaybackTraceText} from '../playback/diagnostics.ts';

export interface LXTransport {
  request(source: SourceState, payload: ReturnType<typeof makeLXRequest>, signal: AbortSignal): Promise<unknown>;
}
export interface RoutedMedia extends ResolvedMedia {
  sourceId: string; sourceName?: string; sourceRevision: number; sourceFingerprint?:string; requestedQuality: Quality; quality: Quality; scriptQuality: string;
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

export interface SmartSwitchPolicy {
  qualityForPlatform?: (platform: OnlinePlatform) => Quality;
  degradeMode?: () => 'progressive' | 'direct128k';
  crossScript?: () => boolean;
  sourceRouting?: () => PlatformSourceRouting;
}

export class MultiSourceResolver {
  private registry: SourceRegistry; private transport: LXTransport; private preference: () => Quality;
  private timeoutMs: number; private policy: SmartSwitchPolicy;
  constructor(registry: SourceRegistry, transport: LXTransport, preference: () => Quality, timeoutMs = 8000, policy: SmartSwitchPolicy = {}) {
    this.registry = registry; this.transport = transport; this.preference = preference; this.timeoutMs = timeoutMs; this.policy = policy;
  }
  async resolve(track: Track, signal: AbortSignal, excluded: ReadonlySet<string> = new Set(), qualityScope?:readonly Quality[], trace?:PlaybackTraceSink, originPlatform?:MusicPlatform): Promise<RoutedMedia> {
    throwIfAborted(signal);
    if (track.origin.kind !== 'online') throw new Error('LX仅处理在线平台歌曲');
    const platform = track.origin.platform;
    const preference = this.policy.qualityForPlatform?.(platform) ?? this.preference();
    const readySources = this.registry.getSnapshot().filter(source => this.registry.isCurrent(source));
    const sources = applyPlatformSourceRouting(readySources, platform, this.policy.sourceRouting?.(), originPlatform);
    const attempts: RouteAttempt[] = [];
    const degrade = this.policy.degradeMode?.() ?? 'progressive';
    const allowCrossScript = this.policy.crossScript?.() ?? true;
    const qualities: readonly Quality[] = qualityScope ?? (degrade === 'direct128k' ? (preference === '128k' ? ['128k'] : [preference, '128k']) : fallbackQualities(preference));
    for (const quality of qualities) {
      let triedSourceForQuality = false;
      for (const source of sources) {
        throwIfAborted(signal);
        if (!this.registry.isCurrent(source)) continue;
        const routeKey = JSON.stringify([source.id, source.revision, quality]);
        if (excluded.has(routeKey)) continue;
        const capability = source.capabilities.find(item => item.platform === platform && item.actions.includes('musicUrl'));
        const scriptQuality = capability?.qualities.find(type => normalizeQuality(type) === quality);
        if (!capability || !scriptQuality) continue;
        if (!allowCrossScript && triedSourceForQuality) break;
        triedSourceForQuality = true;
        trace?.({stage:'source',status:'info',title:`尝试 ${safePlaybackTraceText(source.name)??'LX 音源'} · ${quality}`,sourceId:source.id,sourceName:source.name,platform,quality});
        try {
          const result = await bounded(child => this.transport.request(source, makeLXRequest(track, scriptQuality, capability), child), signal, this.timeoutMs);
          throwIfAborted(signal);
          if (!this.registry.isCurrent(source)) { attempts.push({ sourceId: source.id, quality, reason: 'source-changed' }); trace?.({stage:'source',status:'failed',title:`${safePlaybackTraceText(source.name)??'LX 音源'} 已变化`,sourceId:source.id,sourceName:source.name,platform,quality}); continue; }
          const url = mediaURL(result);
          if (!url) { attempts.push({ sourceId: source.id, quality, reason: 'invalid-url' }); trace?.({stage:'source',status:'failed',title:`${safePlaybackTraceText(source.name)??'LX 音源'} 未返回可用地址`,sourceId:source.id,sourceName:source.name,platform,quality}); continue; }
          trace?.({stage:'source',status:quality===preference?'success':'fallback',title:`选定 ${safePlaybackTraceText(source.name)??'LX 音源'} · ${quality}`,detail:quality===preference?'偏好档位命中':`偏好 ${preference}，已降档至 ${quality}`,sourceId:source.id,sourceName:source.name,platform,quality});
          return { url, routeKey, sourceId: source.id, sourceName:source.name, sourceRevision: source.revision, sourceFingerprint:source.fingerprint, requestedQuality: preference, quality, scriptQuality };
        } catch (error) {
          throwIfAborted(signal);
          const reason=error instanceof DeadlineError?'timeout':'failed';
          attempts.push({ sourceId: source.id, quality, reason });
          trace?.({stage:'source',status:'failed',title:`${safePlaybackTraceText(source.name)??'LX 音源'} · ${reason==='timeout'?'请求超时':'请求失败'}`,sourceId:source.id,sourceName:source.name,platform,quality});
        }
      }
    }
    throw new RoutingError(attempts);
  }
}
