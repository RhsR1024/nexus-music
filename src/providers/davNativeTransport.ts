import {WebDAVError,type WebDAVCredentials,type DAVTransport} from './webdav.ts';
export interface DAVPreparedMedia {url:string;redirectRoot:string;headers:Record<string,string>}
export interface DAVMetadata {title?:string;artist?:string;album?:string;durationMs:number;lyric?:string;artwork?:string}
export interface DAVNativeModule {
  propfind(token:string,root:string,path:string,username:string,password:string,depth:number):Promise<{status:number;body:string}>;
  prepare(root:string,path:string,username:string,password:string):Promise<DAVPreparedMedia>;
  inspect(token:string,root:string,path:string,username:string,password:string,key:string,etag:string):Promise<DAVMetadata>;
  cancel(token:string):Promise<void>;
}
export class DAVNativeTransport implements DAVTransport {
  private native:DAVNativeModule;private uuid:()=>string;private active=0;
  private waiting:{signal:AbortSignal;resolve:()=>void;reject:(error:unknown)=>void;abort:()=>void}[]=[];
  constructor(native:DAVNativeModule,uuid:()=>string){this.native=native;this.uuid=uuid;}
  private check(signal:AbortSignal){if(signal.aborted)throw signal.reason;}
  private async run<T>(signal:AbortSignal,invoke:(token:string)=>Promise<T>):Promise<T>{
    this.check(signal);const token=this.uuid(),abort=()=>{void this.native.cancel(token).catch(()=>{});};
    signal.addEventListener('abort',abort,{once:true});
    try{const result=await invoke(token);this.check(signal);return result;}
    catch(error){this.check(signal);if(error instanceof WebDAVError)throw error;const code=(error as {code?:unknown})?.code;throw new WebDAVError(code==='DAV_2'?'scope':code==='DAV_1'?'configuration':code==='DAV_4'?'protocol':'network');}
    finally{signal.removeEventListener('abort',abort);}
  }
  request(root:string,path:string,credentials:WebDAVCredentials,depth:0|1,signal:AbortSignal){return this.run(signal,token=>this.native.propfind(token,root,path,credentials.username,credentials.password,depth));}
  async prepare(root:string,path:string,credentials:WebDAVCredentials,signal:AbortSignal){this.check(signal);const media=await this.native.prepare(root,path,credentials.username,credentials.password);this.check(signal);return media;}
  private async acquire(signal:AbortSignal){
    this.check(signal);if(this.active<2){this.active++;return;}
    if(this.waiting.length>=64)throw new WebDAVError('network');
    await new Promise<void>((resolve,reject)=>{
      const job={signal,resolve,reject,abort:()=>{const index=this.waiting.indexOf(job);if(index>=0){this.waiting.splice(index,1);reject(signal.reason);}}};
      this.waiting.push(job);signal.addEventListener('abort',job.abort,{once:true});
    });
  }
  private release(){const job=this.waiting.shift();if(job){job.signal.removeEventListener('abort',job.abort);job.resolve();}else this.active--;}
  async inspect(root:string,path:string,credentials:WebDAVCredentials,key:string,signal:AbortSignal,etag=''){
    await this.acquire(signal);
    try{this.check(signal);return await this.run(signal,token=>this.native.inspect(token,root,path,credentials.username,credentials.password,key,etag));}
    finally{this.release();}
  }
}
