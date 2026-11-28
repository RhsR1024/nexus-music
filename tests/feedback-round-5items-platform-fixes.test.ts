import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BodianProvider } from '../src/providers/bodian.ts';
import { CoverService } from '../src/providers/covers.ts';
import { SourceRegistry } from '../src/providers/sourceRegistry.ts';
import { DiscoveryProvider } from '../src/providers/discovery.ts';
import { OnlineProvider } from '../src/providers/online.ts';
import { AccountPlaylists, type AccountPlaylist } from '../src/providers/accountPlaylists.ts';
import { AccountHeartbeat } from '../src/providers/accountHeartbeat.ts';
import { AccountFeatureCache } from '../src/providers/accountFeatureCache.ts';
import { LibraryStore } from '../src/storage/library.ts';
import type { MusicAccount, MusicSession } from '../src/providers/musicAccounts.ts';
import type { Repository } from '../src/storage/repository.ts';

const md5 = async (v: string) => createHash('md5').update(v).digest('hex');
const sha1 = async (v: string) => createHash('sha1').update(v).digest('hex');

test('Item 1 & 3: Bodian playlists, Kuwo rankings/tracks, and CoverService normalize kwcdn.kuwo.cn to valid HTTPS kuwo.cn', async () => {
  const bd = new BodianProvider({
    md5,
    http: async () => ({
      code: 200,
      data: {
        lists: [
          {
            playLists: [
              {
                id: 1001,
                name: '2026热梗合集',
                pic: 'http://img1.kwcdn.kuwo.cn/star/userpl2015/73/41/test_1260.jpg',
                musicCount: 170,
              },
              {
                id: 1002,
                name: '2026新时代歌手',
                pic: 'http://img1.kuwo.cn/star/userpl2015/80/9/test_300.jpg',
                musicCount: 27,
              },
            ],
          },
        ],
      },
    }),
  });
  const playlists = await bd.recommendedPlaylists(new AbortController().signal);
  assert.equal(playlists[0]?.artwork, 'https://img1.kuwo.cn/star/userpl2015/73/41/test_1260.jpg');
  assert.equal(playlists[1]?.artwork, 'https://img1.kuwo.cn/star/userpl2015/80/9/test_300.jpg');

  const fetchedUrls: string[] = [];
  const registry = new SourceRegistry({ initialize: async () => [], destroy() {} });
  const covers = new CoverService(
    {
      fetchCover: async (_k, url) => {
        fetchedUrls.push(url);
        return 'file:///ok.jpg';
      },
      clearCovers: async () => {},
      coverStatistics: async () => ({ bytes: 0, files: 0 }),
    },
    async v => v,
    registry,
    { request: async () => '' },
    async () => '',
  );
  await covers.loadURL('http://img2.kwcdn.kuwo.cn/star/upload/8/8/1543919795640_.png', new AbortController().signal);
  await covers.loadURL('https://img1.kwcdn.kuwo.cn/star/albumcover/500/test.jpg', new AbortController().signal);
  assert.deepEqual(fetchedUrls, [
    'https://img2.kuwo.cn/star/upload/8/8/1543919795640_.png',
    'https://img1.kuwo.cn/star/albumcover/500/test.jpg',
  ]);

  const disc = new DiscoveryProvider(sha1, async url => {
    if (url.includes('qukudata.kuwo.cn')) {
      return {
        child: [
          {
            id: '534804',
            name: '青少年专属飙升榜',
            sourceid: '340',
            pic: 'http://img2.kwcdn.kuwo.cn/star/upload/8/8/1543919795640_.png',
          },
        ],
      };
    }
    return {
      name: '青少年专属飙升榜',
      musiclist: [
        {
          id: '671476115',
          name: '如果我拥有一座花园 (Live)',
          artist: '刘宇宁',
          album: '音乐缘计划3 第3期',
          duration: '6',
          song_duration: '278',
        },
      ],
    };
  });
  const ranks = await disc.rankings('kw', new AbortController().signal);
  assert.equal(ranks[0]?.artwork, 'https://img2.kuwo.cn/star/upload/8/8/1543919795640_.png');
  const detail = await disc.detail('kw', '340', 1, new AbortController().signal, true);
  assert.equal(detail.items[0]?.durationMs, 278_000);

  const onlineRidPic = new OnlineProvider({
    md5,
    sha1,
    deviceId: () => 'dev-1',
    http: async () => ({ status: 301, data: null }),
    textHTTP: async () => 'http://img1.kwcdn.kuwo.cn/star/albumcover/500/s4s46/34/2634440268.jpg',
  });
  const ridPicCover = await onlineRidPic.artwork(detail.items[0]!, new AbortController().signal);
  assert.equal(ridPicCover, 'https://img1.kuwo.cn/star/albumcover/500/s4s46/34/2634440268.jpg');

  const online = new OnlineProvider({
    md5,
    sha1,
    deviceId: () => 'dev-1',
    http: async () => ({
      data: {
        songinfo: {
          pic: 'http://img1.kwcdn.kuwo.cn/star/albumcover/240/s4s46/34/2634440268.jpg',
        },
      },
    }),
  });
  const resolvedCover = await online.artwork(detail.items[0]!, new AbortController().signal);
  assert.equal(resolvedCover, 'https://img1.kuwo.cn/star/albumcover/240/s4s46/34/2634440268.jpg');
});

