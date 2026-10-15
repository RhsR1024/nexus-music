import type {Track} from '../domain/track.ts';
import {validateTrack} from '../domain/track.ts';
import {parseProviderJSON} from '../providers/http.ts';
import {cleanTrack} from './backup.ts';
import type {PlaylistCollection} from './playlistJSON.ts';
type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
export interface WayfarerPreview {collections:readonly PlaylistCollection[];favorites:readonly Track[];unsupported:number;total:number;ignoredSources:number}
function track(value:unknown):Track|undefined {
  const raw=row(value),provider=typeof raw.providerId==='string'?raw.providerId:'';
  if(!['lx:wy','lx:tx','lx:kw'].includes(provider))return;
  const platform=provider.slice(3) as 'wy'|'tx'|'kw';
  if(typeof raw.id!=='string'||!raw.id.startsWith(provider+':'))throw new Error('漫途歌曲与平台ID不匹配');
  const id=raw.id.slice(provider.length+1);
  if(!(platform==='tx'?/^[A-Za-z0-9]+$/:/^\d+$/).test(id)||typeof raw.title!=='string'||!raw.title.trim()||typeof raw.artist!=='string')throw new Error('漫途歌曲结构无效');
  const metadata:Record<string,unknown>={songId:id,...(platform==='tx'?{songmid:id,needsMetadata:true}:{}),wayfarerId:raw.id};
  const result=cleanTrack({origin:{kind:'online',platform,id},title:raw.title,artist:raw.artist,
    ...(typeof raw.album==='string'?{album:raw.album}:{}),...(typeof raw.durationMs==='number'?{durationMs:raw.durationMs}:{}),
    ...(typeof raw.artworkUri==='string'?{artwork:raw.artworkUri}:{}),metadata,qualities:[]});
  validateTrack(result);return result;
}
export function decodeWayfarer(input:string):WayfarerPreview {
  if(input.length>32*1024*1024)throw new Error('漫途备份超过32MiB');
  const root=row(parseProviderJSON(input)),favorites=row(root.favorites);
  if(root.version!==1||!Number.isFinite(root.createdAtMs)||Number(root.createdAtMs)<0||!Array.isArray(root.sources)||!Array.isArray(root.playlists)||!Array.isArray(favorites.tracks)||!Array.isArray(favorites.ids)||!root.settings||typeof root.settings!=='object'||Array.isArray(root.settings))throw new Error('无法识别的漫途备份版本或结构');
  if(root.playlists.length>100||root.sources.length>1000)throw new Error('漫途备份条目过多');
  let total=0,unsupported=0;
  const read=(values:unknown[]):Track[]=>values.flatMap(value=>{if(++total>20000)throw new Error('单次导入最多20000条歌曲');const result=track(value);if(!result){unsupported++;return [];}return[result];});
  const collections=root.playlists.map(value=>{
    const playlist=row(value);if(typeof playlist.title!=='string'||!playlist.title.trim()||!Array.isArray(playlist.tracks))throw new Error('漫途歌单结构无效');
    return{title:playlist.title,tracks:read(playlist.tracks)};
  });
  const byId=new Map(favorites.tracks.map(value=>[row(value).id,value]));
  const ordered=favorites.ids.map(id=>{if(typeof id!=='string'||!byId.has(id))throw new Error('漫途收藏缺少歌曲数据');return byId.get(id);});
  return{collections,favorites:read(ordered),unsupported,total,ignoredSources:root.sources.length};
}
