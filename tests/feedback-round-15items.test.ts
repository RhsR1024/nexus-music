import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscoveryProvider } from '../src/providers/discovery.ts';
import {
  AccountDiscoveryClient,
  parseKugouNewSongs,
  parseNeteaseCloudDrive,
  parseNeteasePlayRecord,
  parseNeteaseRecentPlaylists,
  parseNeteaseRecentSongs,
  parseNeteaseSubscribedArtists,
  parseQQNewSongs,
} from '../src/providers/accountDiscovery.ts';
import {
  QISHUI_CURATED_COLLECTIONS,
  QISHUI_ROAM_MODES,
  QishuiAccountStore,
} from '../src/providers/qishui.ts';
import { RADIO_GLOBE_HTML } from '../src/providers/globalRadio.ts';
import { defaults, validatePreferences } from '../src/app/preferences.ts';
import { cleanBackupSettings } from '../src/storage/backupSettings.ts';

test('NetEase banners retain up to 12 items matching Sollin carousel count', async () => {
  const banners = Array.from({ length: 15 }, (_, i) => ({
    bannerId: `b-${i}`,
    pic: `https://p1.music.126.net/banner-${i}.jpg`,
    typeTitle: `推荐 ${i}`,
    titleColor: 'red',
    targetType: 1000,
    targetId: 10000 + i,
  }));
  const provider = new DiscoveryProvider(
    async x => x,
    async () => ({ code: 200, banners }),
  );
  const parsed = await provider.banners('wy', new AbortController().signal);
  assert.equal(parsed.length, 12);
  assert.equal(parsed[0]?.id, 'b-0');
  assert.equal(parsed[11]?.id, 'b-11');
});

test('Photorealistic Global Radio 3D globe HTML includes WebGL shader, high-detail landmasses, clouds, and pinch zoom', () => {
  assert.ok(RADIO_GLOBE_HTML.includes('uEarth'));
  assert.ok(RADIO_GLOBE_HTML.includes('uClouds'));
  assert.ok(RADIO_GLOBE_HTML.includes('buildEarthTexture'));
  assert.ok(RADIO_GLOBE_HTML.includes('pinchDist'));
  assert.ok(RADIO_GLOBE_HTML.includes('window.nexusGlobe'));
});

test('AccountDiscovery parsers handle NetEase recent/record/cloud/artists and QQ/Kugou new songs', () => {
  const recent = parseNeteaseRecentSongs({
    code: 200,
    data: {
      list: [
        { data: { id: 1001, name: '晴天', ar: [{ id: 1, name: '周杰伦' }], al: { id: 10, name: '叶惠美', picUrl: 'https://p1.music.126.net/a.jpg' }, dt: 269000 } },
      ],
    },
  });
  assert.equal(recent.length, 1);
  assert.equal(recent[0]?.title, '晴天');

  const recentPl = parseNeteaseRecentPlaylists({
    code: 200,
    data: {
      list: [{ data: { id: 9001, name: '夜跑歌单', coverImgUrl: 'http://p2.music.126.net/pl.jpg', trackCount: 42, creator: { nickname: '听友' } } }],
    },
  });
  assert.equal(recentPl.length, 1);
  assert.equal(recentPl[0]?.artwork, 'https://p2.music.126.net/pl.jpg');
  assert.equal(recentPl[0]?.count, 42);

  const rec = parseNeteasePlayRecord({
    code: 200,
    weekData: [
      { playCount: 18, score: 100, song: { id: 2002, name: '玄鸟', ar: [{ id: 2, name: 'CashTrippy' }], al: { id: 20, name: 'Single' }, dt: 153000 } },
    ],
  }, 1);
  assert.equal(rec.length, 1);
  assert.equal(rec[0]?.playCount, 18);
  assert.equal(rec[0]?.track.title, '玄鸟');

  const cloud = parseNeteaseCloudDrive({
    code: 200,
    hasMore: false,
    count: 1,
    data: [{ songId: 3003, songName: 'Demo Track', artist: 'Indie', album: 'Cloud', simpleSong: { id: 3003, name: 'Demo Track', ar: [{ name: 'Indie' }], al: { name: 'Cloud' }, dt: 200000 } }],
  });
  assert.equal(cloud.items.length, 1);
  assert.equal(cloud.items[0]?.title, 'Demo Track');

  const artists = parseNeteaseSubscribedArtists({
    code: 200,
    hasMore: false,
    data: [{ id: 3684, name: '林俊杰', picUrl: 'http://p1.music.126.net/jj.jpg', albumSize: 55, musicSize: 400 }],
  });
  assert.equal(artists.items.length, 1);
  assert.equal(artists.items[0]?.title, '林俊杰');
  assert.equal(artists.items[0]?.artwork, 'https://p1.music.126.net/jj.jpg');

  const qqNew = parseQQNewSongs({
    code: 0,
    req: {
      code: 0,
      data: {
        songlist: [{ mid: '001abc', name: 'QQ 新歌', singer: [{ name: '歌手甲' }], album: { mid: 'alb1', name: '新专' }, interval: 210, file: { size_128mp3: 3000000 } }],
      },
    },
  });
  assert.equal(qqNew.length, 1);
  assert.equal(qqNew[0]?.title, 'QQ 新歌');

  const kgNew = parseKugouNewSongs({
    data: [{ hash: 'AABBCCDD', filename: '陈奕迅 - 富士山下', duration: 259, filesize: 4100000 }],
  });
  assert.equal(kgNew.length, 1);
  assert.equal(kgNew[0]?.title, '富士山下');
  assert.equal(kgNew[0]?.artist, '陈奕迅');
});

