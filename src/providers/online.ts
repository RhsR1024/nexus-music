import type { OnlinePlatform, Track } from '../domain/track.ts';
import { queryURL, requestJSON, requestText, type HTTPClient, type TextHTTPClient } from './http.ts';
import { qqSignature } from './qqSignature.ts';

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
function id(value: unknown) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('服务返回了不安全的歌曲ID');
  const result = text(value); if (!result) throw new Error('歌曲缺少ID'); return result;
}
const number = (value: unknown) => { if(value===undefined||value===null||value==='')return undefined; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; };
function names(value: unknown, key = 'name') { return list(value).map(item => text(row(item)[key])).filter(Boolean).join(' / '); }
function decoded(value: unknown) { return text(value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function qualities(values: Readonly<Record<string, unknown>>) { return Object.entries(values).filter(([,size]) => (number(size) ?? 0) > 0).map(([id,size]) => ({ id, sizeBytes: number(size)! })); }
function normalizePublicArtwork(raw: unknown, relativeBase?: string): string | undefined {
  let s = text(raw).trim();
  if (!s) return undefined;
  s = s.replace(/\{size\}/gi, '400');
  if (s.startsWith('//')) s = `https:${s}`;
  else if (s.startsWith('/') && relativeBase) s = `${relativeBase}${s}`;
  else if (s.startsWith('http://')) s = `https://${s.slice(7)}`;
  s = s.replace(/^(https:\/\/img[1-4])\.kwcdn(\.kuwo\.cn\/)/i, '$1$2');
  return /^https?:\/\//i.test(s) ? s : undefined;
}
function extractKugouArtwork(value: Row): string | undefined {
  const trans = row(value.trans_param);
  const albumInfo = row(value.album_info);
  const firstAuthor = row(list(value.authors)[0]);
  for (const candidate of [
    value.sizable_cover,
    value.union_cover,
    value.album_sizable_cover,
    albumInfo.sizable_cover,
    trans.union_cover,
    value.img,
    value.pic,
    value.imgurl,
    value.Image,
    firstAuthor.sizable_avatar,
  ]) {
    const url = normalizePublicArtwork(candidate);
    if (url) return url;
  }
  return undefined;
}
function extractMiguArtwork(value: Row): string | undefined {
  const pickFromArray = (arr: unknown): string | undefined => {
    const entries = list(arr).map(row);
    for (const pref of ['02', '01', '03']) {
      const hit = entries.find(e => text(e.imgSizeType) === pref && text(e.img || e.webpImg));
      if (hit) {
        const url = normalizePublicArtwork(hit.img || hit.webpImg, 'https://d.musicapp.migu.cn');
        if (url) return url;
      }
    }
    for (const e of entries) {
      const url = normalizePublicArtwork(e.img || e.webpImg, 'https://d.musicapp.migu.cn');
      if (url) return url;
    }
    return undefined;
  };
  for (const candidate of [value.img3, value.img2, value.img1, value.picL, value.picM, value.picS, value.largePic, value.mediumPic, value.smallPic, value.cover]) {
    const url = normalizePublicArtwork(candidate, 'https://d.musicapp.migu.cn');
    if (url) return url;
  }
  return pickFromArray(value.albumImgs) ?? pickFromArray(value.imgItems) ?? normalizePublicArtwork(row(list(value.singerImg ? Object.values(row(value.singerImg)) : [])[0]).miguImgUrl, 'https://d.musicapp.migu.cn');
}
function extractKuwoArtwork(value: Row): string | undefined {
  for (const direct of [value.pic, value.hts_MVPIC, value.albumpic, value.albumPic, value.musicPic, value.pic120, value.artistPic, value.cover]) {
    const url = normalizePublicArtwork(direct);
    if (url) return url;
  }
  const albumShort = text(value.web_albumpic_short ?? value.albumpic_short).trim();
  if (albumShort) {
    if (/^https?:\/\//i.test(albumShort)) return normalizePublicArtwork(albumShort);
    const clean = albumShort.replace(/^\/+/, '').replace(/^120\//, '500/');
    return `https://img4.kuwo.cn/star/albumcover/${clean}`;
  }
  const mvPic = text(value.MVPIC).trim();
  if (mvPic) {
    if (/^https?:\/\//i.test(mvPic)) return normalizePublicArtwork(mvPic);
    return `https://img2.kuwo.cn/wmvpic/${mvPic.replace(/^\/+/, '')}`;
  }
  const artistShort = text(value.web_artistpic_short).trim();
  if (artistShort) {
    if (/^https?:\/\//i.test(artistShort)) return normalizePublicArtwork(artistShort);
    const clean = artistShort.replace(/^\/+/, '').replace(/^120\//, '300/');
    return `https://img3.kuwo.cn/star/starheads/${clean}`;
  }
  return undefined;
}
function extractQQArtwork(value: Row, album: Row): string | undefined {
  const albumMid = text(album.mid ?? value.albummid).trim();
  if (albumMid && !/^0+$/.test(albumMid)) {
    return `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`;
  }
  // Preserve original QQ `vs` slot positions! Slot [1] holds the UGC/single T062 cover ID
  // when album.mid is empty (even if slot [0] is ""). Filtering out empty strings beforehand
  // shifts unrelated non-image slots (e.g. vs[4]) into index 1 and produces 404 image URLs.
  const rawVs = list(value.vs).map(item => text(item).trim());
  for (const vsId of [rawVs[1], rawVs[0]]) {
    if (vsId && /^[A-Za-z0-9]{10,24}$/.test(vsId) && !/^0+$/.test(vsId)) {
      return `https://y.gtimg.cn/music/photo_new/T062R300x300M000${vsId}.jpg`;
    }
  }
  const albumPmid = text(album.pmid ?? value.albumpmid).trim();
  if (albumPmid && /^[A-Za-z0-9_]{10,32}$/.test(albumPmid) && !/^0+(_0+)?$/.test(albumPmid)) {
    return `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumPmid}.jpg`;
  }
  const firstSinger = row(list(value.singer)[0]);
  const singerMid = text(firstSinger.mid ?? firstSinger.pmid).trim();
  if (singerMid && /^[A-Za-z0-9]{10,24}$/.test(singerMid) && !/^0+$/.test(singerMid)) {
    return `https://y.gtimg.cn/music/photo_new/T001R300x300M000${singerMid}.jpg`;
  }
  return undefined;
}
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
    const txArtwork = extractQQArtwork(value, album);
    const txArtistIds = list(value.singer).map(item => text(row(item).mid ?? row(item).pmid)).filter(Boolean);
    track = { origin: { kind: 'online', platform, id: mid }, title: text(value.title ?? value.name ?? value.songname), artist: names(value.singer), album: text(album.name ?? value.albumname),
      ...(duration !== undefined ? { durationMs: duration * 1000 } : {}), ...(txArtwork ? { artwork: txArtwork } : {}),
      metadata: { id: text(value.id ?? value.songid), songId: mid, albumId: albumMid, albumMid, strMediaMid: text(file.media_mid ?? value.media_mid), songmid: mid, ...(txArtistIds.length ? { artistIds: txArtistIds } : {}) },
      qualities: qualities({ '128k': file.size_128mp3, '320k': file.size_320mp3, flac: file.size_flac, flac24bit: file.size_hires }) };
  } else if (platform === 'kw') {
    const songId = id(value.MUSICRID ?? value.rid).replace(/^MUSIC_/, ''), duration = number(value.DURATION ?? value.duration);
    const info = text(value.N_MINFO), available = ['128k', '320k', 'flac', 'flac24bit'].filter((_, index) => info.includes(`bitrate:${[128,320,2000,4000][index]},`));
    const kwArtwork = extractKuwoArtwork(value);
    const kwArtistId = text(value.ARTISTID ?? value.artistid);
    track = { origin: { kind: 'online', platform, id: songId }, title: decoded(value.SONGNAME ?? value.name), artist: decoded(value.ARTIST ?? value.artist).replaceAll('&', ' / '), album: decoded(value.ALBUM ?? value.album),
      ...(duration !== undefined ? { durationMs: duration*1000 } : {}), ...(kwArtwork ? { artwork: kwArtwork } : {}),
      metadata: { albumId: text(value.ALBUMID ?? value.albumid), ...(kwArtistId ? { artistIds: [kwArtistId] } : {}), formats: text(value.FORMATS), N_MINFO: info }, qualities: available.map(id => ({ id })) };
  } else if (platform === 'kg') {
    const hash = id(value.FileHash ?? value.hash), duration = number(value.Duration ?? value.duration), audioId = text(value.Audioid ?? value.audio_id);
    const types = { '128k': { hash, size: value.FileSize }, '320k': { hash: text(value.HQFileHash), size: value.HQFileSize }, flac: { hash: text(value.SQFileHash), size: value.SQFileSize }, flac24bit: { hash: text(value.ResFileHash), size: value.ResFileSize } };
    const kgArtwork = extractKugouArtwork(value);
    const kgArtistIds = list(value.Singers ?? value.authors).map(item => text(row(item).id ?? row(item).author_id)).filter(Boolean);
    track = { origin: { kind: 'online', platform, id: audioId ? `${audioId}_${hash}` : hash }, title: decoded(value.OriSongName ?? value.SongName ?? value.FileName), artist: names(value.Singers) || decoded(value.SingerName), album: decoded(value.AlbumName),
      ...(duration !== undefined ? { durationMs: duration*1000 } : {}), ...(kgArtwork ? { artwork: kgArtwork } : {}),
      metadata: { hash, songId: audioId || hash, songmid: audioId, albumId: text(value.AlbumID ?? value.album_id), ...(kgArtistIds.length ? { artistIds: kgArtistIds } : {}), _types: types },
      qualities: qualities(Object.fromEntries(Object.entries(types).map(([key, value]) => [key, value.size]))) };
  } else {
    const songId = id(value.songId ?? value.id), copyrightId = id(value.copyrightId ?? value.copyright_id), duration = number(value.duration);
    const formats = list(value.audioFormats ?? value.newRateFormats).map(row), types: Row = {};
    const mapping: Record<string, string> = { PQ: '128k', HQ: '320k', SQ: 'flac', ZQ24: 'flac24bit', ZQ: 'flac24bit' };
    for (const format of formats) { const key = mapping[text(format.formatType)]; if (key) types[key] = format.asize ?? format.isize ?? format.size; }
    const mgArtwork = extractMiguArtwork(value);
    const mgArtistIds = list(value.singerList ?? value.singers ?? value.artists).map(item => text(row(item).id)).filter(Boolean);
    track = { origin: { kind: 'online', platform, id: songId }, title: text(value.name ?? value.songName), artist: names(value.singerList ?? value.singers ?? value.artists) || text(value.singer), album: text(value.album),
      ...(duration !== undefined ? { durationMs: duration*1000 } : {}), ...(mgArtwork ? { artwork: mgArtwork } : {}),
      metadata: { copyrightId, albumId: text(value.albumId), ...(mgArtistIds.length ? { artistIds: mgArtistIds } : {}), lrcUrl: text(value.lrcUrl), mrcUrl: text(value.mrcUrl ?? value.mrcurl), trcUrl: text(value.trcUrl), _types: types }, qualities: qualities(types) };
  }
  if (!track.title) throw new Error('歌曲缺少名称'); return track;
}
export interface SearchPage { items: readonly Track[]; total?: number; page: number; hasMore: boolean }
export interface OnlineDependencies { http?: HTTPClient; textHTTP?: TextHTTPClient; md5: (value: string) => Promise<string>; sha1?: (value: string) => Promise<string>; deviceId: () => string }
export class OnlineProvider {
  private http: HTTPClient; private textHTTP?: TextHTTPClient; private md5: OnlineDependencies['md5']; private deviceId: () => string;
  private sha1: NonNullable<OnlineDependencies['sha1']>;
  constructor(dependencies: OnlineDependencies) {
    this.http = dependencies.http ?? requestJSON;
    this.textHTTP = dependencies.textHTTP ?? (dependencies.http ? undefined : requestText);
    this.md5 = dependencies.md5;
    this.deviceId = dependencies.deviceId;
    this.sha1 = dependencies.sha1 ?? (async () => { throw new Error('SHA1不可用'); });
  }
  async artwork(track:Track,signal:AbortSignal):Promise<string|undefined>{
    if(track.origin.kind!=='online')return undefined;
    if(track.origin.platform==='wy'&&/^\d+$/.test(track.origin.id)){
      const id=track.origin.id;
      const body=Object.entries({c:JSON.stringify([{id}]),ids:JSON.stringify([id])}).map(([key,value])=>`${key}=${encodeURIComponent(value)}`).join('&');
      const response=row(await this.http('https://music.163.com/api/v3/song/detail',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:'https://music.163.com/'},body},signal));
      if(response.code!==200)throw new Error('封面元数据暂不可用');
      const song=list(response.songs).map(row).find(song=>text(song.id)===id);
      return song?text(row(song.al??song.album).picUrl)||undefined:undefined;
    }
    if(track.origin.platform==='tx'&&/^[A-Za-z0-9]{8,32}$/.test(track.origin.id)){
      const body=JSON.stringify({comm:{ct:19,cv:1859,uin:0},req:{module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_type:0,song_mid:track.origin.id}}});
      const raw=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},signal));
      const detail=row(row(raw.req).data);
      const info=row(detail.track_info);
      return extractQQArtwork(info,row(info.album));
    }
    if(track.origin.platform==='kw'&&/^\d+$/.test(track.origin.id)){
      // Primary: Kuwo's dedicated rid_pic CDN resolver (returns 500x500 artwork without songinfoandlrc 301 rate-limits).
      if(this.textHTTP){
        try{
          const rawUrl=await this.textHTTP(queryURL('https://artistpicserver.kuwo.cn/pic.web',{corp:'kuwo',type:'rid_pic',pictype:500,size:500,rid:track.origin.id}),{},signal);
          const direct=normalizePublicArtwork(rawUrl);
          if(direct&&!/NO_PIC/i.test(direct))return direct;
        }catch(err){
          if(signal.aborted)throw err;
        }
      }
      const response=row(await this.http(queryURL('https://m.kuwo.cn/newh5/singles/songinfoandlrc',{musicId:track.origin.id}),{},signal));
      const info=row(row(response.data).songinfo);
      return extractKuwoArtwork(info);
    }
    if(track.origin.platform==='kg'){
      const hash=text(track.metadata.hash).toUpperCase();
      if(!/^[A-F0-9]{32}$/.test(hash))return undefined;
      const response=row(await this.http('https://gateway.kugou.com/v2/album_audio/audio',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','x-router':'kmr.service.kugou.com'},body:JSON.stringify({area_code:'1',show_privilege:1,show_album_info:'1',is_publish:'',appid:1005,clientver:11451,mid:'1',dfid:'-',clienttime:Date.now(),key:'OIlwieks28dk2k092lksi2UIkp',fields:'album_info,audio_info,authors,base,trans_param',data:[{hash}]})},signal));
      const first=Array.isArray(response.data)?response.data[0]:undefined;
      const item=row(Array.isArray(first)?first[0]:first);
      return extractKugouArtwork(item);
    }
    return undefined;
  }
  async enrich(track:Track,signal:AbortSignal):Promise<Track>{
    if(track.origin.kind!=='online'||track.origin.platform!=='tx'||track.metadata.needsMetadata!==true)return track;
    const body=JSON.stringify({comm:{ct:19,cv:1859,uin:0},req:{module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_type:0,song_mid:track.origin.id}}});
    const raw=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},signal)),response=row(raw.req);
    if(raw.code!==0||response.code!==0)throw new Error('歌曲元数据暂不可用');
    const detail=onlineTrack('tx',row(response.data).track_info);
    if(detail.origin.id!==track.origin.id)throw new Error('歌曲详情ID不匹配');
    return{...track,metadata:{...track.metadata,...detail.metadata,needsMetadata:false},qualities:detail.qualities,artwork:track.artwork??detail.artwork,album:track.album??detail.album,durationMs:track.durationMs??detail.durationMs};
  }
  async search(platform: OnlinePlatform, query: string, page: number, signal: AbortSignal, limit = 30): Promise<SearchPage> {
    if (!query.trim() || !Number.isInteger(page) || page < 1) throw new Error('搜索参数无效');
    let raw: unknown, rows: unknown[] = [], total: number | undefined;
    if (platform === 'wy') {
      raw = await this.http('https://music.163.com/api/cloudsearch/pc', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://music.163.com/' },
        body: Object.entries({ s: query, type: 1, offset: (page-1)*limit, limit }).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&') }, signal);
      if (row(raw).code !== 200 || typeof row(raw).result === 'string') throw new Error('搜索服务暂时不可用');
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
