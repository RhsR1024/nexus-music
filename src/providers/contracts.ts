import type { OnlinePlatform, Track } from '../domain/track.ts';
import type { MediaResolver } from '../playback/controller.ts';

export interface Page<T> { items: readonly T[]; nextCursor?: string }
export interface MetadataProvider {
  readonly platform: OnlinePlatform;
  search(query: string, cursor: string | undefined, signal: AbortSignal): Promise<Page<Track>>;
}

export interface ScriptHost extends MediaResolver {
  // A script's URL capabilities do not imply metadata/search support.
  readonly capabilities: ReadonlySet<'musicUrl' | 'lyric' | 'pic'>;
  dispose(): void;
}
