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
const nonEmpty=(...values:unknown[]):string=>{
  for(const v of values){if(typeof v==='string'&&v.trim())return v.trim();}
  return '';
};
function pickKugouCover(item:Row):string|undefined{
  const album=row(item.album_info),trans=row(item.trans_param),base=row(item.base);
  const firstAuthor=Array.isArray(item.authors)&&item.authors.length?row(item.authors[0]):{};
  const raw=nonEmpty(
    album.sizable_cover,
    trans.union_cover,
    base.sizable_cover,
    item.sizable_cover,
    item.img,
    firstAuthor.sizable_avatar,
  );
  return raw||undefined;
}
export class KugouTrackDetailError extends Error{constructor(){super('酷狗曲目数据不完整');}}
export async function resolveKugouTracks(options:{http:HTTPClient;now?:()=>number},ids:readonly string[],signal:AbortSignal,check=()=>throwIfAborted(signal),opts?:{lenient?:boolean}):Promise<Track[]>{
  check();if(ids.length>10000||ids.some(id=>!hash(id)))throw new KugouTrackDetailError();
  const lenient=opts?.lenient===true;
  const unique=[...new Set(ids.map(id=>id.toUpperCase()))],byHash=new Map<string,Row>();
  const details=async(group:readonly string[])=>{
    check();const raw=row(await options.http('https://gateway.kugou.com/v2/album_audio/audio',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','x-router':'kmr.service.kugou.com'},body:JSON.stringify({area_code:'1',show_privilege:1,show_album_info:'1',is_publish:'',appid:1005,clientver:11451,mid:'1',dfid:'-',clienttime:(options.now??Date.now)(),key:'OIlwieks28dk2k092lksi2UIkp',fields:'album_info,author_name,authors,audio_info,ori_audio_name,base,songname,trans_param',data:group.map(hash=>({hash}))})},signal));
    check();if(![0,'0'].includes((raw.error_code??raw.errcode??raw.err_code) as string|number)||!Array.isArray(raw.data))throw new KugouTrackDetailError();
    for(const value of raw.data){const item=row(Array.isArray(value)?value[0]:undefined),audio=row(item.audio_info);
      if(!hash(audio.hash)||typeof item.songname!=='string'||!item.songname.trim()||!item.album_info||typeof item.album_info!=='object'||Array.isArray(item.album_info)||
        !(typeof audio.audio_id==='string'&&/^\d{1,20}$/.test(audio.audio_id)||typeof audio.audio_id==='number'&&Number.isSafeInteger(audio.audio_id)&&audio.audio_id>=0))continue;
      for(const [key,value] of Object.entries(audio))if(/^hash(?:_|$)/.test(key)&&hash(value)&&!byHash.has(value.toUpperCase()))byHash.set(value.toUpperCase(),item);
    }
  };
  for(let offset=0;offset<unique.length;offset+=100){
    const group=unique.slice(offset,offset+100);
    try{
      await details(group);
      const missing=group.filter(id=>!byHash.has(id));if(missing.length)await details(missing);
    }catch(err){
      if(!lenient)throw err;
    }
    if(!lenient&&group.some(id=>!byHash.has(id)))throw new KugouTrackDetailError();
  }
  check();
  const resolved:Track[]=[];
  for(const id of ids){
    const item=byHash.get(id.toUpperCase());
    if(!item){if(lenient)continue;throw new KugouTrackDetailError();}
    const audio=row(item.audio_info),album=row(item.album_info);
    resolved.push(onlineTrack('kg',{FileHash:audio.hash,Audioid:audio.audio_id,OriSongName:item.songname,SingerName:item.author_name,AlbumName:album.album_name,AlbumID:album.album_id,sizable_cover:pickKugouCover(item),Duration:Number(audio.timelength)/1000,FileSize:audio.filesize,HQFileHash:hash(audio.hash_320)?audio.hash_320:undefined,HQFileSize:hash(audio.hash_320)?audio.filesize_320:undefined,SQFileHash:hash(audio.hash_flac)?audio.hash_flac:undefined,SQFileSize:hash(audio.hash_flac)?audio.filesize_flac:undefined,ResFileHash:hash(audio.hash_high)?audio.hash_high:undefined,ResFileSize:hash(audio.hash_high)?audio.filesize_high:undefined}));
  }
  return resolved;
}

/** Best-effort cover enricher for Kugou rank / playlist / favorite tracks that lack album artwork. */
export async function enrichKugouTrackArtworks(http:HTTPClient,tracks:readonly Track[],signal:AbortSignal):Promise<readonly Track[]>{
  const allHashes=[...new Set(tracks.filter(t=>t.origin.kind==='online'&&t.origin.platform==='kg'&&!t.artwork).map(t=>String(t.metadata.hash??'').toUpperCase()).filter(h=>hash(h)))];
  if(!allHashes.length)return tracks;
  const coverByHash=new Map<string,string>();
  const capped=allHashes.slice(0,500);
  for(let offset=0;offset<capped.length;offset+=100){
    if(signal.aborted)break;
    const chunk=capped.slice(offset,offset+100);
    try{
      const raw=row(await http('https://gateway.kugou.com/v2/album_audio/audio',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','x-router':'kmr.service.kugou.com'},body:JSON.stringify({area_code:'1',show_privilege:1,show_album_info:'1',is_publish:'',appid:1005,clientver:11451,mid:'1',dfid:'-',clienttime:Date.now(),key:'OIlwieks28dk2k092lksi2UIkp',fields:'album_info,audio_info,authors,base,trans_param',data:chunk.map(h=>({hash:h}))})},signal));
      if(!Array.isArray(raw.data))continue;
      for(const entry of raw.data){
        const item=row(Array.isArray(entry)?entry[0]:entry),audio=row(item.audio_info);
        const rawCover=pickKugouCover(item);
        if(!rawCover)continue;
        const url=rawCover.replace(/\{size\}/gi,'400').replace(/^http:\/\//i,'https://');
        for(const [k,v] of Object.entries(audio))if(/^hash(?:_|$)/.test(k)&&hash(v))coverByHash.set(v.toUpperCase(),url);
      }
    }catch{
      // keep partial covers already collected
    }
  }
  if(!coverByHash.size)return tracks;
  return tracks.map(t=>{
    if(t.artwork||t.origin.kind!=='online'||t.origin.platform!=='kg')return t;
    const h=String(t.metadata.hash??'').toUpperCase();
    const art=coverByHash.get(h);
    return art?{...t,artwork:art}:t;
  });
}
