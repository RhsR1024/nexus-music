import type {AccountPlaylist} from './accountPlaylists.ts';
import {safePublicURL} from '../storage/cleanTrack.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import {neteaseSessionAuth,neteaseWeapiRequest,type NeteaseSessionAuth} from './neteaseSession.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const isIdentifier=(value:string)=>/^[1-9]\d{0,18}$/.test(value);
const isAuthCode=(value:number)=>[301,401,403].includes(value);

export type NeteasePlaylistCreateStatus='created'|'unconfirmed'|'rejected'|'unsupported'|'unavailable'|'login_required'|'account_changed'|'cancelled';
export interface NeteasePlaylistCreateResult {
  readonly status:NeteasePlaylistCreateStatus;
  readonly playlist?:AccountPlaylist;
  readonly id?:string;
  readonly code?:number;
}

class NeteasePlaylistResponseError extends Error {
  readonly code:number;
  constructor(code:number){super('response code');this.code=code;}
}
class NeteasePlaylistUnavailable extends Error {}
class NeteasePlaylistLoginRequired extends Error {}
class NeteasePlaylistAccountChanged extends Error {}
class NeteasePlaylistCancelled extends Error {}
class NeteasePlaylistMalformed extends Error {}

function requireOK(value:unknown){
  const code=typeof value==='number'?value:typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):NaN;
  if(!Number.isSafeInteger(code))throw new NeteasePlaylistUnavailable();
  if(code!==200)throw new NeteasePlaylistResponseError(code);
}
function normalizeName(value:string){
  const name=value.trim(),length=Array.from(name).length;
  if(length<1||length>40||/[\u0000-\u001f\u007f]/.test(name))return undefined;
  return name;
}
function count(value:unknown){
  const result=typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):NaN;
  if(!Number.isSafeInteger(result)||result<0||result>10000)throw new NeteasePlaylistMalformed();
  return result;
}
function cover(value:unknown){
  const raw=text(value).trim();if(!raw)return '';
  try{
    const url=new URL(raw.replace(/^\/\//,'https://'));
    if(url.protocol!=='https:'||!safePublicURL(url.href))return '';
    return url.href;
  }catch{return '';}
}
function more(value:unknown){
  if(value===true||value===1||value==='1')return true;
  if(value===false||value===0||value==='0')return false;
  throw new NeteasePlaylistMalformed();
}

export class NeteasePlaylistCreateClient {
  private readonly dependencies:{
    http:HTTPClient;
    accounts:Pick<MusicAccounts,'getSnapshot'|'session'>;
    weapi?:typeof neteaseWeapiRequest;
  };
  private readonly pending=new Map<string,Promise<NeteasePlaylistCreateResult>>();
  constructor(dependencies:NeteasePlaylistCreateClient['dependencies']){this.dependencies=dependencies;}

  create(account:MusicAccount,name:string,privacy:0|10,signal:AbortSignal):Promise<NeteasePlaylistCreateResult>{
    const normalized=normalizeName(name);
    if(!normalized||![0,10].includes(privacy))return Promise.resolve({status:'unsupported'});
    const key=`${account.id}:${privacy}:${normalized}`,existing=this.pending.get(key);
    if(existing)return existing;
    const task=this.perform(account,normalized,privacy,signal).finally(()=>{if(this.pending.get(key)===task)this.pending.delete(key);});
    this.pending.set(key,task);
    return task;
  }

  private async perform(account:MusicAccount,name:string,privacy:0|10,signal:AbortSignal):Promise<NeteasePlaylistCreateResult>{
    let writing=false,createdId:string|undefined;
    const check=()=>{
      if(signal.aborted)throw new NeteasePlaylistCancelled();
      if(!this.dependencies.accounts.getSnapshot().includes(account))throw new NeteasePlaylistAccountChanged();
    };
    const request=async(path:'playlist/create'|'user/playlist',data:Record<string,unknown>,auth:NeteaseSessionAuth)=>{
      check();
      const raw=row(await this.dependencies.http(`https://music.163.com/weapi/${path}`,{
        ...(this.dependencies.weapi??neteaseWeapiRequest)(data,auth),credentials:'omit',
      },signal));
      check();
      return raw;
    };
    const failure=(id?:string)=>{
      if(id)return {status:'unconfirmed' as const,id};
      return {status:'unconfirmed' as const};
    };
    try{
      check();
      let owner:string,auth:NeteaseSessionAuth;
      try{
        const session=await this.dependencies.accounts.session(account.id);check();
        if(account.platform!=='wy'||session.version!==1||session.platform!=='wy'||session.accountId!==account.id)throw new Error();
        owner=text(session.userId);
        if(!isIdentifier(owner)||account.username!==`netease:${owner}`)throw new Error();
        const sessionAuth=neteaseSessionAuth(session);
        if(!sessionAuth)throw new Error();
        auth=sessionAuth;
      }catch(error){
        if(error instanceof NeteasePlaylistCancelled||error instanceof NeteasePlaylistAccountChanged)throw error;
        throw new NeteasePlaylistLoginRequired();
      }

      writing=true;
      const response=await request('playlist/create',{name,privacy:String(privacy),type:'NORMAL'},auth);
      requireOK(response.code);
      const playlist=row(response.playlist),identifier=text(playlist.id);
      if(!isIdentifier(identifier))return failure();
      createdId=identifier;
      if(text(playlist.name).trim()!==name)return failure(identifier);

      try{
        let offset=0;
        for(let page=0;page<20;page++){
          const catalog=await request('user/playlist',{uid:owner,offset,limit:100,includeVideo:false},auth);
          requireOK(catalog.code);
          if(!Array.isArray(catalog.playlist)||catalog.playlist.length>100)throw new NeteasePlaylistMalformed();
          for(const value of catalog.playlist){
            const item=row(value),id=text(item.id);
            if(!isIdentifier(id))throw new NeteasePlaylistMalformed();
            if(id!==identifier)continue;
            if(text(item.name).trim()!==name)return failure(identifier);
            if(text(row(item.creator).userId)!==owner)return failure(identifier);
            const observedPrivacy=text(item.privacy);
            if(observedPrivacy&&observedPrivacy!==String(privacy))return failure(identifier);
            const entry:AccountPlaylist=Object.freeze({id,title:name,count:count(item.trackCount),coverUrl:cover(item.coverImgUrl),kind:'created' as const});
            check();
            return {status:'created',playlist:entry};
          }
          offset+=catalog.playlist.length;
          if(!more(catalog.more))return failure(identifier);
          if(!catalog.playlist.length)return failure(identifier);
        }
        return failure(identifier);
      }catch(error){
        if(error instanceof NeteasePlaylistCancelled||error instanceof NeteasePlaylistAccountChanged)throw error;
        return failure(identifier);
      }
    }catch(error){
      if(error instanceof NeteasePlaylistCancelled||signal.aborted)return writing?failure(createdId):{status:'cancelled'};
      if(error instanceof NeteasePlaylistAccountChanged)return {status:'account_changed',...(createdId?{id:createdId}:{})};
      if(error instanceof NeteasePlaylistLoginRequired)return {status:'login_required'};
      if(error instanceof NeteasePlaylistResponseError){
        if(isAuthCode(error.code))return {status:'login_required',code:error.code};
        return {status:writing?'rejected':'unavailable',code:error.code};
      }
      if(error instanceof HTTPResponseError&&(error.status===401||error.status===403))return writing?failure(createdId):{status:'login_required'};
      return writing?failure(createdId):{status:'unavailable'};
    }
  }
}
