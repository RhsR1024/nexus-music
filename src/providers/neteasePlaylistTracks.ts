// NetEase playlist track writes follow Sollin-Music-Desktop c9d446f
// src/services/neteaseAuth.ts updatePlaylistTracks (MIT). NexusMusic adds
// strict account/owner binding, one write, read-back confirmation and
// operation-scoped cancellation instead of trusting the write response.
import type {AccountPlaylist} from './accountPlaylists.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import {neteaseSessionAuth,neteaseWeapiRequest,type NeteaseSessionAuth} from './neteaseSession.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const isIdentifier=(value:string)=>/^[1-9]\d{0,18}$/.test(value);
const isAuthCode=(value:number)=>[301,401,403].includes(value);

export type NeteasePlaylistTrackOperation='add'|'del';
export type NeteasePlaylistTrackStatus='added'|'already'|'removed'|'absent'|'unconfirmed'|'unknown'|'rejected'|'unsupported'|'unavailable'|'login_required'|'account_changed'|'cancelled';
export interface NeteasePlaylistTrackResult {readonly status:NeteasePlaylistTrackStatus;readonly code?:number}

class NeteasePlaylistTrackResponseError extends Error {
  readonly code:number;
  constructor(code:number){super('response code');this.code=code;}
}
class NeteasePlaylistTrackUnavailable extends Error {}
class NeteasePlaylistTrackLoginRequired extends Error {}
class NeteasePlaylistTrackAccountChanged extends Error {}
class NeteasePlaylistTrackCancelled extends Error {}
class NeteasePlaylistTrackMalformed extends Error {}

function requireOK(value:unknown){
  const code=typeof value==='number'?value:typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):NaN;
  if(!Number.isSafeInteger(code))throw new NeteasePlaylistTrackUnavailable();
  if(code!==200)throw new NeteasePlaylistTrackResponseError(code);
}
function membership(value:unknown){
  if(!Array.isArray(value)||value.length>10000)throw new NeteasePlaylistTrackMalformed();
  const ids:string[]=[];
  for(const item of value){
    const id=text(item)||text(row(item).id);
    if(!isIdentifier(id))throw new NeteasePlaylistTrackMalformed();
    ids.push(id);
  }
  return ids;
}

export class NeteasePlaylistTracksClient {
  private readonly dependencies:{
    http:HTTPClient;
    accounts:Pick<MusicAccounts,'getSnapshot'|'session'>;
    wait?:(milliseconds:number)=>Promise<void>;
    weapi?:typeof neteaseWeapiRequest;
  };
  private readonly pending=new Map<string,Promise<NeteasePlaylistTrackResult>>();
  constructor(dependencies:NeteasePlaylistTracksClient['dependencies']){this.dependencies=dependencies;}

  update(account:MusicAccount,playlist:AccountPlaylist,trackId:string,operation:NeteasePlaylistTrackOperation,signal:AbortSignal):Promise<NeteasePlaylistTrackResult>{
    if(!isIdentifier(trackId)||!isIdentifier(playlist.id)||playlist.kind!=='created')return Promise.resolve({status:'unsupported'});
    const key=`${account.id}:${playlist.id}:${trackId}:${operation}`,existing=this.pending.get(key);
    if(existing)return existing;
    const task=this.perform(account,playlist.id,trackId,operation,signal).finally(()=>{if(this.pending.get(key)===task)this.pending.delete(key);});
    this.pending.set(key,task);
    return task;
  }

  private async perform(account:MusicAccount,playlistId:string,trackId:string,operation:NeteasePlaylistTrackOperation,signal:AbortSignal):Promise<NeteasePlaylistTrackResult>{
    let writing=false,verifying=false;
    const check=()=>{
      if(signal.aborted)throw new NeteasePlaylistTrackCancelled();
      if(!this.dependencies.accounts.getSnapshot().includes(account))throw new NeteasePlaylistTrackAccountChanged();
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
    const read=async(auth:NeteaseSessionAuth,owner:string)=>{
      const response=await request('v6/playlist/detail',{id:playlistId,n:100000,s:0},auth);
      requireOK(response.code);
      const detail=row(response.playlist);
      if(text(detail.id)!==playlistId||text(row(detail.creator).userId)!==owner)throw new NeteasePlaylistTrackMalformed();
      const ids=membership(detail.trackIds),rawCount=detail.trackCount;
      if(rawCount!==undefined&&rawCount!==null){
        const count=typeof rawCount==='number'?rawCount:typeof rawCount==='string'&&/^\d+$/.test(rawCount)?Number(rawCount):NaN;
        if(!Number.isSafeInteger(count)||count!==ids.length)throw new NeteasePlaylistTrackMalformed();
      }
      return ids.includes(trackId);
    };
    try{
      check();
      let auth:NeteaseSessionAuth,owner:string;
      try{
        const session=await this.dependencies.accounts.session(account.id);check();
        if(account.platform!=='wy'||session.version!==1||session.platform!=='wy'||session.accountId!==account.id)throw new Error();
        owner=text(session.userId);
        if(!isIdentifier(owner)||account.username!==`netease:${owner}`)throw new Error();
        const sessionAuth=neteaseSessionAuth(session);
        if(!sessionAuth)throw new Error();
        auth=sessionAuth;
      }catch(error){
        if(error instanceof NeteasePlaylistTrackCancelled||error instanceof NeteasePlaylistTrackAccountChanged)throw error;
        throw new NeteasePlaylistTrackLoginRequired();
      }

      const present=await read(auth,owner);
      if(operation==='add'&&present)return {status:'already'};
      if(operation==='del'&&!present)return {status:'absent'};
      writing=true;
      const response=await request('playlist/manipulate/tracks',{op:operation,pid:playlistId,trackIds:JSON.stringify([trackId]),imme:'true'},auth);
      requireOK(response.code);
      verifying=true;
      for(let attempt=0;attempt<2;attempt++){
        if(attempt)await pause(800);
        const next=await read(auth,owner);
        if(operation==='add'&&next)return {status:'added'};
        if(operation==='del'&&!next)return {status:'removed'};
      }
      return {status:'unconfirmed'};
    }catch(error){
      if(error instanceof NeteasePlaylistTrackCancelled||signal.aborted)return writing?{status:'unconfirmed'}:{status:'cancelled'};
      if(error instanceof NeteasePlaylistTrackAccountChanged)return {status:'account_changed'};
      if(error instanceof NeteasePlaylistTrackLoginRequired)return {status:'login_required'};
      if(error instanceof NeteasePlaylistTrackResponseError){
        if(verifying)return {status:'unknown',code:error.code};
        if(isAuthCode(error.code))return {status:'login_required',code:error.code};
        return {status:writing?'rejected':'unavailable',code:error.code};
      }
      if(error instanceof HTTPResponseError&&(error.status===401||error.status===403))return {status:writing?'unknown':'login_required'};
      return {status:writing?'unknown':'unavailable'};
    }
  }
}
