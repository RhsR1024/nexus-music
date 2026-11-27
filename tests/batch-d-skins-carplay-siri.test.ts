import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, PreferenceStore, validatePreferences } from '../src/app/preferences.ts';
import { teletypeVisibleChars } from '../src/lyrics/teletype.ts';
import {
  buildCarCatalogSnapshot,
  CarIntegrationCoordinator,
  type CarCommand,
} from '../src/platform/carIntegration.ts';
import type { LibraryState } from '../src/storage/library.ts';
import type { Track } from '../src/domain/track.ts';

const t1: Track = {
  origin: { kind: 'online', platform: 'wy', id: '1' },
  title: '以父之名',
  artist: '周杰伦',
  album: '叶惠美',
  metadata: {},
  qualities: [{ id: 'flac' }],
};

const t2: Track = {
  origin: { kind: 'online', platform: 'wy', id: '2' },
  title: '晴天',
  artist: '周杰伦',
  album: '叶惠美',
  metadata: {},
  qualities: [{ id: 'flac' }],
};

test('Groove and Teletype player layouts and skin options validate and persist cleanly', async () => {
  const g = validatePreferences({
    ...defaults,
    playerLayout: 'groove',
    grooveSpinSpeed: 'fast',
  });
  assert.equal(g.playerLayout, 'groove');
  assert.equal(g.grooveSpinSpeed, 'fast');

  const tt = validatePreferences({
    ...defaults,
    playerLayout: 'teletype',
    teletypeTheme: 'terminal',
  });
  assert.equal(tt.playerLayout, 'teletype');
  assert.equal(tt.teletypeTheme, 'terminal');

  const db = new Map<string, unknown>();
  const store = new PreferenceStore({
    get: async <T>(k: string) => db.get(k) as T | undefined,
    put: async (k, v) => { db.set(k, v); },
  });
  await store.update({ playerLayout: 'teletype', teletypeTheme: 'amber' });
  assert.equal(store.getSnapshot().playerLayout, 'teletype');
  assert.equal(store.getSnapshot().teletypeTheme, 'amber');
});

test('teletypeVisibleChars reveals characters progressively across line duration', () => {
  const start = teletypeVisibleChars('微凉的晨露沾湿黑礼服', 0, 4000);
  const mid = teletypeVisibleChars('微凉的晨露沾湿黑礼服', 1700, 4000);
  const end = teletypeVisibleChars('微凉的晨露沾湿黑礼服', 3600, 4000);
  assert.equal(start.length, 1);
  assert.ok(mid.length > start.length && mid.length < end.length);
  assert.equal(end, '微凉的晨露沾湿黑礼服');
});

test('CarIntegrationCoordinator syncs catalog and routes CarPlay/Siri/Android Auto commands to queue', async () => {
  const lib: LibraryState = {
    version: 1,
    favorites: [t1, t2],
    playlists: [
      {
        id: 'pl-1',
        title: '深夜车载',
        entries: [{ id: 'e1', track: t2 }],
        createdAt: 100,
        updatedAt: 100,
      },
    ],
    history: [{ track: t1, playedAt: 200 }],
  };

  const snap = buildCarCatalogSnapshot(lib, 999);
  assert.equal(snap.favorites.length, 2);
  assert.equal(snap.playlists[0]?.title, '深夜车载');
  assert.equal(snap.recent.length, 1);

  const events: string[] = [];
  let pushedJson = '';
  let liveListener: ((cmd: CarCommand) => void) | null = null;
  const listeners = new Set<() => void>();

  const coord = new CarIntegrationCoordinator({
    native: {
      updateCarCatalog: async json => { pushedJson = json; },
      consumePendingCarCommands: async () => [{ source: 'siri', action: 'resume' }],
      carIntegrationStatus: async () => ({
        platform: 'ios',
        carPlayCodeReady: true,
        carPlayEntitlementActive: false,
        siriIntentsAvailable: true,
        androidAutoServiceReady: false,
        catalogTracks: 3,
        catalogPlaylists: 1,
      }),
      addListener: (_ev, fn) => {
        liveListener = fn;
        return { remove: () => { liveListener = null; } };
      },
    },
    library: {
      getSnapshot: () => lib,
      subscribe: fn => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
    actions: {
      playTracks: (tracks, idx) => events.push(`play:${tracks[idx]?.title}`),
      resume: () => events.push('resume'),
      pause: () => events.push('pause'),
      next: dir => events.push(`next:${dir ?? 1}`),
    },
  });

  coord.start();
  await new Promise(r => setTimeout(r, 15));
  assert.ok(pushedJson.includes('深夜车载'));
  assert.ok(events.includes('resume'));

  liveListener?.({ source: 'carplay', action: 'playPlaylist', id: 'pl-1' });
  liveListener?.({ source: 'android-auto', action: 'playSectionTrack', section: 'favorites', index: 0 });
  liveListener?.({ source: 'siri', action: 'next' });
  assert.deepEqual(events, ['resume', 'play:晴天', 'play:以父之名', 'next:1']);

  const st = await coord.status();
  assert.equal(st.carPlayCodeReady, true);
  assert.equal(st.siriIntentsAvailable, true);
  coord.stop();
});
