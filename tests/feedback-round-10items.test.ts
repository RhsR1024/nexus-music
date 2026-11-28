import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { activeLyric, displayLyricIndex, lyricLineProgress, parseLyrics } from '../src/lyrics/parser.ts';
import { onlineTrack } from '../src/providers/online.ts';
import { DiscoveryProvider } from '../src/providers/discovery.ts';
import { enrichKugouTrackArtworks } from '../src/providers/kugouTrackDetails.ts';
import { PlaybackController, type ResolvedMedia } from '../src/playback/controller.ts';
import type { QueueState } from '../src/domain/queue.ts';
import type { Track } from '../src/domain/track.ts';
import { currentPlayMode, nextPlayModePatch, playModeLabel } from '../src/domain/playMode.ts';

const sha = async () => '0'.repeat(40);

test('displayLyricIndex holds last sung line during YRC/KRC inter-line breath gaps without jumping back to line 0', () => {
  const yrc = [
    '[1000,2000](1000,1000,0)作词：测试(2000,1000,0)人',
    '[5000,3000](5000,1500,0)第一句(6500,1500,0)歌词',
    '[12000,3000](12000,1500,0)第二句(13500,1500,0)歌词',
  ].join('\n');
  const doc = parseLyrics(yrc);
  assert.equal(doc.synced, true);
  assert.equal(doc.lines.length, 3);

  // Strict activeLyric returns -1 in the breath gap between 8000ms and 12000ms
  assert.equal(activeLyric(doc.lines, 9500, 0), -1);
  // displayLyricIndex holds line 1 (第一句歌词) instead of dropping to -1 / jumping to 0
  assert.equal(displayLyricIndex(doc.lines, 9500, 0), 1);
  // Before first line starts, activeLyric is -1 while displayLyricIndex previews the first non-background line (0)
  assert.equal(activeLyric(doc.lines, 200, 0), -1);
  assert.equal(displayLyricIndex(doc.lines, 200, 0), 0);
  // Inside line 2, both return 2
  assert.equal(activeLyric(doc.lines, 12800, 0), 2);
  assert.equal(displayLyricIndex(doc.lines, 12800, 0), 2);

  // Word-timed progress tracks exact syllables
  const midProgress = lyricLineProgress(doc.lines[1]!, 6500, doc.lines[2]!.startMs);
  assert.ok(midProgress >= 0.45 && midProgress <= 0.65, `expected ~0.5 word progress, got ${midProgress}`);
  // After line end during breath gap, progress completes to 1
  assert.equal(lyricLineProgress(doc.lines[1]!, 9500, doc.lines[2]!.startMs), 1);
});

test('Kuwo and QQ search track parsing extracts album, single vs[], and artist fallback artwork', () => {
  const kw = onlineTrack('kw', {
    MUSICRID: 'MUSIC_123456',
    SONGNAME: '主角',
    ARTIST: '马里奥',
    ALBUM: '斗破苍穹',
    DURATION: '210',
    web_albumpic_short: '120/69/91/2366495838.jpg',
  });
  assert.equal(kw.artwork, 'https://img4.kuwo.cn/star/albumcover/500/69/91/2366495838.jpg');

  const kwArtistFallback = onlineTrack('kw', {
    MUSICRID: 'MUSIC_777',
    SONGNAME: '单曲',
    ARTIST: '歌手',
    web_artistpic_short: '120/11/22/333.jpg',
  });
  assert.equal(kwArtistFallback.artwork, 'https://img3.kuwo.cn/star/starheads/300/11/22/333.jpg');

  const qqSingle = onlineTrack('tx', {
    mid: '001abc',
    name: '主角（单曲）',
    singer: [{ mid: '002singer', name: '小花生' }],
    album: { mid: '', name: '' },
    vs: ['', '004atzTo2vuJEQ'],
    interval: 200,
  });
  assert.equal(qqSingle.artwork, 'https://y.gtimg.cn/music/photo_new/T062R300x300M000004atzTo2vuJEQ.jpg');

  const qqSingerFallback = onlineTrack('tx', {
    mid: '002def12345678',
    name: '无专辑单曲',
    singer: [{ mid: '0025NhlN2yWrP4', name: '曾一鸣' }],
    album: { mid: '', name: '' },
    vs: [],
  });
  assert.equal(qqSingerFallback.artwork, 'https://y.gtimg.cn/music/photo_new/T001R300x300M0000025NhlN2yWrP4.jpg');
});

