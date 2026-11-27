import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { defaults as prefDefaults } from '../src/app/preferences.ts';
import { appearanceDefaults } from '../src/domain/appearance.ts';
import { RADIO_GLOBE_HTML } from '../src/providers/globalRadio.ts';
import { EARTH_BLUE_MARBLE_DATA_URI } from '../src/providers/earthTexture.ts';
import { onlineTrack } from '../src/providers/online.ts';
import { enrichKugouTrackArtworks } from '../src/providers/kugouTrackDetails.ts';
import { QQPlaylists } from '../src/providers/qqPlaylists.ts';
import { VideoProvider } from '../src/providers/videos.ts';
import { parseQishuiCookiePayload, MUSIC_WEB_LOGIN_URLS } from '../src/providers/musicWebLogin.ts';
import { QishuiAccountStore } from '../src/providers/qishui.ts';
import {
  AudioMatchCoordinator,
  bytesToBase64,
  base64ToBytes,
  hmacSha1Base64,
  identifyWithACRCloud,
  identifyWithAudD,
} from '../src/providers/audioMatch.ts';

test('Items 17 & 18: default preferences enable 3-track preload and dynamic cover-following backgrounds', () => {
  assert.equal(prefDefaults.preloadNextTrack, true);
  assert.equal(prefDefaults.preloadCount, 3);

  assert.equal(appearanceDefaults.coverColor, true);
  assert.equal(appearanceDefaults.globalBackgroundMotion, true);
  assert.equal(appearanceDefaults.dynamicBackground, true);
});

test('Item 1: global radio 3D globe embeds photorealistic NASA Blue Marble satellite texture', () => {
  assert.ok(EARTH_BLUE_MARBLE_DATA_URI.startsWith('data:image/jpeg;base64,'));
  assert.ok(EARTH_BLUE_MARBLE_DATA_URI.length > 50_000);
  assert.ok(RADIO_GLOBE_HTML.includes(EARTH_BLUE_MARBLE_DATA_URI.slice(0, 80)));
  assert.ok(RADIO_GLOBE_HTML.includes('uEarth'));
  assert.ok(RADIO_GLOBE_HTML.includes('window.nexusGlobe'));
});

test('Items 8 & 12: Kugou and Migu track parsing extracts and normalizes HTTPS artwork URLs', async () => {
  const kg = onlineTrack('kg', {
    FileHash: 'abcdef1234567890abcdef1234567890',
    SongName: '测试酷狗歌曲',
    SingerName: '测试歌手',
    AlbumName: '测试专辑',
    Duration: 215,
    trans_param: { union_cover: 'http://imge.kugou.com/stdmusic/{size}/20240101/test.jpg' },
  });
  assert.equal(kg.artwork, 'https://imge.kugou.com/stdmusic/400/20240101/test.jpg');

  const mgRank = onlineTrack('mg', {
    id: '60054701923',
    copyrightId: '60054701923',
    songName: '测试咪咕热歌',
    singer: '测试歌手',
    albumImgs: [
      { imgSizeType: '01', img: 'https://d.musicapp.migu.cn/small.jpg' },
      { imgSizeType: '02', img: 'https://d.musicapp.migu.cn/medium.jpg' },
    ],
  });
  assert.equal(mgRank.artwork, 'https://d.musicapp.migu.cn/medium.jpg');

  const mgRel = onlineTrack('mg', {
    songId: '60054701924',
    copyrightId: '60054701924',
    name: '相对路径歌曲',
    artists: [{ name: '歌手B' }],
    img2: '/data/oss/resource/cover_rel.webp',
  });
  assert.equal(mgRel.artwork, 'https://d.musicapp.migu.cn/data/oss/resource/cover_rel.webp');

  const bareKg = onlineTrack('kg', {
    FileHash: '11112222333344445555666677778888',
    SongName: '无封面歌曲',
    SingerName: '歌手C',
    Duration: 180,
  });
  assert.equal(bareKg.artwork, undefined);

  const enriched = await enrichKugouTrackArtworks(
    async () => ({
      data: [
        [
          {
            audio_info: { hash: '11112222333344445555666677778888' },
            album_info: { sizable_cover: 'http://imge.kugou.com/stdmusic/{size}/20250101/enriched.jpg' },
          },
        ],
      ],
    }),
    [bareKg],
    new AbortController().signal,
  );
  assert.equal(enriched[0]?.artwork, 'https://imge.kugou.com/stdmusic/400/20250101/enriched.jpg');
});

