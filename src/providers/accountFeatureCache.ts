// Persistent + in-memory cache for signed-in platform playlists & lists (QQ/NetEase/Kugou/Bodian)
// so large playlists (e.g. 1000+ song "我喜欢") open instantly without waiting on repeated cloud fetches.
import type { Track } from '../domain/track.ts';
import { cleanTrack } from '../storage/cleanTrack.ts';
import type { Repository } from '../storage/repository.ts';
import type { AccountPlaylist } from './accountPlaylists.ts';

const STORAGE_KEY = 'accountFeature.cache.v1';
const MAX_TRACK_CACHES = 18;
const MAX_PLAYLIST_LIST_CACHES = 12;

export interface CachedTrackList {
  readonly tracks: readonly Track[];
  readonly updatedAt: number;
}

export interface CachedPlaylistCatalog {
  readonly playlists: readonly AccountPlaylist[];
  readonly updatedAt: number;
}

interface PersistedAccountCache {
  readonly version: 1;
  readonly tracks: Record<string, CachedTrackList>;
  readonly catalogs: Record<string, CachedPlaylistCatalog>;
}

export function formatCacheAge(updatedAt: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (diffSec < 60) return '刚刚同步';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} 分钟前同步`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前同步`;
  return `${Math.floor(hrs / 24)} 天前同步`;
}

export class AccountFeatureCache {
  private readonly repo?: Pick<Repository, 'get' | 'put'>;
  private trackEntries = new Map<string, CachedTrackList>();
  private catalogEntries = new Map<string, CachedPlaylistCatalog>();

  constructor(repo?: Pick<Repository, 'get' | 'put'>) {
    this.repo = repo;
  }

  async restore(): Promise<void> {
    if (!this.repo) return;
    try {
      const saved = await this.repo.get<PersistedAccountCache>(STORAGE_KEY);
      if (!saved || saved.version !== 1) return;
      if (saved.tracks && typeof saved.tracks === 'object') {
        for (const [k, v] of Object.entries(saved.tracks)) {
          if (v && Array.isArray(v.tracks) && typeof v.updatedAt === 'number') {
            this.trackEntries.set(k, { tracks: v.tracks, updatedAt: v.updatedAt });
          }
        }
      }
      if (saved.catalogs && typeof saved.catalogs === 'object') {
        for (const [k, v] of Object.entries(saved.catalogs)) {
          if (v && Array.isArray(v.playlists) && typeof v.updatedAt === 'number') {
            this.catalogEntries.set(k, { playlists: v.playlists, updatedAt: v.updatedAt });
          }
        }
      }
    } catch {
      // Cache corruption is non-fatal; fresh loads will repopulate cleanly.
    }
  }

  getTracks(key: string): CachedTrackList | undefined {
    const entry = this.trackEntries.get(key);
    if (!entry) return undefined;
    // LRU touch
    this.trackEntries.delete(key);
    this.trackEntries.set(key, entry);
    return entry;
  }

  getCatalog(key: string): CachedPlaylistCatalog | undefined {
    const entry = this.catalogEntries.get(key);
    if (!entry) return undefined;
    this.catalogEntries.delete(key);
    this.catalogEntries.set(key, entry);
    return entry;
  }

  async setTracks(key: string, tracks: readonly Track[], now = Date.now()): Promise<CachedTrackList> {
    const sanitized = tracks.slice(0, 3000).map(cleanTrack);
    const entry: CachedTrackList = { tracks: sanitized, updatedAt: now };
    this.trackEntries.delete(key);
    this.trackEntries.set(key, entry);
    while (this.trackEntries.size > MAX_TRACK_CACHES) {
      const oldest = this.trackEntries.keys().next().value;
      if (oldest === undefined) break;
      this.trackEntries.delete(oldest);
    }
    await this.persist();
    return entry;
  }

  async setCatalog(key: string, playlists: readonly AccountPlaylist[], now = Date.now()): Promise<CachedPlaylistCatalog> {
    const entry: CachedPlaylistCatalog = { playlists: playlists.slice(0, 300), updatedAt: now };
    this.catalogEntries.delete(key);
    this.catalogEntries.set(key, entry);
    while (this.catalogEntries.size > MAX_PLAYLIST_LIST_CACHES) {
      const oldest = this.catalogEntries.keys().next().value;
      if (oldest === undefined) break;
      this.catalogEntries.delete(oldest);
    }
    await this.persist();
    return entry;
  }

  async clearForPrefix(prefix: string): Promise<void> {
    let changed = false;
    for (const k of [...this.trackEntries.keys()]) {
      if (k.startsWith(prefix)) {
        this.trackEntries.delete(k);
        changed = true;
      }
    }
    for (const k of [...this.catalogEntries.keys()]) {
      if (k.startsWith(prefix)) {
        this.catalogEntries.delete(k);
        changed = true;
      }
    }
    if (changed) await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.repo) return;
    try {
      const payload: PersistedAccountCache = {
        version: 1,
        tracks: Object.fromEntries(this.trackEntries.entries()),
        catalogs: Object.fromEntries(this.catalogEntries.entries()),
      };
      await this.repo.put(STORAGE_KEY, payload);
    } catch {
      // Non-fatal; in-memory cache stays valid for current session.
    }
  }
}
