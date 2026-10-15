import type {Track} from '../domain/track.ts';
import {cleanTrack} from '../storage/backup.ts';
import {bounded,throwIfAborted} from './async.ts';
import {requestJSON,type HTTPClient} from './http.ts';
type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const hosts=['qishui.douyin.com','music.douyin.com','qishui.com','www.qishui.com','beta-luna.douyin.com'];
function shareURL(input:string){
  const match=input.match(/https?:\/\/[^\s<>"'，。；）】]+/i);if(!match)throw new Error('请输入汽水公开歌单链接或ID');
  const url=new URL(match[0]);if(!hosts.includes(url.hostname.toLowerCase())||url.username||url.password||!['https:','http:'].includes(url.protocol)||url.port)throw new Error('只支持汽水官方公开歌单链接');return url;
}
function urlID(url:URL){const id=url.searchParams.get('playlist_id')??url.searchParams.get('playlistId')??url.searchParams.get('playlistid')??url.pathname.match(/\/playlist(?:_v\d+)?\/(\d+)/)?.[1];return id&&/^\d{1,30}$/.test(id)?id:undefined;}
export function qishuiID(input:string){const value=input.trim();return /^\d{1,30}$/.test(value)?value:urlID(shareURL(value));}
function identifier(value:unknown){const id=text(value);if(!/^\d{1,30}$/.test(id))throw new Error('汽水返回的ID无效');return id;}
function cover(raw:unknown){const value=row(raw);if(typeof value.url==='string')return value.url;const prefix=text(list(value.urls)[0]),uri=text(value.uri);return prefix&&uri?prefix+uri:'';}
function qishuiTrack(value:unknown):Track {
  const media=row(value),entity=row(media.entity);let raw=row(row(entity.track_wrapper).track??entity.track??media.track);let kind='track';
  if(!Object.keys(raw).length){raw=row(row(entity.video_wrapper).video??entity.video??media.video);kind='video';}
  const id=text(raw.id??raw.video_id??raw.vid??media.id),album=row(raw.album);
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new Error('汽水曲目ID无效');
  const artist=list(raw.artists).map(v=>{const a=row(v);return text(a.name??a.artist_name??a.simple_display_name);}).filter(Boolean).join(' / ');
  const duration=Number(raw.duration??raw.duration_ms);
  return cleanTrack({origin:{kind:'imported',platform:'qishui',id},title:text(raw.name??raw.title??raw.description)||'未知或已下架内容',artist,album:text(album.name),
    ...(Number.isFinite(duration)&&duration>=0?{durationMs:duration}:{}),artwork:cover(raw.url_cover??raw.cover_url)||cover(album.url_cover)||undefined,
    metadata:{originalPlatform:'qishui',originalId:id,mediaKind:kind},qualities:[]});
}
export interface QishuiPlaylist {id:string;title:string;tracks:readonly Track[]}
export class QishuiProvider {
  private http:HTTPClient;private expand:(url:string,signal:AbortSignal)=>Promise<string>;
  constructor(http:HTTPClient=requestJSON,expand=(url:string,signal:AbortSignal)=>bounded(async child=>{const result=await fetch(url,{signal:child});if(!result.ok)throw new Error('短链接展开失败');const expanded=result.url;try{await result.body?.cancel();}catch{/* RN may not expose a readable body. */}return expanded;},signal,12000)){this.http=http;this.expand=expand;}
  async complete(input:string,signal:AbortSignal):Promise<QishuiPlaylist>{
    throwIfAborted(signal);let id=qishuiID(input);
    if(!id)id=urlID(shareURL(await this.expand(shareURL(input).toString(),signal)));
    if(!id)throw new Error('无法识别汽水短链接，请粘贴完整歌单地址或ID');
    let cursor='0',title='',total:number|undefined;const visited=new Set<string>(),tracks:Track[]=[];
    for(let page=0;page<100;page++){
      throwIfAborted(signal);if(visited.has(cursor))throw new Error('汽水歌单分页未推进，未导入不完整数据');visited.add(cursor);
      const raw=row(await this.http('https://beta-luna.douyin.com/luna/playlist/detail',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'Luna/19.1.0 Android'},body:JSON.stringify({playlist_id:id,cursor,count:200})},signal));
      throwIfAborted(signal);const playlist=row(raw.playlist),count=Number(playlist.count_tracks);
      if(identifier(playlist.id)!==id||!Number.isInteger(count)||count<0||count>20000||!Array.isArray(raw.media_resources)||typeof raw.has_more!=='boolean')throw new Error('无法完整读取此汽水公开歌单');
      if(total===undefined){total=count;title=text(playlist.title??playlist.name)||'汽水公开歌单';}else if(total!==count)throw new Error('汽水歌单在读取中改变，请重试');
      tracks.push(...list(raw.media_resources).map(qishuiTrack));if(tracks.length>total)throw new Error('汽水歌曲数量与歌单不一致');
      if(raw.has_more!==true){if(tracks.length!==total)throw new Error('汽水歌单歌曲不完整，未导入');return{id,title,tracks};}
      const next=text(raw.next_cursor);if(!next||!list(raw.media_resources).length)throw new Error('汽水分页缺少下一页');cursor=next;
    }
    throw new Error('汽水歌单超过分页上限，未导入');
  }
}