test('Item 2: cached Kugou/QQ playlists preview without false account_changed, and per-entry AccountFeatureCache avoids monolithic rewrites', async () => {
  const kgAccount: MusicAccount = {
    id: 'k'.repeat(64),
    platform: 'kg',
    username: 'kugou:9001',
    label: '酷狗测试',
    updatedAt: 1,
    capabilities: [],
  };
  const kgSession: MusicSession = {
    version: 1,
    platform: 'kg',
    accountId: kgAccount.id,
    userId: '9001',
    token: 'tok',
    mid: 'mid',
  };
  const cachedPlaylist: AccountPlaylist = {
    id: '101',
    title: '我喜欢',
    count: 1197,
    coverUrl: '',
    kind: 'created',
  };
  let releaseList!: () => void;
  const listStarted = new Promise<void>(r => {
    releaseList = r;
  });
  const client = new AccountPlaylists({
    accounts: { getSnapshot: () => [kgAccount], session: async () => kgSession },
    profile: { fetch: async () => ({ userId: '9001', nickname: '酷狗测试' }) },
    library: { createPlaylist: async () => 'p1' },
    http: async () => ({}),
    kugou: {
      list: async () => {
        releaseList();
        await new Promise(r => setTimeout(r, 25));
        return [cachedPlaylist];
      },
      tracks: async () => [
        { origin: { kind: 'online', platform: 'kg', id: '1_abc' }, title: '测试歌曲', artist: '歌手', metadata: {}, qualities: [] },
      ],
    },
  });

  // Preview directly from cached playlist WITHOUT calling list() first -> must NOT throw account_changed!
  const direct = await client.preview(kgAccount, cachedPlaylist, new AbortController().signal, { lenient: true });
  assert.equal(direct.tracks.length, 1);

  // Concurrent background list() refresh must NOT kill lenient preview() with account_changed!
  const listTask = client.list(kgAccount, new AbortController().signal);
  await listStarted;
  const concurrentPreview = await client.preview(kgAccount, cachedPlaylist, new AbortController().signal, { lenient: true });
  assert.equal(concurrentPreview.tracks.length, 1);
  assert.equal((await listTask).length, 1);

  // Per-entry AccountFeatureCache writes only the modified playlist key + tiny index
  const store = new Map<string, unknown>();
  const writtenKeys: string[] = [];
  const repo: Pick<Repository, 'get' | 'put'> = {
    get: async <T>(k: string) => store.get(k) as T | undefined,
    put: async (k, v) => {
      writtenKeys.push(k);
      store.set(k, structuredClone(v));
    },
  };
  const cache = new AccountFeatureCache(repo);
  const t1 = [{ origin: { kind: 'online' as const, platform: 'kg' as const, id: '1' }, title: 'A', artist: 'X', metadata: {}, qualities: [] }];
  const t2 = [{ origin: { kind: 'online' as const, platform: 'tx' as const, id: '2' }, title: 'B', artist: 'Y', metadata: {}, qualities: [] }];
  await cache.setTracks('kg:liked', t1, 1000);
  writtenKeys.length = 0;
  await cache.setTracks('tx:liked', t2, 2000);
  assert.ok(writtenKeys.includes('accountFeature.track.v1:tx:liked'));
  assert.ok(!writtenKeys.includes('accountFeature.track.v1:kg:liked'));

  const restored = new AccountFeatureCache(repo);
  await restored.restore();
  assert.equal(restored.getTracks('kg:liked')?.tracks[0]?.title, 'A');
  assert.equal(restored.getTracks('tx:liked')?.tracks[0]?.title, 'B');
});

