// Official request contracts: Q-music Android 5db858f, musicAccount/
// daily.ts, requests.ts, qqCredentials.ts (Apache-2.0, Nshpiter/LX NOTICE).
// Independent HTTPS reader. Radar is never labeled as official daily.
import {bounded,throwIfAborted} from './async.ts';
import {AccountDailyError,type DailyRecommendation} from './accountDaily.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import {parseQQCookiePayload,qqWebIdentity} from './qqAccountProfile.ts';
import type {MusicAccount,MusicSession} from './musicAccounts.ts';
import type {Track} from '../domain/track.ts';
import {onlineTrack} from './online.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const mid=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9]{1,128}$/.test(value);
const loginCode=(value:unknown)=>[301,401,403,1000,104400,104401].includes(Number(value));
export const validQQDailyKey=(value:unknown):value is string=>typeof value==='string'&&/^qmk-[A-Za-z0-9_-]{12,1024}$/.test(value);
function credentials(account:MusicAccount,session:MusicSession){
  if(account.platform!=='tx'||session.version!==1||session.platform!=='tx'||session.accountId!==account.id)throw new AccountDailyError('login_required');
  const cookies=parseQQCookiePayload(JSON.stringify(row(session.cookies))),identity=qqWebIdentity(cookies);
  if(account.username!==`qq:2:${identity.uin}`||session.userId!==identity.uin)throw new AccountDailyError('login_required');
  return{cookies,...identity};
}
export function validQQDailySession(account:MusicAccount,session:MusicSession):boolean{try{credentials(account,session);return true;}catch{return false;}}
export type QQDailyResult=Pick<DailyRecommendation,'kind'|'reason'|'tracks'>;

export class QQDailyClient{
  validate=validQQDailySession;
  private readonly http:HTTPClient;
  constructor(options:{http:HTTPClient}){this.http=options.http;}
  private async officialIds(account:MusicAccount,session:MusicSession,key:string,signal:AbortSignal):Promise<readonly string[]>{
    const {cookies}=credentials(account,session);
    if(!validQQDailyKey(key))throw new AccountDailyError('unavailable');
    const result=row(await this.http('https://a.y.qq.com/discover/daily-mix',{method:'POST',credentials:'omit',headers:{Cookie:Object.entries(cookies).map(([name,value])=>`${name}=${value}`).join('; '),Authorization:`Bearer ${key}`,'Content-Type':'application/json',Referer:'https://y.qq.com/'},body:JSON.stringify({params:{},comm:{skill_version:'0.0.3'}})},signal));
    throwIfAborted(signal);
    if(result.ret!==undefined&&Number(result.ret)!==0||result.sub_ret!==undefined&&Number(result.sub_ret)!==0||!Array.isArray(result.songlist))throw new AccountDailyError('unavailable');
    const ids:string[]=[];
    for(const value of result.songlist){const id=row(value).songMid;if(mid(id)&&!ids.includes(id))ids.push(id);if(ids.length===30)break;}
    if(result.songlist.length&&!ids.length)throw new AccountDailyError('unavailable');
    return ids;
  }
  /** For the separate official authorization flow; never persists the key. */
  async validateKey(account:MusicAccount,session:MusicSession,key:string,signal:AbortSignal):Promise<void>{
    try{await bounded(async child=>{if(!(await this.officialIds(account,session,key,child)).length)throw new AccountDailyError('unavailable');},signal,12_000);}
    catch{throw new AccountDailyError(signal.aborted?'cancelled':'unavailable');}
  }
  async fetch(account:MusicAccount,session:MusicSession,signal:AbortSignal):Promise<QQDailyResult>{
    try{
      const {cookies,uin,authst,tmeLoginType}=credentials(account,session);
      return await bounded(async child=>{
        const request=async(calls:Row):Promise<Row>=>{
          throwIfAborted(child);
          const result=row(await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',credentials:'omit',headers:{Cookie:Object.entries(cookies).map(([name,value])=>`${name}=${value}`).join('; '),Referer:'https://y.qq.com/',Origin:'https://y.qq.com','Content-Type':'application/json;charset=UTF-8'},body:JSON.stringify({comm:{uin,authst,ct:19,cv:0,format:'json',tmeAppID:'qqmusic',tmeLoginType},...calls})},child));
          throwIfAborted(child);
          for(const code of [result.code,...Object.keys(calls).map(key=>row(result[key]).code)])if(code!==0)throw new AccountDailyError(loginCode(code)?'login_required':'unavailable');
          for(const key of Object.keys(calls))if(!row(result[key]).data||typeof row(result[key]).data!=='object'||Array.isArray(row(result[key]).data))throw new AccountDailyError('unavailable');
          return result;
        };
        const tracks=async(ids:readonly string[]):Promise<readonly Track[]>=>{
          const batches:Promise<Track[]>[]=[];
          for(let offset=0;offset<ids.length;offset+=10){
            const group=ids.slice(offset,offset+10),call=(id:string)=>({module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_type:0,song_mid:id}});
            batches.push((async()=>{
              const decode=(value:unknown,id:string)=>{const info=row(value);if(info.mid!==id||!mid(row(info.file).media_mid)||!info.album)throw new AccountDailyError('unavailable');return onlineTrack('tx',info);};
              try{const result=await request(Object.fromEntries(group.map((id,index)=>[`detail_${index}`,call(id)])));return group.map((id,index)=>decode(row(row(result[`detail_${index}`]).data).track_info,id));}
              catch(error){
                if(child.aborted||error instanceof AccountDailyError&&error.kind==='login_required')throw error;
                // One bounded per-song retry; never publish an incomplete list.
                return Promise.all(group.map(async id=>{const result=await request({detail:call(id)});return decode(row(row(result.detail).data).track_info,id);}));
              }
            })());
          }
          return(await Promise.all(batches)).flat();
        };
        let reason:DailyRecommendation['reason']='';
        if(session.qqDailyKey!==undefined){
          try{const ids=await this.officialIds(account,session,String(session.qqDailyKey),child);if(ids.length)return{kind:'tx_official_daily',reason:'',tracks:await tracks(ids)};}
          catch{throwIfAborted(child);}
          reason='official_unavailable';
        }
        const ids:string[]=[];
        for(const pages of [[1,2],[3,4]]){
          const results=await Promise.all(pages.map(async Page=>{
            const result=await request({radio:{module:'music.recommend.TrackRelationServer',method:'GetRadarSong',param:{Page}}});
            const data=row(row(result.radio).data),rows=[data.VecSongs,data.tracks,data.track,data.songList,data.vec_song,data.List].find(Array.isArray);
            if(!rows||rows.length>1000)throw new AccountDailyError('unavailable');return rows;
          }));
          for(const rows of results)for(const value of rows){if(ids.length>=30)break;const raw=row(value),track=row(raw.Track??raw.track_info??raw),id=track.mid??track.songmid;if(mid(id)&&!ids.includes(id))ids.push(id);if(ids.length===30)break;}
          if(ids.length>=30||!results.some(rows=>rows.length))break;
        }
        return{kind:'tx_radar',reason,tracks:await tracks(ids.slice(0,30))};
      },signal,45_000);
    }catch(error){
      if(signal.aborted)throw new AccountDailyError('cancelled');
      if(error instanceof AccountDailyError)throw error;
      if(!validQQDailySession(account,session)||error instanceof HTTPResponseError&&[401,403].includes(error.status))throw new AccountDailyError('login_required');
      throw new AccountDailyError('unavailable');
    }
  }
}
