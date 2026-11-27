import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscoveryProvider } from '../src/providers/discovery.ts';
import { VideoProvider } from '../src/providers/videos.ts';
import { NeteasePodcastsProvider } from '../src/providers/neteasePodcasts.ts';

const sha = async () => '0'.repeat(40);
const md5 = async () => '0'.repeat(32);

test('DiscoveryProvider.featured parses Sollin NetEase homepage blocks, toplists, new songs, high quality, categories, and MVs', async () => {
  const signal = new AbortController().signal;
  const http = async (url: string) => {
    if (url.includes('/weapi/homepage/block/page')) {
      return {
        code: 200,
        data: {
          blocks: [
            {
              blockCode: 'HOMEPAGE_BLOCK_PLAYLIST_RCMD',
              uiElement: { subTitle: { title: '推荐歌单' } },
              creatives: [{
                resources: [{
                  resourceId: '1001',
                  uiElement: { mainTitle: { title: '今日精选原声' }, image: { imageUrl: 'https://p1.music.126.net/a.jpg' } },
                  resourceExtInfo: { playCount: 224000 },
                }],
              }],
            },
            {
              blockCode: 'HOMEPAGE_BLOCK_STYLE_RCMD',
              uiElement: { subTitle: { title: '专属你的「治愈」精选' } },
              creatives: [{
                resources: [{
                  resourceExtInfo: {
                    songData: { id: 185824, name: '秋天冬天', artists: [{ name: '张震岳' }], album: { name: '专辑A' }, duration: 210000 },
                  },
                }],
              }],
            },
            {
              blockCode: 'HOMEPAGE_BLOCK_MGC_PLAYLIST',
              creatives: [{ resources: [{ resourceId: '2001', uiElement: { mainTitle: { title: '华语私人雷达' } }, resourceExtInfo: { playCount: 900000 } }] }],
            },
            {
              blockCode: 'HOMEPAGE_BLOCK_OFFICIAL_PLAYLIST',
              creatives: [{ resources: [{ resourceId: '3001', uiElement: { mainTitle: { title: '24小时自习室' } }, resourceExtInfo: { playCount: 1190000 } }] }],
            },
          ],
        },
      };
    }
    if (url.includes('/api/v1/discovery/new/songs')) {
      return { code: 200, data: [{ id: 9001, name: '冬天又来临', artists: [{ name: '罗言' }], album: { name: '新单' }, duration: 190000 }] };
    }
    if (url.includes('/weapi/playlist/highquality/list')) {
      return { code: 200, playlists: [{ id: '5001', name: '精品 R&B', coverImgUrl: 'https://p1.music.126.net/hq.jpg', playCount: 10649000 }] };
    }
    if (url.includes('/api/toplist/detail')) {
      return {
        code: 200,
        list: [
          { id: '19723756', name: '飙升榜', updateFrequency: '刚刚更新', coverImgUrl: 'https://p1.music.126.net/r1.jpg', tracks: [{ first: 'Song A', second: 'Artist A' }] },
          { id: '3779629', name: '新歌榜', updateFrequency: '更新19首', coverImgUrl: 'https://p1.music.126.net/r2.jpg', tracks: [{ first: 'Song B', second: 'Artist B' }] },
        ],
      };
    }
    if (url.includes('/api/v6/playlist/detail')) {
      return {
        code: 200,
        playlist: {
          name: '新歌榜',
          trackIds: [{ id: 777 }],
          tracks: [{ id: 777, name: '新歌榜冠军', ar: [{ name: '测试歌手' }], al: { name: '新歌专辑' }, dt: 200000 }],
        },
      };
    }
    if (url.includes('/api/playlist/catalogue')) {
      return { code: 200, categories: { '0': '语种', '1': '风格', '2': '场景' }, sub: [{ name: '华语', category: 0 }, { name: '流行', category: 1 }, { name: '夜晚', category: 2 }] };
    }
    throw new Error(`unexpected url: ${url}`);
  };
  const dp = new DiscoveryProvider(sha, http);
  const featured = await dp.featured('wy', signal, {
    latestMVs: async () => [{ id: '14689667', title: '早发白帝城', platform: 'wy', author: '许嵩', artwork: 'https://p1.music.126.net/mv1.jpg' }],
    topMVs: async () => [{ id: '14690000', title: '时光洪流', platform: 'wy', author: '程响', artwork: 'https://p1.music.126.net/mv2.jpg' }],
    newAlbums: async () => [{ id: '99', title: '最新专辑测试', author: '王以太' }],
    popularArtists: async () => [{ id: '3684', title: '林俊杰' }],
  });

  assert.equal(featured.recommendedPlaylists[0]?.title, '今日精选原声');
  assert.equal(featured.curatedSongs?.title, '专属你的「治愈」精选');
  assert.equal(featured.curatedSongs?.tracks[0]?.title, '秋天冬天');
  assert.equal(featured.radarPlaylists[0]?.title, '华语私人雷达');
  assert.equal(featured.scenePlaylists[0]?.title, '24小时自习室');
  assert.equal(featured.highQualityPlaylists[0]?.title, '精品 R&B');
  assert.equal(featured.newExpressSongs[0]?.title, '冬天又来临');
  assert.equal(featured.officialToplists.length, 2);
  assert.equal(featured.officialToplists[0]?.tracks[0]?.first, 'Song A');
  assert.equal(featured.newSongChartTracks[0]?.title, '新歌榜冠军');
  assert.equal(featured.latestMVs[0]?.title, '早发白帝城');
  assert.equal(featured.topMVs[0]?.title, '时光洪流');
  assert.equal(featured.popularArtists[0]?.title, '林俊杰');
});