test('Item 4: NetEase lenient preview loads 1,250+ liked songs with duplicates, count drift, inline tracks, and delisted omissions', async () => {
  const owner: MusicAccount = {
    id: 'w'.repeat(64),
    platform: 'wy',
    username: 'netease:777',
    label: '网易云测试',
    updatedAt: 1,
    capabilities: [],
  };
  const session: MusicSession = {
    version: 1,
    platform: 'wy',
    accountId: owner.id,
    userId: '777',
    cookies: { MUSIC_U: 'unit-only' },
  };
  const song = (id: string) => ({
    id,
    name: `Song ${id}`,
    ar: [{ id: '1', name: 'Artist' }],
    al: { id: '2', name: 'Album', picUrl: 'https://p1.music.126.net/a.jpg' },
    dt: 180000,
    h: { size: 4000000 },
  });
  const totalIds = Array.from({ length: 1250 }, (_, i) => String(100000 + i));
  const detailCalls: number[] = [];
  const client = new AccountPlaylists({
    accounts: { getSnapshot: () => [owner], session: async () => session },
    profile: { fetch: async () => ({ userId: '777', nickname: '网易云测试' }) },
    library: new LibraryStore({ get: async () => undefined, put: async () => {} }, () => '1'),
    http: async (url, init) => {
      if (url.endsWith('v6/playlist/detail')) {
        return {
          code: 200,
          playlist: {
            id: '5001',
            trackCount: 1265, // deliberately drifted vs trackIds length
            trackIds: [...totalIds.map(id => ({ id })), { id: totalIds[0] }], // duplicate ID included
            tracks: totalIds.slice(0, 200).map(song), // 200 already inline
          },
        };
      }
      if (url.endsWith('v3/song/detail')) {
        const callIdx = detailCalls.length;
        detailCalls.push(callIdx);
        // Return all requested IDs except two delisted tracks (100250 and 100888)
        const start = 200 + callIdx * 500;
        const slice = totalIds.slice(start, start + 500).filter(id => id !== '100250' && id !== '100888');
        return {
          code: 200,
          songs: slice.map(song),
          privileges: slice.map(id => ({ id })),
        };
      }
      throw new Error(`unexpected ${url}`);
    },
  });
  const likedPlaylist: AccountPlaylist = { id: '5001', title: '我喜欢的音乐', count: 1265, coverUrl: '', kind: 'created' };
  const preview = await client.preview(owner, likedPlaylist, new AbortController().signal, { lenient: true });
  assert.equal(preview.tracks.length, 1248);
  assert.equal(preview.tracks[0]?.origin.id, '100000');
  assert.equal(preview.tracks[preview.tracks.length - 1]?.origin.id, '101249');
  assert.equal(detailCalls.length, 3); // 1050 missing IDs fetched in 3 x 500 batches instead of 7 x 200
});

test('Item 5: NetEase AccountHeartbeat recognizes real specialType=5 liked playlist and title fallback', async () => {
  const account: MusicAccount = {
    id: 'h'.repeat(64),
    platform: 'wy',
    label: '网易云',
    username: 'netease:88001',
    capabilities: ['daily', 'fm'],
    updatedAt: 1,
  };
  const session: MusicSession = {
    version: 1,
    platform: 'wy',
    accountId: account.id,
    userId: '88001',
    cookies: { MUSIC_U: 'unit-only', __csrf: 'csrf' },
  };
  const song = (id: string) => ({
    id,
    name: `Track ${id}`,
    ar: [{ id: '1', name: 'Singer' }],
    al: { id: '2', name: 'Album', picUrl: 'https://p1.music.126.net/p.jpg' },
    dt: 200000,
    l: { size: 1000 },
  });
  const pathOf = (url: string) => new URL(url).pathname.replace(/^\/weapi\//, '');

  for (const likedRow of [
    { id: '9001', name: 'User喜欢的音乐', specialType: 5, creator: { userId: '88001' } },
    { id: '9002', name: '我喜欢的音乐', specialType: 0, creator: { userId: '88001' } },
  ]) {
    const hb = new AccountHeartbeat({
      accounts: { getSnapshot: () => [account] },
      random: () => 0,
      http: async url => {
        const p = pathOf(url);
        if (p === 'user/playlist') {
          return {
            code: 200,
            playlist: [
              { id: '8999', name: '别人的喜欢的音乐', specialType: 5, creator: { userId: '99999' } },
              likedRow,
            ],
          };
        }
        if (p === 'v3/playlist/detail') return { code: 200, playlist: { trackIds: [{ id: '111' }] } };
        if (p === 'v3/song/detail') return { code: 200, songs: [song('111'), song('222')] };
        if (p === 'playmode/intelligence/list') return { code: 200, data: { list: [{ songInfo: { id: '222' } }] } };
        throw new Error(`unexpected ${url}`);
      },
    });
    const res = await hb.start(account, session, undefined, new AbortController().signal);
    assert.deepEqual(res.tracks.map(t => t.origin.id), ['111', '222']);
  }
});
