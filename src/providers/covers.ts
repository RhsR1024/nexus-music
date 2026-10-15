import type {Track} from '../domain/track.ts';
import type {SourceRegistry} from './sourceRegistry.ts';
import type {LXTransport} from './multiSourceResolver.ts';
import {makeLXActionRequest} from './lx.ts';
import {bounded,throwIfAborted} from './async.ts';
export interface CoverNative {fetchCover(key:string,url:string):Promise<string>;coverStatistics():Promise<{bytes:number;files:number}>;clearCovers():Promise<void>}
export class CoverService {
  private native:CoverNative;private hash:(value:string)=>Promise<string>;private registry:SourceRegistry;private transport:LXTransport;private privateURL:(account:string,id:string,signal:AbortSignal)=>Promise<string>;
  constructor(native:CoverNative,hash:(value:string)=>Promise<string>,registry:SourceRegistry,transport:LXTransport,privateURL:(account:string,id:string,signal:AbortSignal)=>Promise<string>){this.native=native;this.hash=hash;this.registry=registry;this.transport=transport;this.privateURL=privateURL;}
  statistics(){return this.native.coverStatistics();}
  clear(){return this.native.clearCovers();}
  async loadPrivate(account:string,id:string,signal:AbortSignal){
    const url=await this.privateURL(account,id,signal);return this.fetch(['navidrome',account,id],url,signal);
  }
  async loadTrack(track:Track,signal:AbortSignal):Promise<string|undefined>{
    if(track.origin.kind==='navidrome')return typeof track.metadata.coverArtId==='string'&&track.metadata.coverArtId?this.loadPrivate(track.origin.accountId,track.metadata.coverArtId,signal):undefined;
    if(track.artwork)return this.loadURL(track.artwork,signal);
    const platform=track.origin.platform;
    for(const source of this.registry.getSnapshot()){
      if(!this.registry.isCurrent(source))continue;
      const capability=source.capabilities.find(item=>item.platform===platform&&item.actions.includes('pic'));if(!capability)continue;
      try{const value=await bounded(child=>this.transport.request(source,makeLXActionRequest(track,'pic',capability),child),signal,6000);throwIfAborted(signal);if(!this.registry.isCurrent(source))continue;
        const url=typeof value==='string'?value:value&&typeof value==='object'?(value as {url?:unknown}).url:undefined;
        if(typeof url==='string')return this.fetch(['lx',source.fingerprint??source.revision,platform,track.origin.id],url,signal);
      }catch{throwIfAborted(signal);}
    }
  }
  loadURL(url:string,signal:AbortSignal){return this.fetch(['public',url],url,signal);}
  private async fetch(identity:unknown,url:string,signal:AbortSignal){
    throwIfAborted(signal);const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('封面地址无效');
    const key=await this.hash(JSON.stringify(identity));throwIfAborted(signal);const file=await this.native.fetchCover(key,url);throwIfAborted(signal);return file;
  }
}
