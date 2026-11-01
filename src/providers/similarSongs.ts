import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import {onlineTrack} from './online.ts';
import {requestJSON,type HTTPClient} from './http.ts';

// Capability is explicit: other platforms must not silently receive a keyword
// search presented as a platform's similarity recommendation.
export function supportsSimilarSongs(track:Track){return track.origin.kind==='online'&&track.origin.platform==='wy'&&/^\d{1,24}$/.test(track.origin.id);}
export async function readSimilarSongs(track:Track,signal:AbortSignal,http:HTTPClient=requestJSON):Promise<readonly Track[]>{
 if(!supportsSimilarSongs(track))throw new Error('此来源暂不支持相似歌曲');
 if(signal.aborted)throw new Error('读取已取消');
 const raw=await http('https://music.163.com/api/v1/discovery/simiSong',{method:'POST',credentials:'omit',headers:{Referer:'https://music.163.com/','Content-Type':'application/x-www-form-urlencoded'},body:`songid=${encodeURIComponent(track.origin.id)}&limit=50&offset=0`},signal);
 if(!raw||typeof raw!=='object')throw new Error('相似歌曲暂不可用');
 const response=raw as Record<string,unknown>;
 if(response.code!==200||!Array.isArray(response.songs)||response.songs.length>200)throw new Error('相似歌曲暂不可用');
 const items:Track[]=[],seen=new Set([trackKey(track.origin)]);let valid=0;
 for(const row of response.songs){
  try{const song=onlineTrack('wy',row);if(!supportsSimilarSongs(song)||!song.title.trim())continue;valid++;const key=trackKey(song.origin);if(!seen.has(key)&&items.length<50){seen.add(key);items.push(song);}}catch{/* A malformed row cannot introduce an invalid identity. */}
 }
 if(response.songs.length&&!valid)throw new Error('相似歌曲数据暂不可用');
 return items;
}
