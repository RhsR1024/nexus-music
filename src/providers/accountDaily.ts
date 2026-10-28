import type {HTTPClient} from './http.ts';
import {onlineTrack} from './online.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import type {Track} from '../domain/track.ts';
import {neteaseSessionAuth,neteaseWeapiRequest} from './neteaseSession.ts';

const DAILY_ENDPOINT='https://music.163.com/weapi/v3/discovery/recommend/songs';

export type DailyRecommendationKind='netease_daily'|'kugou_daily'|'tx_official_daily'|'tx_radar'|'local';
export type DailyRecommendationReason=''|'login_required'|'official_unavailable'|'unavailable';
export interface DailyRecommendation {
  readonly accountId:string;
  readonly platform:MusicAccount['platform'];
  readonly kind:DailyRecommendationKind;
  readonly reason:DailyRecommendationReason;
  readonly tracks:readonly Track[];
}

export class AccountDailyError extends Error {
  readonly kind:'login_required'|'unavailable'|'cancelled'|'account_changed';
  constructor(kind:'login_required'|'unavailable'|'cancelled'|'account_changed') {
    super(kind==='login_required'?'平台登录已失效，请重新登录':kind==='cancelled'?'每日推荐已取消':kind==='account_changed'?'平台账号已更改，请重试':'每日推荐暂时不可用');
    this.kind=kind;
  }
}

const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];

/** Converts only already-authorized NetEase daily rows into bounded tracks. */
export function parseNeteaseDaily(raw:unknown):readonly Track[] {
  const seen=new Set<string>(),tracks:Track[]=[];
  for(const value of list(row(row(raw).data).dailySongs)){
    try{const track=onlineTrack('wy',value);if(track.origin.kind!=='online'||seen.has(track.origin.id))continue;seen.add(track.origin.id);tracks.push(track);}
    catch{/* One malformed row must not hide valid account recommendations. */}
    if(tracks.length===30)break;
  }
  return tracks;
}

export interface AccountDailyClientOptions {
  readonly http?:HTTPClient;
  readonly endpoint?:string;
  readonly now?:()=>number;
  readonly day?:()=>string;
  readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  readonly kugou?:{validate:(account:MusicAccount,session:Readonly<Record<string,unknown>>)=>boolean;fetch:(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal)=>Promise<readonly Track[]>};
  readonly qq?:{validate:(account:MusicAccount,session:Readonly<Record<string,unknown>>)=>boolean;fetch:(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal)=>Promise<Pick<DailyRecommendation,'kind'|'reason'|'tracks'>>};
}

/** Account-scoped reader. Production binds the authoritative repository and
 * the authenticated web API; all requests stay inside the saved session. */
export class AccountDailyClient {
  private readonly http:HTTPClient;
  private readonly endpoint:string;
  private readonly now:()=>number;
  private readonly day:()=>string;
  private readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  private readonly kugou?:AccountDailyClientOptions['kugou'];
  private readonly qq?:AccountDailyClientOptions['qq'];
  private readonly cache=new Map<string,{expires:number;value:DailyRecommendation}>();
  private readonly generations=new Map<string,{request:number}>();
  constructor(options:AccountDailyClientOptions={}) {
    this.http=options.http??(async()=>{throw new AccountDailyError('unavailable');});
    this.endpoint=options.endpoint??DAILY_ENDPOINT;
    this.now=options.now??Date.now;
    this.day=options.day??(()=>new Date(this.now()).toLocaleDateString('en-CA'));
    this.accounts=options.accounts;
    this.kugou=options.kugou;
    this.qq=options.qq;
  }
  private key(account:MusicAccount,day:string){return JSON.stringify([account.id,account.platform,account.updatedAt,day]);}
  clear(accountId?:string){
    if(accountId===undefined){this.cache.clear();this.generations.clear();return;}
    this.generations.delete(accountId);
    for(const [key,entry] of this.cache)if(entry.value.accountId===accountId)this.cache.delete(key);
  }

