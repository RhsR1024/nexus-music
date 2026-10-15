import {PlaybackMessageError} from '../playback/errors.ts';
import type {Repository} from '../storage/repository.ts';
import {InvalidRecordError} from '../storage/recovery.ts';
import type {Track} from '../domain/track.ts';
export type MediaAuthorization='authorized'|'denied'|'restricted'|'notDetermined'|'unavailable';
export interface DeviceMediaRow {id:string;signature:string;title:string;artist:string;album:string;albumArtist?:string;durationMs:number;reason:''|'protected'|'cloud'|'unavailable'}
export interface DeviceMediaNative {
  authorizationStatus():Promise<string>;requestAuthorization():Promise<string>;
  beginQuery(search:string):Promise<{token:string;total:number}>;
  page(token:string,offset:number,limit:number):Promise<DeviceMediaRow[]>;
  resolve(id:string,signature:string):Promise<string>;
  lyrics(id:string,signature:string):Promise<string|null>;
  artwork(id:string,signature:string):Promise<string|null>;
}
interface Snapshot {authorization:MediaAuthorization;tracks:readonly Track[];total:number;busy:boolean;stale:boolean;error:string|null}
const authorization=(value:string):MediaAuthorization=>['authorized','denied','restricted','notDetermined'].includes(value)?value as MediaAuthorization:'unavailable';
const validID=(id:unknown):id is string=>typeof id==='string'&&/^[1-9]\d{0,19}$/.test(id)&&(id.length<20||id<='18446744073709551615');
export class DeviceMediaStore {
  private repository:Pick<Repository,'get'|'put'>;private native:DeviceMediaNative;private uuid:()=>string;
  private namespace='';private revision=0;private token='';private loadingMore=false;
  private listeners=new Set<()=>void>();
  private value:Snapshot={authorization:'notDetermined',tracks:[],total:0,busy:false,stale:false,error:null};
  constructor(repository:Pick<Repository,'get'|'put'>,native:DeviceMediaNative,uuid:()=>string){this.repository=repository;this.native=native;this.uuid=uuid;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<Snapshot>){this.value={...this.value,...patch};for(const listener of this.listeners)listener();}
  async initialize(){const value=await this.repository.get<string>('deviceMedia.namespace.v1');if(value!==undefined&&(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)))throw new InvalidRecordError();this.namespace=value??this.uuid();if(value===undefined)await this.repository.put('deviceMedia.namespace.v1',this.namespace);}
  async checkAuthorization(request=false){
    const generation=++this.revision,status=authorization(await(request?this.native.requestAuthorization():this.native.authorizationStatus()));
    if(generation!==this.revision)return status;
    if(status!=='authorized'){this.token='';this.publish({authorization:status,tracks:[],total:0,busy:false,stale:false,error:null});}
    else this.publish({authorization:status,busy:false});return status;
  }
  invalidate=()=>{this.revision++;this.token='';this.publish({stale:true,busy:false,error:'媒体库已变化，请刷新'});};
  private track(row:DeviceMediaRow):Track {
    if(!validID(row.id)||!/^[a-f0-9]{64}$/.test(row.signature)||typeof row.title!=='string'||typeof row.artist!=='string'||typeof row.album!=='string'||!Number.isFinite(row.durationMs)||row.durationMs<0||!['','protected','cloud','unavailable'].includes(row.reason))throw new Error('设备媒体库返回无效条目');
    return{origin:{kind:'device',libraryId:this.namespace,id:row.id},title:row.title,artist:row.artist,album:row.album,durationMs:row.durationMs,metadata:{albumArtist:row.albumArtist??row.artist,deviceSignature:row.signature,deviceUnavailable:row.reason},qualities:[]};
  }
  private async failed(generation:number,message:string){
    let status:MediaAuthorization='unavailable';try{status=authorization(await this.native.authorizationStatus());}catch{}
    if(generation!==this.revision)return;
    if(status!=='authorized'){this.token='';this.publish({authorization:status,tracks:[],total:0,busy:false,stale:false,error:null});}
    else this.publish({busy:false,stale:true,error:message});
  }
  async search(query=''){
    const generation=++this.revision;this.loadingMore=false;this.publish({busy:true,error:null});
    try{
      const status=authorization(await this.native.authorizationStatus());if(generation!==this.revision)return;
      if(status!=='authorized'){this.token='';this.publish({authorization:status,tracks:[],total:0,busy:false});return;}
      if(!this.namespace)throw new Error('媒体库身份尚未初始化');
      const snapshot=await this.native.beginQuery(query.trim());if(generation!==this.revision)return;
      if(typeof snapshot.token!=='string'||!snapshot.token||!Number.isSafeInteger(snapshot.total)||snapshot.total<0||snapshot.total>50000)throw new Error('设备媒体库快照无效');
      const rows=await this.native.page(snapshot.token,0,100);if(generation!==this.revision)return;
      const tracks=rows.map(row=>this.track(row));if(tracks.length!==Math.min(100,snapshot.total)||new Set(tracks.map(track=>track.origin.id)).size!==tracks.length)throw new Error('设备媒体库分页不完整，请刷新');
      this.token=snapshot.token;this.publish({authorization:status,tracks,total:snapshot.total,busy:false,stale:false});
    }catch{await this.failed(generation,'设备媒体库读取失败，原结果保留，可刷新重试');}
  }
  async loadMore(){
    if(this.loadingMore||this.value.busy||this.value.stale||!this.token||this.value.tracks.length>=this.value.total)return;
    const generation=this.revision,offset=this.value.tracks.length;this.loadingMore=true;this.publish({busy:true,error:null});
    try{
      const rows=await this.native.page(this.token,offset,100);if(generation!==this.revision)return;
      const added=rows.map(row=>this.track(row)),keys=new Set(this.value.tracks.map(track=>track.origin.id));
      if(added.length!==Math.min(100,this.value.total-offset))throw new Error('媒体库分页不完整');
      for(const track of added){if(keys.has(track.origin.id))throw new Error('媒体库分页重复');keys.add(track.origin.id);}
      this.publish({tracks:[...this.value.tracks,...added],busy:false});
    }catch{await this.failed(generation,'媒体库分页已失效，请刷新');}finally{if(generation===this.revision)this.loadingMore=false;}
  }
  private identity(track:Track){if(track.origin.kind!=='device'||track.origin.libraryId!==this.namespace||!validID(track.origin.id)||typeof track.metadata.deviceSignature!=='string'||!/^[a-f0-9]{64}$/.test(track.metadata.deviceSignature))throw new PlaybackMessageError('此媒体库引用不属于当前设备，请从设备媒体库重新选择');return{id:track.origin.id,signature:track.metadata.deviceSignature};}
  async resolve(track:Track){const {id,signature}=this.identity(track);if(authorization(await this.native.authorizationStatus())!=='authorized')throw new PlaybackMessageError('请在设备媒体库中授权访问音乐');let url:string;try{url=await this.native.resolve(id,signature);}catch{throw new PlaybackMessageError('设备音乐受保护、未下载或已变化，请刷新媒体库并检查');}if(!['ipod-library:','file:'].includes(new URL(url).protocol)||authorization(await this.native.authorizationStatus())!=='authorized')throw new PlaybackMessageError('设备媒体已失效或权限已更改，请重新检查媒体库授权');return{url,quality:'original',deviceMedia:true};}
  async lyric(track:Track){const {id,signature}=this.identity(track);return(await this.native.lyrics(id,signature))??'';}
  async cover(track:Track){const {id,signature}=this.identity(track);return(await this.native.artwork(id,signature))??undefined;}
}
