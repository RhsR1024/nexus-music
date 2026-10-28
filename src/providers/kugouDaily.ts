// Protocol reference: Q-music Android 5db858f, kugouApi.ts / kg/songList.js
// (Apache-2.0); MakcRe/KuGouMusicApi MIT attribution: licenses/kugou-api-mit.txt.
// Independent bounded HTTPS reader; no reference runtime or native patches.
import {bounded,throwIfAborted} from './async.ts';
import {HTTPResponseError,queryURL,type HTTPClient} from './http.ts';
import {onlineTrack} from './online.ts';
import {AccountDailyError} from './accountDaily.ts';
import type {MusicAccount} from './musicAccounts.ts';
import type {Track} from '../domain/track.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{32}$/i.test(value);
export function validKugouDailySession(account:MusicAccount,session:Readonly<Row>):boolean{
  return account.platform==='kg'&&session.version===1&&session.platform==='kg'&&session.userId===account.username&&
    typeof session.userId==='string'&&/^[1-9][0-9]{0,19}$/.test(session.userId)&&hash(session.mid)&&
    typeof session.token==='string'&&session.token.length>0&&session.token.length<=4096&&!/[\u0000-\u0020\u007f]/.test(session.token);
}

/** Returned tracks are complete and in recommendation order, or the entire
 * request fails. Partial details never replace a previously displayed list. */
export class KugouDailyClient{
  validate=validKugouDailySession;
  private readonly options:{http:HTTPClient;md5:(value:string)=>Promise<string>;now?:()=>number};
  constructor(options:KugouDailyClient['options']){this.options=options;}
  async fetch(account:MusicAccount,session:Readonly<Row>,signal:AbortSignal):Promise<readonly Track[]>{
    try{
      if(!validKugouDailySession(account,session))throw new AccountDailyError('login_required');
      return await bounded(async child=>{
        throwIfAborted(child);
        const query:Row={dfid:'-',mid:session.mid,uuid:'-',appid:1005,clientver:20489,clienttime:Math.floor((this.options.now??Date.now)()/1000),userid:session.userId,token:session.token};
        const body=JSON.stringify({platform:'android',userid:session.userId}),salt='OIlwieks28dk2k092lksi2UIkp';
        const signature=await this.options.md5(salt+Object.keys(query).sort().map(key=>`${key}=${query[key]}`).join('')+body+salt);
        throwIfAborted(child);if(!hash(signature))throw new AccountDailyError('unavailable');
        const response=row(await this.options.http(queryURL('https://gateway.kugou.com/everyday_song_recommend',{...query,signature}),{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',dfid:'-',mid:String(session.mid),clienttime:String(query.clienttime),'x-router':'everydayrec.service.kugou.com'},body},child));
        throwIfAborted(child);
        if(![1,'1'].includes(response.status as string|number)||response.error_code!==undefined&&![0,'0'].includes(response.error_code as string|number))throw new AccountDailyError('unavailable');
        const songs=row(response.data).song_list;
        if(!Array.isArray(songs)||songs.length>1000)throw new AccountDailyError('unavailable');
        const hashes:string[]=[];
        for(const value of songs){const id=row(value).hash??row(value).hash_128;if(!hash(id))throw new AccountDailyError('unavailable');const upper=id.toUpperCase();if(!hashes.includes(upper))hashes.push(upper);}
        const requested=hashes.slice(0,30);if(!requested.length)return[];
        const byHash=new Map<string,Row>();
        const details=async(ids:readonly string[])=>{
          const raw=row(await this.options.http('https://gateway.kugou.com/v2/album_audio/audio',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','x-router':'kmr.service.kugou.com'},body:JSON.stringify({area_code:'1',show_privilege:1,show_album_info:'1',is_publish:'',appid:1005,clientver:11451,mid:'1',dfid:'-',clienttime:(this.options.now??Date.now)(),key:salt,fields:'album_info,author_name,audio_info,ori_audio_name,base,songname',data:ids.map(hash=>({hash}))})},child));
          throwIfAborted(child);
          if(![0,'0'].includes((raw.error_code??raw.errcode??raw.err_code) as string|number)||!Array.isArray(raw.data))throw new AccountDailyError('unavailable');
          for(const group of raw.data){const item=row(Array.isArray(group)?group[0]:undefined),audio=row(item.audio_info);
            if(!hash(audio.hash)||typeof item.songname!=='string'||!item.songname.trim()||!item.album_info||typeof item.album_info!=='object'||
              !(typeof audio.audio_id==='string'&&/^[0-9]{1,20}$/.test(audio.audio_id)||typeof audio.audio_id==='number'&&Number.isSafeInteger(audio.audio_id)&&audio.audio_id>=0))continue;
            for(const [key,value] of Object.entries(audio))if(/^hash(?:_|$)/.test(key)&&hash(value)&&!byHash.has(value.toUpperCase()))byHash.set(value.toUpperCase(),item);
          }
        };
        await details(requested);
        const missing=requested.filter(id=>!byHash.has(id));if(missing.length)await details(missing);
        const seen=new Set<string>();
        return requested.map(id=>{
          const item=byHash.get(id);if(!item)throw new AccountDailyError('unavailable');
          const audio=row(item.audio_info),album=row(item.album_info);
          return onlineTrack('kg',{FileHash:audio.hash,Audioid:audio.audio_id,OriSongName:item.songname,SingerName:item.author_name,AlbumName:album.album_name,AlbumID:album.album_id,Duration:Number(audio.timelength)/1000,FileSize:audio.filesize,HQFileHash:hash(audio.hash_320)?audio.hash_320:undefined,HQFileSize:hash(audio.hash_320)?audio.filesize_320:undefined,SQFileHash:hash(audio.hash_flac)?audio.hash_flac:undefined,SQFileSize:hash(audio.hash_flac)?audio.filesize_flac:undefined,ResFileHash:hash(audio.hash_high)?audio.hash_high:undefined,ResFileSize:hash(audio.hash_high)?audio.filesize_high:undefined});
        }).filter(track=>{if(seen.has(track.origin.id))return false;seen.add(track.origin.id);return true;});
      },signal,30_000);
    }catch(error){
      if(signal.aborted)throw new AccountDailyError('cancelled');
      if(error instanceof AccountDailyError)throw error;
      if(error instanceof HTTPResponseError&&[401,403].includes(error.status))throw new AccountDailyError('login_required');
      // Transport exceptions may contain the credential-bearing query URL.
      throw new AccountDailyError('unavailable');
    }
  }
}
