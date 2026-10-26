import {cleanPlaybackStats,type PlaybackStatsState,type PlaybackStatsStore} from './playbackStats.ts';
import {normalizeBackupDirectory,strongBackupETag,type BackupTransport,type BackupConfig} from './webdavBackups.ts';
import {davURL,WebDAVError,type WebDAVAccount,type WebDAVClient,type WebDAVCredentials} from '../providers/webdav.ts';
import type {Repository} from './repository.ts';
import {InvalidRecordError} from './recovery.ts';
export const statisticsDirectory='nexus-music-statistics/',statisticsFileName='statistics-v1.json';
const key='webdav.statistics.v1',maximumBytes=32*1024*1024;
export interface StatisticsFile {format:'nexus-listening-statistics';version:1;revision:number;exportedAt:string;statistics:PlaybackStatsState}
export class StatisticsSyncError extends Error {
  constructor(kind:'format'|'changed'|'account'|'busy'|'http'|'etag'|'digest'){
    super({format:'统计文件格式或大小不受支持，本机数据保留',changed:'云端统计已变化，请重新读取上传预览',account:'统计连接已移除或更改，请重新选择并保存',busy:'正在处理统计，请等待或取消请求',http:'统计请求未完成，请检查网络、权限与空间',etag:'远端未提供强版本标记，不能安全覆盖；仍可下载合并',digest:'上传回读与预览内容不一致，请重新读取云端统计'}[kind]);
  }
}
function checkSize(text:string){let bytes=0;if(text.length>maximumBytes)throw new StatisticsSyncError('format');for(const point of text){const n=point.codePointAt(0)!;bytes+=n<128?1:n<2048?2:n<65536?3:4;if(bytes>maximumBytes)throw new StatisticsSyncError('format');}}
export function decodeStatisticsFile(text:string):StatisticsFile{
  try{checkSize(text);const value=JSON.parse(text) as StatisticsFile;
    if(value.format!=='nexus-listening-statistics'||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.exportedAt!=='string'||value.exportedAt.length>80||!Number.isFinite(Date.parse(value.exportedAt)))throw Error();
    const statistics=cleanPlaybackStats(value.statistics);if(!statistics.replicas)throw Error();return {format:value.format,version:1,revision:value.revision,exportedAt:value.exportedAt,statistics};
  }catch{throw new StatisticsSyncError('format');}
}
export function encodeStatisticsFile(statistics:PlaybackStatsState,revision:number,date:Date){const text=JSON.stringify({format:'nexus-listening-statistics',version:1,revision,exportedAt:date.toISOString(),statistics:cleanPlaybackStats(statistics)});decodeStatisticsFile(text);return text;}
interface Accounts {getSnapshot():readonly WebDAVAccount[];subscribe(listener:()=>void):()=>void;credentials(id:string):Promise<WebDAVCredentials>;client(id:string):Promise<Pick<WebDAVClient,'stat'>>}
interface Options {repository:Pick<Repository,'get'|'put'>;accounts:Accounts;transport:BackupTransport;statistics:Pick<PlaybackStatsStore,'snapshotForSync'|'merge'>;hash:(text:string)=>Promise<string>;now?:()=>Date}
interface Summary {revision:number;tracks:number;playCount:number;listenedMs:number;exportedAt:string}
export interface StatisticsSyncState {config?:BackupConfig;cloud?:Summary|null;preview?:{local:Summary;remote:Summary|null};busy:null|'configure'|'read'|'preview'|'upload'|'download'|'merge';message:string;error:string}
const summarize=(file:StatisticsFile):Summary=>({revision:file.revision,tracks:file.statistics.items.length,playCount:file.statistics.items.reduce((n,x)=>n+x.playCount,0),listenedMs:file.statistics.items.reduce((n,x)=>n+x.listenedMs,0),exportedAt:file.exportedAt});
function status(value:number,allowed:readonly number[]){if(value===401||value===403)throw new WebDAVError('authorization');if(value===412)throw new StatisticsSyncError('changed');if(!allowed.includes(value))throw new StatisticsSyncError('http');}
interface Context {config:BackupConfig;account:WebDAVAccount;credentials:WebDAVCredentials;signal:AbortSignal;check:()=>void;valid:()=>boolean}
export class WebDAVStatistics {
  private value:StatisticsSyncState={busy:null,message:'',error:''};private listeners=new Set<()=>void>();private generation=0;private request?:AbortController;private account?:WebDAVAccount;
  private prepared?:{config:BackupConfig;account:WebDAVAccount;body:string;etag:string};private options:Options;
  constructor(options:Options){this.options=options;options.accounts.subscribe(()=>{const account=this.selected();if(account===this.account)return;this.account=account;if(this.value.busy==='merge'||this.value.busy==='configure')return;this.cancel();this.publish({...this.value,cloud:undefined,error:this.value.config?'统计连接已更改，请重新选择并读取':''});});}
  getSnapshot=()=>this.value;subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private selected(){return this.options.accounts.getSnapshot().find(x=>x.id===this.value.config?.accountId);}
  private publish(value:StatisticsSyncState){this.value=value;for(const listener of this.listeners)listener();}
  async restore(){const value=await this.options.repository.get<BackupConfig>(key);if(!value)return;try{if(value.version!==1||typeof value.accountId!=='string'||!/^[a-f\d]{64}$/.test(value.accountId)||typeof value.directory!=='string'||normalizeBackupDirectory(decodeURIComponent(value.directory))!==value.directory)throw Error();this.publish({...this.value,config:{version:1,accountId:value.accountId,directory:value.directory}});this.account=this.selected();}catch{throw new InvalidRecordError();}}
  async configure(accountId:string,directory:string){if(this.value.busy)throw new StatisticsSyncError('busy');if(!this.options.accounts.getSnapshot().some(x=>x.id===accountId))throw new StatisticsSyncError('account');const config:BackupConfig={version:1,accountId,directory:normalizeBackupDirectory(directory.trim()||statisticsDirectory)};this.cancel();this.publish({...this.value,busy:'configure',message:'',error:''});try{await this.options.repository.put(key,config);this.account=this.options.accounts.getSnapshot().find(x=>x.id===accountId);this.publish({config,busy:null,message:'统计目录已保存',error:''});}catch(error){this.publish({...this.value,busy:null,error:'统计目录未保存，请重试'});throw error;}}
  cancel(){if(this.value.busy==='merge'||this.value.busy==='configure')return false;const busy=!!this.value.busy,preview=!!this.prepared;this.generation++;this.request?.abort();this.request=undefined;this.prepared=undefined;this.publish({...this.value,busy:null,preview:undefined,...(busy?{message:'已取消；上传可能已到达服务器，请重新读取核对',error:''}:preview?{message:'上传预览已取消，云端未写入',error:''}:{})});return true;}
  private async run(kind:'read'|'preview'|'upload'|'download',work:(context:Context)=>Promise<Partial<StatisticsSyncState>>){
    if(this.value.busy)throw new StatisticsSyncError('busy');const config=this.value.config,account=this.selected();if(!config||!account)throw new StatisticsSyncError('account');
    const generation=++this.generation,request=new AbortController();this.request=request;this.prepared=undefined;
    const valid=()=>generation===this.generation&&!request.signal.aborted&&config===this.value.config&&account===this.selected();const check=()=>{if(!valid())throw new StatisticsSyncError('account');};
    this.publish({...this.value,busy:kind,preview:undefined,message:'',error:''});
    try{const credentials=await this.options.accounts.credentials(account.id);check();const result=await work({config,account,credentials,signal:request.signal,check,valid});if(this.value.busy!=='merge')check();this.publish({...this.value,...result,busy:null});}
    catch(error){if(generation===this.generation)this.publish({...this.value,busy:null,preview:undefined,error:error instanceof StatisticsSyncError||error instanceof WebDAVError?error.message:'统计操作未确认完成，请核对本机和云端后重试'});throw error;}
    finally{if(this.request===request)this.request=undefined;}
  }
  private async read(context:Context){const {account,config,credentials,signal,check}=context,root=davURL(account.url,config.directory),response=await this.options.transport.backup(root,statisticsFileName,credentials,'GET','','',signal);check();if(response.status===404)return {file:null,etag:''};status(response.status,[200]);return {file:decodeStatisticsFile(response.body),etag:strongBackupETag(response.etag)};}
  refresh(){return this.run('read',async context=>{const {file}=await this.read(context);return {cloud:file?summarize(file):null,message:file?`已读取云端统计（修订 #${file.revision}）`:'云端暂无听歌统计'};});}
  prepareUpload(){return this.run('preview',async context=>{
    const remote=await this.read(context);if(remote.file&&!remote.etag)throw new StatisticsSyncError('etag');
    const local=await this.options.statistics.snapshotForSync();context.check();const body=encodeStatisticsFile(local,(remote.file?.revision??0)+1,(this.options.now??(()=>new Date()))());
    this.prepared={config:context.config,account:context.account,body,etag:remote.etag};const file=decodeStatisticsFile(body);return {cloud:remote.file?summarize(remote.file):null,preview:{local:summarize(file),remote:remote.file?summarize(remote.file):null},message:'上传预览已就绪；确认后用本机快照覆盖云端'};
  });}
  uploadPrepared(){const plan=this.prepared;if(!plan||plan.config!==this.value.config||plan.account!==this.selected())return Promise.reject(new StatisticsSyncError('changed'));
    return this.run('upload',async context=>{const {account,config,credentials,signal,check}=context;const client=await this.options.accounts.client(account.id);check();let prefix='';
      for(const part of config.directory.split('/').filter(Boolean)){prefix+=part+'/';try{if(!(await client.stat(prefix,signal)).directory)throw new StatisticsSyncError('format');check();}catch(error){check();if(!(error instanceof WebDAVError&&error.kind==='missing'))throw error;const created=await this.options.transport.backup(account.url,prefix,credentials,'MKCOL','','',signal);check();status(created.status,[201,405]);if(!(await client.stat(prefix,signal)).directory)throw new StatisticsSyncError('format');check();}}
      const root=davURL(account.url,config.directory),digest=await this.options.hash(plan.body);check();const written=await this.options.transport.backup(root,statisticsFileName,credentials,'PUT',plan.body,plan.etag,signal);check();status(written.status,[200,201,204]);
      const read=await this.options.transport.backup(root,statisticsFileName,credentials,'GET','',strongBackupETag(written.etag),signal);check();status(read.status,[200]);if(await this.options.hash(read.body)!==digest)throw new StatisticsSyncError('digest');check();const file=decodeStatisticsFile(read.body);return {cloud:summarize(file),message:`听歌统计已上传并回读验证（修订 #${file.revision}）`};
    });
  }
  downloadAndMerge(){return this.run('download',async context=>{const {file}=await this.read(context);if(!file)return {cloud:null,message:'云端暂无听歌统计，本机数据保留'};context.check();this.publish({...this.value,busy:'merge'});await this.options.statistics.merge(file.statistics,context.valid);return {cloud:summarize(file),message:`已合并云端听歌统计（修订 #${file.revision}）；重复下载不重复累加`};});}
}