test('Kugou HTTPS plaza & detail parse var data=[] and var specialInfo={} without plaintext http://www2.kugou.kugou.com', async () => {
  const seenUrls: string[] = [];
  const fakePlazaHtml = `
    <dl id="dl"><dt><a href="https://www.kugou.com/yy/special/index/1-5-0.html">推荐</a></dt><dt><a href="https://www.kugou.com/yy/special/index/1-6-0.html">最热</a></dt></dl>
    <ul id="ulAlbums">
      <li class="s_3339907">
        <div class="pic"><a title="乡村之旅" href="https://www.kugou.com/songlist/gcid_abc/"><img _src="http://c1.kgimg.com/custom/150/20201207/cover.jpg" /></a></div>
        <div class="detail"><div class="top"><em>制作人：蔓若</em><strong><a title="乡村之旅">乡村之旅</a></strong></div></div>
      </li>
    </ul>
  `;
  const fakeSingleHtml = `
    <script>
      var data = [{"hash":"ABCD1234","audio_id":99,"songname":"故梦","singername":"双笙","album_name":"故梦","album_id":8509952,"duration":284013,"trans_param":{"union_cover":"http://imge.kugou.com/stdmusic/{size}/20250217/cover.jpg"}}],
      specialInfo = {"specialname":"古风精选"};
    </script>
  `;
  const provider = new DiscoveryProvider(
    sha,
    async (url) => {
      seenUrls.push(url);
      // Simulate m.kugou.com anti-bot redirect stub
      return { fr: -2, ver: 'v3' };
    },
    async (url) => {
      seenUrls.push(url);
      if (url.includes('/special/single/')) return fakeSingleHtml;
      return fakePlazaHtml;
    },
  );

  const cats = await provider.categories('kg', new AbortController().signal);
  assert.equal(cats.length, 2);
  assert.equal(cats[0]?.id, '5-0');

  const plaza = await provider.playlists('kg', 1, undefined, new AbortController().signal);
  assert.equal(plaza.items.length, 1);
  assert.equal(plaza.items[0]?.id, '3339907');
  assert.equal(plaza.items[0]?.artwork, 'https://c1.kgimg.com/custom/400/20201207/cover.jpg');

  const detail = await provider.detail('kg', '3339907', 1, new AbortController().signal);
  assert.equal(detail.title, '古风精选');
  assert.equal(detail.items.length, 1);
  assert.equal(detail.items[0]?.title, '故梦');
  assert.equal(detail.items[0]?.artwork, 'https://imge.kugou.com/stdmusic/400/20250217/cover.jpg');

  for (const url of seenUrls) {
    assert.ok(url.startsWith('https://'), `expected strictly HTTPS Kugou request, got ${url}`);
    assert.ok(!url.includes('www2.kugou.kugou.com'), `must not call ATS-blocked www2.kugou.kugou.com: ${url}`);
  }
});

