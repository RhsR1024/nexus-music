// QQ Music favorite wire semantics adapted from Q-music-android 5db858f,
// musicAccount/qqFavorite.ts and qqCredentials.ts (Apache-2.0).
// Modified for NexusMusic: account/session binding, cancellation, one write and
// read-back confirmation instead of treating a successful response as success.
import type {MusicAccount,MusicAccounts,MusicSession} from './musicAccounts.ts';
import {parseQQCookiePayload,qqMusicIdentity} from './qqAccountProfile.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import {qqSignature} from './qqSignature.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const authCode=(value:number)=>[301,401,403,1000,104400,104401].includes(value);
const requestComm=(uin:string,authst:string,tmeLoginType:1|2)=>({uin,authst,ct:24,cv:0,format:'json',tmeAppID:'qqmusic',tmeLoginType});
const cookieHeader=(cookies:Readonly<Record<string,string>>)=>Object.entries(cookies).map(([name,value])=>`${name}=${value}`).join('; ');

export type QQFavoriteStatus='added'|'already'|'unconfirmed'|'unknown'|'rejected'|'unsupported'|'unavailable'|'login_required'|'account_changed'|'cancelled';
export interface QQFavoriteResult {readonly status:QQFavoriteStatus;readonly code?:number}

class QQFavoriteResponseError extends Error {
  readonly code:number;
  constructor(code:number){super('response code');this.code=code;}
}
class QQFavoriteUnavailable extends Error {}
class QQFavoriteUnsupported extends Error {}
class QQFavoriteLoginRequired extends Error {}
class QQFavoriteAccountChanged extends Error {}
class QQFavoriteCancelled extends Error {}

function requireSuccess(value:unknown){
  const code=typeof value==='number'?value:typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):NaN;
  if(!Number.isSafeInteger(code))throw new QQFavoriteUnavailable();
  if(code!==0)throw new QQFavoriteResponseError(code);
}

/** QQ playlist web requests use the jqqweb CSRF tokens; the music API uses
 * authst. The saved cookie subset may only contain an auth key, so fall back to
 * that verified session credential rather than hashing an empty string. */
function csrfToken(cookies:Readonly<Record<string,string>>,authst:string,preferred:'skey'|'qqmusic_key'):string{
  if(preferred==='skey')return cookies.skey||cookies.qqmusic_key||authst;
  return cookies.qqmusic_key||cookies.p_skey||cookies.skey||cookies.p_lskey||cookies.lskey||authst;
}
function csrfHash(value:string):number{
  let token=5381;
  for(let index=0;index<value.length;index++)token=(token+(token<<5)+value.charCodeAt(index))|0;
  return token&0x7fffffff;
}

export class QQFavoriteClient {
  private readonly dependencies:{http:HTTPClient;sha1:(value:string)=>Promise<string>;accounts:Pick<MusicAccounts,'getSnapshot'>;wait?:(milliseconds:number)=>Promise<void>};
  private readonly pending=new Map<string,Promise<QQFavoriteResult>>();
  constructor(dependencies:QQFavoriteClient['dependencies']){this.dependencies=dependencies;}

  add(account:MusicAccount,session:MusicSession,songMid:string,signal:AbortSignal):Promise<QQFavoriteResult>{
    if(!/^[A-Za-z0-9]{1,64}$/.test(songMid))return Promise.resolve({status:'unsupported'});
    const key=`${account.id}:${songMid}`,existing=this.pending.get(key);
    if(existing)return existing;
    const task=this.perform(account,session,songMid,signal).finally(()=>{if(this.pending.get(key)===task)this.pending.delete(key);});
    this.pending.set(key,task);
    return task;
  }

