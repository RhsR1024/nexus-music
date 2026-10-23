import type {OnlinePlatform,Track} from '../domain/track.ts';
import {parseProviderJSON} from '../providers/http.ts';
import {cleanTrack} from './backup.ts';
type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const maxDurationMs=24*60*60*1000;
function lxQualities(meta:Row):{id:string}[]{
  const seen=new Set<string>(),qualities:{id:string}[]=[];
  for(const value of Array.isArray(meta.qualitys)?meta.qualitys:[]){
    if(qualities.length>=64)break;
    const type=row(value).type;
    if(typeof type!=='string'||!type||type.length>128||seen.has(type))continue;
    seen.add(type);qualities.push({id:type});
  }
  return qualities;
}
export interface PlaylistCollection {title:string;tracks:readonly Track[]}
export interface PlaylistJSONPreview {collections:readonly PlaylistCollection[];unsupported:number;total:number}
export function lxTrack(value:unknown):Track|undefined {
  const item=row(value),platform=text(item.source);if(!['wy','tx','kw','kg','mg'].includes(platform))return;
  const meta=row(item.meta),songId=text(meta.songId),hash=text(meta.hash),sourceId=text(item.id).replace(new RegExp(`^${platform}_`),'');
  // kg identity is the LX composite `${songmid}_${hash}`; other sources use
  // the song id from the LX `source_songid` item id.
  const id=platform==='kg'
    ?(sourceId.includes('_')?sourceId:hash?`${sourceId||songId}_${hash}`:sourceId||songId)
    :sourceId||songId;
  if(!id||typeof item.name!=='string'||typeof item.singer!=='string')throw new Error('LX歌曲ID或名称格式无效');
  const interval=text(item.interval).match(/^(\d+):(\d{1,2})$/);
  const seconds=interval&&Number(interval[2])<60?Number(interval[1])*60+Number(interval[2]):undefined;
  const duration=seconds!==undefined&&Number.isFinite(seconds)&&seconds*1000<=maxDurationMs?seconds*1000:undefined;
  const metaSongId=songId||(platform==='kg'&&sourceId.includes('_')?'':sourceId);
  return cleanTrack({origin:{kind:'online',platform:platform as OnlinePlatform,id},title:item.name,artist:item.singer,
    ...(typeof meta.albumName==='string'?{album:meta.albumName}:{}),...(duration!==undefined?{durationMs:duration}:{}),
    ...(typeof meta.picUrl==='string'?{artwork:meta.picUrl}:{}),metadata:{...meta,...(metaSongId?{songId:metaSongId}:{})},qualities:lxQualities(meta)});
}
export function decodePlaylistJSON(input:string):PlaylistJSONPreview {
  if(input.length>32*1024*1024)throw new Error('歌单JSON超过32MiB');
  const value=row(parseProviderJSON(input));
  const values=value.type==='playList_v2'?value.data:value.type==='playListPart_v2'?[value.data]:undefined;
  if(!Array.isArray(values)||values.length>100)throw new Error('支持LX v2歌单JSON；未知格式未导入');
  let unsupported=0,total=0;
  const collections=values.map(value=>{
    const playlist=row(value);if(typeof playlist.name!=='string'||!playlist.name.trim()||!Array.isArray(playlist.list))throw new Error('歌单结构无效');
    const tracks:Track[]=[];
    for(const value of playlist.list){if(++total>20000)throw new Error('单次导入最多20000条歌曲');const track=lxTrack(value);if(track)tracks.push(track);else unsupported++;}
    return{title:playlist.name,tracks};
  });
  return{collections,unsupported,total};
}
