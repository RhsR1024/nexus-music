import {AccountCatalogError,AccountCatalogRead,type AccountCatalogDeps,type AccountCatalogFailure} from './accountCatalogRead.ts';
import {cleanCatalogTarget,type CatalogTarget} from '../storage/catalogFavorites.ts';

// Read-only request contract: Binaryify/NeteaseCloudMusicApi, MIT; pinned mirror
// IcyBlue17/NeteaseCloudMusicApiVercel 32531f1, module/album_sublist.js.
// No remote subscription writes, local fallback, account persistence or player calls.
export type AccountAlbum=Readonly<CatalogTarget&{kind:'album';platform:'wy'}>;
export type AccountAlbumFailure=AccountCatalogFailure;
export class AccountAlbumError extends AccountCatalogError {
 constructor(kind:AccountAlbumFailure){super(kind,{login_required:'请重新登录网易云后读取收藏专辑',account_changed:'账号已更改，请重新读取收藏专辑',cancelled:'读取已取消',incomplete:'收藏专辑目录不完整或超过读取范围，请重试',unavailable:'暂时无法读取收藏专辑，请重试'}[kind]);}
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
export class AccountAlbums extends AccountCatalogRead<AccountAlbum> {
 constructor(deps:AccountCatalogDeps){super(deps,{endpoint:'https://music.163.com/weapi/album/sublist',parse:parseAccountAlbumPage,error:kind=>new AccountAlbumError(kind)});}
}
