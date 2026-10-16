import {InvalidRecordError} from './recovery.ts';
import type {Repository} from './repository.ts';
import {decodeBackup,type LibraryBackup} from './backup.ts';
import {davURL,WebDAVError,type WebDAVAccount,type WebDAVCredentials,type WebDAVClient} from '../providers/webdav.ts';
export const backupDirectory='nexus-music-backups/';
export interface BackupConfig {version:1;accountId:string;directory:string}
export interface RemoteBackup {path:string;name:string;bytes?:number;modified?:string;etag?:string;digest?:string}
export interface BackupPreview {file:RemoteBackup;backup:LibraryBackup;digestVerified:boolean}
export interface CloudBackupState {config?:BackupConfig;files:readonly RemoteBackup[];preview?:BackupPreview;busy:null|'configure'|'list'|'upload'|'download'|'restore';message:string;error:string}
export interface BackupTransport {backup(root:string,path:string,credentials:WebDAVCredentials,operation:'GET'|'PUT'|'MKCOL',body:string,etag:string,signal:AbortSignal):Promise<{status:number;body:string;etag:string;bytes:number}>}
interface Accounts {getSnapshot():readonly WebDAVAccount[];subscribe(listener:()=>void):()=>void;credentials(id:string):Promise<WebDAVCredentials>;client(id:string):Promise<Pick<WebDAVClient,'list'|'stat'>>}
interface Options {repository:Pick<Repository,'get'|'put'>;accounts:Accounts;transport:BackupTransport;hash:(text:string)=>Promise<string>;uuid:()=>string;snapshot:(date:Date)=>string;restore:(backup:LibraryBackup)=>Promise<void>;now?:()=>Date}
export class CloudBackupError extends Error {
  constructor(kind:'config'|'connection'|'format'|'digest'|'collision'|'changed'|'http'|'busy'){
    super({config:'备份目录无效，请使用连接根目录内的相对文件夹',connection:'备份连接已移除或更改，请重新选择并刷新',format:'备份格式或大小不受支持，本机数据未更改',digest:'备份摘要不一致，本机数据未更改',collision:'远端同名版本已存在，本次未覆盖，请刷新后重试',changed:'远端备份版本已变化，请刷新列表后重新预览',http:'云备份请求未完成，请检查权限、空间与网络后重试',busy:'正在处理备份，请等待或取消当前请求'}[kind]);
  }
}
export function normalizeBackupDirectory(raw:string):string {
  const text=raw.trim()||backupDirectory;
  if(text.length>1024||text.startsWith('/')||/^[a-z][a-z\d+.-]*:/i.test(text)||/[\u0000-\u001f\u007f\\]/.test(text))throw new CloudBackupError('config');
  const parts=text.replace(/\/+$/,'').split('/');
  if(parts.length>32||parts.some(part=>!part||part==='.'||part==='..'||part.length>128))throw new CloudBackupError('config');
  const directory=parts.map(encodeURIComponent).join('/')+'/';
  try{davURL('https://fixture.invalid/',directory);}catch{throw new CloudBackupError('config');}return directory;
}
export function strongBackupETag(value:string|undefined):string {
  return value&&value.length<=8192&&value.length+(value.match(/[\x80-\xff]/g)?.length??0)<=8192&&/^"[\x21\x23-\x7e\x80-\xff]*"$/.test(value)?value:'';
}
function digestForName(name:string){return /^nexus-\d{8}T\d{9}Z-[a-f\d]{32}-([a-f\d]{64})\.json$/i.exec(name)?.[1]?.toLowerCase();}
function checkHTTP(status:number,accepted:readonly number[],precondition:'collision'|'changed'='changed'){if(status===401||status===403)throw new WebDAVError('authorization');if(status===412)throw new CloudBackupError(precondition);if(!accepted.includes(status))throw new CloudBackupError('http');}
export class WebDAVBackups {
  private value:CloudBackupState={files:[],busy:null,message:'',error:''};private listeners=new Set<()=>void>();private options:Options;
  private generation=0;private request?:AbortController;private account?:WebDAVAccount;
  constructor(options:Options){this.options=options;options.accounts.subscribe(()=>{
    const current=this.selectedAccount();if(current===this.account)return;this.account=current;
    if(this.value.busy==='restore'||this.value.busy==='configure')return;
    this.cancel();this.publish({...this.value,files:[],preview:undefined,error:this.value.config?'备份连接已移除或更新，请重新选择或刷新':''});
  });}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:CloudBackupState){this.value=value;for(const listener of this.listeners)listener();}
  private selectedAccount(){return this.options.accounts.getSnapshot().find(account=>account.id===this.value.config?.accountId);}
  async restore(){
    const saved=await this.options.repository.get<BackupConfig>('webdav.backup.v1');if(!saved)return;
    try{if(saved.version!==1||typeof saved.accountId!=='string'||!/^[a-f\d]{64}$/.test(saved.accountId)||typeof saved.directory!=='string'||!saved.directory||normalizeBackupDirectory(decodeURIComponent(saved.directory))!==saved.directory)throw new Error();}
    catch{throw new InvalidRecordError();}
    this.publish({...this.value,config:{version:1,accountId:saved.accountId,directory:saved.directory}});this.account=this.selectedAccount();
  }
  configure(accountId:string,rawDirectory:string){
    if(this.value.busy) return Promise.reject(new CloudBackupError('busy'));
    let directory:string;try{directory=normalizeBackupDirectory(rawDirectory);if(!this.options.accounts.getSnapshot().some(account=>account.id===accountId))throw new CloudBackupError('connection');}catch(error){return Promise.reject(error);}
    this.cancel();const config:BackupConfig={version:1,accountId,directory};this.publish({...this.value,busy:'configure',error:'',message:''});
    return this.options.repository.put('webdav.backup.v1',config).then(()=>{this.publish({config,files:[],busy:null,message:'备份目录已保存',error:''});this.account=this.selectedAccount();},error=>{this.publish({...this.value,busy:null,error:'备份目录未能保存，请重试'});throw error;});
  }
  cancel(){
    if(this.value.busy==='restore'||this.value.busy==='configure')return false;
    const wasBusy=!!this.value.busy;this.generation++;this.request?.abort();this.request=undefined;
    this.publish({...this.value,busy:null,preview:undefined,...(wasBusy?{message:'已取消；上传若已到达服务器，请刷新列表核对。',error:''}:{})});return true;
  }
  private async run(kind:'list'|'upload'|'download',action:(context:{config:BackupConfig;account:WebDAVAccount;credentials:WebDAVCredentials;client:Pick<WebDAVClient,'list'|'stat'>;signal:AbortSignal;check:()=>void})=>Promise<Partial<CloudBackupState>>){
    if(this.value.busy)throw new CloudBackupError('busy');
    const config=this.value.config,account=this.selectedAccount();if(!config||!account)throw new CloudBackupError('connection');
    const generation=++this.generation,request=new AbortController();this.request=request;this.publish({...this.value,busy:kind,preview:undefined,message:'',error:''});
    const check=()=>{if(request.signal.aborted||generation!==this.generation||config!==this.value.config||account!==this.selectedAccount())throw new CloudBackupError('connection');};
    try{
      const credentials=await this.options.accounts.credentials(account.id);check();const client=await this.options.accounts.client(account.id);check();
      const result=await action({config,account,credentials,client,signal:request.signal,check});check();this.publish({...this.value,...result,busy:null});
    }catch(error){if(generation===this.generation&&!request.signal.aborted)this.publish({...this.value,busy:null,error:error instanceof CloudBackupError||error instanceof WebDAVError?error.message:'云备份未完成，请重试；本机音乐库未更改。'});throw error;}
    finally{if(this.request===request)this.request=undefined;}
  }
  list(){return this.run('list',async({config,client,signal,check})=>{
    try{
      const entries=await client.list(config.directory,signal);check();
      const files=entries.filter(item=>!item.directory&&/\.json$/i.test(item.path)).map(item=>{const name=decodeURIComponent(item.path.slice(config.directory.length));return{path:item.path,name,bytes:item.bytes,modified:item.modified,etag:item.etag,digest:digestForName(name)};});
      files.sort((a,b)=>(Date.parse(b.modified??'')||0)-(Date.parse(a.modified??'')||0)||b.name.localeCompare(a.name));
      return{files,message:`已读取 ${files.length} 个JSON备份`};
    }catch(error){check();if(error instanceof WebDAVError&&error.kind==='missing')return{files:[],message:'备份目录尚不存在，上传时将创建'};throw error;}
  });}
  upload(){return this.run('upload',async({config,account,credentials,client,signal,check})=>{
    const date=(this.options.now??(()=>new Date()))(),body=this.options.snapshot(date);try{decodeBackup(body);}catch{throw new CloudBackupError('format');}
    const digest=await this.options.hash(body);check();const uuid=this.options.uuid().replace(/-/g,'').toLowerCase();if(!/^[a-f\d]{64}$/.test(digest)||!/^[a-f\d]{32}$/.test(uuid))throw new CloudBackupError('format');
    let prefix='';for(const part of config.directory.split('/').filter(Boolean)){
      prefix+=part+'/';let exists=false;
      try{const entry=await client.stat(prefix,signal);check();if(!entry.directory)throw new CloudBackupError('config');exists=true;}catch(error){check();if(!(error instanceof WebDAVError&&error.kind==='missing'))throw error;}
      if(!exists){const created=await this.options.transport.backup(account.url,prefix,credentials,'MKCOL','','',signal);check();checkHTTP(created.status,[201,405]);if(!(await client.stat(prefix,signal)).directory)throw new CloudBackupError('config');check();}
    }
    const name=`nexus-${date.toISOString().replace(/[-:.]/g,'')}-${uuid}-${digest}.json`,root=davURL(account.url,config.directory);
    const written=await this.options.transport.backup(root,name,credentials,'PUT',body,'',signal);check();checkHTTP(written.status,[200,201,204],'collision');
    const read=await this.options.transport.backup(root,name,credentials,'GET','',strongBackupETag(written.etag),signal);check();checkHTTP(read.status,[200]);
    if(await this.options.hash(read.body)!==digest)throw new CloudBackupError('digest');check();try{decodeBackup(read.body);}catch{throw new CloudBackupError('format');}
    const file:RemoteBackup={path:config.directory+name,name,digest,bytes:read.bytes,modified:date.toISOString(),etag:read.etag};
    return{files:[file,...this.value.files.filter(item=>item.path!==file.path)],message:'备份已上传并通过回读摘要与格式校验'};
  });}
  preview(file:RemoteBackup){return this.run('download',async({config,account,credentials,signal,check})=>{
    if(!this.value.files.includes(file)||file.bytes!==undefined&&file.bytes>32*1024*1024)throw new CloudBackupError('format');
    const root=davURL(account.url,config.directory),relative=file.path.slice(config.directory.length);if(!file.path.startsWith(config.directory)||!relative||relative.includes('/'))throw new CloudBackupError('config');
    const read=await this.options.transport.backup(root,relative,credentials,'GET','',strongBackupETag(file.etag),signal);check();checkHTTP(read.status,[200]);
    if(file.digest&&await this.options.hash(read.body)!==file.digest)throw new CloudBackupError('digest');check();let backup:LibraryBackup;
    try{backup=decodeBackup(read.body);}catch{throw new CloudBackupError('format');}
    return{preview:{file,backup,digestVerified:!!file.digest},message:file.digest?'摘要与格式校验通过，请核对预览后恢复':'格式验证通过；此旧命名备份未附内容摘要，请核对预览后恢复'};
  });}
  async restorePreview(){
    if(this.value.busy)throw new CloudBackupError('busy');const preview=this.value.preview;if(!preview)throw new CloudBackupError('format');
    let backup:LibraryBackup;try{backup=decodeBackup(JSON.stringify(preview.backup));}catch{throw new CloudBackupError('format');}
    this.publish({...this.value,busy:'restore',message:'',error:''});const account=this.selectedAccount();
    try{await this.options.restore(backup);this.publish({...this.value,...(account!==this.selectedAccount()?{files:[]}:{}),preview:undefined,busy:null,message:'本机音乐库与播放统计已恢复；音频文件和连接需在此设备另行配置'});}
    catch(error){this.publish({...this.value,busy:null,error:'恢复未确认完成，请检查本机音乐库后重试。'});throw error;}
  }
}
