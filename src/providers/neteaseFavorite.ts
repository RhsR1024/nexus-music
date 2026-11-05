// NetEase Cloud Music favorite wire semantics follow the public web API used by
// NeteaseCloudMusicApi module/song_like and module/song_like_check (fixed
// 984cc021) and were cross-checked against Sollin-Music-Desktop c9d446f
// neteaseAuth.ts (MIT). NexusMusic adds strict account binding, one write and
// read-back confirmation instead of trusting the write response.
import type {MusicAccount,MusicAccounts,MusicSession} from './musicAccounts.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import {neteaseSessionAuth,neteaseWeapiRequest,type NeteaseSessionAuth} from './neteaseSession.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const isAuthCode=(value:number)=>[301,401,403].includes(value);

export type NeteaseFavoriteStatus='added'|'already'|'unconfirmed'|'unknown'|'rejected'|'unsupported'|'unavailable'|'login_required'|'account_changed'|'cancelled';
export interface NeteaseFavoriteResult {readonly status:NeteaseFavoriteStatus;readonly code?:number}

class NeteaseFavoriteResponseError extends Error {
  readonly code:number;
  constructor(code:number){super('response code');this.code=code;}
}
class NeteaseFavoriteUnavailable extends Error {}
class NeteaseFavoriteLoginRequired extends Error {}
class NeteaseFavoriteAccountChanged extends Error {}
class NeteaseFavoriteCancelled extends Error {}

function requireOK(value:unknown){
  const code=typeof value==='number'?value:typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):NaN;
  if(!Number.isSafeInteger(code))throw new NeteaseFavoriteUnavailable();
  if(code!==200)throw new NeteaseFavoriteResponseError(code);
}

function boolean(value:unknown):boolean|undefined {
  if(value===true||value===1||value==='true'||value==='1')return true;
  if(value===false||value===0||value==='false'||value==='0')return false;
  return undefined;
}

function arrayFavorite(value:unknown,trackId:string):boolean|undefined {
  if(!Array.isArray(value))return undefined;
  let valid=false;
  for(const item of value){
    const id=text(item);
    if(/^[1-9]\d{0,18}$/.test(id))valid=true;
    if(id===trackId)return true;
  }
  return valid?false:undefined;
}

/** /api/song/like/check has appeared as a liked-id array and as an id map.
 * Only an explicit, well-formed answer may decide the local state. */
function favoriteFrom(raw:unknown,trackId:string):boolean {
  const response=row(raw),data=response.data;
  const map=(value:unknown):boolean|undefined=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
    const item=row(value),nested=item.liked;
    if(nested&&typeof nested==='object'&&!Array.isArray(nested)){
      const state=map(nested);if(state!==undefined)return state;
    }
    for(const key of [trackId,`s_${trackId}`]){
      if(!Object.prototype.hasOwnProperty.call(item,key))continue;
      const value=item[key],state=typeof value==='object'?boolean(row(value).liked):boolean(value);
      if(state!==undefined)return state;
    }
    return undefined;
  };
  const state=map(data)??arrayFavorite(data,trackId)??arrayFavorite(response.ids,trackId)??arrayFavorite(raw,trackId);
  if(state===undefined)throw new NeteaseFavoriteUnavailable();
  return state;
}

export class NeteaseFavoriteClient {
  private readonly dependencies:{
    http:HTTPClient;
    accounts:Pick<MusicAccounts,'getSnapshot'>;
    wait?:(milliseconds:number)=>Promise<void>;
    weapi?:typeof neteaseWeapiRequest;
  };
  private readonly pending=new Map<string,Promise<NeteaseFavoriteResult>>();
  constructor(dependencies:NeteaseFavoriteClient['dependencies']){this.dependencies=dependencies;}

  add(account:MusicAccount,session:MusicSession,trackId:string,signal:AbortSignal):Promise<NeteaseFavoriteResult>{
    if(!/^[1-9]\d{0,18}$/.test(trackId))return Promise.resolve({status:'unsupported'});
    const key=`${account.id}:${trackId}`,existing=this.pending.get(key);
    if(existing)return existing;
    const task=this.perform(account,session,trackId,signal).finally(()=>{if(this.pending.get(key)===task)this.pending.delete(key);});
    this.pending.set(key,task);
    return task;
  }

  private async perform(account:MusicAccount,session:MusicSession,trackId:string,signal:AbortSignal):Promise<NeteaseFavoriteResult>{
    let writing=false,verifying=false;
    const check=()=>{
      if(signal.aborted)throw new NeteaseFavoriteCancelled();
      if(!this.dependencies.accounts.getSnapshot().includes(account))throw new NeteaseFavoriteAccountChanged();
    };
    const pause=(milliseconds:number)=>this.dependencies.wait?this.dependencies.wait(milliseconds):new Promise<void>(resolve=>{
      const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};
      const timer=setTimeout(finish,milliseconds);
      signal.addEventListener('abort',finish,{once:true});
    });
    const request=async(path:string,data:Record<string,unknown>,auth:NeteaseSessionAuth)=>{
      check();
      const raw=row(await this.dependencies.http(`https://music.163.com/weapi/${path}`,{
        ...(this.dependencies.weapi??neteaseWeapiRequest)(data,auth),credentials:'omit',
      },signal));
      check();
      return raw;
    };
    try{
      check();
      let owner:string,sessionAuth:NeteaseSessionAuth;
      try{
        if(account.platform!=='wy'||session.version!==1||session.platform!=='wy'||session.accountId!==account.id)throw new Error();
        owner=text(session.userId);
        if(!/^[1-9]\d{0,18}$/.test(owner)||account.username!==`netease:${owner}`)throw new Error();
        const auth=neteaseSessionAuth(session);
        if(!auth)throw new Error();
        sessionAuth=auth;
      }catch{throw new NeteaseFavoriteLoginRequired();}
      const read=async()=>{
        const response=await request('song/like/check',{trackIds:JSON.stringify([trackId])},sessionAuth);
        requireOK(response.code);
        return favoriteFrom(response,trackId);
      };
      if(await read())return {status:'already'};
      writing=true;
      const response=await request('song/like',{trackId,userid:owner,like:true},sessionAuth);
      requireOK(response.code);
      verifying=true;
      // The write is sent once. Only a fresh read may report success.
      for(let attempt=0;attempt<2;attempt++){
        if(attempt)await pause(800);
        if(await read())return {status:'added'};
      }
      return {status:'unconfirmed'};
    }catch(error){
      if(error instanceof NeteaseFavoriteCancelled||signal.aborted)return {status:'cancelled'};
      if(error instanceof NeteaseFavoriteAccountChanged)return {status:'account_changed'};
      if(error instanceof NeteaseFavoriteLoginRequired)return {status:'login_required'};
      if(error instanceof NeteaseFavoriteResponseError){
        if(verifying)return {status:'unknown',code:error.code};
        if(isAuthCode(error.code))return {status:'login_required',code:error.code};
        return {status:writing?'rejected':'unavailable',code:error.code};
      }
      if(error instanceof HTTPResponseError&&(error.status===401||error.status===403))return {status:writing?'unknown':'login_required'};
      return {status:writing?'unknown':'unavailable'};
    }
  }
}
