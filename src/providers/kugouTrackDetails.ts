// Shared public detail reader, extracted from NexusMusic's KugouDailyClient.
// Contract: Q-music Android 5db858f kg/songList.js (Apache-2.0), with
// MakcRe/KuGouMusicApi MIT attribution retained in licenses/kugou-api-mit.txt.
import {throwIfAborted} from './async.ts';
import type {HTTPClient} from './http.ts';
import {onlineTrack} from './online.ts';
import type {Track} from '../domain/track.ts';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v);
export class KugouTrackDetailError extends Error{constructor(){super('酷狗曲目数据不完整');}}
export async function resolveKugouTracks(options:{http:HTTPClient;now?:()=>number},ids:readonly string[],signal:AbortSignal,check=()=>throwIfAborted(signal)):Promise<Track[]>{
  check();if(ids.length>10000||ids.some(id=>!hash(id)))throw new KugouTrackDetailError();
  const unique=[...new Set(ids.map(id=>id.toUpperCase()))],byHash=new Map<string,Row>();
  const details=async(group:readonly string[])=>{
    check();const raw=row(await options.http('https://gateway.kugou.com/v2/album_audio/audio',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','x-router':'kmr.service.kugou.com'},body:JSON.stringify({area_code:'1',show_privilege:1,show_album_info:'1',is_publish:'',appid:1005,clientver:11451,mid:'1',dfid:'-',clienttime:(options.now??Date.now)(),key:'OIlwieks28dk2k092lksi2UIkp',fields:'album_info,author_name,audio_info,ori_audio_name,base,songname',data:group.map(hash=>({hash}))})},signal));
    check();if(![0,'0'].includes((raw.error_code??raw.errcode??raw.err_code) as string|number)||!Array.isArray(raw.data))throw new KugouTrackDetailError();
    for(const value of raw.data){const item=row(Array.isArray(value)?value[0]:undefined),audio=row(item.audio_info);
      if(!hash(audio.hash)||typeof item.songname!=='string'||!item.songname.trim()||!item.album_info||typeof item.album_info!=='object'||Array.isArray(item.album_info)||
        !(typeof audio.audio_id==='string'&&/^\d{1,20}$/.test(audio.audio_id)||typeof audio.audio_id==='number'&&Number.isSafeInteger(audio.audio_id)&&audio.audio_id>=0))continue;
      for(const [key,value] of Object.entries(audio))if(/^hash(?:_|$)/.test(key)&&hash(value)&&!byHash.has(value.toUpperCase()))byHash.set(value.toUpperCase(),item);
    }
  };
  for(let offset=0;offset<unique.length;offset+=100){
    const group=unique.slice(offset,offset+100);await details(group);
    const missing=group.filter(id=>!byHash.has(id));if(missing.length)await details(missing);
    if(group.some(id=>!byHash.has(id)))throw new KugouTrackDetailError();
  }
  check();return ids.map(id=>{
    const item=byHash.get(id.toUpperCase());if(!item)throw new KugouTrackDetailError();const audio=row(item.audio_info),album=row(item.album_info);
    return onlineTrack('kg',{FileHash:audio.hash,Audioid:audio.audio_id,OriSongName:item.songname,SingerName:item.author_name,AlbumName:album.album_name,AlbumID:album.album_id,Duration:Number(audio.timelength)/1000,FileSize:audio.filesize,HQFileHash:hash(audio.hash_320)?audio.hash_320:undefined,HQFileSize:hash(audio.hash_320)?audio.filesize_320:undefined,SQFileHash:hash(audio.hash_flac)?audio.hash_flac:undefined,SQFileSize:hash(audio.hash_flac)?audio.filesize_flac:undefined,ResFileHash:hash(audio.hash_high)?audio.hash_high:undefined,ResFileSize:hash(audio.hash_high)?audio.filesize_high:undefined});
  });
}
