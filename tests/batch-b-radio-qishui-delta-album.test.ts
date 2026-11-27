import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm,
  GlobalRadioApi,
  GlobalRadioStore,
  RADIO_GLOBE_HTML,
  stationToTrack,
  validRadioStreamURL,
} from '../src/providers/globalRadio.ts';
import { asQishuiMatchedTrack, QISHUI_ROAM_MODES } from '../src/providers/qishui.ts';
import {
  computeLibraryDelta,
  projectLibraryDelta,
  summarizeLibraryDelta,
} from '../src/storage/libraryDelta.ts';
import { buildAlbumLibrary, filterAndSortAlbums } from '../src/domain/albumLibrary.ts';
import { trackKey } from '../src/domain/track.ts';
import { cleanTrack } from '../src/storage/cleanTrack.ts';
import { buildSyncState } from '../src/storage/multiDeviceSync.ts';
import type { LibraryState } from '../src/storage/library.ts';

test('GlobalRadioApi fails over mirrors, filters unsafe streams, maps radio TrackOrigin, and persists favorites/recent', async () => {
  const seenHosts: string[] = [];
  const api = new GlobalRadioApi({
    http: async url => {
      seenHosts.push(new URL(url).hostname);
      if (seenHosts.length === 1) throw new TypeError('mirror down');
      if (url.includes('/json/countries')) {
        return [{ name: 'China', iso_3166_1: 'CN', stationcount: 120 }];
      }
      return [
        {
          stationuuid: '11111111-2222-3333-4444-555555555555',
          name: 'Globe 360 Radio',
          url_resolved: 'https://stream.example.org/live.mp3',
          country: 'Cameroon',
          countrycode: 'CM',
          state: 'Littoral',
          language: 'english',
          tags: 'pop,news',
          codec: 'mp3',
          bitrate: 128,
          geo_lat: 4.05,
          geo_long: 9.7,
          votes: 42,
        },
        {
          stationuuid: 'bad-1',
          name: 'Unsafe',
          url_resolved: 'file:///etc/passwd',
        },
      ];
    },
  });

  const stations = await api.search({ name: 'Globe' }, new AbortController().signal);
  assert.equal(seenHosts.length, 2);
  assert.equal(stations.length, 1);
  assert.equal(stations[0]?.codec, 'MP3');
  assert.equal(validRadioStreamURL('javascript:alert(1)'), undefined);
  assert.ok(distanceKm(39.9, 116.4, 31.2, 121.5) > 1000);
  assert.ok(RADIO_GLOBE_HTML.includes('window.nexusGlobe'));

  const track = cleanTrack(stationToTrack(stations[0]!));
  assert.equal(track.origin.kind, 'radio');
  assert.equal(trackKey(track.origin), JSON.stringify(['radio', 'global', '11111111-2222-3333-4444-555555555555']));
  assert.equal(track.metadata.streamUrl, 'https://stream.example.org/live.mp3');

  const facets = await api.facets('countries', new AbortController().signal);
  assert.equal(facets[0]?.value, 'CN');

  const db = new Map<string, unknown>();
  const store = new GlobalRadioStore({
    get: async <T>(k: string) => db.get(k) as T | undefined,
    put: async (k, v) => { db.set(k, v); },
  });
  await store.toggleFavorite(stations[0]!);
  await store.recordRecent(stations[0]!);
  assert.equal(store.isFavorite(stations[0]!.uuid), true);
  const store2 = new GlobalRadioStore({
    get: async <T>(k: string) => db.get(k) as T | undefined,
    put: async (k, v) => { db.set(k, v); },
  });
  await store2.restore();
  assert.equal(store2.getSnapshot().favorites.length, 1);
  assert.equal(store2.getSnapshot().recent.length, 1);
});

test('Qishui Scheme A roam presets and matched tracks wrap into imported qishui origin', () => {
  assert.ok(QISHUI_ROAM_MODES.length >= 6);
  const matched = asQishuiMatchedTrack({
    origin: { kind: 'online', platform: 'wy', id: '9988' },
    title: '夜曲',
    artist: '周杰伦',
    album: '十一月的萧邦',
    metadata: {},
    qualities: [],
  });
  assert.equal(matched.origin.kind, 'imported');
  if (matched.origin.kind === 'imported') {
    assert.equal(matched.origin.platform, 'qishui');
  }
});

test('libraryDelta computes incremental adds/updates/deletes and projects cleanly onto baseline', () => {
  const baseLib: LibraryState = {
    version: 1,
    favorites: [{ origin: { kind: 'online', platform: 'wy', id: '1' }, title: 'A', artist: 'S1', metadata: {}, qualities: [] }],
    playlists: [],
    history: [],
    matches: [],
    lyricChoices: [],
    catalogFavorites: [],
  };
  const nextLib: LibraryState = {
    ...baseLib,
    favorites: [
      { origin: { kind: 'online', platform: 'wy', id: '2' }, title: 'B', artist: 'S2', metadata: {}, qualities: [] },
    ],
  };
  const baseline = buildSyncState(baseLib, '11111111-2222-3333-4444-555555555555', 'a'.repeat(64), 'sync/');
  const delta = computeLibraryDelta(baseline, nextLib);
  assert.equal(delta.counts.add, 1);
  assert.equal(delta.counts.delete, 1);
  assert.match(summarizeLibraryDelta(delta), /新增 1.*删除 1/);
  const projected = projectLibraryDelta(baseline.records, delta);
  assert.equal(projected.filter(r => !r.deleted).length, 1);
});

test('buildAlbumLibrary aggregates favorites, playlists, and local tracks and sorts cleanly', () => {
  const lib: Pick<LibraryState, 'favorites' | 'playlists' | 'history'> = {
    favorites: [
      { origin: { kind: 'online', platform: 'wy', id: '1' }, title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000, metadata: {}, qualities: [] },
      { origin: { kind: 'online', platform: 'wy', id: '2' }, title: '东风破', artist: '周杰伦', album: '叶惠美', durationMs: 315000, metadata: {}, qualities: [] },
    ],
    playlists: [],
    history: [],
  };
  const local = [
    { origin: { kind: 'local' as const, id: 'loc-1' }, title: '七里香', artist: '周杰伦', album: '七里香', durationMs: 299000, metadata: {}, qualities: [] },
  ];
  const albums = buildAlbumLibrary(lib, local);
  assert.equal(albums.length, 2);
  assert.equal(albums[0]?.title, '叶惠美');
  assert.equal(albums[0]?.tracks.length, 2);
  const byTitle = filterAndSortAlbums(albums, '七里', 'title');
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0]?.title, '七里香');
});
