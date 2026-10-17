import {trackKey, validateTrack, type Track} from '../domain/track.ts';
import type {Repository} from './repository.ts';

export type OfflineDownloadStatus = 'queued'|'downloading'|'failed'|'completed';
export interface OfflineDownloadRecord {
  id:string;
  track:Track;
  fileName:string;
  status:OfflineDownloadStatus;
  bytes:number;
  quality?:string;
  error?:string;
  updatedAt:number;
}
export interface OfflineDownloadMedia {url:string;headers?:Readonly<Record<string,string>>;quality?:string}
export interface OfflineDownloadFiles {
  download(url:string,fileName:string,headers?:Readonly<Record<string,string>>):Promise<number>;
  remove(fileName:string):Promise<void>;
  exists(fileName:string):boolean;
  size(fileName:string):number;
  uri(fileName:string):string;
}
export interface OfflineDownloadOptions {
  resolve(track:Track,signal:AbortSignal):Promise<OfflineDownloadMedia>;
  files:OfflineDownloadFiles;
  uuid():string;
  now():number;
  maxBytes?:number;
  maxTotalBytes?:()=>number;
}
interface SavedDownloads {version:1;items:OfflineDownloadRecord[]}

function validFileName(value:unknown):value is string{return typeof value==='string'&&/^[a-f0-9-]{8,80}\.(?:audio|mp3|m4a|aac|flac|wav|aiff)$/.test(value);}
function validateRecord(value:unknown):OfflineDownloadRecord{
  if(!value||typeof value!=='object')throw new Error('离线下载记录无效');
  const row=value as Partial<OfflineDownloadRecord>;
  const bytes=row.bytes,updatedAt=row.updatedAt;
  if(typeof row.id!=='string'||!row.id||!validFileName(row.fileName)||!['queued','downloading','failed','completed'].includes(row.status as string)||!Number.isSafeInteger(bytes)||!Number.isSafeInteger(updatedAt))throw new Error('离线下载记录无效');
  const safeBytes=bytes as number,safeUpdatedAt=updatedAt as number;
  if(safeBytes<0||safeBytes>2*1024*1024*1024||safeUpdatedAt<0)throw new Error('离线下载记录无效');
  validateTrack(row.track as Track);
  if(row.quality!==undefined&&typeof row.quality!=='string')throw new Error('离线下载音质无效');
  if(row.error!==undefined&&typeof row.error!=='string')throw new Error('离线下载错误无效');
  return {...row,bytes:safeBytes,updatedAt:safeUpdatedAt} as OfflineDownloadRecord;
}

export class OfflineDownloadStore {
  private items:readonly OfflineDownloadRecord[]=[];
  private listeners=new Set<()=>void>();
  private tail:Promise<unknown>=Promise.resolve();
  private active=new Map<string,AbortController>();
  private repository:Pick<Repository,'get'|'put'>;
  private options:OfflineDownloadOptions;
  constructor(repository:Pick<Repository,'get'|'put'>,options:OfflineDownloadOptions){this.repository=repository;this.options=options;}
  getSnapshot=()=>this.items;
  getStatistics=()=>({bytes:this.items.filter(item=>item.status==='completed').reduce((sum,item)=>sum+item.bytes,0),files:this.items.filter(item=>item.status==='completed').length,pending:this.items.filter(item=>item.status==='queued'||item.status==='downloading').length});
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(items:readonly OfflineDownloadRecord[]){this.items=items;for(const listener of this.listeners)listener();}
  private save(items:readonly OfflineDownloadRecord[]){return this.repository.put('offlineDownloads.v1',{version:1,items});}
  private update(id:string,patch:Partial<OfflineDownloadRecord>){const next=this.items.map(item=>item.id===id?{...item,...patch,updatedAt:this.options.now()}:item);this.publish(next);return this.save(next);}
  async restore(){
    const saved=await this.repository.get<SavedDownloads>('offlineDownloads.v1');if(!saved)return;
    try{
      if(saved.version!==1||!Array.isArray(saved.items)||saved.items.length>1000)throw new Error();
      const items=saved.items.map(validateRecord);if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error();
      const repaired:OfflineDownloadRecord[]=items.map(item=>item.status==='completed'&&!this.options.files.exists(item.fileName)?{...item,status:'failed',error:'离线文件已不存在'}:item.status==='downloading'?{...item,status:'queued'}:item);
      this.items=repaired;await this.save(repaired);
    }catch{throw new Error('离线下载数据无法读取');}
  }
  find(track:Track){const key=trackKey(track.origin);return this.items.find(item=>trackKey(item.track.origin)===key);}
  async enqueue(track:Track){
    validateTrack(track);const existing=this.find(track);if(existing)return existing;
    if(this.items.length>=1000)throw new Error('离线下载最多保存1000首');
    const record:OfflineDownloadRecord={id:this.options.uuid(),track,fileName:`${this.options.uuid()}.audio`,status:'queued',bytes:0,updatedAt:this.options.now()};
    const next=[...this.items,record];await this.save(next);this.publish(next);return record;
  }
  async start(id:string){
    if(this.active.has(id))return;
    const run=this.tail.then(async()=>{
      const item=this.items.find(value=>value.id===id);if(!item||item.status==='completed')return;
      const abort=new AbortController();this.active.set(id,abort);
      try{
        await this.update(id,{status:'downloading',error:undefined});
        const current=this.items.find(value=>value.id===id);if(!current)throw new Error('下载任务不存在');
        const media=await this.options.resolve(current.track,abort.signal);if(abort.signal.aborted)throw new Error('下载已取消');
        let bytes=await this.options.files.download(media.url,current.fileName,media.headers);if(!Number.isSafeInteger(bytes)||bytes<=0)bytes=this.options.files.size(current.fileName);
        const max=this.options.maxBytes??2*1024*1024*1024;if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>max)throw new Error('离线文件大小无效');
        const total=this.items.filter(value=>value.status==='completed'&&value.id!==id).reduce((sum,value)=>sum+value.bytes,0)+bytes;
        if(total>(this.options.maxTotalBytes?.()??2*1024*1024*1024))throw new Error('离线容量已满，请先清理已保存文件');
        await this.update(id,{status:'completed',bytes,quality:media.quality,error:undefined});
      }catch(error){
        try{await this.options.files.remove(this.items.find(value=>value.id===id)?.fileName??'');}catch{/* Preserve the failed record for explicit cleanup. */}
        if(!abort.signal.aborted)await this.update(id,{status:'failed',error:error instanceof Error&&error.message==='离线容量已满，请先清理已保存文件'?error.message:'下载失败，原有数据保留'});
      }finally{this.active.delete(id);}
    });
    this.tail=run.catch(()=>{});return run;
  }
  async retry(id:string){const item=this.items.find(value=>value.id===id);if(!item)throw new Error('下载任务不存在');await this.update(id,{status:'queued',bytes:0,error:undefined});return this.start(id);}
  async remove(id:string){
    const item=this.items.find(value=>value.id===id);if(!item)return;
    this.active.get(id)?.abort();const next=this.items.filter(value=>value.id!==id);await this.save(next);this.publish(next);
    try{await this.options.files.remove(item.fileName);}catch{/* A missing file is already removed. */}
  }
  async clearCompleted(){for(const item of [...this.items].filter(value=>value.status==='completed'))await this.remove(item.id);}
  async resolve(track:Track):Promise<{url:string;quality?:string}|undefined>{
    const item=this.find(track);if(!item||item.status!=='completed'||!this.options.files.exists(item.fileName))return;
    return {url:this.options.files.uri(item.fileName),quality:item.quality};
  }
}
