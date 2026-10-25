import {trackKey, validateTrack, type Track} from '../domain/track.ts';
import type {Repository} from './repository.ts';

export type OfflineDownloadStatus = 'queued'|'downloading'|'paused'|'failed'|'cancelled'|'completed';
export interface OfflineDownloadRecord {
  id:string;
  track:Track;
  fileName:string;
  status:OfflineDownloadStatus;
  bytes:number;
  partialBytes?:number;
  digest?:string;
  validator?:string;
  quality?:string;
  error?:string;
  updatedAt:number;
}
export interface OfflineDownloadMedia {url:string;headers?:Readonly<Record<string,string>>;quality?:string}
export interface OfflineDownloadFiles {
  download(url:string,fileName:string,headers?:Readonly<Record<string,string>>,options?:{signal?:AbortSignal;offset?:number;validator?:string;onValidator?:(validator:string|undefined)=>void}):Promise<number>;
  remove(fileName:string):Promise<void>;
  exists(fileName:string):boolean;
  size(fileName:string):number;
  partialSize(fileName:string):number;
  digest(fileName:string):string|undefined;
  uri(fileName:string):string;
}
export class OfflineDownloadInterrupted extends Error {
  readonly bytes:number;
  constructor(bytes:number){super('下载已暂停');this.name='OfflineDownloadInterrupted';this.bytes=bytes;}
}
export class OfflineDownloadInUse extends Error {
  constructor(){super('当前播放文件不能删除');this.name='OfflineDownloadInUse';}
}
export interface OfflineDownloadOptions {
  resolve(track:Track,signal:AbortSignal):Promise<OfflineDownloadMedia>;
  files:OfflineDownloadFiles;
  uuid():string;
  now():number;
  maxBytes?:number;
  maxTotalBytes?:()=>number;
  isInUse?:(track:Track)=>boolean;
}
interface SavedDownloads {version:1;items:OfflineDownloadRecord[]}

function validFileName(value:unknown):value is string{return typeof value==='string'&&/^[a-f0-9-]{8,80}\.(?:audio|mp3|m4a|aac|flac|wav|aiff)$/.test(value);}
function validateRecord(value:unknown):OfflineDownloadRecord{
  if(!value||typeof value!=='object')throw new Error('离线下载记录无效');
  const row=value as Partial<OfflineDownloadRecord>;
  const bytes=row.bytes,updatedAt=row.updatedAt;
  if(typeof row.id!=='string'||!row.id||!validFileName(row.fileName)||!['queued','downloading','paused','failed','cancelled','completed'].includes(row.status as string)||!Number.isSafeInteger(bytes)||!Number.isSafeInteger(updatedAt))throw new Error('离线下载记录无效');
  const safeBytes=bytes as number,safeUpdatedAt=updatedAt as number;
  if(safeBytes<0||safeBytes>2*1024*1024*1024||safeUpdatedAt<0)throw new Error('离线下载记录无效');
  if(row.partialBytes!==undefined&&(!Number.isSafeInteger(row.partialBytes)||row.partialBytes<0||row.partialBytes>2*1024*1024*1024))throw new Error('离线下载临时文件无效');
  if(row.digest!==undefined&&(typeof row.digest!=='string'||!/^[a-f\d]{32}$/i.test(row.digest)))throw new Error('离线文件摘要无效');
  if(row.validator!==undefined&&(typeof row.validator!=='string'||row.validator.length>256))throw new Error('离线下载实体校验器无效');
  validateTrack(row.track as Track);
  if(row.quality!==undefined&&typeof row.quality!=='string')throw new Error('离线下载音质无效');
  if(row.error!==undefined&&typeof row.error!=='string')throw new Error('离线下载错误无效');
  return {...row,bytes:safeBytes,updatedAt:safeUpdatedAt} as OfflineDownloadRecord;
}

