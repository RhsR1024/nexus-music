import {davURL,WebDAVError,type WebDAVAccount,type WebDAVClient,type WebDAVCredentials} from '../providers/webdav.ts';
import {normalizeBackupDirectory,strongBackupETag,type BackupTransport} from './webdavBackups.ts';
import {InvalidRecordError} from './recovery.ts';
import type {Repository} from './repository.ts';
import type {LibraryStore} from './library.ts';
import type {MutationQueue} from './mutations.ts';
import {buildSyncState,canonical,decodeSync,encodeSync,libraryFromSync,planSync,resolveSync,syncRecords,SyncError,validateSyncState,type SyncChoices,type SyncPlan,type SyncState} from './multiDeviceSync.ts';

export const syncDirectory='nexus-music-sync/';
export interface SyncConfig {version:1;accountId:string;directory:string}
export interface SyncPreview {plan:SyncPlan;etag?:string;localSignature:string}
export interface WebDAVSyncState {config?:SyncConfig;preview?:SyncPreview;busy:null|'configure'|'preview'|'commit';message:string;error:string}
interface Accounts {getSnapshot():readonly WebDAVAccount[];subscribe(listener:()=>void):()=>void;credentials(id:string):Promise<WebDAVCredentials>;client(id:string):Promise<Pick<WebDAVClient,'stat'>>}
interface Options {repository:Pick<Repository,'get'|'put'|'putMany'>;accounts:Accounts;transport:BackupTransport;library:Pick<LibraryStore,'getSnapshot'|'restore'>;mutations:MutationQueue;uuid:()=>string}
interface SavedState {version:1;deviceId:string;config?:SyncConfig;baselines:SyncState[]}
const space=(value:{accountId:string;directory:string})=>JSON.stringify([value.accountId,value.directory]);
const fileName='library-v1.json';
const key='webdav.sync.v1';
function validateConfig(value:SyncConfig):SyncConfig {
  if(!value||value.version!==1||typeof value.accountId!=='string'||!/^[a-f\d]{64}$/.test(value.accountId)||typeof value.directory!=='string'||!value.directory||normalizeBackupDirectory(decodeURIComponent(value.directory))!==value.directory)throw new SyncError('format');
  return{version:1,accountId:value.accountId,directory:value.directory};
}
function status(value:number,allowed:readonly number[]){if(value===412)throw new SyncError('conflict');if(!allowed.includes(value))throw new SyncError('network');}

