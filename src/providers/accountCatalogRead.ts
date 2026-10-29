import {HTTPResponseError,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import {NeteaseAccountProfileError,type NeteaseAccountProfileClient} from './neteaseAccountProfile.ts';
import {neteaseSessionAuth,neteaseWeapiRequest} from './neteaseSession.ts';
export type AccountCatalogFailure='login_required'|'account_changed'|'cancelled'|'incomplete'|'unavailable';
export class AccountCatalogError extends Error {readonly kind:AccountCatalogFailure;constructor(kind:AccountCatalogFailure,message:string){super(message);this.kind=kind;}}
export interface AccountCatalogDeps {http:HTTPClient;accounts:Pick<MusicAccounts,'getSnapshot'|'session'>;profile:Pick<NeteaseAccountProfileClient,'fetch'>}
type Endpoint='https://music.163.com/weapi/album/sublist'|'https://music.163.com/weapi/cloudvideo/allvideo/sublist';
interface Options<T>{key?:(item:T)=>string;endpoint:Endpoint;parse:(value:unknown)=>{items:readonly T[];count:number;more:boolean};error:(kind:AccountCatalogFailure)=>AccountCatalogError}
// Shared original account lifecycle/completeness policy. Each adapter instance
// owns its operation and member maps; album and MV refreshes do not revoke each other.
export class AccountCatalogRead<T extends {id:string}> {
 private readonly operations=new Map<string,object>();
 private readonly catalogs=new WeakMap<MusicAccount,readonly T[]>();
 private readonly deps:AccountCatalogDeps;private readonly options:Options<T>;
 constructor(deps:AccountCatalogDeps,options:Options<T>){this.deps=deps;this.options=options;}
 assertMember(account:MusicAccount,item:T){if(!this.deps.accounts.getSnapshot().includes(account)||!this.catalogs.get(account)?.includes(item))throw this.options.error('account_changed');}
 async list(account:MusicAccount,signal:AbortSignal):Promise<readonly T[]>{
  const operation={};this.operations.set(account.id,operation);this.catalogs.delete(account);
  const check=()=>{if(signal.aborted)throw this.options.error('cancelled');if(!this.deps.accounts.getSnapshot().includes(account)||this.operations.get(account.id)!==operation)throw this.options.error('account_changed');};
  try{
   check();if(account.platform!=='wy')throw this.options.error('unavailable');
   const session=await this.deps.accounts.session(account.id);check();const auth=neteaseSessionAuth(session),owner=typeof session.userId==='string'?session.userId:typeof session.userId==='number'&&Number.isSafeInteger(session.userId)?String(session.userId):'';
   if(!auth||session.platform!=='wy'||session.accountId!==account.id||!/^[1-9]\d{0,19}$/.test(owner)||account.username!==`netease:${owner}`)throw this.options.error('login_required');
   const profile=await this.deps.profile.fetch(session,signal);check();if(profile.userId!==owner)throw this.options.error('login_required');
   const items:T[]=[],seen=new Set<string>();let offset=0,expected:number|undefined;
   for(let page=0;page<50;page++){
    const value=await this.deps.http(this.options.endpoint,{...neteaseWeapiRequest({limit:100,offset,total:true},auth),credentials:'omit'},signal);check();
    const result=this.options.parse(value);if(expected!==undefined&&result.count!==expected)throw this.options.error('incomplete');expected=result.count;
    for(const item of result.items){const key=this.options.key?.(item)??item.id;if(seen.has(key))throw this.options.error('incomplete');seen.add(key);items.push(item);}
    offset+=result.items.length;
    if(offset>expected||items.length>5000)throw this.options.error('incomplete');
    if(!result.more){if(offset!==expected)throw this.options.error('incomplete');const result=Object.freeze(items);check();this.catalogs.set(account,result);return result;}
    if(!result.items.length||offset>=expected)throw this.options.error('incomplete');
   }
   throw this.options.error('incomplete');
  }catch(error){check();if(error instanceof AccountCatalogError)throw error;if(error instanceof NeteaseAccountProfileError)throw this.options.error(error.kind);if(error instanceof HTTPResponseError&&[401,403].includes(error.status))throw this.options.error('login_required');throw this.options.error('unavailable');}
 }
}
