import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AccountHeartbeat } from '../src/providers/accountHeartbeat.ts';
import { AccountDiscoveryClient, parseNeteaseCloudDrive } from '../src/providers/accountDiscovery.ts';
import { neteaseSessionAuth, neteaseWeapiRequest } from '../src/providers/neteaseSession.ts';
import {
  AudioMatchCoordinator,
  DEFAULT_CLOUD_CONFIG,
  bytesToBase64,
  identifyWithShazam,
} from '../src/providers/audioMatch.ts';
import {
  buildShazamSignatureFromWav,
  crc32,
  decodeWavToPcm16k,
} from '../src/providers/shazamSignature.ts';
import type { HTTPRequest } from '../src/providers/http.ts';
import type { MusicAccount, MusicSession } from '../src/providers/musicAccounts.ts';

const wyAccount: MusicAccount = {
  id: 'a'.repeat(64),
  platform: 'wy',
  label: '网易云',
  username: 'netease:9000000000000000001',
  capabilities: ['daily', 'fm'],
  updatedAt: 1,
};

const wySession: MusicSession = {
  version: 1,
  platform: 'wy',
  accountId: wyAccount.id,
  userId: '9000000000000000001',
  cookies: { MUSIC_U: 'synthetic-wy-session', __csrf: 'synthetic-csrf' },
};

function makeWav16k(seconds: number, freqs: readonly number[], sampleRate = 16000, channels = 1): Uint8Array {
  const frames = Math.floor(seconds * sampleRate);
  const pcmBytes = frames * channels * 2;
  const wav = new Uint8Array(44 + pcmBytes);
  const dv = new DataView(wav.buffer);
  const putStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) wav[off + i] = s.charCodeAt(i);
  };
  putStr(0, 'RIFF');
  dv.setUint32(4, 36 + pcmBytes, true);
  putStr(8, 'WAVE');
  putStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, channels, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * channels * 2, true);
  dv.setUint16(32, channels * 2, true);
  dv.setUint16(34, 16, true);
  putStr(36, 'data');
  dv.setUint32(40, pcmBytes, true);
  let pos = 44;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    // Modulate tones so peaks stand out against time/frequency neighbours
    const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.7 * t);
    let sample = 0;
    for (let fIdx = 0; fIdx < freqs.length; fIdx++) {
      const f = freqs[fIdx]! + 120 * Math.sin(2 * Math.PI * (0.4 + fIdx * 0.25) * t);
      sample += (0.28 / freqs.length) * env * Math.sin(2 * Math.PI * f * t);
    }
    const s16 = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
    for (let c = 0; c < channels; c++) {
      dv.setInt16(pos, s16, true);
      pos += 2;
    }
  }
  return wav;
}

test('neteaseWeapiRequest enforces credentials: omit without mutating auth cookie', () => {
  const auth = neteaseSessionAuth(wySession);
  assert.ok(auth);
  const req = neteaseWeapiRequest({ limit: 10 }, auth);
  assert.equal(req.credentials, 'omit');
  assert.match(req.headers?.Cookie ?? '', /MUSIC_U=synthetic-wy-session/);
});

