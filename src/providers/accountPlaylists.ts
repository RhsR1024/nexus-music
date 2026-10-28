import type {Track} from '../domain/track.ts';
import type {LibraryStore} from '../storage/library.ts';
import {cleanTrack,safePublicURL} from '../storage/cleanTrack.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicAccounts,MusicSession} from './musicAccounts.ts';
import {NeteaseAccountProfileError,type NeteaseAccountProfileClient} from './neteaseAccountProfile.ts';
import {neteaseSessionAuth,neteaseWeapiRequest,type NeteaseSessionAuth} from './neteaseSession.ts';
import {onlineTrack} from './online.ts';

// Protocol reference: Nshpiter/Q-music android 5db858f, playlists.ts (Apache-2.0).
// Independent account-bound reader; no remote writes or synchronization.
export interface AccountPlaylist {
  readonly id:string;readonly title:string;readonly count:number;
  readonly coverUrl:string;readonly kind:'created'|'favorite';
}
export interface AccountPlaylistPreview {
  readonly playlist:AccountPlaylist;readonly tracks:readonly Track[];
}
export type AccountPlaylistFailure='login_required'|'account_changed'|'cancelled'|'incomplete'|'unavailable';
export class AccountPlaylistError extends Error {
  readonly kind:AccountPlaylistFailure;
  constructor(kind:AccountPlaylistFailure){
    super(({login_required:'请重新登录网易云后读取歌单',account_changed:'账号已更改，请重新读取歌单',cancelled:'操作已取消',incomplete:'歌单数据不完整或超过本机导入范围，请重试',unavailable:'暂时无法读取或保存歌单，请重试'})[kind]);
    this.kind=kind;
  }
}
const row=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
const identifier=(v:unknown)=>{const s=text(v);if(!/^[1-9]\d{0,19}$/.test(s))throw new AccountPlaylistError('incomplete');return s;};
const count=(v:unknown)=>{const n=typeof v==='number'?v:/^\d+$/.test(text(v))?Number(v):NaN;if(!Number.isSafeInteger(n)||n<0||n>10000)throw new AccountPlaylistError('incomplete');return n;};
const more=(v:unknown)=>{if(v===true||v===1||v==='1')return true;if(v===false||v===0||v==='0')return false;throw new AccountPlaylistError('incomplete');};
const cover=(v:unknown)=>{try{const u=new URL(text(v).replace(/^\/\//,'https://'));return u.protocol==='https:'&&safePublicURL(u.href)?u.href:'';}catch{return '';}};

export class AccountPlaylists {
  private readonly operations=new Map<string,object>();
  private readonly catalogs=new WeakMap<MusicAccount,readonly AccountPlaylist[]>();
  private readonly previews=new WeakMap<AccountPlaylistPreview,{account:MusicAccount;operation:object}>();
  private readonly imports=new WeakSet<AccountPlaylistPreview>();
  private readonly deps:{http:HTTPClient;accounts:Pick<MusicAccounts,'getSnapshot'|'session'>;profile:Pick<NeteaseAccountProfileClient,'fetch'>;library:Pick<LibraryStore,'createPlaylist'>};
  constructor(deps:AccountPlaylists['deps']){this.deps=deps;}
  private begin(account:MusicAccount,signal:AbortSignal){
    const operation={};this.operations.set(account.id,operation);
    const check=()=>{
      if(signal.aborted)throw new AccountPlaylistError('cancelled');
      if(!this.deps.accounts.getSnapshot().includes(account)||this.operations.get(account.id)!==operation)throw new AccountPlaylistError('account_changed');
    };
    check();return {operation,check};
  }
  private async open(account:MusicAccount,signal:AbortSignal,check:()=>void){
    check();if(account.platform!=='wy')throw new AccountPlaylistError('unavailable');
    const session:MusicSession=await this.deps.accounts.session(account.id);check();
    const auth=neteaseSessionAuth(session),owner=text(session.userId);
    if(!/^[1-9]\d{0,19}$/.test(owner))throw new AccountPlaylistError('login_required');
    if(!auth||session.platform!=='wy'||session.accountId!==account.id||account.username!==`netease:${owner}`)throw new AccountPlaylistError('login_required');
    const profile=await this.deps.profile.fetch(session,signal);check();
    if(profile.userId!==owner)throw new AccountPlaylistError('login_required');
    return {auth,owner};
  }
  private async request(path:'user/playlist'|'v6/playlist/detail'|'v3/song/detail',data:Record<string,unknown>,auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void){
    check();const raw=row(await this.deps.http(`https://music.163.com/weapi/${path}`,{...neteaseWeapiRequest(data,auth),credentials:'omit'},signal));check();
    if(raw.code!==200)throw new AccountPlaylistError([301,401,403].includes(Number(raw.code))?'login_required':'unavailable');
    return raw;
  }
  private failure(error:unknown,check:()=>void):never{
    check();
    if(error instanceof AccountPlaylistError)throw error;
    if(error instanceof NeteaseAccountProfileError)throw new AccountPlaylistError(error.kind);
    if(error instanceof HTTPResponseError&&[401,403].includes(error.status))throw new AccountPlaylistError('login_required');
    throw new AccountPlaylistError('unavailable');
  }
  async list(account:MusicAccount,signal:AbortSignal):Promise<readonly AccountPlaylist[]>{
    const {check}=this.begin(account,signal);this.catalogs.delete(account);
    try{
      const {auth,owner}=await this.open(account,signal,check),items:AccountPlaylist[]=[];
      const seen=new Set<string>();let offset=0;
      for(let page=0;page<100;page++){
        const raw=await this.request('user/playlist',{uid:owner,offset,limit:100,includeVideo:false},auth,signal,check);
        if(!Array.isArray(raw.playlist)||raw.playlist.length>100)throw new AccountPlaylistError('incomplete');
        let added=0;
        for(const value of raw.playlist){
          const item=row(value),id=identifier(item.id),title=text(item.name).trim();
          if(!title||title.length>200||/[\u0000-\u001f\u007f]/.test(title))throw new AccountPlaylistError('incomplete');
          const entry=Object.freeze({id,title,count:count(item.trackCount),coverUrl:cover(item.coverImgUrl),kind:identifier(row(item.creator).userId)===owner?'created' as const:'favorite' as const});
          if(seen.has(id))continue;seen.add(id);items.push(entry);added++;
        }
        offset+=raw.playlist.length;
        if(!more(raw.more)){const result=Object.freeze(items);check();this.catalogs.set(account,result);return result;}
        if(!added)throw new AccountPlaylistError('incomplete');
      }
      throw new AccountPlaylistError('incomplete');
    }catch(error){return this.failure(error,check);}
  }
  async preview(account:MusicAccount,playlist:AccountPlaylist,signal:AbortSignal):Promise<AccountPlaylistPreview>{
    const {operation,check}=this.begin(account,signal);
    try{
      if(!this.catalogs.get(account)?.includes(playlist))throw new AccountPlaylistError('account_changed');
      const {auth}=await this.open(account,signal,check);
      const detail=row((await this.request('v6/playlist/detail',{id:playlist.id,n:100000,s:0},auth,signal,check)).playlist);
      if(identifier(detail.id)!==playlist.id||!Array.isArray(detail.trackIds))throw new AccountPlaylistError('incomplete');
      const ids=detail.trackIds.map(v=>identifier(row(v).id));
      if(ids.length!==count(detail.trackCount)||new Set(ids).size!==ids.length)throw new AccountPlaylistError('incomplete');
      const tracks:Track[]=[];
      for(let offset=0;offset<ids.length;offset+=200){
        const batch=ids.slice(offset,offset+200),raw=await this.request('v3/song/detail',{c:JSON.stringify(batch.map(id=>({id})))},auth,signal,check);
        if(!Array.isArray(raw.songs)||!Array.isArray(raw.privileges))throw new AccountPlaylistError('incomplete');
        const songs=new Map<string,unknown>(),permissions=new Set<string>();
        for(const value of raw.songs){const id=identifier(row(value).id);if(songs.has(id))throw new AccountPlaylistError('incomplete');songs.set(id,value);}
        for(const value of raw.privileges){const id=identifier(row(value).id);if(permissions.has(id))throw new AccountPlaylistError('incomplete');permissions.add(id);}
        for(const id of batch){
          if(!songs.has(id)||!permissions.has(id))throw new AccountPlaylistError('incomplete');
          try{tracks.push(cleanTrack(onlineTrack('wy',songs.get(id))));}catch{throw new AccountPlaylistError('incomplete');}
        }
      }
      check();const result=Object.freeze({playlist,tracks:Object.freeze(tracks)});this.previews.set(result,{account,operation});return result;
    }catch(error){return this.failure(error,check);}
  }
  async importPreview(account:MusicAccount,preview:AccountPlaylistPreview,signal:AbortSignal):Promise<string>{
    if(this.imports.has(preview))throw new AccountPlaylistError('unavailable');
    const saved=this.previews.get(preview);
    const check=()=>{
      if(signal.aborted)throw new AccountPlaylistError('cancelled');
      if(!saved||saved.account!==account||!this.deps.accounts.getSnapshot().includes(account)||this.operations.get(account.id)!==saved.operation||!this.catalogs.get(account)?.includes(preview.playlist))throw new AccountPlaylistError('account_changed');
    };
    this.imports.add(preview);
    try{
      check();const valid=()=>{try{check();return true;}catch{return false;}};
      const id=await this.deps.library.createPlaylist(preview.playlist.title,preview.tracks,{...(preview.playlist.coverUrl?{coverUrl:preview.playlist.coverUrl}:{})},valid);
      // The guarded library commit is the linearization point. Cancellation
      // after it must not turn an already completed copy into a false failure.
      this.previews.delete(preview);return id;
    }catch(error){return this.failure(error,check);}
    finally{this.imports.delete(preview);}
  }
}
