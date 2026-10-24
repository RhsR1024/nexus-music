import type {Track} from '../domain/track.ts';
import type {SourceRegistry} from './sourceRegistry.ts';
import type {LXTransport} from './multiSourceResolver.ts';
import {makeLXActionRequest} from './lx.ts';
import {bounded,throwIfAborted} from './async.ts';
export type CoverSize=512|1024;
export interface CoverNative {fetchCover(key:string,url:string,maxPixelSize:CoverSize):Promise<string>;coverStatistics():Promise<{bytes:number;files:number}>;clearCovers():Promise<void>}
export class CoverService {
  private active=0;private epoch=0;private waiting:{run:()=>void;cancel:()=>void}[]=[];
  private native:CoverNative;private hash:(value:string)=>Promise<string>;private registry:SourceRegistry;private transport:LXTransport;private privateURL:(account:string,id:string,signal:AbortSignal,size:CoverSize)=>Promise<string>;
  private publicCover?: (track:Track,signal:AbortSignal)=>Promise<string|undefined>;
  private localCover?:(track:Track,signal:AbortSignal)=>Promise<string|undefined>;
  constructor(native:CoverNative,hash:(value:string)=>Promise<string>,registry:SourceRegistry,transport:LXTransport,privateURL:(account:string,id:string,signal:AbortSignal,size:CoverSize)=>Promise<string>,localCover?:(track:Track,signal:AbortSignal)=>Promise<string|undefined>,publicCover?:(track:Track,signal:AbortSignal)=>Promise<string|undefined>){this.publicCover=publicCover;this.localCover=localCover;this.native=native;this.hash=hash;this.registry=registry;this.transport=transport;this.privateURL=privateURL;}
  statistics(){return this.native.coverStatistics();}
  clear(){this.epoch++;for(const job of [...this.waiting])job.cancel();return this.native.clearCovers();}
  async loadPrivate(account:string,id:string,signal:AbortSignal,size:CoverSize=512){
    return this.withFallback(size,signal,async side=>{const url=await this.privateURL(account,id,signal,side);return this.fetch(['navidrome',account,id],url,signal,side);});
  }
  async loadTrack(track:Track,signal:AbortSignal,size:CoverSize=512):Promise<string|undefined>{
    if(track.origin.kind==='local'||track.origin.kind==='device'||track.origin.kind==='webdav')return this.localCover?.(track,signal);
    if(track.origin.kind==='navidrome')return typeof track.metadata.coverArtId==='string'&&track.metadata.coverArtId?this.loadPrivate(track.origin.accountId,track.metadata.coverArtId,signal,size):undefined;
    if(track.artwork)return this.loadURL(track.artwork,signal,size);
    if(this.publicCover){
      const epoch=this.epoch;
      try{
        const release=await this.acquire(signal);let url:string|undefined;
        try{url=await bounded(child=>this.publicCover!(track,child),signal,6000);}finally{release();}
        throwIfAborted(signal);if(epoch!==this.epoch)throw new Error('封面请求已过期');
        if(url)return this.loadURL(url,signal,size);
      }catch{throwIfAborted(signal);if(epoch!==this.epoch)throw new Error('封面请求已过期');}
    }
    const platform=track.origin.platform;
    for(const source of this.registry.getSnapshot()){
      if(!this.registry.isCurrent(source))continue;
      const capability=source.capabilities.find(item=>item.platform===platform&&item.actions.includes('pic'));if(!capability)continue;
      try{const value=await bounded(child=>this.transport.request(source,makeLXActionRequest(track,'pic',capability),child),signal,6000);throwIfAborted(signal);if(!this.registry.isCurrent(source))continue;
        const url=typeof value==='string'?value:value&&typeof value==='object'?(value as {url?:unknown}).url:undefined;
        if(typeof url==='string')return this.withFallback(size,signal,side=>this.fetch(['lx',source.fingerprint??source.revision,platform,track.origin.id],url,signal,side));
      }catch{throwIfAborted(signal);}
    }
  }
  loadURL(url:string,signal:AbortSignal,size:CoverSize=512){
    // These public CDNs support TLS but providers sometimes return legacy HTTP.
    // Do not rewrite user/private servers, whose endpoints may be HTTP-only.
    const parsed=new URL(url);
    if(parsed.protocol==='http:'&&!parsed.port&&/^(?:p[1-9]c?\.music\.126\.net|y\.gtimg\.cn|y\.qq\.com)$/i.test(parsed.hostname))parsed.protocol='https:';
    const normalized=parsed.toString();return this.withFallback(size,signal,side=>this.fetch(['public',normalized],normalized,signal,side));
  }
  private async withFallback(size:CoverSize,signal:AbortSignal,load:(side:CoverSize)=>Promise<string>){
    const epoch=this.epoch;
    try{return await load(size);}
    catch(error){throwIfAborted(signal);if(size!==1024||epoch!==this.epoch)throw error;return load(512);}
  }
  private async fetch(identity:unknown,url:string,signal:AbortSignal,size:CoverSize){
    const epoch=this.epoch;
    throwIfAborted(signal);const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('封面地址无效');
    if(size!==512&&size!==1024)throw new Error('封面尺寸无效');
    const key=await this.hash(JSON.stringify(['cover-v2',size,identity]));throwIfAborted(signal);
    const release=await this.acquire(signal);
    try{throwIfAborted(signal);if(epoch!==this.epoch)throw new Error('封面请求已过期');const file=await this.native.fetchCover(key,url,size);throwIfAborted(signal);if(epoch!==this.epoch)throw new Error('封面请求已过期');return file;}
    finally{release();}
  }
  private async acquire(signal:AbortSignal):Promise<()=>void>{
    throwIfAborted(signal);
    if(this.active>=4){
      if(this.waiting.length>=64)throw new Error('封面加载繁忙');
      await new Promise<void>((resolve,reject)=>{
        const remove=()=>{const index=this.waiting.indexOf(job);if(index>=0)this.waiting.splice(index,1);signal.removeEventListener('abort',cancel);};
        const cancel=()=>{remove();reject(new Error('封面请求已取消'));};
        const job={run:()=>{remove();this.active++;resolve();},cancel};
        this.waiting.push(job);signal.addEventListener('abort',cancel,{once:true});
      });
    }else this.active++;
    return()=>{this.active--;this.waiting[0]?.run();};
  }
}
