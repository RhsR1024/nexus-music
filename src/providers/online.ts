import type { OnlinePlatform, Track } from '../domain/track.ts';
import { queryURL, requestJSON, type HTTPClient } from './http.ts';
import { qqSignature } from './qqSignature.ts';

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
function id(value: unknown) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('服务返回了不安全的歌曲ID');
  const result = text(value); if (!result) throw new Error('歌曲缺少ID'); return result;
}
const number = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; };
function names(value: unknown, key = 'name') { return list(value).map(item => text(row(item)[key])).filter(Boolean).join(' / '); }
function decoded(value: unknown) { return text(value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function qualities(values: Readonly<Record<string, unknown>>) { return Object.entries(values).filter(([,size]) => (number(size) ?? 0) > 0).map(([id,size]) => ({ id, sizeBytes: number(size)! })); }
export function onlineTrack(platform: OnlinePlatform, raw: unknown): Track {
  const value = row(raw);
  let track: Track;
  if (platform === 'wy') {
    const album = row(value.al ?? value.album), singers = value.ar ?? value.artists;
    const duration = number(value.dt ?? value.duration);
    track = { origin: { kind: 'online', platform, id: id(value.id) }, title: text(value.name), artist: names(singers), album: text(album.name),
      ...(duration !== undefined ? { durationMs: duration } : {}), artwork: text(album.picUrl) || undefined,
      metadata: { albumId: text(album.id), artistIds: list(singers).map(item => text(row(item).id)),
        _types: { '128k': row(value.l), '320k': row(value.h), flac: row(value.sq), flac24bit: row(value.hr) } },
      qualities: qualities({ '128k': row(value.l).size, '320k': row(value.h).size, flac: row(value.sq).size, flac24bit: row(value.hr).size }) };
  } else if (platform === 'tx') {
    const album = row(value.album), file = row(value.file), mid = id(value.mid ?? value.songmid), albumMid = text(album.mid ?? value.albummid);
    const duration = number(value.interval);
    track = { origin: { kind: 'online', platform, id: mid }, title: text(value.title ?? value.name ?? value.songname), artist: names(value.singer), album: text(album.name ?? value.albumname),
      ...(duration !== undefined ? { durationMs: duration * 1000 } : {}), artwork: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg` : undefined,
      metadata: { id: text(value.id ?? value.songid), songId: mid, albumId: albumMid, albumMid, strMediaMid: text(file.media_mid ?? value.media_mid), songmid: mid },
      qualities: qualities({ '128k': file.size_128mp3, '320k': file.size_320mp3, flac: file.size_flac, flac24bit: file.size_hires }) };
  } else if (platform === 'kw') {
    const songId = id(value.MUSICRID ?? value.rid).replace(/^MUSIC_/, ''), duration = number(value.DURATION ?? value.duration);
    const info = text(value.N_MINFO), available = ['128k', '320k', 'flac', 'flac24bit'].filter((_, index) => info.includes(`bitrate:${[128,320,2000,4000][index]},`));
    track = { origin: { kind: 'online', platform, id: songId }, title: decoded(value.SONGNAME ?? value.name), artist: decoded(value.ARTIST ?? value.artist).replaceAll('&', ' / '), album: decoded(value.ALBUM ?? value.album),
      ...(duration !== undefined ? { durationMs: duration*1000 } : {}), artwork: text(value.pic) || undefined,
      metadata: { albumId: text(value.ALBUMID ?? value.albumid), formats: text(value.FORMATS), N_MINFO: info }, qualities: available.map(id => ({ id })) };
  } else if (platform === 'kg') {
    const hash = id(value.FileHash ?? value.hash), duration = number(value.Duration ?? value.duration), audioId = text(value.Audioid ?? value.audio_id);
    const types = { '128k': { hash, size: value.FileSize }, '320k': { hash: text(value.HQFileHash), size: value.HQFileSize }, flac: { hash: text(value.SQFileHash), size: value.SQFileSize }, flac24bit: { hash: text(value.ResFileHash), size: value.ResFileSize } };
    track = { origin: { kind: 'online', platform, id: audioId ? `${audioId}_${hash}` : hash }, title: decoded(value.OriSongName ?? value.SongName ?? value.FileName), artist: names(value.Singers) || decoded(value.SingerName), album: decoded(value.AlbumName),
      ...(duration !== undefined ? { durationMs: duration*1000 } : {}),
      metadata: { hash, songId: audioId || hash, songmid: audioId, albumId: text(value.AlbumID ?? value.album_id), _types: types },
      qualities: qualities(Object.fromEntries(Object.entries(types).map(([key, value]) => [key, value.size]))) };
  } else {
    const songId = id(value.songId ?? value.id), copyrightId = id(value.copyrightId ?? value.copyright_id), duration = number(value.duration);
    const formats = list(value.audioFormats ?? value.newRateFormats).map(row), types: Row = {};
    const mapping: Record<string, string> = { PQ: '128k', HQ: '320k', SQ: 'flac', ZQ24: 'flac24bit', ZQ: 'flac24bit' };
    for (const format of formats) { const key = mapping[text(format.formatType)]; if (key) types[key] = format.asize ?? format.isize ?? format.size; }
    track = { origin: { kind: 'online', platform, id: songId }, title: text(value.name ?? value.songName), artist: names(value.singerList ?? value.singers), album: text(value.album),
      ...(duration !== undefined ? { durationMs: duration*1000 } : {}), artwork: text(value.img3 ?? value.img2 ?? value.img1) || undefined,
      metadata: { copyrightId, albumId: text(value.albumId), lrcUrl: text(value.lrcUrl), mrcUrl: text(value.mrcurl), trcUrl: text(value.trcUrl), _types: types }, qualities: qualities(types) };
  }
  if (!track.title) throw new Error('歌曲缺少名称'); return track;
}
export interface SearchPage { items: readonly Track[]; total?: number; page: number; hasMore: boolean }
export interface OnlineDependencies { http?: HTTPClient; md5: (value: string) => Promise<string>; sha1?: (value: string) => Promise<string>; deviceId: () => string }
export class OnlineProvider {
  private http: HTTPClient; private md5: OnlineDependencies['md5']; private deviceId: () => string;
  private sha1: NonNullable<OnlineDependencies['sha1']>;
  constructor(dependencies: OnlineDependencies) { this.http = dependencies.http ?? requestJSON; this.md5 = dependencies.md5; this.deviceId = dependencies.deviceId; this.sha1 = dependencies.sha1 ?? (async () => { throw new Error('SHA1不可用'); }); }
  async search(platform: OnlinePlatform, query: string, page: number, signal: AbortSignal, limit = 30): Promise<SearchPage> {
    if (!query.trim() || !Number.isInteger(page) || page < 1) throw new Error('搜索参数无效');
    let raw: unknown, rows: unknown[] = [], total: number | undefined;
    if (platform === 'wy') {
      raw = await this.http('https://music.163.com/api/search/get/web', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://music.163.com/' },
        body: Object.entries({ s: query, type: 1, offset: (page-1)*limit, limit }).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&') }, signal);
      if (row(raw).code !== 200) throw new Error('搜索服务暂时不可用');
      const result = row(row(raw).result); rows = list(result.songs); total = number(result.songCount);
    } else if (platform === 'tx') {
      const guid = this.deviceId().replaceAll('-', '').toUpperCase();
      const body = JSON.stringify({ comm: { ct:'19', cv:'2151', _channelid:'0', _os_version:'6.2.9200-2', guid, patch:'118', uin:'0', tmeAppID:'qqmusic', tmeLoginType:0 },
        'music.search.SearchCgiService': { module: 'music.search.SearchCgiService', method: 'DoSearchForQQMusicDesktop', param: { grp:1, search_type:0, query, num_per_page:limit, page_num:page, remoteplace:'txt.newclient.top', searchid:`${guid}00000` } } });
      const signature = await qqSignature(body, this.sha1);
      raw = await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg', {sign:signature}), {method:'POST',headers:{'Content-Type':'application/json','User-Agent':'QQMusic 14090508(android 12)',Referer:'https://y.qq.com/'},body},signal);
      const req = row(row(raw)['music.search.SearchCgiService'] ?? row(raw).req); if (row(raw).code !== 0 || req.code !== 0) throw new Error('搜索服务暂时不可用');
      const data = row(req.data), result = row(row(data.body).song); rows = list(result.list); total = number(result.sum ?? row(data.meta).sum);
    } else if (platform === 'kw') {
      raw = await this.http(queryURL('https://search.kuwo.cn/r.s', { client: 'kt', all: query, pn: page-1, rn: limit, ft: 'music', encoding: 'utf8', rformat: 'json', mobi: 1, newver: 1, vermerge: 1, show_copyright_off: 1 }), {}, signal);
      if (!Array.isArray(row(raw).abslist)) throw new Error('搜索服务格式无效');
      rows = list(row(raw).abslist); total = number(row(raw).TOTAL);
    } else if (platform === 'kg') {
      raw = await this.http(queryURL('https://songsearch.kugou.com/song_search_v2', { keyword: query, page, pagesize: limit, userid: 0, platform: 'WebFilter', filter: 2, iscorrection: 1, privilege_filter: 0, area_code: 1 }), {}, signal);
      if (row(raw).error_code !== 0) throw new Error('搜索服务暂时不可用');
      const result = row(row(raw).data); rows = list(result.lists).flatMap(value => [value, ...list(row(value).Grp)]); total = number(result.total);
    } else {
      const timestamp = String(Date.now()), deviceId = this.deviceId().replaceAll('-', '').toUpperCase();
      const sign = await this.md5(`${query}6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${timestamp}`);
      raw = await this.http(queryURL('https://jadeite.migu.cn/music_search/v3/search/searchAll', { isCorrect: 0, isCopyright: 1,
        searchSwitch: JSON.stringify({ song: 1, album: 0, singer: 0, tagSong: 1, mvSong: 0, bestShow: 1, songlist: 0, lyricSong: 0 }), pageSize: limit, text: query, pageNo: page, sort: 0, sid: 'USS' }),
        { headers: { uiVersion: 'A_music_3.6.1', deviceId, timestamp, sign, channel: '0146921', 'User-Agent': 'Mozilla/5.0' } }, signal);
      if (row(raw).code !== '000000') throw new Error('搜索服务暂时不可用');
      const result = row(row(raw).songResultData); rows = list(result.resultList).flat(); total = number(result.totalCount);
    }
    const items = rows.map(value => onlineTrack(platform, value));
    return { items, page, ...(total !== undefined ? { total } : {}), hasMore: total !== undefined ? page*limit < total : rows.length >= limit };
  }
}