export class OfflineDownloadStore {
  private items:readonly OfflineDownloadRecord[]=[];
  private listeners=new Set<()=>void>();
  private tail:Promise<unknown>=Promise.resolve();
  private mutationTail:Promise<unknown>=Promise.resolve();
  private active=new Map<string,AbortController>();
  private runs=new Map<string,Promise<void>>();
  private pauseRequested=new Set<string>();
  private cancelRequested=new Set<string>();
  private removed=new Set<string>();
  private repository:Pick<Repository,'get'|'put'>;
  private options:OfflineDownloadOptions;
  constructor(repository:Pick<Repository,'get'|'put'>,options:OfflineDownloadOptions){this.repository=repository;this.options=options;}
  getSnapshot=()=>this.items;
  getStatistics=()=>({bytes:this.items.filter(item=>item.status==='completed').reduce((sum,item)=>sum+item.bytes,0),files:this.items.filter(item=>item.status==='completed').length,pending:this.items.filter(item=>item.status==='queued'||item.status==='downloading'||item.status==='paused').length});
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(items:readonly OfflineDownloadRecord[]){this.items=items;for(const listener of this.listeners)listener();}
  private save(items:readonly OfflineDownloadRecord[]){return this.repository.put('offlineDownloads.v1',{version:1,items});}
  private mutate<T>(operation:()=>Promise<T>):Promise<T>{const run=this.mutationTail.then(operation,operation);this.mutationTail=run.catch(()=>{});return run;}
  private async update(id:string,patch:Partial<OfflineDownloadRecord>){await this.mutate(async()=>{const current=this.items.find(item=>item.id===id);if(!current)return;const next=this.items.map(item=>item.id===id?{...item,...patch,updatedAt:this.options.now()}:item);await this.save(next);this.publish(next);});}
  async restore(){
    await this.mutate(async()=>{
      const saved=await this.repository.get<SavedDownloads>('offlineDownloads.v1');if(!saved)return;
      try{
        if(saved.version!==1||!Array.isArray(saved.items)||saved.items.length>1000)throw new Error();
        const items=saved.items.map(validateRecord);if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error();
        const repaired:OfflineDownloadRecord[]=items.map(item=>{
          if(item.status==='completed'&&!this.options.files.exists(item.fileName))return{...item,status:'failed',error:'离线文件已不存在',partialBytes:undefined,digest:undefined};
          if(item.status==='completed'){
            let digest:string|undefined;
            try{if(this.options.files.size(item.fileName)===item.bytes)digest=this.options.files.digest(item.fileName);}catch{/* A single unreadable file must not quarantine the whole download index. */}
            if(!digest||(item.digest!==undefined&&item.digest.toLowerCase()!==digest.toLowerCase()))return{...item,status:'failed',error:'离线文件完整性校验失败',partialBytes:undefined,digest:undefined};
            return item.digest===digest?item:{...item,digest};
          }
          return item.status==='downloading'?{...item,status:'queued'}:item;
        });
        await this.save(repaired);this.items=repaired;
      }catch{throw new Error('离线下载数据无法读取');}
    });
  }
  /** Resume work that was queued before the process stopped or was backgrounded.
   *  The store serializes transfers through `tail`, so a restart cannot create
   * duplicate network work for the same persisted record. Native background
   * URLSession handoff remains a separate adapter boundary.
   */
  async resumeQueued(): Promise<void> {
    const queued = this.items.filter(item => item.status === 'queued').map(item => item.id);
    for (const id of queued) {
      if (!this.items.some(item => item.id === id && item.status === 'queued')) continue;
      try { await this.start(id); } catch { /* Keep later records schedulable if persistence fails. */ }
    }
  }
  find(track:Track){const key=trackKey(track.origin);return this.items.find(item=>trackKey(item.track.origin)===key);}
  async enqueue(track:Track){
    validateTrack(track);return this.mutate(async()=>{const existing=this.find(track);if(existing)return existing;
      if(this.items.length>=1000)throw new Error('离线下载最多保存1000首');
      const record:OfflineDownloadRecord={id:this.options.uuid(),track,fileName:`${this.options.uuid()}.audio`,status:'queued',bytes:0,updatedAt:this.options.now()};
      const next=[...this.items,record];await this.save(next);this.publish(next);return record;
    });
  }
  async start(id:string){
    const existing=this.runs.get(id);if(existing)return existing;
    const run=this.tail.then(async()=>{
      const item=this.items.find(value=>value.id===id);if(this.removed.has(id)||this.pauseRequested.has(id)||this.cancelRequested.has(id)||!item||item.status==='completed'||item.status==='paused'||item.status==='cancelled')return;
      const abort=new AbortController();this.active.set(id,abort);
      let invalidFile=false,capacityExceeded=false,integrityFailed=false,validator:string|undefined;
      try{
        await this.update(id,{status:'downloading',error:undefined});
        const current=this.items.find(value=>value.id===id);if(!current)throw new Error('下载任务不存在');
        if(abort.signal.aborted)throw new OfflineDownloadInterrupted(current.partialBytes??0);
        const media=await this.options.resolve(current.track,abort.signal);if(abort.signal.aborted)throw new OfflineDownloadInterrupted(current.partialBytes??0);
        const offset=current.partialBytes??0;validator=current.validator;
        let bytes=await this.options.files.download(media.url,current.fileName,media.headers,{signal:abort.signal,offset,validator,onValidator:value=>{validator=value;}});if(!Number.isSafeInteger(bytes)||bytes<=0)bytes=this.options.files.size(current.fileName);
        if(abort.signal.aborted)throw new OfflineDownloadInterrupted(0);
        const max=this.options.maxBytes??2*1024*1024*1024;if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>max){invalidFile=true;throw new Error('离线文件大小无效');}
        const digest=this.options.files.digest(current.fileName);if(!digest||!/^[a-f\d]{32}$/i.test(digest)){integrityFailed=true;throw new Error('离线文件完整性校验失败');}
        const total=this.items.filter(value=>value.status==='completed'&&value.id!==id).reduce((sum,value)=>sum+value.bytes,0)+bytes;
        if(total>(this.options.maxTotalBytes?.()??2*1024*1024*1024)){capacityExceeded=true;throw new Error('离线容量已满，请先清理已保存文件');}
        await this.update(id,{status:'completed',bytes,partialBytes:undefined,digest,validator,quality:media.quality,error:undefined});
      }catch(error){
        const cancelled=this.cancelRequested.delete(id);
        const paused=this.pauseRequested.delete(id);
        const current=this.items.find(value=>value.id===id),partial=invalidFile||capacityExceeded||integrityFailed?0:Math.max(0,this.options.files.partialSize(current?.fileName??''));
        if(invalidFile||capacityExceeded||integrityFailed)try{await this.options.files.remove(current?.fileName??'');}catch{/* Keep the record even when cleanup fails. */}
        if(cancelled)await this.update(id,{status:'cancelled',error:undefined});
        else if(paused)await this.update(id,{status:'paused',bytes:0,partialBytes:partial,digest:undefined,validator,error:undefined});
        else if(!abort.signal.aborted)await this.update(id,{status:'failed',bytes:0,partialBytes:partial,digest:undefined,validator,error:integrityFailed?'离线文件完整性校验失败':error instanceof Error&&error.message==='离线容量已满，请先清理已保存文件'?error.message:'下载失败，原有数据保留'});
      }finally{this.active.delete(id);}
    });
    this.runs.set(id,run);this.tail=run.catch(()=>{});try{await run;}finally{if(this.runs.get(id)===run)this.runs.delete(id);}
  }
  async pause(id:string){
    const item=this.items.find(value=>value.id===id);if(!item||!['queued','downloading'].includes(item.status))return;
    // A run can already be active while its downloading state is being saved.
    // Publish the pause intent synchronously so that window cannot start I/O.
    this.pauseRequested.add(id);const active=this.active.get(id);active?.abort();
    if(item.status==='queued')await this.update(id,{status:'paused',error:undefined});
    if(active)await this.runs.get(id);
  }
  /** Sollin E-1301: cancelling keeps the record as 下载已取消 for later retry. */
  async cancel(id:string){
    const item=this.items.find(value=>value.id===id);if(!item||item.status==='completed')return;
    // The transfer's abort handler consumes this intent before committing its
    // terminal state. Keep it until that run has settled.
    this.cancelRequested.add(id);this.pauseRequested.delete(id);const active=this.active.get(id);active?.abort();
    if(!active||['queued','paused','failed','cancelled'].includes(item.status))await this.update(id,{status:'cancelled',error:undefined});
    if(active)await this.runs.get(id);
    this.cancelRequested.delete(id);
  }
  async resume(id:string){const item=this.items.find(value=>value.id===id);if(!item)throw new Error('下载任务不存在');if(item.status==='paused')await this.update(id,{status:'queued',error:undefined});this.pauseRequested.delete(id);return this.start(id);}
  async retry(id:string){const item=this.items.find(value=>value.id===id);if(!item)throw new Error('下载任务不存在');if(item.status==='completed')return;await this.update(id,{status:'queued',bytes:0,partialBytes:undefined,error:undefined,digest:undefined});this.pauseRequested.delete(id);this.cancelRequested.delete(id);return this.start(id);}
  async pauseAll(){await Promise.all(this.items.filter(item=>item.status==='queued'||item.status==='downloading').map(item=>this.pause(item.id)));}
  async resumeAll(){await Promise.all(this.items.filter(item=>item.status==='queued'||item.status==='paused').map(item=>this.resume(item.id)));}
  /** Sollin E-1302: 全部取消 ends unfinished work but keeps their records. */
  async cancelAll(){await Promise.all(this.items.filter(item=>['queued','downloading','paused'].includes(item.status)).map(item=>this.cancel(item.id)));}
  async cancelPending(){await Promise.all(this.items.filter(item=>item.status!=='completed').map(item=>this.remove(item.id)));}
  async remove(id:string){
    const item=this.items.find(value=>value.id===id);if(!item)return;
    if(this.options.isInUse?.(item.track))throw new OfflineDownloadInUse();
    this.removed.add(id);
    try{
      this.pauseRequested.delete(id);const active=this.active.get(id);active?.abort();const run=this.runs.get(id);if(run)await run;
      if(this.options.isInUse?.(item.track))throw new OfflineDownloadInUse();
      await this.mutate(async()=>{const next=this.items.filter(value=>value.id!==id);await this.save(next);this.publish(next);});
      try{await this.options.files.remove(item.fileName);}catch{/* A missing file is already removed. */}
    }finally{this.removed.delete(id);}
  }
  async clearCompleted(){for(const item of [...this.items].filter(value=>value.status==='completed')){if(this.options.isInUse?.(item.track))continue;await this.remove(item.id);}}
  async resolve(track:Track):Promise<{url:string;quality?:string}|undefined>{
    const item=this.find(track);if(!item||item.status!=='completed'||!this.options.files.exists(item.fileName))return;
    return {url:this.options.files.uri(item.fileName),quality:item.quality};
  }
}
