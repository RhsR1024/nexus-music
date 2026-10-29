import type {OnlinePlatform} from '../domain/track.ts';
import {safePublicURL} from './cleanTrack.ts';

export type CatalogKind='playlist'|'album'|'mv';
export interface CatalogTarget {kind:CatalogKind;platform:OnlinePlatform;id:string;title:string;artwork?:string;author?:string;description?:string;released?:string;count?:number;durationSeconds?:number}
export interface CatalogFavorite extends CatalogTarget {savedId:string;savedAt:number}
export const catalogKey=(item:Pick<CatalogTarget,'kind'|'platform'|'id'>)=>`${item.kind}:${item.platform}:${item.id}`;
const text=(value:unknown,max:number,multiline=false)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!(multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(value);
export function cleanCatalogTarget(input:unknown):CatalogTarget {
  if(!input||typeof input!=='object')throw Error('目录收藏格式无效');const value=input as CatalogTarget;
  if(!['playlist','album','mv'].includes(value.kind)||!['wy','tx','kw','kg','mg'].includes(value.platform)||typeof value.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.id)||!text(value.title,1000))throw Error('目录收藏身份或名称无效');
  const result:CatalogTarget={kind:value.kind,platform:value.platform,id:value.id,title:value.title.trim()};
  for(const [key,max,multiline] of [['author',1000,false],['description',20000,true],['released',100,false]] as const){if(value[key]!==undefined){if(!text(value[key],max,multiline))throw Error('目录收藏资料无效');result[key]=value[key]!.trim();}}
  if(value.count!==undefined){if(!Number.isSafeInteger(value.count)||value.count<0)throw Error('目录收藏数量无效');result.count=value.count;}
  if(value.durationSeconds!==undefined){if(!Number.isFinite(value.durationSeconds)||value.durationSeconds<=0||value.durationSeconds>86400)throw Error('MV时长无效');result.durationSeconds=value.durationSeconds;}
  if(value.artwork!==undefined){
    if(typeof value.artwork!=='string'||value.artwork.length>2048)throw Error('目录封面格式无效');
    try{const url=new URL(value.artwork);if(safePublicURL(value.artwork)&&['http:','https:'].includes(url.protocol)&&!url.port&&!/^(?:\d+\.|\[)/.test(url.hostname)&&url.hostname.includes('.')&&!/\.(?:local|localhost)$/i.test(url.hostname)){url.protocol='https:';result.artwork=url.toString();}}catch{}
  }
  return result;
}
export function cleanCatalogFavorite(input:unknown):CatalogFavorite {
  const target=cleanCatalogTarget(input),value=input as CatalogFavorite;
  if(typeof value.savedId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.savedId)||!Number.isSafeInteger(value.savedAt)||value.savedAt<0)throw Error('目录收藏保存记录无效');
  return{...target,savedId:value.savedId,savedAt:value.savedAt};
}
