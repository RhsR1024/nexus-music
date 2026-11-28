import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountInsightsStore,
  formatExpireDate,
  parseBodianVipInfo,
  parseKugouVipInfo,
  parseNeteaseUserDetail,
  parseNeteaseVipInfo,
  parseQishuiVipInfo,
  parseQQVipInfo,
} from '../src/providers/accountInsights.ts';
import { extractTrackArtists, splitArtistNames } from '../src/domain/artistNames.ts';
import { AlbumProvider } from '../src/providers/albums.ts';
import { AccountPlaybackResolver } from '../src/providers/accountPlaybackResolver.ts';
import { ArtistProvider } from '../src/providers/artists.ts';
import { QishuiProvider } from '../src/providers/qishui.ts';
import { selectShazamWindows } from '../src/providers/shazamSignature.ts';
import type { Track } from '../src/domain/track.ts';
import type { MusicAccount, MusicSession } from '../src/providers/musicAccounts.ts';

const NOW = Date.UTC(2026, 10, 28, 6, 0, 0);
const FUTURE = Date.UTC(2027, 5, 15, 0, 0, 0);
const PAST = Date.UTC(2025, 0, 1, 0, 0, 0);

test('multi-platform VIP parsers recognize active tiers and expired non-members', () => {
  // NetEase
  assert.deepEqual(
    parseNeteaseVipInfo({ code: 200, data: { redplus: { vipCode: 100, expireTime: FUTURE } } }, NOW),
    { tier: 'wy_svip', expireAt: FUTURE },
  );
  assert.deepEqual(
    parseNeteaseVipInfo({ code: 200, data: { associator: { vipCode: 100, expireTime: FUTURE } } }, NOW),
    { tier: 'wy_vip', expireAt: FUTURE },
  );
  assert.deepEqual(
    parseNeteaseVipInfo({ code: 200, data: { musicPackage: { vipCode: 200, expireTime: FUTURE } } }, NOW),
    { tier: 'wy_package', expireAt: FUTURE },
  );
  assert.deepEqual(
    parseNeteaseVipInfo({ code: 200, data: { associator: { vipCode: 100, expireTime: PAST } } }, NOW),
    { tier: 'none' },
  );
  assert.deepEqual(parseNeteaseVipInfo({}, NOW), { tier: 'unknown' });

  // NetEase user detail stats
  assert.deepEqual(
    parseNeteaseUserDetail({
      code: 200,
      level: 8,
      listenSongs: 12345,
      profile: { follows: 42, followeds: 19, playlistCount: 15 },
    }),
    { level: 8, listenSongs: 12345, follows: 42, followeds: 19, playlistCount: 15 },
  );

  // QQ Music
  const qqWrap = (identity: Record<string, unknown>) => ({ code: 0, req_0: { code: 0, data: { identity } } });
  assert.equal(parseQQVipInfo(qqWrap({ HugeVip: 1, HugeVipEnd: '2027-06-15' }), NOW).tier, 'tx_super');
  assert.equal(parseQQVipInfo(qqWrap({ LMFlag: 1, LMEnd: '2027-06-15' }), NOW).tier, 'tx_deluxe');
  assert.equal(parseQQVipInfo(qqWrap({ vip: 1, overdate: '2027-06-15' }), NOW).tier, 'tx_green');
  assert.deepEqual(parseQQVipInfo(qqWrap({ HugeVip: 1, HugeVipEnd: '2025-01-01', vip: 0 }), NOW), { tier: 'none' });

  // Kugou
  assert.equal(parseKugouVipInfo({ status: 1, data: { vip_type: 6, expire_time: Math.floor(FUTURE / 1000) } }, NOW).tier, 'kg_super');
  assert.equal(parseKugouVipInfo({ status: 1, data: { vip_type: 11, expire_time: Math.floor(FUTURE / 1000) } }, NOW).tier, 'kg_deluxe');
  assert.equal(parseKugouVipInfo({ status: 1, data: { vip_type: 1, expire_time: Math.floor(FUTURE / 1000) } }, NOW).tier, 'kg_vip');
  assert.deepEqual(parseKugouVipInfo({ status: 1, data: { vip_type: 0 } }, NOW), { tier: 'none' });
  assert.deepEqual(parseKugouVipInfo({ status: 1, data: { vip_type: 6, expire_time: Math.floor(PAST / 1000) } }, NOW), { tier: 'none' });

  // Bodian
  assert.equal(parseBodianVipInfo({ vipType: 1, payVipType: 2, vipExpireTime: FUTURE }, NOW).tier, 'bodian_vip');
  assert.equal(parseBodianVipInfo({ vipType: 2, payVipType: 1, vipExpireTime: FUTURE }, NOW).tier, 'bodian_big');
  assert.deepEqual(parseBodianVipInfo({ vipType: 1, payVipType: 2, vipExpireTime: PAST }, NOW), { tier: 'none' });
  assert.deepEqual(parseBodianVipInfo({ isVip: 0, vipType: 0 }, NOW), { tier: 'none' });

  // Qishui
  assert.deepEqual(parseQishuiVipInfo({ is_vip: true }), { tier: 'qishui_vip' });
  assert.deepEqual(parseQishuiVipInfo({ is_vip: false }), { tier: 'none' });
  assert.deepEqual(parseQishuiVipInfo({}), { tier: 'unknown' });

  assert.equal(formatExpireDate(FUTURE), '2027-06-15');
});

