import {emptyLibrary,validateLibrary,type LibraryState,type LocalPlaylist,type TrackMatch,type LyricChoice} from './library.ts';
import {cleanTrack} from './cleanTrack.ts';
import {trackKey,validateTrack,type Track} from '../domain/track.ts';

export type SyncKind='favorite'|'playlist'|'match'|'lyricChoice';
export interface SyncRecord {id:string;kind:SyncKind;deleted:boolean;payload?:unknown}
export interface SyncState {format:'nexus-music-sync';version:1;accountId:string;directory:string;deviceId:string;revision:number;records:readonly SyncRecord[]}
export interface SyncConflict {id:string;kind:SyncKind;local?:SyncRecord;remote?:SyncRecord}
export interface SyncPlan {local:SyncState;remote?:SyncState;records:readonly SyncRecord[];conflicts:readonly SyncConflict[]}
export type SyncChoices=Readonly<Record<string,'local'|'remote'>>;
export class SyncError extends Error {
  readonly kind:'account'|'format'|'conflict'|'network'|'cancelled'|'localChanged'|'choices'|'busy'|'capacity';
  constructor(kind:SyncError['kind']){
    super({account:'同步连接或目录已改变，请重新预览',format:'同步数据格式或强版本信息无效',conflict:'云端版本已改变，请重新预览并核对冲突',network:'同步连接失败，请检查服务端配置',cancelled:'同步已取消',localChanged:'本机音乐库已改变，请重新预览',choices:'请为每项冲突选择本机或云端版本',busy:'当前同步操作尚未结束',capacity:'同步数据超过容量限制，请保留原库并检查数据'}[kind]);this.kind=kind;
  }
}
const kinds:readonly SyncKind[]=['favorite','playlist','match','lyricChoice'];
const maxRecords=20000,maxEntries=100000;
export const syncLimit=32*1024*1024;
export function canonical(value:unknown):string {
  if(value===undefined)return 'undefined';
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string,unknown>).filter(key=>(value as Record<string,unknown>)[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;
}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
const identifier=(kind:SyncKind,value:string)=>`${kind}:${value}`;
const order=(a:{id:string},b:{id:string})=>a.id<b.id?-1:a.id>b.id?1:0;
function cleanRecord(input:SyncRecord):SyncRecord {
  if(!input||typeof input.id!=='string'||input.id.length>8192||!kinds.includes(input.kind)||typeof input.deleted!=='boolean'||!input.id.startsWith(input.kind+':')||input.id.length<=input.kind.length+1)throw new SyncError('format');
  if(input.deleted){if(input.payload!==undefined)throw new SyncError('format');return{id:input.id,kind:input.kind,deleted:true};}
  let payload:unknown,id:string;
  try{
    switch(input.kind){
      case 'favorite':{const value=input.payload as Track;validateTrack(value);payload=cleanTrack(value);id=trackKey(value.origin);break;}
      case 'playlist':{
        const value=input.payload as LocalPlaylist;validateLibrary({...emptyLibrary,playlists:[value]});
        if(value.title.length>4096||value.id.length>4096||value.entries.length>maxEntries||value.entries.some(entry=>entry.id.length>4096))throw new SyncError('capacity');
        payload={id:value.id,title:value.title,createdAt:value.createdAt,updatedAt:value.updatedAt,entries:value.entries.map(entry=>({id:entry.id,track:cleanTrack(entry.track)}))};id=value.id;break;
      }
      case 'match':{const value=input.payload as TrackMatch;validateLibrary({...emptyLibrary,matches:[value]});payload={original:cleanTrack(value.original),target:cleanTrack(value.target),method:value.method,updatedAt:value.updatedAt};id=trackKey(value.original.origin);break;}
      case 'lyricChoice':{const value=input.payload as LyricChoice;validateLibrary({...emptyLibrary,lyricChoices:[value]});payload={original:cleanTrack(value.original),mode:value.mode,...(value.target?{target:cleanTrack(value.target)}:{}),updatedAt:value.updatedAt};id=trackKey(value.original.origin);break;}
    }
  }catch(error){if(error instanceof SyncError)throw error;throw new SyncError('format');}
  if(identifier(input.kind,id)!==input.id)throw new SyncError('format');
  return{id:input.id,kind:input.kind,deleted:false,payload};
}
export function validateSyncState(input:unknown):SyncState {
  if(!input||typeof input!=='object')throw new SyncError('format');const value=input as SyncState;
  if(value.format!=='nexus-music-sync'||value.version!==1||typeof value.accountId!=='string'||!/^[a-f\d]{64}$/.test(value.accountId)||typeof value.directory!=='string'||!value.directory||value.directory.length>4096||typeof value.deviceId!=='string'||!/^[a-f\d-]{16,64}$/i.test(value.deviceId)||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.records))throw new SyncError('format');
  if(value.records.length>maxRecords)throw new SyncError('capacity');
  const records=value.records.map(cleanRecord),ids=new Set<string>();let entries=0;
  for(const item of records){if(ids.has(item.id))throw new SyncError('format');ids.add(item.id);if(item.kind==='playlist'&&!item.deleted)entries+=(item.payload as LocalPlaylist).entries.length;}
  if(entries>maxEntries)throw new SyncError('capacity');
  if(records.filter(item=>item.kind==='lyricChoice'&&!item.deleted).length>1000)throw new SyncError('capacity');
  return clone({format:'nexus-music-sync',version:1,accountId:value.accountId,directory:value.directory,deviceId:value.deviceId,revision:value.revision,records:records.sort(order)} satisfies SyncState);
}
function utf8Length(text:string):number {
  let bytes=0;for(let i=0;i<text.length;i++){const value=text.charCodeAt(i);if(value<128)bytes++;else if(value<2048)bytes+=2;else if(value>=0xd800&&value<=0xdbff&&i+1<text.length&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}else bytes+=3;if(bytes>syncLimit)return bytes;}return bytes;
}
export function encodeSync(state:SyncState):string {
  const text=JSON.stringify(validateSyncState(state));if(text.length>syncLimit||utf8Length(text)>syncLimit)throw new SyncError('capacity');return text;
}
export function decodeSync(text:string):SyncState {
  if(text.length>syncLimit||utf8Length(text)>syncLimit)throw new SyncError('capacity');
  try{return validateSyncState(JSON.parse(text));}catch(error){if(error instanceof SyncError)throw error;throw new SyncError('format');}
}
export function syncRecords(library:LibraryState):SyncRecord[]{
  validateLibrary(library);
  return [
    ...library.favorites.map(value=>({id:identifier('favorite',trackKey(value.origin)),kind:'favorite' as const,deleted:false,payload:value})),
    ...library.playlists.map(value=>({id:identifier('playlist',value.id),kind:'playlist' as const,deleted:false,payload:value})),
    ...(library.matches??[]).map(value=>({id:identifier('match',trackKey(value.original.origin)),kind:'match' as const,deleted:false,payload:value})),
    ...(library.lyricChoices??[]).map(value=>({id:identifier('lyricChoice',trackKey(value.original.origin)),kind:'lyricChoice' as const,deleted:false,payload:value})),
  ].map(cleanRecord).sort(order);
}
export function buildSyncState(library:LibraryState,deviceId:string,accountId:string,directory:string,previous?:SyncState):SyncState {
  const base=previous?validateSyncState(previous):undefined;
  if(base&&(base.accountId!==accountId||base.directory!==directory))throw new SyncError('account');
  const records=syncRecords(library),seen=new Set(records.map(item=>item.id));
  // Keep tombstones until an explicit future compaction protocol can prove that
  // all devices acknowledged them. A record-count limit fails safely instead.
  for(const old of base?.records??[])if(!seen.has(old.id))records.push({id:old.id,kind:old.kind,deleted:true});
  return validateSyncState({format:'nexus-music-sync',version:1,accountId,directory,deviceId,revision:base?.revision??0,records});
}
export function planSync(local:SyncState,remote?:SyncState,baseline?:SyncState):SyncPlan {
  local=validateSyncState(local);remote=remote?validateSyncState(remote):undefined;baseline=baseline?validateSyncState(baseline):undefined;
  for(const state of [remote,baseline])if(state&&(state.accountId!==local.accountId||state.directory!==local.directory))throw new SyncError('account');
  // A missing or older server after a confirmed baseline may be a restore or
  // deletion. Do not overwrite it as though this were a first connection.
  if(baseline&&(!remote||remote.revision<baseline.revision))throw new SyncError('conflict');
  const toMap=(state?:SyncState)=>new Map(state?.records.map(item=>[item.id,item]));
  const l=toMap(local),r=toMap(remote),b=toMap(baseline),records:SyncRecord[]=[],conflicts:SyncConflict[]=[];
  // No compaction protocol exists yet. A server dropping acknowledged records
  // (including tombstones) is not a safe deletion and needs reconciliation.
  if([...b.keys()].some(id=>!r.has(id)))throw new SyncError('conflict');
  for(const id of [...new Set([...l.keys(),...r.keys(),...b.keys()])].sort()){
    const left=l.get(id),right=r.get(id),base=b.get(id);let selected:SyncRecord|undefined;
    if(canonical(left)===canonical(right))selected=left;
    else if(canonical(left)===canonical(base))selected=right;
    else if(canonical(right)===canonical(base))selected=left;
    else{conflicts.push({id,kind:(left??right??base)!.kind,...(left?{local:left}:{}),...(right?{remote:right}:{})});continue;}
    if(selected)records.push(selected);
  }
  return clone({local,...(remote?{remote}:{}),records,conflicts});
}
export function resolveSync(plan:SyncPlan,choices:SyncChoices={}):SyncState {
  const records=[...plan.records];
  for(const conflict of plan.conflicts){
    if(!Object.hasOwn(choices,conflict.id)||!['local','remote'].includes(choices[conflict.id]!))throw new SyncError('choices');
    const selected=conflict[choices[conflict.id]!];records.push(selected??{id:conflict.id,kind:conflict.kind,deleted:true});
  }
  const revision=Math.max(plan.local.revision,plan.remote?.revision??0)+1;
  return validateSyncState({...plan.local,revision,records});
}
export function libraryFromSync(state:SyncState,current:LibraryState):LibraryState {
  const active=validateSyncState(state).records.filter(item=>!item.deleted);
  // Collection display order is device-local. Keep surviving local slots and
  // append remote additions deterministically; playlist entry order is synced.
  const of=<T>(kind:SyncKind,previous:readonly T[],id:(value:T)=>string):T[]=>{
    const records=new Map(active.filter(item=>item.kind===kind).map(item=>[item.id,item.payload as T])),result:T[]=[];
    for(const value of previous){const key=identifier(kind,id(value)),next=records.get(key);if(next!==undefined){result.push(next);records.delete(key);}}
    return [...result,...records.values()];
  };
  const library:LibraryState={version:1,favorites:of('favorite',current.favorites,value=>trackKey(value.origin)),playlists:of('playlist',current.playlists,value=>value.id),history:current.history,matches:of('match',current.matches??[],value=>trackKey(value.original.origin)),lyricChoices:of('lyricChoice',current.lyricChoices??[],value=>trackKey(value.original.origin))};
  return validateLibrary(library);
}
export function describeSyncRecord(record:SyncRecord|undefined):string {
  if(!record||record.deleted)return '已删除';
  if(record.kind==='playlist'){const value=record.payload as LocalPlaylist;return `${value.title} · ${value.entries.length} 首`;}
  const value=record.kind==='favorite'?record.payload as Track:(record.payload as TrackMatch|LyricChoice).original;
  if(record.kind==='match'){const match=record.payload as TrackMatch;return `${value.title} → ${match.target.title} · ${match.target.artist}`;}
  if(record.kind==='lyricChoice'){const choice=record.payload as LyricChoice;return `${value.title} · ${choice.mode==='manual'?`人工：${choice.target!.title}`:choice.mode==='original'?'原歌词':'自动优选'}`;}
  return `${value.title} · ${value.artist}`;
}