export class WebDAVSync {
  private value:WebDAVSyncState={busy:null,message:'',error:''};private listeners=new Set<()=>void>();
  private deviceId:string;private baselines=new Map<string,SyncState>();private generation=0;private request?:AbortController;private account?:WebDAVAccount;
  private options:Options;
  constructor(options:Options){
    this.options=options;this.deviceId=options.uuid();
    options.accounts.subscribe(()=>{
      const account=this.selectedAccount();if(account===this.account)return;this.account=account;
      if(this.value.busy==='configure')return;
      if(this.value.busy==='commit'){this.request?.abort();return;}
      this.cancel();if(this.value.config)this.publish({...this.value,error:new SyncError('account').message});
    });
  }
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:WebDAVSyncState){this.value=value;for(const listener of this.listeners)listener();}
  private selectedAccount(){return this.options.accounts.getSnapshot().find(value=>value.id===this.value.config?.accountId);}
  private saved(config=this.value.config,baselines=this.baselines):SavedState{return{version:1,deviceId:this.deviceId,...(config?{config}:{}),baselines:[...baselines.values()]};}
  async restore(){
    const saved=await this.options.repository.get<SavedState>(key);if(saved===undefined)return;
    try{
      if(!saved||saved.version!==1||typeof saved.deviceId!=='string'||!/^[a-f\d-]{16,64}$/i.test(saved.deviceId)||!Array.isArray(saved.baselines)||saved.baselines.length>8)throw new SyncError('format');
      const config=saved.config?validateConfig(saved.config):undefined,baselines=saved.baselines.map(value=>validateSyncState(value));
      for(const baseline of baselines)validateConfig({version:1,accountId:baseline.accountId,directory:baseline.directory});
      if(new Set(baselines.map(space)).size!==baselines.length)throw new SyncError('format');
      this.deviceId=saved.deviceId;this.baselines=new Map(baselines.map(value=>[space(value),value]));this.publish({...this.value,config});this.account=this.selectedAccount();
    }catch{throw new InvalidRecordError();}
  }
  async configure(accountId:string,rawDirectory:string){
    if(this.value.busy)throw new SyncError('busy');
    const config=validateConfig({version:1,accountId,directory:normalizeBackupDirectory(rawDirectory.trim()||syncDirectory)});
    if(!this.options.accounts.getSnapshot().some(value=>value.id===accountId))throw new SyncError('account');
    if(!this.baselines.has(space(config))&&this.baselines.size>=8)throw new SyncError('capacity');
    this.cancel();this.publish({...this.value,busy:'configure',message:'',error:''});
    try{await this.options.repository.put(key,this.saved(config));this.publish({config,busy:null,message:'同步目录已保存，请读取合并预览',error:''});this.account=this.selectedAccount();}
    catch(error){this.publish({...this.value,busy:null,error:'同步目录未能保存，请重试'});throw error;}
  }
  cancel(){
    if(this.value.busy==='configure'||this.value.busy==='commit')return false;
    this.generation++;this.request?.abort();this.request=undefined;this.publish({...this.value,busy:null,preview:undefined,message:'',error:''});return true;
  }
  private async run(kind:'preview'|'commit',work:(context:{config:SyncConfig;account:WebDAVAccount;credentials:WebDAVCredentials;signal:AbortSignal;check:()=>void})=>Promise<Partial<WebDAVSyncState>>){
    if(this.value.busy)throw new SyncError('busy');
    const config=this.value.config,account=this.selectedAccount();if(!config||!account)throw new SyncError('account');
    const generation=++this.generation,request=new AbortController();this.request=request;
    const check=()=>{if(request.signal.aborted||generation!==this.generation||this.value.config!==config||this.selectedAccount()!==account)throw new SyncError('account');};
    this.publish({...this.value,busy:kind,message:'',error:'',...(kind==='preview'?{preview:undefined}:{})});
    try{
      const credentials=await this.options.accounts.credentials(account.id);check();const result=await work({config,account,credentials,signal:request.signal,check});
      // A committed SQLite transaction must be reported as such even if the
      // connection changes while the in-memory library is being refreshed.
      if(kind==='preview')check();this.publish({...this.value,...result,busy:null});
    }catch(error){if(generation===this.generation)this.publish({...this.value,busy:null,preview:undefined,error:error instanceof SyncError?error.message:'同步未确认完成，请重新预览并核对本机与云端数据'});throw error;}
    finally{if(this.request===request)this.request=undefined;}
  }
  preview(){return this.run('preview',async({config,account,credentials,signal,check})=>{
    const baseline=this.baselines.get(space(config)),snapshot=this.options.library.getSnapshot(),local=buildSyncState(snapshot,this.deviceId,account.id,config.directory,baseline);
    const root=davURL(account.url,config.directory),read=await this.options.transport.backup(root,fileName,credentials,'GET','','',signal);check();
    let remote:SyncState|undefined,etag:string|undefined;
    if(read.status!==404){status(read.status,[200]);etag=strongBackupETag(read.etag);if(!etag)throw new SyncError('format');remote=decodeSync(read.body);}
    const plan=planSync(local,remote,baseline);return{preview:{plan,etag,localSignature:canonical(syncRecords(snapshot))},message:plan.conflicts.length?`发现 ${plan.conflicts.length} 项冲突，请逐项选择后确认`:'合并预览已就绪，确认后同步两端音乐库'};
  });}
  commit(choices:SyncChoices={}){
    const preview=this.value.preview;if(!preview)return Promise.reject(new SyncError('format'));
    // Freeze the user's choices before any asynchronous operation.
    const resolved=resolveSync(preview.plan,{...choices}),body=encodeSync(resolved);
    return this.run('commit',async({config,account,credentials,signal,check})=>{
      return this.options.mutations.run(async()=>{
        check();if(canonical(syncRecords(this.options.library.getSnapshot()))!==preview.localSignature)throw new SyncError('localChanged');
        const client=await this.options.accounts.client(account.id);check();let prefix='';
        for(const part of config.directory.split('/').filter(Boolean)){
          prefix+=part+'/';let exists=false;
          try{const item=await client.stat(prefix,signal);check();if(!item.directory)throw new SyncError('format');exists=true;}
          catch(error){check();if(!(error instanceof WebDAVError&&error.kind==='missing'))throw error;}
          if(!exists){const created=await this.options.transport.backup(account.url,prefix,credentials,'MKCOL','','',signal);check();status(created.status,[201,405]);const item=await client.stat(prefix,signal);check();if(!item.directory)throw new SyncError('format');}
        }
        const root=davURL(account.url,config.directory),written=await this.options.transport.backup(root,fileName,credentials,'PUT',body,preview.etag??'',signal);check();status(written.status,[200,201,204]);
        const etag=strongBackupETag(written.etag);if(!etag)throw new SyncError('format');
        const read=await this.options.transport.backup(root,fileName,credentials,'GET','',etag,signal);check();status(read.status,[200]);
        if(strongBackupETag(read.etag)!==etag||canonical(decodeSync(read.body))!==canonical(resolved))throw new SyncError('conflict');
        const library=libraryFromSync(resolved,this.options.library.getSnapshot()),baselines=new Map(this.baselines);baselines.set(space(config),resolved);
        // Baseline and library are one durable commit. Failed storage keeps the
        // old baseline, allowing the next preview to reconcile an accepted PUT.
        await this.options.repository.putMany([[key,this.saved(config,baselines)],['library.v1',library]]);this.baselines=baselines;
        await this.options.library.restore();return{preview:undefined,message:'同步已完成，音乐库与基线已保存；本机历史、统计和播放队列保留'};
      });
    });
  }
}