test('Kugou artwork enrichment falls back past empty album.sizable_cover string to union_cover and author avatar', async () => {
  const h1 = 'A'.repeat(32);
  const h2 = 'B'.repeat(32);
  const t1: Track = {
    origin: { kind: 'online', platform: 'kg', id: h1 },
    title: '歌1',
    artist: '歌手1',
    metadata: { hash: h1 },
    qualities: [],
  };
  const t2: Track = {
    origin: { kind: 'online', platform: 'kg', id: h2 },
    title: '歌2',
    artist: '歌手2',
    metadata: { hash: h2 },
    qualities: [],
  };
  const enriched = await enrichKugouTrackArtworks(
    async () => ({
      data: [
        [{ audio_info: { hash: h1 }, album_info: { sizable_cover: '' }, trans_param: { union_cover: 'http://imge.kugou.com/stdmusic/{size}/u1.jpg' } }],
        [{ audio_info: { hash: h2 }, album_info: { sizable_cover: '' }, trans_param: { union_cover: '' }, authors: [{ sizable_avatar: 'http://singerimg.kugou.com/uploadpic/softhead/{size}/a2.jpg' }] }],
      ],
    }),
    [t1, t2],
    new AbortController().signal,
  );
  assert.equal(enriched[0]?.artwork, 'https://imge.kugou.com/stdmusic/400/u1.jpg');
  assert.equal(enriched[1]?.artwork, 'https://singerimg.kugou.com/uploadpic/softhead/400/a2.jpg');
});

test('PlayModeButton cycles through all 4 distinct playback modes cleanly', () => {
  assert.equal(currentPlayMode('all', false), 'list');
  const s1 = nextPlayModePatch('all', false);
  assert.equal(s1.mode, 'one');
  assert.equal(s1.label, '单曲循环');

  const s2 = nextPlayModePatch(s1.repeat, s1.shuffle);
  assert.equal(s2.mode, 'shuffle');
  assert.equal(s2.label, '随机播放');

  const s3 = nextPlayModePatch(s2.repeat, s2.shuffle);
  assert.equal(s3.mode, 'order');
  assert.equal(s3.label, '顺序播放');

  const s4 = nextPlayModePatch(s3.repeat, s3.shuffle);
  assert.equal(s4.mode, 'list');
  assert.equal(s4.label, '列表循环');
  assert.equal(playModeLabel('off', false), '顺序播放');
});

test('PlaybackController.reloadAtCurrentPosition re-resolves active track at current cursor after quality change', async () => {
  const track: Track = {
    origin: { kind: 'online', platform: 'wy', id: '1901371647' },
    title: '孤勇者',
    artist: '陈奕迅',
    metadata: {},
    qualities: [],
  };
  let resolveCount = 0;
  const loadedStarts: number[] = [];
  const queue: QueueState = {
    entries: [{ id: 'e1', track }],
    currentId: 'e1',
    priorityIds: [],
  };
  const controller = new PlaybackController(
    {
      resolve: async () => {
        resolveCount += 1;
        return {
          url: `https://example.test/audio-${resolveCount}.flac`,
          quality: resolveCount === 1 ? '320k' : 'flac',
          headers: {},
        };
      },
    },
    {
      stop: () => {},
      load: (media: ResolvedMedia) => { loadedStarts.push(media.startPosition ?? 0); },
      play: () => {},
      pause: () => {},
      seek: () => {},
    },
    queue,
  );
  await controller.play(queue);
  const tok = controller.getSnapshot().token!;
  controller.onReady(tok, { duration: 256 });
  controller.onProgress(tok, 42.5, 256, false);
  assert.equal(controller.getSnapshot().position, 42.5);

  await controller.reloadAtCurrentPosition();
  assert.equal(resolveCount, 2);
  assert.equal(controller.getSnapshot().media?.quality, 'flac');
  assert.equal(loadedStarts[loadedStarts.length - 1], 42.5);
});

test('No user-visible Sollin branding remains in UI screens', () => {
  const uiDir = join(process.cwd(), 'src', 'ui');
  for (const file of readdirSync(uiDir)) {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
    const raw = readFileSync(join(uiDir, file), 'utf8');
    // Strip JS/TS comments and check string literals for visible "Sollin"
    const withoutComments = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    const stringHits = [...withoutComments.matchAll(/(['"`])([^'"`\n]*\bSollin\b[^'"`\n]*)\1/g)];
    assert.equal(stringHits.length, 0, `Found visible Sollin string in src/ui/${file}: ${stringHits.map(m => m[2]).join(', ')}`);
  }
});