test('Item 10: VideoProvider.allNetease parses paginated MV catalog with area and order filters', async () => {
  const urls: string[] = [];
  const videos = new VideoProvider({
    md5: async s => s,
    sha1: async s => s,
    deviceId: () => 'test-dev',
    http: async url => {
      urls.push(url);
      return {
        code: 200,
        hasMore: true,
        count: 5000,
        data: [
          { id: 1001, name: '晴天 MV', artistName: '周杰伦', cover: 'http://p1.music.126.net/mv1.jpg', playCount: 123456, duration: 269000 },
          { id: 1002, name: '夜曲 MV', artistName: '周杰伦', cover: 'https://p2.music.126.net/mv2.jpg', playCount: 98765, duration: 226000 },
        ],
      };
    },
  });
  const res = await videos.allNetease({ area: '港台', order: '最热', page: 2, limit: 20 }, new AbortController().signal);
  assert.equal(res.items.length, 2);
  assert.equal(res.hasMore, true);
  assert.equal(res.total, 5000);
  assert.equal(res.items[0]?.artwork, 'https://p1.music.126.net/mv1.jpg');
  assert.match(urls[0]!, /\/api\/mv\/all\?/);
  assert.match(urls[0]!, /offset=20/);
  assert.match(urls[0]!, /limit=20/);
});

test('Item 11: QQPlaylists lenient mode handles 1200+ liked tracks with delisted/duplicate/drifting rows', async () => {
  const totalSongs = 1205;
  const qq = new QQPlaylists({
    profile: { fetch: async () => ({ userId: '42', nickname: 'TestQQ', encryptedUin: 'enc42' }) },
    http: async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { detail: { param: { song_begin: number; song_num: number } } };
      const begin = body.detail.param.song_begin;
      const size = body.detail.param.song_num;
      const sliceCount = Math.max(0, Math.min(size, totalSongs - begin));
      const songlist = Array.from({ length: sliceCount }, (_, i) => {
        const idx = begin + i;
        // Inject a delisted entry with missing media_mid & album, plus a duplicate mid
        if (idx === 5) return { mid: 'MID00004', name: 'Dup song', singer: [{ name: 'A' }], file: {}, album: null };
        if (idx === 10) return { mid: 'MID00010', name: 'Delisted song', singer: [{ name: 'B' }], file: {}, album: null };
        return {
          mid: `MID${String(idx).padStart(5, '0')}`,
          name: `Liked Song ${idx}`,
          singer: [{ name: 'Artist' }],
          file: { media_mid: `MEDIA${String(idx).padStart(5, '0')}` },
          album: { mid: 'ALB1', name: 'Album 1' },
          interval: 200,
        };
      });
      return {
        code: 0,
        detail: {
          code: 0,
          data: {
            // Simulate server total_song_num slightly higher than returned songlist
            total_song_num: totalSongs + 3,
            hasmore: begin + sliceCount < totalSongs,
            songlist,
          },
        },
      };
    },
  });

  const account = {
    id: 'a'.repeat(64),
    platform: 'tx' as const,
    label: 'QQ 音乐',
    username: 'qq:2:42',
    capabilities: [],
    updatedAt: 1,
  };
  const session = {
    version: 1,
    platform: 'tx',
    accountId: account.id,
    userId: '42',
    cookies: { qqmusic_key: 'Q_H_L_test', qqmusic_uin: '42', login_type: '1' },
  };
  const playlist = { id: 'dir:201', title: '我喜欢', count: totalSongs, coverUrl: '', kind: 'created' as const };
  const tracks = await qq.tracks(account, session, playlist, new AbortController().signal, () => {}, { lenient: true });
  assert.equal(tracks.length, totalSongs - 1); // 1 duplicate skipped, delisted song preserved cleanly
  assert.equal(tracks[0]?.title, 'Liked Song 0');
});

