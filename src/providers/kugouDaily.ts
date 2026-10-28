// Protocol reference: Q-music Android 5db858f, kugouApi.ts / kg/songList.js
// (Apache-2.0); MakcRe/KuGouMusicApi MIT attribution: licenses/kugou-api-mit.txt.
// Independent bounded HTTPS reader; no reference runtime or native patches.
import {bounded,throwIfAborted} from './async.ts';
import {HTTPResponseError,queryURL,type HTTPClient} from './http.ts';
import {resolveKugouTracks} from './kugouTrackDetails.ts';
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
        const seen=new Set<string>();
        return(await resolveKugouTracks(this.options,requested,child)).filter(track=>{if(seen.has(track.origin.id))return false;seen.add(track.origin.id);return true;});
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