  private async perform(account:MusicAccount,session:MusicSession,songMid:string,signal:AbortSignal):Promise<QQFavoriteResult>{
    let writing=false,verifying=false;
    const check=()=>{
      if(signal.aborted)throw new QQFavoriteCancelled();
      if(!this.dependencies.accounts.getSnapshot().includes(account))throw new QQFavoriteAccountChanged();
    };
    const pause=(milliseconds:number)=>this.dependencies.wait?this.dependencies.wait(milliseconds):new Promise<void>(resolve=>{
      const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};
      const timer=setTimeout(finish,milliseconds);
      signal.addEventListener('abort',finish,{once:true});
    });
    try{
      check();
      let cookies:Readonly<Record<string,string>>,identity:ReturnType<typeof qqMusicIdentity>;
      try{
        if(account.platform!=='tx'||session.version!==1||session.platform!=='tx'||session.accountId!==account.id)throw new Error();
        cookies=parseQQCookiePayload(JSON.stringify(row(session.cookies)),'music');
        identity=qqMusicIdentity(cookies);
        if(session.userId!==identity.uin||account.username!==`qq:${identity.tmeLoginType}:${identity.uin}`)throw new Error();
      }catch{throw new QQFavoriteLoginRequired();}
      const headers={Cookie:cookieHeader(cookies),Referer:'https://y.qq.com/',Origin:'https://y.qq.com'};
      const read=async()=>{
        check();
        const result=row(await this.dependencies.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{
          method:'POST',credentials:'omit',headers:{...headers,'Content-Type':'application/json;charset=UTF-8'},
          body:JSON.stringify({comm:requestComm(identity.uin,identity.authst,identity.tmeLoginType),verify:{module:'music.musicasset.SongFavRead',method:'IsSongFanByMid',param:{v_songMid:[songMid]}}}),
        },signal));
        check();
        requireSuccess(result.code);requireSuccess(row(result.verify).code);
        const data=row(row(result.verify).data),value=row(data.m_fan)[songMid];
        if(value===true||value===1)return true;
        if(value===false||value===0)return false;
        throw new QQFavoriteUnavailable();
      };
      const detail=async()=>{
        check();
        const result=row(await this.dependencies.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{
          method:'POST',credentials:'omit',headers:{...headers,'Content-Type':'application/json;charset=UTF-8'},
          body:JSON.stringify({comm:requestComm(identity.uin,identity.authst,identity.tmeLoginType),detail:{module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_mid:songMid,song_type:0}}}),
        },signal));
        check();
        requireSuccess(result.code);requireSuccess(row(result.detail).code);
        const track=row(row(row(result.detail).data).track_info);
        if(text(track.mid)!==songMid||track.type!=null&&Number(track.type)!==0)throw new QQFavoriteUnsupported();
        const id=text(track.id);
        if(!/^[1-9]\d{0,15}$/.test(id)||!Number.isSafeInteger(Number(id)))throw new QQFavoriteUnsupported();
        return id;
      };
      if(await read())return {status:'already'};
      const songId=await detail();
      const webComm={
        uin:identity.uin,ct:24,cv:4747474,
        g_tk:csrfHash(csrfToken(cookies,identity.authst,'skey')),
        g_tk_new_20200303:csrfHash(csrfToken(cookies,identity.authst,'qqmusic_key')),
        format:'json',inCharset:'utf-8',outCharset:'utf-8',notice:0,platform:'yqq.json',needNewCode:1,
      };
      const body=JSON.stringify({comm:webComm,favorite:{module:'music.musicasset.PlaylistDetailWrite',method:'AddSonglist',param:{dirId:201,v_songInfo:[{songId,songType:0}]}}});
      const sign=await qqSignature(body,this.dependencies.sha1);check();
      writing=true;
      const result=row(await this.dependencies.http(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${encodeURIComponent(sign)}`,{
        method:'POST',credentials:'omit',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body,
      },signal));
      check();
      requireSuccess(result.code);requireSuccess(row(result.favorite).code);
      const data=row(row(result.favorite).data);
      if(data.retCode!=null)requireSuccess(data.retCode);
      verifying=true;
      // The write request is sent once. Only a read-back may report success.
      for(let attempt=0;attempt<2;attempt++){
        if(attempt)await pause(800);
        if(await read())return {status:'added'};
      }
      return {status:'unconfirmed'};
    }catch(error){
      if(error instanceof QQFavoriteCancelled||signal.aborted)return {status:'cancelled'};
      if(error instanceof QQFavoriteAccountChanged)return {status:'account_changed'};
      if(error instanceof QQFavoriteLoginRequired)return {status:'login_required'};
      if(error instanceof QQFavoriteUnsupported)return {status:'unsupported'};
      if(error instanceof QQFavoriteResponseError){
        if(verifying)return {status:'unknown',code:error.code};
        if(authCode(error.code))return {status:'login_required',code:error.code};
        return {status:writing?'rejected':'unavailable',code:error.code};
      }
      if(error instanceof HTTPResponseError&&(error.status===401||error.status===403))return {status:writing?'unknown':'login_required'};
      return {status:writing?'unknown':'unavailable'};
    }
  }
}