  async fetch(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal,force=false):Promise<DailyRecommendation> {
    const snapshot={id:account.id,platform:account.platform,updatedAt:account.updatedAt};
    const auth=neteaseSessionAuth(session);
    const assertAccount=()=>{
      if(signal.aborted)throw new AccountDailyError('cancelled');
      if(account.id!==snapshot.id||account.platform!==snapshot.platform||account.updatedAt!==snapshot.updatedAt||
        this.accounts&&this.accounts.getSnapshot().find(item=>item.id===snapshot.id)!==account)throw new AccountDailyError('account_changed');
      if(account.platform==='tx'){
        if(!this.qq)throw new AccountDailyError('unavailable');
        if(!this.qq.validate(account,session))throw new AccountDailyError('login_required');
        return;
      }
      if(account.platform==='kg'){
        if(!this.kugou)throw new AccountDailyError('unavailable');
        if(!this.kugou.validate(account,session))throw new AccountDailyError('login_required');
        return;
      }
      if(session.accountId===undefined||session.platform===undefined)throw new AccountDailyError('login_required');
      if(session.accountId!==snapshot.id||session.platform!==snapshot.platform)throw new AccountDailyError('account_changed');
      if(!auth)throw new AccountDailyError('login_required');
      if(account.platform!=='wy')throw new AccountDailyError('unavailable');
    };
    // A cached list must never bypass the current account/session boundary.
    assertAccount();
    const day=this.day(),key=this.key(account,day),cached=this.cache.get(key);
    if(!force&&cached&&cached.expires>this.now())return cached.value;
    let generation=this.generations.get(snapshot.id);
    if(!generation){generation={request:0};this.generations.set(snapshot.id,generation);}
    const requestId=++generation.request;
    const assertCurrent=()=>{
      assertAccount();
      if(this.generations.get(snapshot.id)!==generation)throw new AccountDailyError('account_changed');
      if(generation.request!==requestId||this.day()!==day)throw new AccountDailyError('cancelled');
    };
    if(snapshot.platform==='tx'){
      let result:Pick<DailyRecommendation,'kind'|'reason'|'tracks'>;
      try{result=await this.qq!.fetch(account,session,signal);}catch(error){assertCurrent();throw error;}
      assertCurrent();
      const value:DailyRecommendation={accountId:snapshot.id,platform:snapshot.platform,...result};
      this.cache.set(key,{expires:this.now()+10*60_000,value});return value;
    }
    if(snapshot.platform==='kg'){
      let tracks:readonly Track[];
      try{tracks=await this.kugou!.fetch(account,session,signal);}catch(error){assertCurrent();throw error;}
      assertCurrent();
      const value:DailyRecommendation={accountId:snapshot.id,platform:snapshot.platform,kind:'kugou_daily',reason:'',tracks};
      this.cache.set(key,{expires:this.now()+10*60_000,value});return value;
    }
    const request=neteaseWeapiRequest({offset:0,total:true,limit:30},auth!);
    let raw:unknown;
    try{raw=await this.http(this.endpoint,request,signal);}
    catch(error){
      assertCurrent();
      const status=(error as {status?:unknown})?.status;
      throw new AccountDailyError(status===401||status===403?'login_required':'unavailable');
    }
    assertCurrent();
    const result=row(raw),data=row(result.data);
    if(result.code!==200)throw new AccountDailyError([301,401,403].includes(Number(result.code))?'login_required':'unavailable');
    if(!Array.isArray(data.dailySongs))throw new AccountDailyError('unavailable');
    const tracks=parseNeteaseDaily(raw);
    if(data.dailySongs.length&&!tracks.length)throw new AccountDailyError('unavailable');
    const value:DailyRecommendation={accountId:snapshot.id,platform:snapshot.platform,kind:'netease_daily',reason:'',tracks};
    this.cache.set(key,{expires:this.now()+10*60_000,value});return value;
  }
}

/** Local fallback is always marked so callers cannot display it as platform daily. */
export function localDaily(account:MusicAccount,tracks:readonly Track[],reason:DailyRecommendationReason='unavailable'):DailyRecommendation{
  return{accountId:account.id,platform:account.platform,kind:'local',reason,tracks};
}
