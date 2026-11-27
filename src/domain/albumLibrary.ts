// Standalone Album Library aggregation across favorites, playlists, local audio, and saved album catalogs (Item #10).
import { trackKey, type Track } from './track.ts';
import type { LibraryState } from '../storage/library.ts';

export interface AlbumLibraryGroup {
  readonly key: string;
  readonly title: string;
  readonly artist: string;
  readonly artwork?: string;
  readonly tracks: readonly Track[];
  readonly totalDurationMs: number;
  readonly sources: readonly ('favorite' | 'playlist' | 'local' | 'history')[];
}

export type AlbumLibrarySort = 'count' | 'title' | 'artist';

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildAlbumLibrary(
  library: Pick<LibraryState, 'favorites' | 'playlists' | 'history'>,
  localTracks: readonly Track[] = [],
): readonly AlbumLibraryGroup[] {
  const groups = new Map<
    string,
    {
      title: string;
      artist: string;
      artwork?: string;
      trackMap: Map<string, Track>;
      sources: Set<'favorite' | 'playlist' | 'local' | 'history'>;
    }
  >();

  const ingest = (track: Track, source: 'favorite' | 'playlist' | 'local' | 'history') => {
    const rawAlbum = track.album?.trim();
    if (!rawAlbum) return;
    const artist = track.artist.trim() || '未知歌手';
    const key = `${normalizeKeyPart(rawAlbum)}::${normalizeKeyPart(artist.split(/[\/,、&]/)[0] || artist)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        title: rawAlbum,
        artist,
        artwork: track.artwork,
        trackMap: new Map(),
        sources: new Set(),
      };
      groups.set(key, group);
    }
    if (!group.artwork && track.artwork) group.artwork = track.artwork;
    group.sources.add(source);
    try {
      const tk = trackKey(track.origin);
      if (!group.trackMap.has(tk)) group.trackMap.set(tk, track);
    } catch {}
  };

  for (const t of library.favorites) ingest(t, 'favorite');
  for (const pl of library.playlists) {
    for (const entry of pl.entries) ingest(entry.track, 'playlist');
  }
  for (const t of localTracks) ingest(t, 'local');
  for (const h of library.history) ingest(h.track, 'history');

  const result: AlbumLibraryGroup[] = [];
  for (const [key, g] of groups) {
    const tracks = [...g.trackMap.values()];
    const totalDurationMs = tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
    result.push({
      key,
      title: g.title,
      artist: g.artist,
      ...(g.artwork ? { artwork: g.artwork } : {}),
      tracks,
      totalDurationMs,
      sources: [...g.sources],
    });
  }
  return result.sort((a, b) => b.tracks.length - a.tracks.length || a.title.localeCompare(b.title, 'zh-Hans-CN'));
}

export function filterAndSortAlbums(
  albums: readonly AlbumLibraryGroup[],
  query: string,
  sort: AlbumLibrarySort,
): readonly AlbumLibraryGroup[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? albums.filter(a => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
    : [...albums];
  if (sort === 'title') return [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
  if (sort === 'artist') return [...filtered].sort((a, b) => a.artist.localeCompare(b.artist, 'zh-Hans-CN') || a.title.localeCompare(b.title, 'zh-Hans-CN'));
  return [...filtered].sort((a, b) => b.tracks.length - a.tracks.length || a.title.localeCompare(b.title, 'zh-Hans-CN'));
}