test('VideoProvider fetches latest/top NetEase MVs and resolves HTTPS direct MP4 stream with fallback', async () => {
  const signal = new AbortController().signal;
  const vp = new VideoProvider({
    md5,
    sha1: sha,
    deviceId: () => 'dev-1',
    http: async url => {
      if (url.includes('/api/mv/first')) {
        return { code: 200, data: [{ id: 101, name: '最新MV测试', artistName: '歌手A', cover: 'http://p1.music.126.net/c1.jpg', duration: 240000, playCount: 12000 }] };
      }
      if (url.includes('/weapi/mv/toplist')) {
        return { code: 200, data: [{ id: 202, name: '排行MV测试', artistName: '歌手B', cover: 'https://p1.music.126.net/c2.jpg', duration: 185000 }] };
      }
      if (url.includes('/weapi/song/enhance/play/mv/url')) {
        return { code: 200, data: { id: 101, r: 1080, url: 'http://vodkgeyttp8.vod.126.net/demo.mp4' } };
      }
      throw new Error(`unexpected ${url}`);
    },
  });
  const latest = await vp.latestNetease(signal);
  assert.equal(latest[0]?.id, '101');
  assert.equal(latest[0]?.artwork, 'https://p1.music.126.net/c1.jpg');
  const top = await vp.topNetease(signal);
  assert.equal(top[0]?.id, '202');

  const stream = await vp.resolveStream('wy', latest[0]!, 1080, signal);
  assert.equal(stream.url, 'https://vodkgeyttp8.vod.126.net/demo.mp4');
  assert.equal(stream.resolution, 1080);

  const nonWy = await vp.resolveStream('tx', { id: 'abc', title: 'QQ MV', platform: 'tx' }, 1080, signal);
  assert.equal(nonWy.url, undefined);
});

test('NeteasePodcastsProvider lists categories, hot radios, and maps programs to playable tracks', async () => {
  const signal = new AbortController().signal;
  const pod = new NeteasePodcastsProvider({
    http: async url => {
      if (url.includes('/weapi/djradio/category/get')) {
        return { code: 200, categories: [{ id: 2, name: '音乐播客' }, { id: 3, name: '情感' }] };
      }
      if (url.includes('/weapi/djradio/hot/v1')) {
        return { code: 200, hasMore: true, djRadios: [{ id: 7925, name: '午夜电台', dj: { nickname: '主播甲' }, picUrl: 'http://p1.music.126.net/r.jpg', programCount: 20 }] };
      }
      if (url.includes('/weapi/dj/program/byradio')) {
        return {
          code: 200,
          count: 1,
          more: false,
          programs: [{
            id: 90001,
            name: '第 1 期：好音乐分享',
            duration: 300000,
            listenerCount: 5400,
            coverUrl: 'http://p1.music.126.net/p.jpg',
            radio: { name: '午夜电台' },
            dj: { nickname: '主播甲' },
            mainSong: { id: 554433 },
          }],
        };
      }
      throw new Error(`unexpected ${url}`);
    },
  });
  const cats = await pod.categories(signal);
  assert.equal(cats.length, 2);
  const radios = await pod.radios(undefined, 1, signal);
  assert.equal(radios.items[0]?.artwork, 'https://p1.music.126.net/r.jpg');
  const progs = await pod.programs('7925', 1, signal);
  assert.equal(progs.programs[0]?.track.origin.kind, 'online');
  assert.equal(progs.programs[0]?.track.origin.id, '554433');
  assert.equal(progs.programs[0]?.track.album, '午夜电台');
});