test('AccountHeartbeat supports real NetEase top-level data[] array, count=1 retry, and inline songInfo fallback', async () => {
  let intelCalls = 0;
  const songObj = (id: string, name: string) => ({
    id,
    name,
    ar: [{ id: '10', name: '测试歌手' }],
    al: { id: '20', name: '测试专辑', picUrl: `https://p1.music.126.net/${id}.jpg` },
    dt: 210000,
  });

  const client = new AccountHeartbeat({
    random: () => 0,
    http: async url => {
      const path = new URL(url).pathname.replace(/^\/weapi\//, '');
      if (path === 'user/playlist') {
        return {
          code: 200,
          playlist: [{ id: '8001', name: '我喜欢的音乐', specialType: 5, creator: { userId: wySession.userId } }],
        };
      }
      if (path === 'v3/playlist/detail') {
        return { code: 200, playlist: { trackIds: [{ id: '5001' }] } };
      }
      if (path === 'playmode/intelligence/list') {
        intelCalls++;
        if (intelCalls === 1) return { code: 400, message: 'invalid count' };
        // Real NetEase response returns `data` as an array directly
        return {
          code: 200,
          data: [
            { id: '5001', songInfo: songObj('5001', '种子歌曲') },
            { id: '5002', songInfo: songObj('5002', '心动推荐一') },
            { id: '5003', songInfo: songObj('5003', '心动推荐二') },
          ],
        };
      }
      if (path === 'v3/song/detail') {
        // First call hydrates liked seed; second call simulates partial detail omit for 5003
        return intelCalls === 0
          ? { code: 200, songs: [songObj('5001', '种子歌曲')] }
          : { code: 200, songs: [songObj('5002', '心动推荐一')] };
      }
      throw new Error(`unexpected ${url}`);
    },
  });

  const res = await client.start(wyAccount, wySession, undefined, new AbortController().signal);
  assert.equal(intelCalls, 2);
  assert.equal(res.seed.origin.id, '5001');
  assert.deepEqual(
    res.tracks.map(t => t.origin.id),
    ['5001', '5002', '5003'],
  );
});

test('AccountDiscoveryClient uses live play-record endpoints, credentials: omit, total: true, and session uid', async () => {
  const calls: Array<{ url: string; req: HTTPRequest }> = [];
  const client = new AccountDiscoveryClient({
    sha1: async () => '0'.repeat(40),
    http: async (url, req) => {
      calls.push({ url, req });
      if (url.endsWith('/weapi/play-record/song/list')) {
        return {
          code: 200,
          data: {
            list: [{ data: { id: 101, name: '最近单曲', ar: [{ name: '歌手A' }], al: { name: '专辑A' }, dt: 180000 } }],
          },
        };
      }
      if (url.endsWith('/weapi/play-record/playlist/list')) {
        return {
          code: 200,
          data: {
            list: [{ resourceId: '777', data: { id: '777', name: '最近歌单', coverImgUrl: 'http://p1.music.126.net/p.jpg', trackCount: 15 } }],
          },
        };
      }
      if (url.endsWith('/weapi/v1/cloud/get')) {
        return {
          code: 200,
          hasMore: false,
          count: 1,
          data: [{ songId: 888, songName: '云盘曲目', artist: '独立音乐人', album: '个人云盘', simpleSong: { id: 888, name: '云盘曲目', ar: [{ name: null }], al: {} } }],
        };
      }
      if (url.endsWith('/weapi/artist/sublist')) {
        return {
          code: 200,
          hasMore: false,
          data: [{ id: 3684, name: '林俊杰', picUrl: 'http://p1.music.126.net/jj.jpg', albumSize: 40, musicSize: 300 }],
        };
      }
      if (url.endsWith('/weapi/v1/play/record')) {
        return {
          code: 200,
          weekData: [{ playCount: 9, score: 100, song: { id: 999, name: '周榜冠军', ar: [{ name: '歌手B' }], al: { name: '专辑B' }, dt: 200000 } }],
        };
      }
      throw new Error(`unexpected endpoint: ${url}`);
    },
  });

  const sig = new AbortController().signal;
  const recentSongs = await client.recentSongs(wyAccount, wySession, sig);
  const recentPlaylists = await client.recentPlaylists(wyAccount, wySession, sig);
  const cloud = await client.cloudDrive(wyAccount, wySession, sig);
  const artists = await client.subscribedArtists(wyAccount, wySession, sig);
  const record = await client.playRecord(wyAccount, wySession, 1, sig);

  assert.equal(recentSongs[0]?.title, '最近单曲');
  assert.equal(recentPlaylists[0]?.id, '777');
  assert.equal(cloud.items[0]?.title, '云盘曲目');
  assert.equal(artists.items[0]?.title, '林俊杰');
  assert.equal(record[0]?.track.title, '周榜冠军');
  assert.equal(calls.length, 5);
  for (const call of calls) {
    assert.equal(call.req.credentials, 'omit', `expected credentials: omit for ${call.url}`);
    assert.match(call.req.headers?.Cookie ?? '', /MUSIC_U=synthetic-wy-session/);
  }

  // Cloud fallback handles sparse uploaded items without dropping them
  const sparseCloud = parseNeteaseCloudDrive({
    code: 200,
    hasMore: false,
    count: 1,
    data: [{ songId: '123456', fileName: '自录小样.mp3', simpleSong: null }],
  });
  assert.equal(sparseCloud.items[0]?.title, '自录小样.mp3');
});

test('Shazam zero-key fingerprinting builds valid signature binary and integrates with AudioMatchCoordinator', async () => {
  assert.equal(DEFAULT_CLOUD_CONFIG.provider, 'shazam');

  const wav16k = makeWav16k(4, [440, 980, 2100, 4200], 16000, 1);
  const pcm = decodeWavToPcm16k(wav16k);
  assert.equal(pcm.length, 4 * 16000);

  // Stereo 44.1 kHz WAV downmixes & resamples cleanly to 16 kHz
  const wav44k = makeWav16k(2, [440, 1200], 44100, 2);
  const pcm44k = decodeWavToPcm16k(wav44k);
  assert.ok(Math.abs(pcm44k.length - 2 * 16000) <= 2);

  const sig = buildShazamSignatureFromWav(wav16k);
  assert.ok(sig.uri.startsWith('data:audio/vnd.shazam.sig;base64,'));
  assert.equal(sig.samplems, 4000);
  assert.ok(sig.peakCount > 10, `expected peaks > 10, got ${sig.peakCount}`);

  const dv = new DataView(sig.bytes.buffer, sig.bytes.byteOffset, sig.bytes.byteLength);
  assert.equal(dv.getUint32(0, true), 0xcafe2580);
  assert.equal(dv.getUint32(4, true), crc32(sig.bytes, 8));
  assert.equal(dv.getUint32(12, true), 0x94119c00);
  assert.equal(dv.getUint32(28, true), (3 << 27) >>> 0);

  let shazamUrl = '';
  const hit = await identifyWithShazam(
    wav16k,
    (async (url: string | URL | Request) => {
      shazamUrl = String(url);
      return new Response(
        JSON.stringify({
          track: {
            title: '稻香',
            subtitle: '周杰伦',
            sections: [{ type: 'SONG', metadata: [{ title: '专辑', text: '魔杰座' }, { title: '发行', text: '2008' }] }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch,
  );
  assert.match(shazamUrl, /^https:\/\/amp\.shazam\.com\/discovery\/v5\/zh-CN\/CN\/iphone\/-\/tag\//);
  assert.deepEqual(hit, {
    provider: 'shazam',
    title: '稻香',
    artist: '周杰伦',
    album: '魔杰座',
    releaseDate: '2008',
  });

  const coord = new AudioMatchCoordinator({
    native: {
      audioMatchPermission: async () => 'granted',
      audioMatchRequestPermission: async () => true,
      audioMatchStart: async () => ({
        durationMs: 4000,
        sampleRate: 16000,
        avgLevel: 0.2,
        peakLevel: 0.5,
        zeroCrossings: 1200,
        energySignature: 'abcdef012345',
        cancelled: false,
        audioBase64: bytesToBase64(wav16k),
        mimeType: 'audio/wav',
      }),
      audioMatchStop: async () => {},
    },
    fetchFn: (async () =>
      new Response(JSON.stringify({ track: { title: '素颜', subtitle: '许嵩' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch,
    search: async () => ({
      items: [{ origin: { kind: 'online', platform: 'wy', id: '167876' }, title: '素颜', artist: '许嵩', metadata: {}, qualities: [] }],
    }),
  });
  await coord.startListening(4000);
  assert.equal(coord.getSnapshot().lastCloudMatch?.provider, 'shazam');
  assert.equal(coord.getSnapshot().lastCloudMatch?.title, '素颜');
  assert.equal(coord.getSnapshot().results[0]?.title, '素颜');
});

test('Track list loading toast and player play-mode cycle toasts are removed', () => {
  const sheet = fs.readFileSync('src/ui/AccountFeatureSheet.tsx', 'utf8');
  assert.doesNotMatch(sheet, /toast\.show\(/);
  assert.doesNotMatch(sheet, /正在加载：\$\{track\.title\}/);

  for (const file of [
    'src/ui/Player.tsx',
    'src/ui/ModernPlayer.tsx',
    'src/ui/VinylPlayer.tsx',
    'src/ui/GroovePlayer.tsx',
    'src/ui/PhotoPlayer.tsx',
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /toast\.show\(next\.label\)/, `${file} should not toast next.label`);
    assert.doesNotMatch(src, /onNotify\?\.\(next\.label\)/, `${file} should not notify next.label`);
  }
});