test('AccountInsightsStore refreshes all 5 platforms, persists safely without secrets, and restores', async () => {
  const saved = new Map<string, unknown>();
  const repository = {
    async get<T>(key: string): Promise<T | undefined> {
      return saved.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T): Promise<void> {
      saved.set(key, value);
    },
  };

  const accounts: MusicAccount[] = [
    { id: 'wy-1', platform: 'wy', username: 'netease:10001', label: 'WY', displayName: '云村用户', updatedAt: NOW, capabilities: [] },
    { id: 'tx-1', platform: 'tx', username: 'qq:20002', label: 'QQ', displayName: '绿钻用户', updatedAt: NOW, capabilities: [] },
    { id: 'kg-1', platform: 'kg', username: 'kugou:30003', label: 'KG', displayName: '酷狗用户', updatedAt: NOW, capabilities: [] },
  ];
  const sessions: Record<string, MusicSession> = {
    'wy-1': { platform: 'wy', userId: '10001', cookies: { MUSIC_U: 'SECRET_WY_COOKIE_VALUE', __csrf: 'csrf123' } },
    'tx-1': { platform: 'tx', userId: '20002', cookies: { uin: '20002', qm_keyst: 'SECRET_QQ_KEYST' } },
    'kg-1': { platform: 'kg', userId: '30003', token: 'SECRET_KG_TOKEN', mid: 'mid-1' },
  };

  const http = async (url: string) => {
    if (url.includes('/music-vip-membership/client/vip/info')) {
      return { code: 200, data: { redplus: { vipCode: 100, expireTime: FUTURE } } };
    }
    if (url.includes('/weapi/v1/user/detail/10001')) {
      return { code: 200, level: 8, listenSongs: 4567, profile: { follows: 18, followeds: 9, playlistCount: 12 } };
    }
    if (url.includes('u.y.qq.com/cgi-bin/musicu.fcg')) {
      return {
        code: 0,
        req_0: { code: 0, data: { identity: { LMFlag: 1, LMEnd: '2027-06-15' } } },
        playlists: { code: 0, data: { v_playlist: [{ dirid: 1 }, { dirid: 2 }, { dirid: 3 }] } },
      };
    }
    if (url.includes('kugouvip.kugou.com/v1/get_union_vip')) {
      return { status: 1, data: { vip_type: 6, expire_time: Math.floor(FUTURE / 1000) } };
    }
    if (url.includes('gateway.kugou.com/v7/get_all_list')) {
      return { status: 1, data: { info: [{ listid: 1 }, { listid: 2 }, { listid: 3 }, { listid: 4 }] } };
    }
    if (url.includes('api.qishui.com/luna/pc/user/info')) {
      return { status_code: 0, user_info: { is_vip: true } };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const store = new AccountInsightsStore({
    repository,
    http: http as never,
    md5: async s => `md5_${s.length}`,
    musicAccounts: {
      getSnapshot: () => accounts,
      session: async id => sessions[id]!,
    },
    qishui: {
      fetchUserPlaylists: async () => [{ id: 'q1', title: 'P1', trackCount: 5 }, { id: 'q2', title: 'P2', trackCount: 8 }],
    },
    qishuiAccount: {
      getSnapshot: () => ({
        loggedIn: true,
        nickname: '汽水测试',
        playlists: [{ id: 'q1', title: 'P1', trackCount: 5, tracks: [] }],
        liked: [],
      } as never),
      sessionCookieHeader: async () => 'sessionid=SECRET_QISHUI_SESSION',
    },
    bodian: {
      fetchProfile: async () => ({ nickname: '波点测试', isVip: true, vipLabel: '波点大会员', vipTier: 'bodian_big', expireAt: FUTURE }),
      userCollections: async () => ({
        created: [{ id: 'b1', title: 'B1', trackCount: 3 } as never],
        collectedPlaylists: [{ id: 'b2', title: 'B2', trackCount: 7 } as never],
        collectedAlbums: [],
      }),
    },
    bodianAccount: {
      getSnapshot: () => ({ loggedIn: true, userId: 'bd-1', nickname: '波点测试', isVip: true } as never),
      session: async () => ({ userId: 'bd-1', token: 'SECRET_BODIAN_TOKEN' } as never),
    },
    now: () => NOW,
  });

  await store.refreshAll();

  const wy = store.get('wy-1');
  assert.equal(wy?.membership, 'wy_svip');
  assert.equal(wy?.membershipLabel, '黑胶SVIP');
  assert.equal(wy?.isMember, true);
  assert.equal(wy?.level, 8);
  assert.equal(wy?.listenSongs, 4567);
  assert.equal(wy?.follows, 18);
  assert.equal(wy?.followeds, 9);
  assert.equal(wy?.playlistCount, 12);

  const tx = store.get('tx-1');
  assert.equal(tx?.membership, 'tx_deluxe');
  assert.equal(tx?.membershipLabel, '豪华绿钻');
  assert.equal(tx?.playlistCount, 3);

  const kg = store.get('kg-1');
  assert.equal(kg?.membership, 'kg_super');
  assert.equal(kg?.membershipLabel, '超级VIP');
  assert.equal(kg?.playlistCount, 4);

  const qs = store.get('qishui:default');
  assert.equal(qs?.membership, 'qishui_vip');
  assert.equal(qs?.membershipLabel, '汽水会员');
  assert.equal(qs?.playlistCount, 2);

  const bd = store.get('bodian:default');
  assert.equal(bd?.membership, 'bodian_big');
  assert.equal(bd?.membershipLabel, '波点大会员');
  assert.equal(bd?.playlistCount, 2);

  // Verify zero credentials persisted
  const serialized = JSON.stringify(saved.get('accountInsights.v1'));
  assert.equal(serialized.includes('SECRET_WY_COOKIE_VALUE'), false);
  assert.equal(serialized.includes('SECRET_QQ_KEYST'), false);
  assert.equal(serialized.includes('SECRET_KG_TOKEN'), false);
  assert.equal(serialized.includes('SECRET_QISHUI_SESSION'), false);
  assert.equal(serialized.includes('SECRET_BODIAN_TOKEN'), false);

  // Verify restore into a fresh store
  const restored = new AccountInsightsStore({
    repository,
    md5: async () => '',
    musicAccounts: { getSnapshot: () => [], session: async () => ({ platform: 'wy', cookies: {} }) },
    qishui: { fetchUserPlaylists: async () => [] },
    qishuiAccount: { getSnapshot: () => ({ loggedIn: false, nickname: '', playlists: [], liked: [] } as never), sessionCookieHeader: async () => undefined },
    bodian: {
      fetchProfile: async () => ({ isVip: false }),
      userCollections: async () => ({ created: [], collectedPlaylists: [], collectedAlbums: [] }),
    },
    bodianAccount: { getSnapshot: () => ({ loggedIn: false } as never), session: async () => null },
  });
  await restored.restore();
  assert.equal(restored.get('wy-1')?.level, 8);
  assert.equal(restored.get('tx-1')?.membershipLabel, '豪华绿钻');
  assert.equal(restored.get('kg-1')?.membershipLabel, '超级VIP');
});

test('splitArtistNames and extractTrackArtists split collaborations and pair platform IDs', () => {
  assert.deepEqual(splitArtistNames('周杰伦'), ['周杰伦']);
  assert.deepEqual(splitArtistNames('林俊杰 / 麻吉 / JJ陆'), ['林俊杰', '麻吉', 'JJ陆']);
  assert.deepEqual(splitArtistNames('周杰伦、费玉清'), ['周杰伦', '费玉清']);
  assert.deepEqual(splitArtistNames('许嵩 (with 何曼婷)'), ['许嵩', '何曼婷']);
  assert.deepEqual(splitArtistNames('Jay Chou feat. Lara'), ['Jay Chou', 'Lara']);
  assert.deepEqual(splitArtistNames('周杰伦 & 温岚'), ['周杰伦', '温岚']);
  assert.deepEqual(splitArtistNames('赵本山&赵大牛&球球'), ['赵本山', '赵大牛', '球球']);
  assert.deepEqual(splitArtistNames('张学友＆王菲'), ['张学友', '王菲']);
  assert.deepEqual(splitArtistNames('林俊杰 / 麻吉&JJ陆'), ['林俊杰', '麻吉', 'JJ陆']);
  assert.deepEqual(splitArtistNames('A&B'), ['A&B']);

  const collabTrack: Track = {
    origin: { kind: 'online', platform: 'tx', id: 'song-1' },
    title: '主角',
    artist: '林俊杰 / 麻吉',
    album: 'JJ陆',
    qualities: [],
    metadata: { artistIds: ['001BLpXF2DyJe2', '003abcDEF12345'] },
  };
  assert.deepEqual(extractTrackArtists(collabTrack), [
    { name: '林俊杰', id: '001BLpXF2DyJe2', platform: 'tx' },
    { name: '麻吉', id: '003abcDEF12345', platform: 'tx' },
  ]);

  const localTrack: Track = {
    origin: { kind: 'local', id: 'local-1' },
    title: '千里之外',
    artist: '周杰伦 / 费玉清',
    album: '依然范特西',
    qualities: [],
    metadata: {},
  };
  assert.deepEqual(extractTrackArtists(localTrack), [
    { name: '周杰伦' },
    { name: '费玉清' },
  ]);
});

test('ArtistProvider.resolveByName and similar handle WY auth + anonymous QQ fallback', async () => {
  const provider = new ArtistProvider({
    http: (async (url: string, init?: { body?: unknown }) => {
      if (url.includes('/weapi/discovery/simiArtist')) {
        return {
          code: 200,
          artists: [
            { id: 6452, name: '周杰伦', img1v1Url: 'https://p1.music.126.net/jay.jpg' },
            { id: 3684, name: '林俊杰', img1v1Url: 'https://p1.music.126.net/jj.jpg' },
          ],
        };
      }
      if (url.includes('u.y.qq.com/cgi-bin/musics.fcg')) {
        const body = String(init?.body ?? '');
        if (body.includes('DoSearchForQQMusicDesktop')) {
          return {
            code: 0,
            req: {
              code: 0,
              data: {
                body: {
                  singer: {
                    list: [{ singerMID: '0025NhlN2yWrP4', singerName: '周杰伦', singerPic: 'https://y.gtimg.cn/jay.jpg' }],
                  },
                },
              },
            },
          };
        }
        if (body.includes('GetSimilarSingerList')) {
          return {
            code: 0,
            req: {
              code: 0,
              data: {
                singerlist: [
                  { singerMid: '001JDzPT3JdvqK', singerName: '王力宏' },
                  { singerMid: '001BLpXF2DyJe2', singerName: '林俊杰' },
                ],
              },
            },
          };
        }
      }
      throw new Error(`Unexpected call: ${url}`);
    }) as never,
    md5: async () => '00000000000000000000000000000000',
    sha1: async () => '0000000000000000000000000000000000000000',
    deviceId: () => 'test-device-id-0001',
  });

  const controller = new AbortController();

  // Direct known ID resolution
  const direct = await provider.resolveByName('周杰伦', 'tx', '0025NhlN2yWrP4', controller.signal);
  assert.equal(direct.platform, 'tx');
  assert.equal(direct.artist.id, '0025NhlN2yWrP4');

  // Authenticated NetEase similar artists
  const wySim = await provider.similar(
    'wy',
    { id: '3684', title: '林俊杰' },
    controller.signal,
    { neteaseSession: { cookies: { MUSIC_U: 'test-token', __csrf: 'csrf' } } },
  );
  assert.equal(wySim.platform, 'wy');
  assert.equal(wySim.items.length, 2);
  assert.equal(wySim.items[0]?.title, '周杰伦');

  // Anonymous WY artist falls back cleanly to QQ anonymous GetSimilarSingerList
  const fallbackSim = await provider.similar('wy', { id: '6452', title: '周杰伦' }, controller.signal);
  assert.equal(fallbackSim.platform, 'tx');
  assert.equal(fallbackSim.items.length, 2);
  assert.equal(fallbackSim.items[0]?.title, '王力宏');
  assert.ok(fallbackSim.items[0]?.artwork?.includes('T001R300x300M000001JDzPT3JdvqK'));
});

test('AlbumProvider.detail uses NetEase /api/v1/album and tolerates partial copyright removals', async () => {
  const seenUrls: string[] = [];
  const provider = new AlbumProvider({
    http: async url => {
      seenUrls.push(url);
      return {
        code: 200,
        album: { id: 363435330, name: '飞瀑而下', size: 2, publishTime: Date.UTC(2026, 2, 1), artist: { name: '孙燕姿' } },
        songs: [
          {
            id: 3352859087,
            name: '飞瀑而下',
            ar: [{ id: 9272, name: '孙燕姿' }],
            al: { id: 363435330, name: '飞瀑而下', picUrl: 'https://p1.music.126.net/cover.jpg' },
            dt: 245000,
          },
        ],
      };
    },
    md5: async () => '',
    sha1: async () => 'a'.repeat(40),
    deviceId: () => 'test-device',
  });
  const detail = await provider.detail('wy', { id: '363435330', title: '飞瀑而下' }, 1, new AbortController().signal);
  assert.equal(seenUrls[0], 'https://music.163.com/api/v1/album/363435330');
  assert.equal(detail.items.length, 1);
  assert.equal(detail.items[0]?.title, '飞瀑而下');
  assert.equal(detail.total, 1);
});

test('QishuiProvider.directPlayback parses video_model + VOD PlayInfoList anonymously and rejects previews', async () => {
  const fullTrack: Track = {
    origin: { kind: 'imported', platform: 'qishui', id: '6777691046773000193' },
    title: "Don't Let Me Down",
    artist: 'The Chainsmokers',
    durationMs: 208823,
    qualities: [],
    metadata: {},
  };
  const qishui = new QishuiProvider(async url => {
    if (url.includes('/luna/h5/seo_track')) {
      return {
        track: { duration: 208823, playable_range: { start: 30720, duration: 25344 } },
        track_player: {
          expire_at: Math.floor(Date.now() / 1000) + 3600,
          url_player_info: 'https://vod-luna.douyin.com/?Action=GetPlayInfo&Version=2019-03-15',
          video_model: JSON.stringify({
            video_duration: 208.774,
            video_list: [
              { main_url: 'https://v11-luna.douyinvod.com/low.m4a', bitrate: 128000, quality: 'higher', format: 'm4a' },
            ],
          }),
        },
      };
    }
    if (url.includes('Action=GetPlayInfo')) {
      return {
        Result: {
          Data: {
            PlayInfoList: [
              { Quality: 'higher', Format: 'm4a', Bitrate: 129449, Duration: 208.774, Size: 3378207, MainPlayUrl: 'https://v11-luna.douyinvod.com/128.m4a' },
              { Quality: 'highest', Format: 'm4a', Bitrate: 257489, Duration: 208.774, Size: 6719651, MainPlayUrl: 'https://v11-luna.douyinvod.com/320.m4a' },
            ],
          },
        },
      };
    }
    throw new Error(`Unexpected Qishui URL: ${url}`);
  });

  const stream = await qishui.directPlayback(fullTrack, undefined, new AbortController().signal, 'flac');
  assert.ok(stream);
  assert.equal(stream.url, 'https://v11-luna.douyinvod.com/320.m4a');
  assert.equal(stream.quality, '320k');

  // Preview-only track (29s vs 218s) must be strictly rejected
  const previewQishui = new QishuiProvider(async () => ({
    track: { duration: 218133 },
    track_player: {
      video_model: JSON.stringify({
        video_duration: 29.002,
        video_list: [{ main_url: 'https://v11-luna.douyinvod.com/preview.m4a', bitrate: 129000, quality: 'higher' }],
      }),
    },
  }));
  assert.equal(
    await previewQishui.directPlayback(fullTrack, undefined, new AbortController().signal, 'flac'),
    null,
  );
});

test('AccountPlaybackResolver plays free Qishui anonymously, resolves QQ media_mid + downgrades 403 fake FLAC, and cross-falls back to signed-in platforms', async () => {
  const ctrl = new AbortController();

  // 1. Anonymous Qishui free track plays directly without account login!
  const qishuiTrack: Track = {
    origin: { kind: 'imported', platform: 'qishui', id: '6777691046773000193' },
    title: 'Free Qishui Song',
    artist: 'Artist',
    qualities: [],
    metadata: {},
  };
  const anonResolver = new AccountPlaybackResolver({
    enabled: () => true,
    quality: () => 'flac',
    musicAccounts: { getSnapshot: () => [], session: async () => ({}) },
    qishui: {
      directPlayback: async (_t, cookie) => {
        assert.equal(cookie, undefined);
        return { url: 'https://v11-luna.douyinvod.com/free-full.m4a', quality: '320k' };
      },
    },
    qishuiAccount: {
      getSnapshot: () => ({ loggedIn: false } as never),
      sessionCookieHeader: async () => undefined,
    },
    md5: async () => '00000000000000000000000000000000',
    hash: async s => `h:${s}`,
  });
  const qsHit = await anonResolver.resolve(qishuiTrack, ctrl.signal);
  assert.ok(qsHit);
  assert.equal(qsHit.sourceName, '汽水官方免费直连');
  assert.equal(qsHit.url, 'https://v11-luna.douyinvod.com/free-full.m4a');

  // 2. QQ media_mid lookup + probe downgrades 403 fake FLAC to working C400 m4a
  const qqTrack: Track = {
    origin: { kind: 'online', platform: 'tx', id: '0039MnYb0qxYhV' },
    title: '晴天',
    artist: '周杰伦',
    qualities: [],
    metadata: {},
  };
  let fetchedMediaMid = false;
  const qqResolver = new AccountPlaybackResolver({
    enabled: () => true,
    quality: () => 'flac',
    musicAccounts: {
      getSnapshot: () => [
        { id: 'tx-1', platform: 'tx', label: 'QQ', username: 'qq:100', capabilities: [], updatedAt: NOW },
      ],
      session: async () => ({ platform: 'tx', cookies: { uin: '100', qm_keyst: 'key123' } }),
    },
    http: async (url, init) => {
      if (init?.method === 'POST' && String(init.body).includes('get_song_detail_yqq')) {
        fetchedMediaMid = true;
        return { songinfo: { code: 0, data: { track_info: { file: { media_mid: '003Qui1q2u1Zho' } } } } };
      }
      if (url.includes('F000') && url.includes('003Qui1q2u1Zho')) {
        return { req_0: { data: { sip: ['https://ws.stream.qqmusic.qq.com/'], midurlinfo: [{ purl: 'fake403.flac' }] } } };
      }
      if (url.includes('C400') && url.includes('003Qui1q2u1Zho')) {
        return { req_0: { data: { sip: ['https://ws.stream.qqmusic.qq.com/'], midurlinfo: [{ purl: 'good.m4a' }] } } };
      }
      return { req_0: { data: { sip: ['https://ws.stream.qqmusic.qq.com/'], midurlinfo: [{ purl: '' }] } } };
    },
    probeUrl: async url => (url.includes('fake403.flac') ? 'forbidden' : 'ok'),
    md5: async () => '00000000000000000000000000000000',
    hash: async s => `h:${s}`,
  });
  const qqHit = await qqResolver.resolve(qqTrack, ctrl.signal);
  assert.equal(fetchedMediaMid, true);
  assert.ok(qqHit);
  assert.equal(qqHit.url, 'https://ws.stream.qqmusic.qq.com/good.m4a');
  assert.equal(qqHit.quality, '128k');

  // 3. Cross-platform signed-in fallback when Qishui track is preview-only
  const wyMatched: Track = {
    origin: { kind: 'online', platform: 'wy', id: '186016' },
    title: 'Free Qishui Song',
    artist: 'Artist',
    qualities: [{ id: 'flac' }],
    metadata: {},
  };
  const crossResolver = new AccountPlaybackResolver({
    enabled: () => true,
    quality: () => 'flac',
    musicAccounts: {
      getSnapshot: () => [
        { id: 'wy-1', platform: 'wy', label: 'WY', username: 'netease:1', capabilities: [], updatedAt: NOW },
      ],
      session: async () => ({ platform: 'wy', cookies: { MUSIC_U: 'valid-cookie', __csrf: 'c' } }),
    },
    qishui: { directPlayback: async () => null },
    qishuiAccount: { getSnapshot: () => ({ loggedIn: false } as never), sessionCookieHeader: async () => undefined },
    matcher: {
      candidates: async () => ({
        items: [{ track: wyMatched, automatic: true, score: 100, reasons: [] } as never],
        failedPlatforms: [],
      }),
    },
    http: async () => ({
      code: 200,
      data: [{ code: 200, url: 'https://m8.music.126.net/full.flac', level: 'lossless', freeTrialInfo: null }],
    }),
    md5: async () => '00000000000000000000000000000000',
    hash: async s => `h:${s}`,
  });
  const crossHit = await crossResolver.resolve(qishuiTrack, ctrl.signal);
  assert.ok(crossHit);
  assert.equal(crossHit.sourceName, '网易云账号直连');
  assert.equal(crossHit.matchedTrack?.origin.id, '186016');
});

test('selectShazamWindows keeps <=12s clips intact and extracts highest-energy 12s windows from 15s–25s clips', () => {
  const shortClip = new Int16Array(8 * 16000);
  assert.equal(selectShazamWindows(shortClip).length, 1);

  // 20s clip: first 6s quiet, 6s..18s loud chorus -> highest-energy 12s window must start around 6s!
  const longClip = new Int16Array(20 * 16000);
  for (let i = 6 * 16000; i < 18 * 16000; i++) {
    longClip[i] = Math.round(Math.sin(i * 0.1) * 20000);
  }
  const windows = selectShazamWindows(longClip);
  assert.ok(windows.length >= 2 && windows.length <= 3);
  assert.equal(windows[0]!.length, 12 * 16000);
  // First window must be the loud chorus window (high average amplitude), not the silent intro
  let avgAbs = 0;
  for (let i = 0; i < windows[0]!.length; i += 64) avgAbs += Math.abs(windows[0]![i]!);
  avgAbs /= windows[0]!.length / 64;
  assert.ok(avgAbs > 10000);
});
