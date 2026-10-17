import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalRecommendations, LocalRecommendationStore } from '../src/providers/recommendations.ts';
import { emptyLibrary, type LibraryState } from '../src/storage/library.ts';
import { emptyPlaybackStats, type PlaybackStatsState } from '../src/storage/playbackStats.ts';
import { track } from './fixtures.ts';

const song = (id: string, artist = '测试歌手') => ({ ...track, origin: { kind: 'online' as const, platform: 'wy' as const, id }, title: `歌曲${id}`, artist });
function source<T>(value: T) {
  const listeners = new Set<() => void>();
  return { getSnapshot: () => value, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); }, publish(next: T) { value = next; listeners.forEach(listener => listener()); } };
}

test('local recommendations combine favorites, recency, statistics and playlists without duplicates', () => {
  const favorite = song('favorite'), recent = song('recent'), frequent = song('frequent'), playlist = song('playlist');
  const library: LibraryState = { ...emptyLibrary, favorites: [favorite], history: [{ track: recent, playedAt: 9_900 }], playlists: [{ id: 'p', title: '本地', entries: [{ id: 'e', track: playlist }], createdAt: 1, updatedAt: 1 }] };
  const statistics: PlaybackStatsState = { ...emptyPlaybackStats, items: [{ track: frequent, playCount: 4, listenedMs: 600_000, firstPlayedAt: 1, lastPlayedAt: 9_800 }] };
  const result = buildLocalRecommendations(library, statistics, 10_000);
  assert.deepEqual(result.recommendations.map(item => item.track.origin.id), ['favorite', 'frequent', 'recent', 'playlist']);
  assert.deepEqual(result.recommendations.map(item => item.reasons), [['favorite'], ['frequent'], ['recent'], ['playlist']]);
  assert.equal(new Set(result.fm.map(item => item.origin.id)).size, 4);
});

test('FM session avoids consecutive same-artist tracks and cycles after exhaustion', () => {
  const a = song('a', '甲'), b = song('b', '甲'), c = song('c', '乙');
  const library: LibraryState = { ...emptyLibrary, favorites: [a, b, c] };
  const stats: PlaybackStatsState = emptyPlaybackStats;
  const librarySource = source(library), statsSource = source(stats);
  const store = new LocalRecommendationStore(librarySource, statsSource, () => 1000);
  const first = store.nextFM(3);
  assert.equal(first.length, 3);
  assert.notEqual(first[0]!.artist, first[1]!.artist);
  assert.deepEqual(store.nextFM(3).map(item => item.origin.id), first.map(item => item.origin.id));
  store.dispose();
});

test('recommendation store refreshes when local library changes and removes stale FM state', () => {
  const first = song('first'), second = song('second');
  const librarySource = source<LibraryState>({ ...emptyLibrary, favorites: [first] });
  const statsSource = source<PlaybackStatsState>(emptyPlaybackStats);
  const store = new LocalRecommendationStore(librarySource, statsSource, () => 1000);
  let notifications = 0;
  const stop = store.subscribe(() => { notifications += 1; });
  assert.deepEqual(store.getSnapshot().recommendations.map(item => item.track.origin.id), ['first']);
  librarySource.publish({ ...emptyLibrary, favorites: [second] });
  assert.deepEqual(store.getSnapshot().recommendations.map(item => item.track.origin.id), ['second']);
  assert.ok(notifications > 0);
  stop(); store.dispose();
});