test('AccountDiscoveryClient fetches QQ and Kugou new songs cleanly', async () => {
  const client = new AccountDiscoveryClient({
    sha1: async () => '0'.repeat(40),
    http: async url => {
      if (url.includes('u.y.qq.com')) {
        return { code: 0, req: { code: 0, data: { songlist: [{ mid: 'm1', title: 'New QQ', singer: [{ name: 'A' }], album: { mid: 'a1', name: 'Alb' }, interval: 180, file: {} }] } } };
      }
      return { data: [{ hash: 'H1', filename: 'Singer - Song', duration: 200, filesize: 3000000 }] };
    },
  });
  const qq = await client.qqNewSongs(new AbortController().signal);
  const kg = await client.kugouNewSongs(new AbortController().signal);
  assert.equal(qq[0]?.title, 'New QQ');
  assert.equal(kg[0]?.title, 'Song');
});

test('QishuiAccountStore persists active roam mode, bound playlists, likes, and recent tracks', async () => {
  assert.equal(QISHUI_ROAM_MODES.length, 12);
  assert.ok(QISHUI_ROAM_MODES.some(m => m.id === 'familiar' && m.title === '熟悉的歌'));
  assert.ok(QISHUI_CURATED_COLLECTIONS.length >= 6);

  const mem = new Map<string, unknown>();
  const repo = {
    get: async <T,>(k: string) => mem.get(k) as T | undefined,
    put: async (k: string, v: unknown) => { mem.set(k, v); },
  };
  const store = new QishuiAccountStore(repo);
  await store.setNickname('汽水听友');
  await store.setActiveMode('familiar');
  const track = {
    origin: { kind: 'imported' as const, platform: 'qishui' as const, id: 'qs-1' },
    title: '夜航船',
    artist: '旅人',
    metadata: {},
    qualities: [],
  };
  await store.toggleLike(track);
  await store.recordRecent(track);
  await store.bindPlaylist({ id: '712345', title: '汽水精选', tracks: [track] });

  const restored = new QishuiAccountStore(repo);
  await restored.restore();
  assert.equal(restored.getSnapshot().nickname, '汽水听友');
  assert.equal(restored.getSnapshot().activeModeId, 'familiar');
  assert.equal(restored.getSnapshot().liked.length, 1);
  assert.equal(restored.getSnapshot().recent.length, 1);
  assert.equal(restored.getSnapshot().playlists[0]?.title, '汽水精选');
});

test('Preferences and backupSettings accept groove2 and teletype2 player layouts', () => {
  const g2 = validatePreferences({ ...defaults, playerLayout: 'groove2' });
  const t2 = validatePreferences({ ...defaults, playerLayout: 'teletype2' });
  assert.equal(g2.playerLayout, 'groove2');
  assert.equal(t2.playerLayout, 'teletype2');

  const cleaned = cleanBackupSettings({ version: 1, preferences: { ...defaults, playerLayout: 'teletype2' } });
  assert.equal(cleaned.preferences.playerLayout, 'teletype2');
});
