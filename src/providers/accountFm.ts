import type {HTTPClient} from './http.ts';
import {onlineTrack} from './online.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import type {Track} from '../domain/track.ts';
import {neteaseSessionAuth,neteaseWeapiRequest} from './neteaseSession.ts';

const FM_ENDPOINT='https://music.163.com/weapi/v1/radio/get';
const TRASH_ENDPOINT='https://music.163.com/weapi/radio/trash/add';

export type AccountFmErrorKind='login_required'|'unavailable'|'cancelled'|'account_changed';
export class AccountFmError extends Error {
  readonly kind:AccountFmErrorKind;
  constructor(kind:AccountFmErrorKind){
    super(kind==='login_required'?'平台登录已失效，请重新登录':kind==='cancelled'?'私人FM已取消':kind==='account_changed'?'平台账号已更改，请重试':'私人FM暂时不可用');
    this.kind=kind;
  }
}

const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

export function parseNeteaseFm(raw:unknown):readonly Track[] {
  const rows=row(raw).data,seen=new Set<string>(),tracks:Track[]=[];
  if(!Array.isArray(rows))return tracks;
  for(const value of rows){
    try{const track=onlineTrack('wy',value);if(track.origin.kind!=='online'||seen.has(track.origin.id))continue;seen.add(track.origin.id);tracks.push(track);}
    catch{/* One malformed station row must not hide the rest. */}
    if(tracks.length===30)break;
  }
  return tracks;
}

export interface AccountFmClientOptions {
  readonly http?:HTTPClient;
  readonly endpoint?:string;
  readonly trashEndpoint?:string;
  readonly now?:()=>number;
  readonly ttl?:number;
  readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
}

interface FmState {revision:number;queue:Track[];expires:number;request:number}

/** Session-scoped personal FM station. Loads bounded batches, keeps them per
 * account revision, and never publishes a response after account replacement. */
export class AccountFmClient {
  private readonly http:HTTPClient;
  private readonly endpoint:string;
  private readonly trashEndpoint:string;
  private readonly now:()=>number;
  private readonly ttl:number;
  private readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  private readonly states=new Map<string,FmState>();
  constructor(options:AccountFmClientOptions={}) {
    this.http=options.http??(async()=>{throw new AccountFmError('unavailable')});
    this.endpoint=options.endpoint??FM_ENDPOINT;
    this.trashEndpoint=options.trashEndpoint??TRASH_ENDPOINT;
    this.now=options.now??Date.now;
    this.ttl=options.ttl??30*60_000;
    this.accounts=options.accounts;
  }
  private state(account:MusicAccount):FmState {
    const current=this.states.get(account.id);
    if(current&&current.revision===account.updatedAt)return current;
    const next:FmState={revision:account.updatedAt,queue:[],expires:0,request:0};
    this.states.set(account.id,next);return next;
  }
  private guard(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal,snapshot?:{id:string;platform:MusicAccount['platform'];updatedAt:number}){
    if(signal.aborted)throw new AccountFmError('cancelled');
    if(snapshot&&(account.id!==snapshot.id||account.platform!==snapshot.platform||account.updatedAt!==snapshot.updatedAt))throw new AccountFmError('account_changed');
    if(this.accounts&&this.accounts.getSnapshot().find(item=>item.id===account.id)!==account)throw new AccountFmError('account_changed');
    if(session.accountId===undefined||session.platform===undefined)throw new AccountFmError('login_required');
    if(session.accountId!==account.id||session.platform!==account.platform)throw new AccountFmError('account_changed');
    const auth=neteaseSessionAuth(session);
    if(!auth)throw new AccountFmError('login_required');
    if(account.platform!=='wy')throw new AccountFmError('unavailable');
    return auth;
  }
  clear(accountId?:string){
    if(accountId===undefined)this.states.clear();
    else this.states.delete(accountId);
  }
  private async fill(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal,force:boolean):Promise<FmState> {
    const snapshot={id:account.id,platform:account.platform,updatedAt:account.updatedAt};
    const auth=this.guard(account,session,signal,snapshot),state=this.state(account);
    const assertCurrent=()=>{
      if(signal.aborted)throw new AccountFmError('cancelled');
      this.guard(account,session,signal,snapshot);
      if(this.states.get(account.id)!==state)throw new AccountFmError('account_changed');
    };
    if(!force&&state.expires>this.now())return state;
    const requestId=++state.request;
    const assertCurrentRequest=()=>{assertCurrent();if(state.request!==requestId)throw new AccountFmError('cancelled');};
    let raw:unknown;
    try{raw=await this.http(this.endpoint,neteaseWeapiRequest({},auth),signal);}
    catch(error){
      assertCurrentRequest();
      const status=(error as {status?:unknown})?.status;
      throw new AccountFmError(status===401||status===403?'login_required':'unavailable');
    }
    assertCurrentRequest();
    const result=row(raw);
    if(result.code!==200)throw new AccountFmError([301,401,403].includes(Number(result.code))?'login_required':'unavailable');
    if(!Array.isArray(result.data))throw new AccountFmError('unavailable');
    const tracks=parseNeteaseFm(raw);
    if(result.data.length&&!tracks.length)throw new AccountFmError('unavailable');
    state.queue=[...tracks];state.expires=this.now()+this.ttl;
    return state;
  }
  async load(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal,force=false):Promise<readonly Track[]> {
    const state=await this.fill(account,session,signal,force);
    return [...state.queue];
  }
  async preload(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal):Promise<number> {
    return(await this.fill(account,session,signal,false)).queue.length;
  }
  async next(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal):Promise<Track|null> {
    const state=await this.fill(account,session,signal,false);
    return state.queue.shift()??null;
  }
  async discard(account:MusicAccount,session:Readonly<Record<string,unknown>>,trackId:string,signal:AbortSignal):Promise<void> {
    const snapshot={id:account.id,platform:account.platform,updatedAt:account.updatedAt};
    const auth=this.guard(account,session,signal,snapshot),state=this.state(account),requestId=++state.request;
    const assertCurrent=()=>{
      this.guard(account,session,signal,snapshot);
      if(this.states.get(account.id)!==state)throw new AccountFmError('account_changed');
      if(state.request!==requestId)throw new AccountFmError('cancelled');
    };
    let raw:unknown;
    try{raw=await this.http(this.trashEndpoint,neteaseWeapiRequest({songId:trackId,alg:'RT',time:25},auth),signal);}
    catch(error){
      assertCurrent();
      const status=(error as {status?:unknown})?.status;
      throw new AccountFmError(status===401||status===403?'login_required':'unavailable');
    }
    assertCurrent();
    const result=row(raw);
    if(result.code!==200)throw new AccountFmError([301,401,403].includes(Number(result.code))?'login_required':'unavailable');
    state.queue=state.queue.filter(track=>track.origin.id!==trackId);
  }
}
