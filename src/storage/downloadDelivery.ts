import {validateDestinationIntent,type DownloadDestinationIntent} from '../domain/downloadDestination.ts';
import {exportOfflineAudio,type AudioExportFiles} from './offlineExport.ts';
import type {Repository} from './repository.ts';
import type {OfflineDownloadStore} from './offlineDownloads.ts';
import type {ManagedDownloadAttachments} from './managedDownloadAttachments.ts';
import type {DownloadDestinationSettings} from './downloadDestination.ts';
export type DownloadDeliveryState='waiting'|'copying'|'saved'|'failed'|'cancelled';
export interface DownloadDeliveryRecord {fileName:string;intent:DownloadDestinationIntent;state:DownloadDeliveryState;names?:readonly string[]}
export interface DownloadDeliveryOptions {downloads:OfflineDownloadStore;attachments:ManagedDownloadAttachments;destination:DownloadDestinationSettings;files:AudioExportFiles}
/** A user copy is independent of the authoritative audio file and queue. */
export class DownloadDelivery {
 private rows:readonly DownloadDeliveryRecord[]=[];private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();private running?:Promise<void>;private halted=false;private disposed=false;private unsubs:(()=>void)[]=[];
 private repository:Pick<Repository,'get'|'put'>;private options:DownloadDeliveryOptions;
 constructor(repository:Pick<Repository,'get'|'put'>,options:DownloadDeliveryOptions){this.repository=repository;this.options=options;}
 getSnapshot=()=>this.rows;subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private mutate<T>(operation:()=>Promise<T>){const next=this.tail.then(operation,operation);this.tail=next.catch(()=>{});return next;}
 private async save(rows:readonly DownloadDeliveryRecord[]){await this.repository.put('downloadDelivery.v1',{version:1,items:rows});this.rows=rows;for(const listener of this.listeners)listener();}
 async restore(){
  const saved=await this.repository.get<{version:number;items:DownloadDeliveryRecord[]}>('downloadDelivery.v1');if(saved){if(saved.version!==1||!Array.isArray(saved.items)||saved.items.length>1000)throw Error('目录保存记录无效');const seen=new Set<string>();this.rows=saved.items.map(row=>{if(typeof row.fileName!=='string'||!/^[a-f\d-]{8,80}\.(?:audio|mp3|m4a|aac|flac|wav|aiff)$/.test(row.fileName)||seen.has(row.fileName)||!['waiting','copying','saved','failed','cancelled'].includes(row.state))throw Error('目录保存记录无效');seen.add(row.fileName);if(row.names&&(!Array.isArray(row.names)||row.names.length>4||row.names.some(name=>typeof name!=='string'||!name||name.length>240||/[\\/\p{Cc}]/u.test(name))))throw Error('目录文件记录无效');return{fileName:row.fileName,intent:validateDestinationIntent(row.intent),state:row.state==='copying'?'waiting':row.state,...(row.names?{names:row.names}:{})};});}
  await this.reconcile();for(const source of [this.options.downloads,this.options.attachments,this.options.destination])this.unsubs.push(source.subscribe(()=>{void this.reconcile().catch(()=>{});}));this.pump();
 }
 private reconcile(){return this.mutate(async()=>{
  const root=this.options.destination.getSnapshot().root;
  const rows=this.options.downloads.getSnapshot().filter(item=>item.status==='completed'&&item.destination).map(item=>{const intent=validateDestinationIntent(item.destination),old=this.rows.find(row=>row.fileName===item.fileName&&row.intent.job===intent.job);return old?.state==='saved'?old:{fileName:item.fileName,intent,state:root?.id===intent.id?old?.state??'waiting':'cancelled'} as DownloadDeliveryRecord;});await this.save(rows);
 }).then(()=>this.pump());}
 private ready(row:DownloadDeliveryRecord){if(this.options.destination.getSnapshot().busy||this.options.destination.getSnapshot().root?.id!==row.intent.id)return;const item=this.options.downloads.getSnapshot().find(item=>item.fileName===row.fileName&&item.destination?.job===row.intent.job&&item.status==='completed');return item&&(!item.attachmentPolicy||this.options.attachments.getSnapshot().some(aux=>aux.fileName===row.fileName&&aux.state==='ready'))?item:undefined;}
 private pump(){if(this.running||this.halted||this.disposed)return;const next=this.rows.find(row=>row.state==='waiting'&&this.ready(row));if(!next)return;this.running=this.copy(next).catch(()=>{this.halted=true;}).finally(()=>{this.running=undefined;this.pump();});}
 private async update(row:DownloadDeliveryRecord,state:DownloadDeliveryState,names?:readonly string[]){await this.save(this.rows.map(item=>item.fileName===row.fileName&&item.intent.job===row.intent.job?{...item,state,...(names?{names}:{})}:item));}
 private async copy(row:DownloadDeliveryRecord){
  try{
   await this.mutate(async()=>{if(this.options.destination.getSnapshot().root?.id!==row.intent.id)throw Error('目录授权已改变');await this.update(row,'copying');});
   const item=this.ready(row);if(!item)throw Error('附加文件尚未保存');const p=item.attachmentPolicy,platform=item.track.origin.kind==='online'?item.track.origin.platform:undefined;let names:readonly string[]=[];
   await exportOfflineAudio(this.options.downloads,item.id,row.intent,{stage:this.options.files.stage,share:async(uri,additional)=>{if(!this.ready(row))throw Error('原下载已移除或附加文件未就绪');names=await this.options.destination.save([uri,...additional??[]],row.intent);}},p?{...p,downloadCoverSizes:platform?{[platform]:p.coverSize}:{},signal:new AbortController().signal,prepared:(_record,size)=>this.options.attachments.prepared(row.fileName,size),lyrics:async()=>{throw Error('附加文件未就绪');},cover:async()=>{throw Error('附加文件未就绪');}}:undefined);
   await this.mutate(()=>this.update(row,'saved',names));
  }catch{await this.mutate(async()=>{const current=this.rows.find(item=>item.fileName===row.fileName&&item.intent.job===row.intent.job);if(current&&current.state!=='saved')await this.update(row,this.options.destination.getSnapshot().root?.id===row.intent.id?'failed':'cancelled');});}
 }
 async retry(id:string){if(this.running)throw Error('正在保存文件，请稍后重试');const row=this.options.downloads.getSnapshot().find(item=>item.id===id);if(!row||row.status!=='completed')throw Error('原音频尚未保存');const existing=this.rows.find(item=>item.fileName===row.fileName);const root=this.options.destination.getSnapshot().root;if(!root)throw Error('请先选择保存目录');const intent=existing?.state==='failed'&&existing.intent.id===root.id?existing.intent:this.options.destination.capture();if(!intent)throw Error('保存目录尚未就绪');this.halted=false;
  await this.options.downloads.setDestination(id,intent);await this.mutate(()=>this.save(this.rows.filter(item=>item.fileName!==row.fileName)));await this.reconcile();
 }
 async whenIdle(){await this.tail;while(this.running){await this.running;await this.tail;}}
 dispose(){this.disposed=true;for(const unsub of this.unsubs)unsub();}
}
