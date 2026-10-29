import {AccountCatalogError,AccountCatalogRead,type AccountCatalogDeps,type AccountCatalogFailure} from './accountCatalogRead.ts';
import {cleanCatalogTarget,type CatalogTarget} from '../storage/catalogFavorites.ts';
// Read-only request contract: Binaryify/NeteaseCloudMusicApi, MIT, pinned mirror
// 32531f1331fe9db7af8e7def33b4702e59275bfe module/mv_sublist.js.
export type AccountMV=Readonly<CatalogTarget&{kind:'mv';platform:'wy';contentKind:'mv'|'video';canOpen:boolean}>;
export class AccountMVError extends AccountCatalogError {constructor(kind:AccountCatalogFailure){super(kind,{login_required:'请重新登录网易云后读取收藏MV',account_changed:'账号已更改，请重新读取收藏MV',cancelled:'读取已取消',incomplete:'收藏MV目录不完整或超过读取范围，请重试',unavailable:'暂时无法读取收藏MV，请重试'}[kind]);}}
const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
export function parseAccountMVPage(value:unknown){
 const raw=row(value);if(raw.code!==200)throw new AccountMVError([301,401,403].includes(Number(raw.code))?'login_required':'unavailable');
 if(!Array.isArray(raw.data)||raw.data.length>100||typeof raw.hasMore!=='boolean'||!Number.isSafeInteger(raw.count)||Number(raw.count)<0||Number(raw.count)>5000)throw new AccountMVError('incomplete');
 const items=raw.data.map(value=>{
  const item=row(value),id=text(item.vid);if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||typeof item.title!=='string'||![0,1].includes(Number(item.type))||typeof item.type!=='number')throw new AccountMVError('incomplete');
  const contentKind=item.type===0?'mv' as const:'video' as const;
  if(contentKind==='mv'&&!/^[1-9]\d{0,19}$/.test(id))throw new AccountMVError('incomplete');
  const author=Array.isArray(item.creator)?item.creator.map(value=>text(row(value).userName).trim()).filter(Boolean).join(' / '):undefined;
  const milliseconds=item.durationms;
  if(milliseconds!==undefined&&(!Number.isFinite(milliseconds)||Number(milliseconds)<0||Number(milliseconds)>86400000))throw new AccountMVError('incomplete');
  try{const target=cleanCatalogTarget({kind:'mv',platform:'wy',id,title:item.title,...(typeof item.coverUrl==='string'?{artwork:item.coverUrl}:{}),...(author?{author}:{}),...(Number(milliseconds)>0?{durationSeconds:Number(milliseconds)/1000}:{})});return Object.freeze({...target,kind:'mv' as const,platform:'wy' as const,contentKind,canOpen:contentKind==='mv'});}
  catch{throw new AccountMVError('incomplete');}
 });
 if(new Set(items.map(item=>`${item.contentKind}:${item.id}`)).size!==items.length)throw new AccountMVError('incomplete');
 // Identity includes content type: a platform video and MV must not overwrite
 // one another if a service returns equal raw ids. The reader uses this key.
 return {items,count:Number(raw.count),more:raw.hasMore};
}
export class AccountMVs extends AccountCatalogRead<AccountMV> {
 constructor(deps:AccountCatalogDeps){super(deps,{key:item=>`${item.contentKind}:${item.id}`,endpoint:'https://music.163.com/weapi/cloudvideo/allvideo/sublist',parse:parseAccountMVPage,error:kind=>new AccountMVError(kind)});}
}
