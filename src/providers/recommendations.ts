import type { Track } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import type { LibraryState } from '../storage/library.ts';
import type { PlaybackStatsState } from '../storage/playbackStats.ts';

export type RecommendationReason = 'favorite' | 'recent' | 'frequent' | 'playlist' | 'library';

export interface LocalRecommendation {
  track: Track;
  score: number;
  reasons: readonly RecommendationReason[];
}

export interface LocalRecommendationSnapshot {
  version: 1;
  generatedAt: number;
  recommendations: readonly LocalRecommendation[];
  fm: readonly Track[];
}

export interface RecommendationSource {
  getSnapshot(): LibraryState;
  subscribe(listener: () => void): () => void;
}

export interface RecommendationStatsSource {
  getSnapshot(): PlaybackStatsState;
  subscribe(listener: () => void): () => void;
}

const emptySnapshot: LocalRecommendationSnapshot = {
  version: 1,
  generatedAt: 0,
  recommendations: [],
  fm: [],
};

interface Candidate {
  track: Track;
  favorite: boolean;
  historyIndex?: number;
  lastPlayedAt?: number;
  playCount: number;
  listenedMs: number;
  playlist: boolean;
}

function daysSince(timestamp: number, now: number): number {
  return Math.max(0, (now - timestamp) / 86_400_000);
}

function fmOrder(items: readonly LocalRecommendation[]): readonly Track[] {
  const remaining = [...items].sort((a, b) => b.score - a.score || trackKey(a.track.origin).localeCompare(trackKey(b.track.origin)));
  const ordered: Track[] = [];
  let previousArtist = '';
  while (remaining.length) {
    const index = remaining.findIndex(item => !previousArtist || item.track.artist !== previousArtist);
    const [next] = remaining.splice(index < 0 ? 0 : index, 1);
    if (!next) break;
    ordered.push(next.track);
    previousArtist = next.track.artist;
  }
  return ordered;
}

export function buildLocalRecommendations(library: LibraryState, statistics: PlaybackStatsState, now: number, limit = 50): LocalRecommendationSnapshot {
  if (!Number.isFinite(now) || now < 0) throw new Error('推荐时间无效');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('推荐数量无效');
  const candidates = new Map<string, Candidate>();
  const add = (track: Track, source: (value: Candidate) => void) => {
    const key = trackKey(track.origin);
    const current = candidates.get(key) ?? { track, favorite: false, playCount: 0, listenedMs: 0, playlist: false };
    source(current);
    candidates.set(key, current);
  };
  library.favorites.forEach(track => add(track, value => { value.favorite = true; }));
  library.history.forEach((entry, index) => add(entry.track, value => {
    value.historyIndex = value.historyIndex === undefined ? index : Math.min(value.historyIndex, index);
    value.lastPlayedAt = Math.max(value.lastPlayedAt ?? 0, entry.playedAt);
  }));
  library.playlists.forEach(playlist => playlist.entries.forEach(entry => add(entry.track, value => { value.playlist = true; })));
  const stats = new Map(statistics.items.map(item => [trackKey(item.track.origin), item]));
  statistics.items.forEach(item => add(item.track, value => {
    value.playCount = item.playCount;
    value.listenedMs = item.listenedMs;
    value.lastPlayedAt = Math.max(value.lastPlayedAt ?? 0, item.lastPlayedAt);
  }));
  const recommendations = [...candidates.values()].map(item => {
    const stat = stats.get(trackKey(item.track.origin));
    const recent = item.lastPlayedAt === undefined ? 0 : 36 * Math.exp(-daysSince(item.lastPlayedAt, now) / 30);
    const score = (item.favorite ? 120 : 0) + recent + Math.min(60, item.playCount * 18) + Math.min(30, item.listenedMs / 60_000) + (item.playlist ? 8 : 0) + (item.historyIndex === undefined ? 0 : 18 / (item.historyIndex + 1));
    const reasons: RecommendationReason[] = [];
    if (item.favorite) reasons.push('favorite');
    if (item.historyIndex !== undefined || stat) reasons.push(item.playCount > 1 ? 'frequent' : 'recent');
    if (item.playlist) reasons.push('playlist');
    if (!reasons.length) reasons.push('library');
    return { track: item.track, score, reasons } satisfies LocalRecommendation;
  }).sort((a, b) => b.score - a.score || trackKey(a.track.origin).localeCompare(trackKey(b.track.origin))).slice(0, limit);
  return { version: 1, generatedAt: now, recommendations, fm: fmOrder(recommendations) };
}

export class LocalRecommendationStore {
  private value: LocalRecommendationSnapshot = emptySnapshot;
  private listeners = new Set<() => void>();
  private fmPlayed = new Set<string>();
  private readonly stopLibrary: () => void;
  private readonly stopStats: () => void;
  private readonly library: RecommendationSource;
  private readonly statistics: RecommendationStatsSource;
  private readonly now: () => number;
  constructor(library: RecommendationSource, statistics: RecommendationStatsSource, now: () => number = Date.now) {
    this.library = library;
    this.statistics = statistics;
    this.now = now;
    this.stopLibrary = library.subscribe(this.refresh);
    this.stopStats = statistics.subscribe(this.refresh);
    this.refresh();
  }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  refresh = () => {
    const next = buildLocalRecommendations(this.library.getSnapshot(), this.statistics.getSnapshot(), this.now());
    const available = new Set(next.fm.map(track => trackKey(track.origin)));
    for (const key of this.fmPlayed) if (!available.has(key)) this.fmPlayed.delete(key);
    this.value = next;
    for (const listener of this.listeners) listener();
  };
  nextFM(count = 1): readonly Track[] {
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('FM数量无效');
    const choose = () => this.value.fm.filter(track => !this.fmPlayed.has(trackKey(track.origin))).slice(0, count);
    let selected = choose();
    if (selected.length < count && this.fmPlayed.size) { this.fmPlayed.clear(); selected = choose(); }
    selected.forEach(track => this.fmPlayed.add(trackKey(track.origin)));
    return selected;
  }
  resetFM() { this.fmPlayed.clear(); }
  dispose() { this.stopLibrary(); this.stopStats(); this.listeners.clear(); }
}
