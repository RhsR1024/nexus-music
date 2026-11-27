import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  BodianAccountStore,
  BodianProvider,
  decodeBodianLyricContent,
  signBodianRequest,
  stableSortedJson,
} from '../src/providers/bodian.ts';
import { AccountPlaybackResolver } from '../src/providers/accountPlaybackResolver.ts';
import { AccountFeatureCache, formatCacheAge } from '../src/providers/accountFeatureCache.ts';
import { KugouPlaylists } from '../src/providers/kugouPlaylists.ts';
import { QISHUI_ROAM_MODES, QishuiAccountStore, QishuiProvider } from '../src/providers/qishui.ts';
import { AudioMatchCoordinator, bytesToBase64 } from '../src/providers/audioMatch.ts';
import { PreferenceStore } from '../src/app/preferences.ts';
import type { Track } from '../src/domain/track.ts';

const md5 = async (value: string) => crypto.createHash('md5').update(value, 'utf8').digest('hex');
const sha256 = async (value: string) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

function makeMemRepo() {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async <T,>(key: string) => map.get(key) as T | undefined,
    put: async (key: string, value: unknown) => {
      map.set(key, value);
    },
    putMany: async (entries: readonly (readonly [string, unknown])[]) => {
      for (const [k, v] of entries) map.set(k, v);
    },
  };
}

function makeMemSecrets() {
  const map = new Map<string, string>();
  return {
    get: async (k: string) => map.get(k) ?? null,
    set: async (k: string, v: string) => {
      map.set(k, v);
    },
    remove: async (k: string) => {
      map.delete(k);
    },
  };
}

