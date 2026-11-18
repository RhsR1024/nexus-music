// NetEase playlist deletion follows the pinned Sollin-Music-Desktop
// c9d446f deletePlaylist endpoint/body fact (MIT). NexusMusic adds strict
// account/owner binding, one write and catalog read-back confirmation.
import type {AccountPlaylist} from './accountPlaylists.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import {neteaseSessionAuth,neteaseWeapiRequest,type NeteaseSessionAuth} from './neteaseSession.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const isIdentifier=(value:string)=>/^[1-9]\d{0,18}$/.test(value);
const isAuthCode=(value:number)=>[301,401,403].includes(value);

export type NeteasePlaylistDeleteStatus='deleted'|'absent'|'unconfirmed'|'rejected'|'unsupported'|'unavailable'|'login_required'|'account_changed'|'cancelled';
export interface NeteasePlaylistDeleteResult {readonly status:NeteasePlaylistDeleteStatus;readonly code?:number}

class NeteasePlaylistDeleteResponseError extends Error {
  readonly code:number;
  constructor(code:number){super('response code');this.code=code;}
}
class NeteasePlaylistDeleteUnavailable extends Error {}
class NeteasePlaylistDeleteLoginRequired extends Error {}
class NeteasePlaylistDeleteAccountChanged extends Error {}
class NeteasePlaylistDeleteCancelled extends Error {}
class NeteasePlaylistDeleteMalformed extends Error {}

function requireOK(value:unknown){
  const code=typeof value==='number'?value:typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):NaN;
  if(!Number.isSafeInteger(code))throw new NeteasePlaylistDeleteUnavailable();
  if(code!==200)throw new NeteasePlaylistDeleteResponseError(code);
}
function more(value:unknown){
  if(value===true||value===1||value==='1')return true;
  if(value===false||value===0||value==='0')return false;
  throw new NeteasePlaylistDeleteMalformed();
}

export class NeteasePlaylistDeleteClient {
  private readonly dependencies:{
    http:HTTPClient;
    accounts:Pick<MusicAccounts,'getSnapshot'|'session'>;
    wait?:(milliseconds:number)=>Promise<void>;
    weapi?:typeof neteaseWeapiRequest;
  };
  private readonly pending=new Map<string,Promise<NeteasePlaylistDeleteResult>>();
  constructor(dependencies:NeteasePlaylistDeleteClient['dependencies']){this.dependencies=dependencies;}

  delete(account:MusicAccount,playlist:AccountPlaylist,signal:AbortSignal):Promise<NeteasePlaylistDeleteResult>{
    if(playlist.kind!=='created'||!isIdentifier(playlist.id))return Promise.resolve({status:'unsupported'});
    const key=`${account.id}:${playlist.id}`,existing=this.pending.get(key);
    if(existing)return existing;
    const task=this.perform(account,playlist.id,signal).finally(()=>{if(this.pending.get(key)===task)this.pending.delete(key);});
    this.pending.set(key,task);
    return task;
  }

  private async perform(account:MusicAccount,playlistId:string,signal:AbortSignal):Promise<NeteasePlaylistDeleteResult>{
    let writing=false,accepted=false;
    const check=()=>{
      if(signal.aborted)throw new NeteasePlaylistDeleteCancelled();
      if(!this.dependencies.accounts.getSnapshot().includes(account))throw new NeteasePlaylistDeleteAccountChanged();
    };
    const pause=(milliseconds:number)=>this.dependencies.wait?this.dependencies.wait(milliseconds):new Promise<void>(resolve=>{
      const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};
      const timer=setTimeout(finish,milliseconds);
      signal.addEventListener('abort',finish,{once:true});
    });
    const request=async(path:'playlist/remove'|'user/playlist',data:Record<string,unknown>,auth:NeteaseSessionAuth)=>{
      check();
      const raw=row(await this.dependencies.http(`https://music.163.com/weapi/${path}`,{
        ...(this.dependencies.weapi??neteaseWeapiRequest)(data,auth),credentials:'omit',
      },signal));
      check();
      return raw;
    };
    const read=async(auth:NeteaseSessionAuth,owner:string)=>{
      let offset=0;
      for(let page=0;page<20;page++){
        const catalog=await request('user/playlist',{uid:owner,offset,limit:100,includeVideo:false},auth);
        requireOK(catalog.code);
        if(!Array.isArray(catalog.playlist)||catalog.playlist.length>100)throw new NeteasePlaylistDeleteMalformed();
        for(const value of catalog.playlist){
          const item=row(value),id=text(item.id);
          if(!isIdentifier(id))throw new NeteasePlaylistDeleteMalformed();
          if(id!==playlistId)continue;
          if(text(row(item.creator).userId)!==owner)throw new NeteasePlaylistDeleteMalformed();
          return true;
        }
        offset+=catalog.playlist.length;
        if(!more(catalog.more))return false;
        if(!catalog.playlist.length)throw new NeteasePlaylistDeleteMalformed();
      }
      throw new NeteasePlaylistDeleteMalformed();
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
        if(error instanceof NeteasePlaylistDeleteCancelled||error instanceof NeteasePlaylistDeleteAccountChanged)throw error;
        throw new NeteasePlaylistDeleteLoginRequired();
      }

      if(!await read(auth,owner))return {status:'absent'};
      writing=true;
      const response=await request('playlist/remove',{ids:JSON.stringify([playlistId])},auth);
      requireOK(response.code);
      accepted=true;
      for(let attempt=0;attempt<2;attempt++){
        if(attempt)await pause(800);
        if(!await read(auth,owner))return {status:'deleted'};
      }
      return {status:'unconfirmed'};
    }catch(error){
      if(error instanceof NeteasePlaylistDeleteCancelled||signal.aborted)return writing?{status:'unconfirmed'}:{status:'cancelled'};
      if(error instanceof NeteasePlaylistDeleteAccountChanged)return writing?{status:'unconfirmed'}:{status:'account_changed'};
      if(error instanceof NeteasePlaylistDeleteLoginRequired)return {status:'login_required'};
      if(error instanceof NeteasePlaylistDeleteResponseError){
        if(isAuthCode(error.code))return accepted?{status:'unconfirmed'}:{status:'login_required',code:error.code};
        return {status:writing?'rejected':'unavailable',code:error.code};
      }
      if(error instanceof HTTPResponseError&&(error.status===401||error.status===403))return {status:accepted?'unconfirmed':'login_required'};
      return {status:writing?'unconfirmed':'unavailable'};
    }
  }
}
