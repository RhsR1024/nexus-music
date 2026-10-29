import type {HTTPClient} from './http.ts';
import {HTTPResponseError} from './http.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import {NeteaseAccountProfileError,type NeteaseAccountProfileClient} from './neteaseAccountProfile.ts';
import {neteaseSessionAuth,neteaseWeapiRequest} from './neteaseSession.ts';
import {cleanCatalogTarget,type CatalogTarget} from '../storage/catalogFavorites.ts';

// Read-only request contract: Binaryify/NeteaseCloudMusicApi, MIT; pinned mirror
// IcyBlue17/NeteaseCloudMusicApiVercel 32531f1, module/album_sublist.js.
// No remote subscription writes, local fallback, account persistence or player calls.
export type AccountAlbum=Readonly<CatalogTarget&{kind:'album';platform:'wy'}>;
export type AccountAlbumFailure='login_required'|'account_changed'|'cancelled'|'incomplete'|'unavailable';
export class AccountAlbumError extends Error {
 readonly kind:AccountAlbumFailure;
 constructor(kind:AccountAlbumFailure){super({login_required:'请重新登录网易云后读取收藏专辑',account_changed:'账号已更改，请重新读取收藏专辑',cancelled:'读取已取消',incomplete:'收藏专辑目录不完整或超过读取范围，请重试',unavailable:'暂时无法读取收藏专辑，请重试'}[kind]);this.kind=kind;}
}
const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const total=(value:unknown)=>{if(!Number.isSafeInteger(value)||Number(value)<0||Number(value)>5000)throw new AccountAlbumError('incomplete');return Number(value);};
export function parseAccountAlbumPage(value:unknown){
 const raw=row(value);if(raw.code!==200)throw new AccountAlbumError([301,401,403].includes(Number(raw.code))?'login_required':'unavailable');
 if(!Array.isArray(raw.data)||raw.data.length>100||typeof raw.hasMore!=='boolean')throw new AccountAlbumError('incomplete');
 const items=raw.data.map(value=>{
  const item=row(value),id=text(item.id);if(!/^[1-9]\d{0,19}$/.test(id))throw new AccountAlbumError('incomplete');
  if(typeof item.name!=='string')throw new AccountAlbumError('incomplete');
  const author=Array.isArray(item.artists)?item.artists.map(value=>text(row(value).name).trim()).filter(Boolean).join(' / '):undefined;
  try{return Object.freeze(cleanCatalogTarget({kind:'album',platform:'wy',id,title:item.name,...(typeof item.picUrl==='string'?{artwork:item.picUrl}:{}),...(author?{author}:{}),...(item.size!==undefined?{count:total(item.size)}:{})}) as AccountAlbum);}
  catch{throw new AccountAlbumError('incomplete');}
 });
 if(new Set(items.map(item=>item.id)).size!==items.length)throw new AccountAlbumError('incomplete');
 return {items,count:total(raw.count),more:raw.hasMore};
}
export class AccountAlbums {
 private readonly operations=new Map<string,object>();
 private readonly catalogs=new WeakMap<MusicAccount,readonly AccountAlbum[]>();
 private readonly deps:{http:HTTPClient;accounts:Pick<MusicAccounts,'getSnapshot'|'session'>;profile:Pick<NeteaseAccountProfileClient,'fetch'>};
 constructor(deps:AccountAlbums['deps']){this.deps=deps;}
 assertMember(account:MusicAccount,item:AccountAlbum){if(!this.deps.accounts.getSnapshot().includes(account)||!this.catalogs.get(account)?.includes(item))throw new AccountAlbumError('account_changed');}
 async list(account:MusicAccount,signal:AbortSignal):Promise<readonly AccountAlbum[]>{
  const operation={};this.operations.set(account.id,operation);this.catalogs.delete(account);
  const check=()=>{if(signal.aborted)throw new AccountAlbumError('cancelled');if(!this.deps.accounts.getSnapshot().includes(account)||this.operations.get(account.id)!==operation)throw new AccountAlbumError('account_changed');};
  try{
   check();if(account.platform!=='wy')throw new AccountAlbumError('unavailable');
   const session=await this.deps.accounts.session(account.id);check();const auth=neteaseSessionAuth(session),owner=text(session.userId);
   if(!auth||session.platform!=='wy'||session.accountId!==account.id||!/^[1-9]\d{0,19}$/.test(owner)||account.username!==`netease:${owner}`)throw new AccountAlbumError('login_required');
   const profile=await this.deps.profile.fetch(session,signal);check();if(profile.userId!==owner)throw new AccountAlbumError('login_required');
   const items:AccountAlbum[]=[],seen=new Set<string>();let offset=0,expected:number|undefined;
   for(let page=0;page<50;page++){
    const value=await this.deps.http('https://music.163.com/weapi/album/sublist',{...neteaseWeapiRequest({limit:100,offset,total:true},auth),credentials:'omit'},signal);check();
    const result=parseAccountAlbumPage(value);if(expected!==undefined&&result.count!==expected)throw new AccountAlbumError('incomplete');expected=result.count;
    for(const item of result.items){if(seen.has(item.id))throw new AccountAlbumError('incomplete');seen.add(item.id);items.push(item);}
    offset+=result.items.length;
    if(offset>expected||items.length>5000)throw new AccountAlbumError('incomplete');
    if(!result.more){if(offset!==expected)throw new AccountAlbumError('incomplete');const result=Object.freeze(items);check();this.catalogs.set(account,result);return result;}
    if(!result.items.length||offset>=expected)throw new AccountAlbumError('incomplete');
   }
   throw new AccountAlbumError('incomplete');
  }catch(error){check();if(error instanceof AccountAlbumError)throw error;if(error instanceof NeteaseAccountProfileError)throw new AccountAlbumError(error.kind);if(error instanceof HTTPResponseError&&[401,403].includes(error.status))throw new AccountAlbumError('login_required');throw new AccountAlbumError('unavailable');}
 }
}