test('Bodian MD5 signing sorts query keys, appends sorted JSON body, and decodes [kuwo:NN] octal word-timed lyrics', async () => {
  assert.equal(stableSortedJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  const bodyText = '{"authType":10,"qrCode":"abc"}';
  const signed = await signBodianRequest({
    path: '/api/ucenter/users/login',
    query: { uid: '-1', timestamp: '1700000000000', token: '' },
    bodyText,
    md5,
  });
  const sortedAlnum = signed.queryString.replace(/[^A-Za-z0-9]/g, '').split('').sort().join('');
  const bodyDigest = await md5(`${bodyText}kuwotest`);
  assert.equal(signed.sign, await md5(`kuwotest${sortedAlnum}${bodyDigest}/api/ucenter/users/login`));

  // [kuwo:33] -> octal 0o33 = 27 -> startFactor=2, durationFactor=7
  const rawLrc = '[kuwo:33]\n[00:01.00]<2000,2000>你<4200,2800>好\n[00:03.00]下一句';
  const decoded = decodeBodianLyricContent(rawLrc);
  assert.ok(decoded.lyric.includes('[00:01.00]你好'));
  assert.ok(decoded.lyric.includes('[00:03.00]下一句'));
  assert.ok(decoded.yrc && decoded.yrc.includes('你') && decoded.yrc.includes('好'));
});

test('BodianProvider QR login, checkRight trial rejection, and direct full-track playback work end-to-end', async () => {
  const calls: string[] = [];
  const provider = new BodianProvider({
    md5,
    now: () => 1_700_000_000_000,
    http: async url => {
      calls.push(url);
      if (url.includes('/api/ucenter/login/qrCodeStatus')) {
        return { code: 200, data: { status: 3 } };
      }
      if (url.includes('/api/ucenter/login/qrCode')) {
        return { code: 200, data: { qrCode: 'qr-key-999' } };
      }
      if (url.includes('/api/ucenter/users/login')) {
        return { code: 200, data: { id: '888111', token: 'bd-token-xyz', userInfo: { nickname: '波点用户' } } };
      }
      if (url.includes('/api/play/music/v2/checkRight')) {
        if (url.includes('musicId=preview-song')) return { code: 200, data: { status: 3 } };
        return { code: 200, data: { status: 1 } };
      }
      if (url.includes('/api/play/music/v2/audioUrl')) {
        return { code: 200, data: { isTry: 0, audioHttpsUrl: 'https://cdn.kuwo.cn/full-track.flac', format: 'flac', bitrate: 1000 } };
      }
      return { code: 200, data: {} };
    },
  });

  const ctrl = new AbortController();
  const qr = await provider.createQr(ctrl.signal);
  assert.equal(qr.key, 'qr-key-999');
  assert.ok(qr.image.startsWith('data:image/png;base64,'));

  const poll = await provider.pollQr(qr, ctrl.signal);
  assert.equal(poll.status, 'connected');
  if (poll.status === 'connected') {
    assert.equal(poll.userId, '888111');
    assert.equal(poll.token, 'bd-token-xyz');
  }

  const sess = { userId: '888111', token: 'bd-token-xyz', deviceId: '0123456789abcdef0123456789abcdef' };
  const previewTrack: Track = {
    origin: { kind: 'imported', platform: 'bodian', id: 'preview-song' },
    title: '试听歌',
    artist: '歌手',
    metadata: {},
    qualities: [],
  };
  assert.equal(await provider.directPlayback(previewTrack, 'flac', sess, ctrl.signal), null);

  const fullTrack: Track = {
    origin: { kind: 'imported', platform: 'bodian', id: 'full-song' },
    title: '完整歌',
    artist: '歌手',
    metadata: {},
    qualities: [],
  };
  const stream = await provider.directPlayback(fullTrack, 'flac', sess, ctrl.signal);
  assert.equal(stream?.url, 'https://cdn.kuwo.cn/full-track.flac');
  assert.equal(stream?.quality, 'flac');

  // Verify BodianAccountStore persists & restores cleanly
  const repo = makeMemRepo();
  const secrets = makeMemSecrets();
  const store = new BodianAccountStore(repo, secrets, () => 'abcdef12-3456-7890-abcd-ef1234567890');
  await store.saveSession({ userId: '888111', token: 'bd-token-xyz', nickname: '波点用户', isVip: true, vipLabel: '波点VIP' });
  const restored = new BodianAccountStore(repo, secrets, () => '00000000-0000-0000-0000-000000000000');
  await restored.restore();
  assert.equal(restored.getSnapshot().loggedIn, true);
  assert.equal(restored.getSnapshot().isVip, true);
  assert.equal((await restored.session())?.token, 'bd-token-xyz');
});

test('AccountPlaybackResolver honors preferAccountPlayback toggle, rejects 30s previews, and resolves full VIP streams', async () => {
  let enabled = false;
  let trialMode = true;
  const wyTrack: Track = {
    origin: { kind: 'online', platform: 'wy', id: '1901371647' },
    title: '孤勇者',
    artist: '陈奕迅',
    metadata: {},
    qualities: [{ id: 'flac' }, { id: '320k' }, { id: '128k' }],
  };

  const resolver = new AccountPlaybackResolver({
    enabled: () => enabled,
    quality: () => 'flac',
    musicAccounts: {
      getSnapshot: () => [
        { id: 'acc-wy', platform: 'wy', label: '网易云', username: 'vip1', displayName: 'VIP用户', capabilities: ['playlist'], updatedAt: Date.now() },
      ],
      session: async () => ({ cookies: { MUSIC_U: 'valid-music-u-cookie-value', __csrf: 'csrf123' } }),
    },
    http: async () => ({
      code: 200,
      data: [
        {
          code: 200,
          url: 'https://m8.music.126.net/song.flac',
          freeTrialInfo: trialMode ? { start: 0, end: 30 } : null,
        },
      ],
    }),
    md5,
    hash: sha256,
  });

  const ctrl = new AbortController();
  // Disabled -> immediate null (falls back directly to LX)
  assert.equal(await resolver.resolve(wyTrack, ctrl.signal), null);

  // Enabled + freeTrialInfo present -> strictly rejected so LX provides full track
  enabled = true;
  trialMode = true;
  assert.equal(await resolver.resolve(wyTrack, ctrl.signal), null);

  // Enabled + full account rights -> direct playback succeeds
  trialMode = false;
  const hit = await resolver.resolve(wyTrack, ctrl.signal);
  assert.ok(hit);
  assert.equal(hit.sourceName, '网易云账号直连');
  assert.equal(hit.url, 'https://m8.music.126.net/song.flac');
  assert.equal(hit.quality, 'flac');
});

test('KugouPlaylists falls back to /v4/get_list_all_file + concept appid and lenient inline metadata for 我喜欢', async () => {
  const playlists = new KugouPlaylists({
    md5,
    now: () => 1_700_000_000_000,
    http: async url => {
      if (url.includes('get_list_all_file_v3')) {
        return { status: 0, errcode: 20018, error: 'gateway rejected v3' };
      }
      if (url.includes('get_list_all_file') && url.includes('appid=3116')) {
        return {
          status: 1,
          data: {
            info: [
              {
                hash: '0123456789abcdef0123456789abcdef',
                name: '周杰伦 - 晴天',
                timelen: 269000,
                album_id: '960000',
                album_audio_id: 12345,
                albuminfo: { name: '叶惠美' },
                cover: 'https://imge.kugou.com/stdmusic/{size}/cover.jpg',
              },
            ],
          },
        };
      }
      if (url.includes('get_list_all_file')) {
        return { status: 0 };
      }
      // Simulate upstream song detail lookup transiently failing; lenient mode should keep inline track!
      return { status: 0, data: [] };
    },
  });

  const tracks = await playlists.tracks(
    { id: 'a'.repeat(64), platform: 'kg', label: '酷狗', username: '10001', capabilities: ['playlist'], updatedAt: 1 },
    { version: 1, platform: 'kg', userId: '10001', token: 'kg-token', mid: '0123456789abcdef0123456789abcdef' },
    { id: '2', title: '我喜欢', count: 1, kind: 'created', coverUrl: '' },
    new AbortController().signal,
    () => {},
    { lenient: true },
  );
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0]?.title, '晴天');
  assert.equal(tracks[0]?.artist, '周杰伦');
  assert.equal(tracks[0]?.album, '叶惠美');
  assert.equal(tracks[0]?.artwork, 'https://imge.kugou.com/stdmusic/400/cover.jpg');
});

