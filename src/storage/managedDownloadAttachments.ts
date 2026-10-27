import {validateAttachmentPolicy,type DownloadAttachmentPolicy} from '../domain/downloadAttachmentPolicy.ts';
import {exportLRC,exportAudioMetadata} from '../domain/downloadAttachments.ts';
import {audioFileExtension} from '../domain/downloadNaming.ts';
import {bounded,throwIfAborted} from '../providers/async.ts';
import type {Track} from '../domain/track.ts';
import type {LyricDocument} from '../lyrics/parser.ts';
import type {Repository} from './repository.ts';
import type {OfflineDownloadStore} from './offlineDownloads.ts';
export type ManagedAttachmentState='queued'|'preparing'|'ready'|'failed'|'cancelled';
export interface ManagedAttachmentRecord {fileName:string;policy:DownloadAttachmentPolicy;state:ManagedAttachmentState}
export interface ManagedAttachmentStage {
 header:Uint8Array;
 text(name:'lyrics.lrc'|'song.meta.json',body:string):void;
 cover(uri:string,maximum:DownloadAttachmentPolicy['coverSize']):Promise<void>;
 bytes():number;
 commit(fileName:string,policy:DownloadAttachmentPolicy):void;
 remove():void;
}
export interface ManagedAttachmentFiles {
 stage(audioURI:string):ManagedAttachmentStage;
 valid(fileName:string,policy:DownloadAttachmentPolicy,digest:string|undefined):boolean;
 remove(fileName:string):void;
 prune(retained:ReadonlySet<string>):void;
 usedBytes():number;
 lyric(fileName:string):string;
 cover(fileName:string):string;
}
export interface ManagedAttachmentOptions {
 downloads:OfflineDownloadStore;files:ManagedAttachmentFiles;maximumBytes():number;
 lyrics(track:Track,signal:AbortSignal):Promise<LyricDocument>;
 cover(track:Track,signal:AbortSignal,size:DownloadAttachmentPolicy['coverSize']):Promise<string|undefined>;
}
const safeName=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9-]{8,80}\.(?:audio|mp3|m4a|aac|flac|wav|aiff)$/.test(value);
const samePolicy=(a:DownloadAttachmentPolicy,b:DownloadAttachmentPolicy)=>JSON.stringify(a)===JSON.stringify(b);
/** Independent auxiliary jobs; the audio store and playback queue keep ownership of audio. */
export class ManagedDownloadAttachments {
 private rows:readonly ManagedAttachmentRecord[]=[];private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
 private running?:Promise<void>;private active?:{fileName:string;abort:AbortController};private unsubscribe?:()=>void;private disposed=false;private halted=false;private versions=new Map<string,number>();private verified=new Map<string,string>();
 private repository:Pick<Repository,'get'|'put'>;private options:ManagedAttachmentOptions;
 constructor(repository:Pick<Repository,'get'|'put'>,options:ManagedAttachmentOptions){this.repository=repository;this.options=options;}
 getSnapshot=()=>this.rows;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private mutate<T>(operation:()=>Promise<T>):Promise<T>{const next=this.tail.then(operation,operation);this.tail=next.catch(()=>{});return next;}
 private async save(rows:readonly ManagedAttachmentRecord[]){await this.repository.put('managedDownloadAttachments.v1',{version:1,items:rows});this.rows=rows;for(const listener of this.listeners)listener();}
 private source(name:string){return this.options.downloads.getSnapshot().find(item=>item.fileName===name&&item.status==='completed'&&item.attachmentPolicy);}
 private async update(name:string,state:ManagedAttachmentState){await this.save(this.rows.map(row=>row.fileName===name?{...row,state}:row));}
 async restore(){
  const saved=await this.repository.get<{version:number;items:ManagedAttachmentRecord[]}>('managedDownloadAttachments.v1');
  if(saved){if(saved.version!==1||!Array.isArray(saved.items)||saved.items.length>1000)throw Error('附加文件记录无效');const names=new Set<string>();this.rows=saved.items.map(value=>{if(!safeName(value.fileName)||names.has(value.fileName)||!['queued','preparing','ready','failed','cancelled'].includes(value.state))throw Error('附加文件记录无效');names.add(value.fileName);return{fileName:value.fileName,policy:validateAttachmentPolicy(value.policy),state:value.state==='preparing'?'queued':value.state};});}
  await this.reconcile();this.unsubscribe=this.options.downloads.subscribe(()=>{if(this.active&&!this.source(this.active.fileName))this.active.abort.abort();void this.reconcile().catch(()=>{});});this.pump();
 }
 private reconcile(){return this.mutate(async()=>{
  const eligible=this.options.downloads.getSnapshot().filter(item=>item.status==='completed'&&item.attachmentPolicy),names=new Set(eligible.map(item=>item.fileName));
  this.options.files.prune(names);for(const name of this.verified.keys())if(!names.has(name))this.verified.delete(name);const rows:ManagedAttachmentRecord[]=eligible.map(item=>{const policy=validateAttachmentPolicy(item.attachmentPolicy),old=this.rows.find(row=>row.fileName===item.fileName&&samePolicy(row.policy,policy));const signature=JSON.stringify([item.digest,policy]);if((old?.state==='ready'&&this.verified.get(item.fileName)===signature)||this.options.files.valid(item.fileName,policy,item.digest)){this.verified.set(item.fileName,signature);return{fileName:item.fileName,policy,state:'ready'};}return{fileName:item.fileName,policy,state:old?.state==='ready'?'failed':old?.state??'queued'};});
  await this.save(rows);
 }).then(()=>this.pump());}
 private pump(){
  if(this.running||this.disposed||this.halted)return;const next=this.rows.find(row=>row.state==='queued');if(!next)return;
  const abort=new AbortController();this.active={fileName:next.fileName,abort};
  this.running=this.prepare(next,abort.signal,this.versions.get(next.fileName)??0).catch(()=>{this.halted=true;}).finally(()=>{this.active=undefined;this.running=undefined;this.pump();});
 }
 private async prepare(row:ManagedAttachmentRecord,signal:AbortSignal,version:number){
  let stage:ManagedAttachmentStage|undefined;
  try{
   await this.mutate(async()=>{if(!this.source(row.fileName)||signal.aborted)throw Error('附加任务已取消');await this.update(row.fileName,'preparing');});
   const source=this.source(row.fileName);if(!source)throw Error('原音频不存在');
   stage=await this.options.downloads.prepareExport(source.id,(_item,uri)=>this.options.files.stage(uri));
   const p=row.policy;
   if(p.downloadAttachLyrics){const document=await bounded(child=>this.options.lyrics(source.track,child),signal,25000);throwIfAborted(signal);stage.text('lyrics.lrc',exportLRC(document));}
   if(p.downloadAttachCover){const uri=await bounded(child=>this.options.cover(source.track,child,p.coverSize),signal,20000);throwIfAborted(signal);if(!uri)throw Error('封面暂不可用');await stage.cover(uri,p.coverSize);}
   if(p.downloadAttachMetadata){if(!source.digest)throw Error('原音频摘要缺失');stage.text('song.meta.json',exportAudioMetadata(source.track,source.bytes,source.digest,audioFileExtension(stage.header)));}
   throwIfAborted(signal);
   await this.mutate(async()=>{
    if((this.versions.get(row.fileName)??0)!==version||this.rows.find(item=>item.fileName===row.fileName)?.state!=='preparing')throw Error('附加任务已取消');
    await this.options.downloads.prepareExport(source.id,current=>{throwIfAborted(signal);if(current.fileName!==row.fileName||current.digest!==source.digest)throw Error('原音频已改变');if(this.options.downloads.getStatistics().bytes+this.options.files.usedBytes()+stage!.bytes()>this.options.maximumBytes())throw Error('离线容量不足');stage!.commit(row.fileName,p);this.verified.set(row.fileName,JSON.stringify([current.digest,p]));});
    await this.update(row.fileName,'ready');
   });
  }catch{
   await this.mutate(async()=>{const current=this.rows.find(item=>item.fileName===row.fileName);if((this.versions.get(row.fileName)??0)!==version)return;if(current&&['queued','preparing'].includes(current.state))await this.update(row.fileName,signal.aborted?'cancelled':'failed');});
  }finally{stage?.remove();}
 }
 async cancel(fileName:string){this.versions.set(fileName,(this.versions.get(fileName)??0)+1);if(this.active?.fileName===fileName)this.active.abort.abort();await this.mutate(async()=>{const row=this.rows.find(item=>item.fileName===fileName);if(row&&['queued','preparing'].includes(row.state))await this.update(fileName,'cancelled');});}
 async retry(fileName:string){this.versions.set(fileName,(this.versions.get(fileName)??0)+1);this.halted=false;await this.mutate(async()=>{const row=this.rows.find(item=>item.fileName===fileName);if(row&&['failed','cancelled'].includes(row.state)&&this.source(fileName))await this.update(fileName,'queued');});await this.reconcile();}
 async prepared(fileName:string,maximum:DownloadAttachmentPolicy['coverSize']){await this.tail;const row=this.rows.find(item=>item.fileName===fileName);if(!row||row.state!=='ready'||!this.source(fileName))return;if(!this.options.files.valid(fileName,row.policy,this.source(fileName)?.digest)){this.verified.delete(fileName);await this.mutate(async()=>{if(this.rows.find(item=>item.fileName===fileName)?.state==='ready')await this.update(fileName,'failed');});return;}
  return{lyrics:row.policy.downloadAttachLyrics?this.options.files.lyric(fileName):undefined,cover:row.policy.downloadAttachCover&&row.policy.coverSize===maximum?this.options.files.cover(fileName):undefined};
 }
 async whenIdle(){await this.tail;while(this.running){await this.running;await this.tail;}}
 dispose(){this.disposed=true;this.unsubscribe?.();this.active?.abort.abort();}
}
