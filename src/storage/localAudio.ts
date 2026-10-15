import {InvalidRecordError} from './recovery.ts';
import type {Repository} from './repository.ts';
import {validateTrack,type Track} from '../domain/track.ts';
export interface LocalAudioRecord {id:string;extension:string;bytes:number;track:Track;lyric:string}
export interface ImportedAudio {id:string;extension:string;bytes:number;durationMs:number;title:string;artist:string;album:string;lyric:string;created:boolean}
export interface LocalAudioNative {
  beginRemoval(id:string,extension_:string):Promise<string>;
  finishRemoval(token:string,restore:boolean):Promise<void>;
  reconcile(files:readonly {id:string;extension:string}[]):Promise<void>;
  importAudio(uri:string,name:string):Promise<ImportedAudio>;
  resolveAudio(id:string,extension_:string):Promise<string>;
  localArtwork(id:string):Promise<string|null>;
  removeAudio(id:string,extension_:string):Promise<void>;
}
const validID=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
const validExtension=(ext:unknown):ext is string=>typeof ext==='string'&&['mp3','flac','aac','m4a','wav','aiff','aif'].includes(ext);
function validate(record:LocalAudioRecord) {
  if(!record||!validID(record.id)||!validExtension(record.extension)||!Number.isSafeInteger(record.bytes)||record.bytes<1||record.bytes>1073741824||typeof record.lyric!=='string'||record.lyric.length>2097152)throw new Error('本地音频记录无效');
  validateTrack(record.track);if(!Number.isFinite(record.track.durationMs)||!record.track.durationMs||record.track.durationMs<=0)throw new Error('本地音频时长无效');if(record.track.origin.kind!=='local'||record.track.origin.id!==record.id)throw new Error('本地音频身份无效');return record;
}
export class LocalAudioStore {
  private files:readonly LocalAudioRecord[]=[];private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private repository:Pick<Repository,'get'|'put'>;private native:LocalAudioNative;
  constructor(repository:Pick<Repository,'get'|'put'>,native:LocalAudioNative){this.repository=repository;this.native=native;}
  getSnapshot=()=>this.files;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(files:readonly LocalAudioRecord[]) {this.files=files;for(const listener of this.listeners)listener();}
  async restore() {
    const state=await this.repository.get<{version:1;files:LocalAudioRecord[]}>('localAudio.v1');if(!state)return;
    try{if(state.version!==1||!Array.isArray(state.files)||state.files.length>10000)throw new Error();state.files.forEach(validate);if(new Set(state.files.map(file=>file.id)).size!==state.files.length)throw new Error();this.files=state.files;}catch{throw new InvalidRecordError();}
    await this.native.reconcile(this.files.map(file=>({id:file.id,extension:file.extension})));
  }
  import(assets:readonly {uri:string;name:string}[]) {
    const run=this.tail.then(async()=>{
      if(!assets.length||assets.length>50)throw new Error('每次请选择1到50个音频文件');
      const next=[...this.files],created:ImportedAudio[]=[];let added=0,duplicates=0;
      try {
        for(const asset of assets) {
          const value=await this.native.importAudio(asset.uri,asset.name);
          if(value.created&&validID(value.id)&&validExtension(value.extension))created.push(value);
          const record=validate({id:value.id,extension:value.extension,bytes:value.bytes,lyric:value.lyric,track:{origin:{kind:'local',id:value.id},title:value.title,artist:value.artist,album:value.album,durationMs:value.durationMs,metadata:{localFormat:value.extension},qualities:[]}});
          const existing=next.find(file=>file.id===record.id);
          if(existing){
            duplicates++;
            if(value.created){
              if(existing.extension!==value.extension){
                // Repair an existing missing reference even when the newly picked
                // file uses another extension for the same content.
                const uri=await this.native.resolveAudio(value.id,value.extension);
                await this.native.importAudio(uri,`${value.id}.${existing.extension}`);
                await this.native.removeAudio(value.id,value.extension);
              }
              // This copy repairs a pre-existing record, so rolling back a later
              // new import must not remove it again.
              created.splice(created.indexOf(value),1);
            }
            continue;
          }
          if(next.length>=10000)throw new Error('本地曲库最多10000首');next.push(record);added++;
        }
        await this.repository.put('localAudio.v1',{version:1,files:next});this.publish(next);return{added,duplicates};
      }catch(error){
        const cleanup=await Promise.allSettled(created.map(file=>this.native.removeAudio(file.id,file.extension)));
        if(cleanup.some(result=>result.status==='rejected'))throw new Error('导入未完成，原曲库保留；临时文件清理失败，请保留数据后重试');throw error;
      }
    });this.tail=run.catch(()=>{});return run;
  }
  remove(id:string) {
    const run=this.tail.then(async()=>{
      const file=this.files.find(file=>file.id===id);if(!file)return{pendingCleanup:false};
      const token=await this.native.beginRemoval(file.id,file.extension),next=this.files.filter(file=>file.id!==id);
      try{await this.repository.put('localAudio.v1',{version:1,files:next});}
      catch(error){await this.native.finishRemoval(token,true);throw error;}
      this.publish(next);
      try{await this.native.finishRemoval(token,false);return{pendingCleanup:false};}catch{return{pendingCleanup:true};}
    });this.tail=run.catch(()=>{});return run;
  }
  async resolve(track:Track) {const file=this.files.find(file=>track.origin.kind==='local'&&file.id===track.origin.id);if(!file)throw new Error('本地音频未导入此设备，请重新导入');return{url:await this.native.resolveAudio(file.id,file.extension),quality:'original'};}
  lyric(track:Track) {return this.files.find(file=>track.origin.kind==='local'&&file.id===track.origin.id)?.lyric??'';}
  async cover(track:Track) {return track.origin.kind==='local'?(await this.native.localArtwork(track.origin.id))??undefined:undefined;}
}