test('AccountFeatureCache persists large playlists, restores across sessions, and formats sync age', async () => {
  const repo = makeMemRepo();
  const cache = new AccountFeatureCache(repo);
  const track: Track = {
    origin: { kind: 'online', platform: 'tx', id: '001abc' },
    title: '稻香',
    artist: '周杰伦',
    metadata: {},
    qualities: [{ id: 'flac' }],
  };
  await cache.setTracks('tx-1:tx_liked', [track], 1_700_000_000_000);
  const reloaded = new AccountFeatureCache(repo);
  await reloaded.restore();
  const hit = reloaded.getTracks('tx-1:tx_liked');
  assert.equal(hit?.tracks.length, 1);
  assert.equal(hit?.tracks[0]?.title, '稻香');
  assert.equal(formatCacheAge(1_700_000_000_000, 1_700_000_020_000), '刚刚同步');
  assert.equal(formatCacheAge(1_700_000_000_000, 1_700_000_300_000), '5 分钟前同步');
});

test('Qishui 48 modes include 3 core defaults + 45 scene modes and migrate legacy mode IDs cleanly', async () => {
  assert.equal(QISHUI_ROAM_MODES.length, 48);
  const ids = new Set(QISHUI_ROAM_MODES.map(m => m.id));
  assert.equal(ids.size, 48);
  assert.ok(ids.has('default') && ids.has('familiar') && ids.has('fresh'));
  assert.ok(ids.has('chill') && ids.has('happy') && ids.has('sport') && ids.has('cantonese'));

  const repo = makeMemRepo();
  await repo.put('qishui.account.v1', { loggedIn: false, nickname: '', activeModeId: 'for_you', playlists: [], liked: [], recent: [] });
  const store = new QishuiAccountStore(repo);
  await store.restore();
  assert.equal(store.getSnapshot().activeModeId, 'default');

  // Verify Qishui directPlayback rejects encrypted spade_a stream
  const qishui = new QishuiProvider(async () => ({
    track: { duration: 240000 },
    track_player: { spade_a: 'encrypted-key', url_player_info: 'https://cdn.qishui.com/enc.mp4', duration: 240000 },
  }));
  const qTrack: Track = {
    origin: { kind: 'imported', platform: 'qishui', id: '71234567890' },
    title: '加密曲目',
    artist: '歌手',
    metadata: {},
    qualities: [],
  };
  assert.equal(await qishui.directPlayback(qTrack, 'sessionid=abc', new AbortController().signal), null);
});

test('AudioMatchCoordinator auto-uploads freshly recorded mic clip using selected AudD engine', async () => {
  let auddCalled = false;
  const fakeWav = bytesToBase64(new Uint8Array(2048).fill(7));
  const coord = new AudioMatchCoordinator({
    native: {
      audioMatchPermission: async () => 'granted',
      audioMatchRequestPermission: async () => true,
      audioMatchStart: async () => ({
        durationMs: 6000,
        sampleRate: 16000,
        avgLevel: 0.25,
        peakLevel: 0.65,
        zeroCrossings: 420,
        energySignature: 'a1b2c3d4e5f6',
        cancelled: false,
        audioBase64: fakeWav,
        mimeType: 'audio/wav',
      }),
      audioMatchStop: async () => {},
    },
    fetchFn: (async () => {
      auddCalled = true;
      return new Response(
        JSON.stringify({ status: 'success', result: { title: '七里香', artist: '周杰伦', album: '七里香' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch,
    search: async () => ({
      items: [
        {
          origin: { kind: 'online', platform: 'wy', id: '186016' },
          title: '七里香',
          artist: '周杰伦',
          metadata: {},
          qualities: [{ id: '320k' }],
        },
      ],
    }),
  });

  await coord.saveCloudConfig({ provider: 'audd', auddToken: 'my-free-token' });
  await coord.startListening(6000);
  assert.equal(auddCalled, true);
  assert.equal(coord.getSnapshot().lastCloudMatch?.title, '七里香');
  assert.equal(coord.getSnapshot().results.length, 1);
});

test('PreferenceStore enables preferAccountPlayback by default and persists toggle updates', async () => {
  const repo = makeMemRepo();
  const prefs = new PreferenceStore(repo);
  assert.equal(prefs.getSnapshot().preferAccountPlayback, true);
  await prefs.update({ preferAccountPlayback: false });
  assert.equal(prefs.getSnapshot().preferAccountPlayback, false);
  const reloaded = new PreferenceStore(repo);
  await reloaded.restore();
  assert.equal(reloaded.getSnapshot().preferAccountPlayback, false);
});