test('Item 13: Qishui WebView cookie validation and account login persistence keep secrets out of repository', async () => {
  assert.equal(MUSIC_WEB_LOGIN_URLS.qishui, 'https://music.douyin.com/qishui');
  const parsed = parseQishuiCookiePayload(JSON.stringify({ sessionid: 'qs-token', uid_tt: 'uid-99', random_ignored: 'drop' }));
  assert.deepEqual(parsed, { sessionid: 'qs-token', uid_tt: 'uid-99' });
  assert.throws(() => parseQishuiCookiePayload(JSON.stringify({ sessionid: 'qs-token' })));

  const records = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  const store = new QishuiAccountStore(
    { get: async <T>(k: string) => records.get(k) as T | undefined, put: async (k: string, v: unknown) => { records.set(k, v); } },
    { get: async k => secrets.get(k) ?? null, set: async (k, v) => { secrets.set(k, v); }, remove: async k => { secrets.delete(k); } },
  );
  const snap = await store.loginWithWebView({
    native: { open: async () => JSON.stringify({ sessionid: 'qs-secret-val', uid_tt: 'u123' }), cancel: async () => {} },
    uuid: () => 'qs-attempt-1',
    http: async () => ({ user_info: { nickname: '汽水听众', id: '8801', avatar_url: 'https://p3.douyinpic.com/a.jpg' } }),
  });
  assert.equal(snap.loggedIn, true);
  assert.equal(snap.nickname, '汽水听众');
  assert.equal(snap.userId, '8801');
  assert.doesNotMatch(JSON.stringify(records.get('qishui.account.v1')), /qs-secret-val/);
  assert.match(secrets.get('nexus.music.qishui.v1') ?? '', /qs-secret-val/);

  await store.logout();
  assert.equal(store.getSnapshot().loggedIn, false);
  assert.equal(secrets.has('nexus.music.qishui.v1'), false);
});

test('Item 15: AudioMatch HMAC-SHA1 matches Node crypto and supports ACRCloud & AudD clip upload recognition', async () => {
  const sig = hmacSha1Base64('my-secret-key', 'POST\n/v1/identify\nmy-key\naudio\n1\n1700000000');
  const expected = createHmac('sha1', 'my-secret-key').update('POST\n/v1/identify\nmy-key\naudio\n1\n1700000000').digest('base64');
  assert.equal(sig, expected);

  const sample = new Uint8Array(2048);
  for (let i = 0; i < sample.length; i++) sample[i] = i & 0xff;
  assert.deepEqual(base64ToBytes(bytesToBase64(sample)), sample);

  const acrHit = await identifyWithACRCloud(
    sample,
    'test.wav',
    { host: 'identify-cn-north-1.acrcloud.cn', accessKey: 'ak', accessSecret: 'as' },
    (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: { code: 0, msg: 'Success' },
        metadata: {
          music: [{ title: '稻香', artists: [{ name: '周杰伦' }], album: { name: '魔杰座' }, score: 98 }],
        },
      }),
    })) as unknown as typeof fetch,
  );
  assert.equal(acrHit?.provider, 'acrcloud');
  assert.equal(acrHit?.title, '稻香');
  assert.equal(acrHit?.artist, '周杰伦');
  assert.equal(acrHit?.score, 98);

  const auddHit = await identifyWithAudD(
    bytesToBase64(sample),
    '',
    (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        result: { title: '七里香', artist: '周杰伦', album: '七里香' },
      }),
    })) as unknown as typeof fetch,
  );
  assert.equal(auddHit?.provider, 'audd');
  assert.equal(auddHit?.title, '七里香');

  const records = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  const coordinator = new AudioMatchCoordinator({
    native: null,
    repository: { get: async <T>(k: string) => records.get(k) as T | undefined, put: async (k: string, v: unknown) => { records.set(k, v); } },
    secrets: { get: async k => secrets.get(k) ?? null, set: async (k, v) => { secrets.set(k, v); }, remove: async k => { secrets.delete(k); } },
    fetchFn: (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', result: { title: '告白气球', artist: '周杰伦', album: '周杰伦的床边故事' } }),
    })) as unknown as typeof fetch,
    search: async (platform, query) => ({
      items: platform === 'wy' ? [{ origin: { kind: 'online', platform: 'wy', id: '418603077' }, title: query.split(' ')[0]!, artist: '周杰伦', metadata: {}, qualities: [] }] : [],
    }),
  });
  await coordinator.saveCloudConfig({ provider: 'audd', auddToken: 'secret-audd-tok' });
  assert.doesNotMatch(JSON.stringify(records.get('audioMatch.v1')), /secret-audd-tok/);
  assert.match(secrets.get('nexus.audiomatch.keys.v1') ?? '', /secret-audd-tok/);

  const matchResult = await coordinator.identifyAudioClip({ bytes: sample, filename: 'sample.wav' });
  assert.equal(matchResult?.title, '告白气球');
  assert.equal(coordinator.getSnapshot().results.length, 1);
  assert.equal(coordinator.getSnapshot().results[0]?.title, '告白气球');
});
