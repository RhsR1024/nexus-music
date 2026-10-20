import type {HTTPClient, HTTPRequest} from './http.ts';
import {onlineTrack} from './online.ts';
import type {MusicAccount} from './musicAccounts.ts';
import type {Track} from '../domain/track.ts';
import {throwIfAborted} from './async.ts';

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
}

/**
 * Account-scoped, bounded daily recommendation reader. HTTP is injected so
 * login/session transport can be added without moving credentials into UI
 * state. The cache key includes the account revision; callers still hold the
 * authoritative account snapshot and may invalidate on removal.
 */
export class AccountDailyClient {
  private readonly http:HTTPClient;
  private readonly endpoint?:string;
  private readonly now:()=>number;
  private readonly day:()=>string;
  private readonly cache=new Map<string,{expires:number;value:DailyRecommendation}>();
  constructor(options:AccountDailyClientOptions={}) {
    this.http=options.http??(async()=>{throw new AccountDailyError('unavailable');});
    this.endpoint=options.endpoint;
    this.now=options.now??Date.now;
    this.day=options.day??(()=>new Date(this.now()).toLocaleDateString('en-CA'));
  }
  private key(account:MusicAccount,day:string){return JSON.stringify([account.id,account.platform,account.updatedAt,day]);}
  clear(accountId?:string){if(!accountId){this.cache.clear();return;}for(const key of this.cache.keys())if(key.includes(`"${accountId}"`))this.cache.delete(key);}

  async fetch(account:MusicAccount,session:Readonly<Record<string,unknown>>,signal:AbortSignal,force=false):Promise<DailyRecommendation> {
    try{throwIfAborted(signal);}catch{throw new AccountDailyError('cancelled');}
    if(account.platform!=='wy'||!account.capabilities.includes('daily'))throw new AccountDailyError('unavailable');
    const snapshot={id:account.id,platform:account.platform,updatedAt:account.updatedAt},day=this.day(),key=this.key(account,day),cached=this.cache.get(key);
    if(!force&&cached&&cached.expires>this.now()&&cached.value.accountId===snapshot.id&&cached.value.platform===snapshot.platform)return cached.value;
    let raw:unknown;
    if(!this.endpoint)throw new AccountDailyError('unavailable');
    const request:HTTPRequest={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offset:0,total:true,limit:30})};
    try{raw=await this.http(this.endpoint,request,signal);}
    catch(error){if(signal.aborted)throw new AccountDailyError('cancelled');const status=(error as {status?:unknown})?.status;if(status===401||status===403)throw new AccountDailyError('login_required');throw new AccountDailyError('unavailable');}
    try{throwIfAborted(signal);}catch{throw new AccountDailyError('cancelled');}
    if(account.id!==snapshot.id||account.platform!==snapshot.platform||account.updatedAt!==snapshot.updatedAt)throw new AccountDailyError('account_changed');
    if(session.accountId!==undefined&&session.accountId!==account.id)throw new AccountDailyError('account_changed');
    if(session.platform!==undefined&&session.platform!==account.platform)throw new AccountDailyError('account_changed');
    if(row(raw).code!==200&&!row(raw).data)throw new AccountDailyError('login_required');
    const tracks=parseNeteaseDaily(raw);
    if(!tracks.length)throw new AccountDailyError('unavailable');
    const value:DailyRecommendation={accountId:account.id,platform:account.platform,kind:'netease_daily',reason:'',tracks};
    this.cache.set(key,{expires:this.now()+10*60_000,value});return value;
  }
}

/** Local fallback is always marked so callers cannot display it as platform daily. */
export function localDaily(account:MusicAccount,tracks:readonly Track[],reason:DailyRecommendationReason='unavailable'):DailyRecommendation{
  return{accountId:account.id,platform:account.platform,kind:'local',reason,tracks};
}
