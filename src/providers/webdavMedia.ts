import {trackKey,type Track} from '../domain/track.ts';
import {PlaybackMessageError} from '../playback/errors.ts';
import {WebDAVError,davURL,type DAVEntry,type WebDAVAccount} from './webdav.ts';
import type {WebDAVAccounts} from './webdavAccounts.ts';
import type {DAVNativeTransport,DAVMetadata} from './davNativeTransport.ts';
const extensions=new Set(['mp3','flac','aac','m4a','wav','aiff','aif']);
export const isDAVAudio=(entry:DAVEntry)=>!entry.directory&&extensions.has(entry.path.split('.').at(-1)?.toLowerCase()??'');
const strongETag=(entry:DAVEntry)=>entry.etag&&entry.etag.length<=1024&&/^"[\x21\x23-\x7e\x80-\xff]*"$/.test(entry.etag)?entry.etag:undefined;
const version=(entry:DAVEntry)=>strongETag(entry)?JSON.stringify(['etag',entry.etag]):entry.modified&&Number.isFinite(Date.parse(entry.modified))&&entry.bytes!==undefined?JSON.stringify(['modified',entry.modified,entry.bytes]):undefined;
export class WebDAVMedia {
  private accounts:WebDAVAccounts;private native:DAVNativeTransport;private hash:(text:string)=>Promise<string>;
  private epoch=0;private cache=new Map<string,{value:DAVMetadata;bytes:number}>();private cacheBytes=0;private known=new Map<string,DAVEntry>();
  private unversionedRevision=0;
  // A counter alone repeats after process restart and could revive a lyric
  // binding for a different unversioned remote file at the same path.
  private unversionedNamespace=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  private transientVersion(){return `transient:${this.unversionedNamespace}:${++this.unversionedRevision}`;}
  clearMetadata(){this.epoch++;this.cache.clear();this.cacheBytes=0;}
  constructor(accounts:WebDAVAccounts,native:DAVNativeTransport,hash:(text:string)=>Promise<string>){
    this.accounts=accounts;this.native=native;this.hash=hash;let previous=accounts.getSnapshot();
    accounts.subscribe(()=>{const next=accounts.getSnapshot(),changed=new Set(previous.filter(account=>!next.includes(account)).map(account=>account.id));previous=next;this.clearMetadata();
      for(const key of this.known.keys())if(changed.has((JSON.parse(key) as string[])[1]!))this.known.delete(key);
    });
  }
  private account(track:Track){if(track.origin.kind!=='webdav')throw new WebDAVError('configuration');const origin=track.origin;const account=this.accounts.getSnapshot().find(item=>item.id===origin.accountId);if(!account)throw new WebDAVError('missing');davURL(account.url,track.origin.id);return account;}
  private current(account:WebDAVAccount,signal:AbortSignal,epoch:number){if(signal.aborted)throw signal.reason;if(!this.accounts.getSnapshot().includes(account))throw new WebDAVError('missing');}
  private remember(track:Track,entry:DAVEntry){const key=trackKey(track.origin);this.known.delete(key);this.known.set(key,entry);while(this.known.size>200)this.known.delete(this.known.keys().next().value!);}
  track(accountId:string,entry:DAVEntry):Track {
    if(!isDAVAudio(entry))throw new WebDAVError('configuration');
    const track:Track={origin:{kind:'webdav',accountId,id:entry.path},title:entry.name.replace(/\.[^.]+$/,''),artist:'未知艺术家',metadata:{davName:entry.name,davMetadata:'pending',davVersion:version(entry)??''},qualities:[]};
    this.account(track);this.remember(track,entry);return track;
  }
  private async stat(track:Track,signal:AbortSignal){const account=this.account(track),epoch=this.epoch,entry=await(await this.accounts.client(account.id)).stat(track.origin.id,signal);this.current(account,signal,epoch);if(!isDAVAudio(entry))throw new WebDAVError('missing');this.remember(track,entry);return{account,entry,epoch};}
  async inspectTrack(track:Track,signal:AbortSignal):Promise<{track:Track;metadata:DAVMetadata}>{
    const {account,entry,epoch}=await this.stat(track,signal);return this.inspectEntry(track,account,entry,epoch,signal);
  }
  private async inspectEntry(track:Track,account:WebDAVAccount,entry:DAVEntry,epoch:number,signal:AbortSignal):Promise<{track:Track;metadata:DAVMetadata}>{
    const identity=version(entry),key=await this.hash(JSON.stringify(['dav-tags',account.id,entry.path,identity??'unversioned']));
    this.current(account,signal,epoch);let metadata=identity?this.cache.get(key)?.value:undefined;
    if(!metadata){const credentials=await this.accounts.credentials(account.id);this.current(account,signal,epoch);metadata=await this.native.inspect(account.url,entry.path,credentials,key,signal,strongETag(entry)??'');this.current(account,signal,epoch);
      if(!Number.isFinite(metadata.durationMs)||metadata.durationMs<=0)throw new WebDAVError('protocol');
      if(identity&&epoch===this.epoch){const bytes=JSON.stringify(metadata).length*2;this.cacheBytes-=this.cache.get(key)?.bytes??0;this.cache.delete(key);this.cache.set(key,{value:metadata,bytes});this.cacheBytes+=bytes;while(this.cache.size>100||this.cacheBytes>8*1024*1024){const first=this.cache.keys().next().value!;this.cacheBytes-=this.cache.get(first)!.bytes;this.cache.delete(first);}}
    }
    return{track:{...track,title:metadata.title||track.title,artist:metadata.artist||track.artist,album:metadata.album??'',durationMs:metadata.durationMs,metadata:{davName:entry.name,davMetadata:'read',davTitleFromFile:!metadata.title,davVersion:identity??this.transientVersion()}},metadata};
  }
  async resolve(track:Track,signal:AbortSignal){
    try{
      const account=this.account(track),epoch=this.epoch;let entry:DAVEntry,cacheOnly=false;
      try{entry=(await this.stat(track,signal)).entry;}catch(error){const old=this.known.get(trackKey(track.origin));if(!(error instanceof WebDAVError)||error.kind!=='network'||!old||!version(old))throw error;entry=old;cacheOnly=true;}
      let resolvedTrack=track;
      if(!cacheOnly){try{resolvedTrack=(await this.inspectEntry(track,account,entry,epoch,signal)).track;}catch{this.current(account,signal,epoch);resolvedTrack={...track,metadata:{...track.metadata,davVersion:version(entry)??this.transientVersion(),davMetadata:'failed'}};}}
      const credentials=await this.accounts.credentials(account.id);this.current(account,signal,epoch);
      const media=await this.native.prepare(account.url,entry.path,credentials,signal);this.current(account,signal,epoch);
      const identity=version(entry),cacheKey=identity?await this.hash(JSON.stringify(['webdav',account.id,entry.path,identity])):undefined;this.current(account,signal,epoch);
      return{...media,resolvedTrack,quality:'original',...(cacheKey?{cacheKey}:{}),...(cacheOnly?{cacheOnly:true}:{}),...(strongETag(entry)?{headers:{...media.headers,'If-Match':strongETag(entry)!}}:{})};
    }catch(error){if(signal.aborted)throw signal.reason;throw new PlaybackMessageError(error instanceof WebDAVError?error.message:'WebDAV歌曲暂不可用，请刷新目录或重新连接');}
  }
  async lyric(track:Track,signal:AbortSignal){return(await this.inspectTrack(track,signal)).metadata.lyric??'';}
  async cover(track:Track,signal:AbortSignal){return(await this.inspectTrack(track,signal)).metadata.artwork;}
}
