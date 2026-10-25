import {emptyLocalScan,validateLocalScan,validateAudioLocation,scanLocationKey,type LocalScanState,type AudioLocation,type ScanFolder} from '../domain/localScan.ts';
import {PlaybackMessageError} from '../playback/errors.ts';
import {InvalidRecordError} from './recovery.ts';
import type {Repository} from './repository.ts';
import {validateTrack,type Track} from '../domain/track.ts';
export interface LocalAudioRecord {id:string;extension:string;bytes:number;track:Track;lyric:string;hidden?:boolean;favorite?:boolean;addedAt?:number;modifiedAt?:number;manualImport?:boolean;scanExcluded?:boolean;locations?:readonly AudioLocation[]}
export interface ImportedAudio {id:string;extension:string;bytes:number;durationMs:number;title:string;artist:string;album:string;lyric:string;created:boolean;modifiedAt?:number}
export interface ScannedAudio extends ImportedAudio {location:AudioLocation}
export interface NativeAudioScan {files:readonly ScannedAudio[];folders:readonly ScanFolder[];failed:readonly AudioLocation[]}
export interface LocalAudioNative {
  pickAudioFolder?():Promise<{id:string;name:string}|null>;
  retainAudioFolders?(ids:readonly string[]):Promise<void>;
  scanAudioFolders?(ids:readonly string[],recursive:readonly string[],blocked:readonly string[],minimumSeconds:number):Promise<NativeAudioScan>;
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
  if((record.hidden!==undefined&&typeof record.hidden!=='boolean')||(record.favorite!==undefined&&typeof record.favorite!=='boolean'))throw new Error('本地音频状态无效');
  for(const time of [record.addedAt,record.modifiedAt])if(time!==undefined&&(!Number.isFinite(time)||time<0||time>8640000000000000))throw new Error('本地音频时间无效');
  if((record.manualImport!==undefined&&typeof record.manualImport!=='boolean')||(record.scanExcluded!==undefined&&typeof record.scanExcluded!=='boolean'))throw Error('本地导入来源无效');
  if(record.locations!==undefined){if(!Array.isArray(record.locations)||record.locations.length>1000)throw Error('本地文件位置无效');record.locations.forEach(validateAudioLocation);}
  validateTrack(record.track);if(!Number.isFinite(record.track.durationMs)||!record.track.durationMs||record.track.durationMs<=0)throw new Error('本地音频时长无效');if(record.track.origin.kind!=='local'||record.track.origin.id!==record.id)throw new Error('本地音频身份无效');return record;
}
export class LocalAudioStore {
  private files:readonly LocalAudioRecord[]=[];private visible:readonly LocalAudioRecord[]=[];private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private repository:Pick<Repository,'get'|'put'>;private native:LocalAudioNative;
  constructor(repository:Pick<Repository,'get'|'put'>,native:LocalAudioNative){this.repository=repository;this.native=native;}
  private scan:LocalScanState=emptyLocalScan;
  getScanSnapshot=()=>this.scan;
  getSnapshot=()=>this.visible;
  private persist(files:readonly LocalAudioRecord[],scan=this.scan){return this.repository.put('localAudio.v1',{version:1,files,scan});}
  isFavorite=(id:string)=>this.files.some(file=>file.id===id&&file.favorite===true);
  hiddenCount=()=>this.files.filter(file=>file.hidden&&!file.scanExcluded).length;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(files:readonly LocalAudioRecord[],scan=this.scan) {this.scan=scan;this.files=files;this.visible=files.filter(file=>!file.hidden&&!file.scanExcluded);for(const listener of this.listeners)listener();}
  async restore() {
    const state=await this.repository.get<{version:1;files:LocalAudioRecord[];scan?:LocalScanState}>('localAudio.v1');if(!state)return;
    try{if(state.version!==1||!Array.isArray(state.files)||state.files.length>10000)throw new Error();state.files.forEach(validate);if(new Set(state.files.map(file=>file.id)).size!==state.files.length)throw new Error();this.publish(state.files,validateLocalScan(state.scan??emptyLocalScan));}catch{throw new InvalidRecordError();}
    // Bookmark pruning is maintenance; a source permission failure must not
    // prevent playback of the already owned audio index.
    await this.native.retainAudioFolders?.(this.scan.roots.map(root=>root.id)).catch(()=>{});
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
          const record=validate({id:value.id,extension:value.extension,bytes:value.bytes,lyric:value.lyric,addedAt:Date.now(),modifiedAt:value.modifiedAt,manualImport:true,track:{origin:{kind:'local',id:value.id},title:value.title,artist:value.artist,album:value.album,durationMs:value.durationMs,metadata:{localFormat:value.extension},qualities:[]}});
          const existing=next.find(file=>file.id===record.id);
          if(existing){
            next[next.indexOf(existing)]={...existing,manualImport:true,hidden:false,scanExcluded:false};if(existing.hidden||existing.scanExcluded){added++;}else duplicates++;
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
        await this.persist(next);this.publish(next);return{added,duplicates};
      }catch(error){
        const cleanup=await Promise.allSettled(created.map(file=>this.native.removeAudio(file.id,file.extension)));
        if(cleanup.some(result=>result.status==='rejected'))throw new Error('导入未完成，原曲库保留；临时文件清理失败，请保留数据后重试');throw error;
      }
    });this.tail=run.catch(()=>{});return run;
  }
  async pickFolder(){if(!this.native.pickAudioFolder)throw Error('当前平台不支持文件夹授权');return this.native.pickAudioFolder();}
  saveScanRules(rules:Pick<LocalScanState,'roots'|'minimumSeconds'|'blocked'>){
    const run=this.tail.then(async()=>{const scan=validateLocalScan({...this.scan,...rules,dirty:true});await this.persist(this.files,scan);this.publish(this.files,scan);});this.tail=run.catch(()=>{});return run;
  }
  rescan(){
    const run=this.tail.then(async()=>{
      if(!this.native.scanAudioFolders)throw Error('当前平台不支持文件夹扫描');
      const scan=this.scan,created:ImportedAudio[]=[];
      try{
        const result=await this.native.scanAudioFolders(scan.roots.map(root=>root.id),scan.roots.filter(root=>root.recursive).map(root=>root.id),scan.blocked,scan.minimumSeconds);
        const existingIDs=new Set(this.files.map(file=>file.id));
        for(const file of result.files)if(file.created&&!existingIDs.has(file.id)&&validID(file.id)&&validExtension(file.extension))created.push(file);
        if(!Array.isArray(result.files)||result.files.length>10000||!Array.isArray(result.failed)||result.failed.length>50000)throw Error('扫描返回数据无效');
        const next=this.files.map(file=>({...file,locations:[] as AudioLocation[],scanExcluded:file.manualImport===false,hidden:file.hidden}));
        const byID=new Map(next.map(file=>[file.id,file])),rootIDs=new Set(scan.roots.map(root=>root.id));
        const failures=new Set(result.failed.map(location=>{validateAudioLocation(location);if(!rootIDs.has(location.rootId))throw Error('扫描目录不在授权范围');return scanLocationKey(location);}));
        for(const old of this.files){const retained=old.locations?.filter(location=>failures.has(scanLocationKey(location)))??[];if(retained.length){const target=byID.get(old.id)!;target.locations=retained;target.hidden=old.hidden;target.scanExcluded=old.scanExcluded===true;}}
        for(const file of result.files){
          const location=validateAudioLocation(file.location);if(!rootIDs.has(location.rootId))throw Error('扫描目录不在授权范围');
          const existing=byID.get(file.id);
          if(existing){existing.locations=[...existing.locations.filter(old=>scanLocationKey(old)!==scanLocationKey(location)),location];existing.hidden=false;existing.scanExcluded=false;}
          else{if(next.length>=10000)throw Error('本地曲库最多10000首');next.push(validate({id:file.id,extension:file.extension,bytes:file.bytes,lyric:file.lyric,addedAt:Date.now(),modifiedAt:file.modifiedAt,manualImport:false,scanExcluded:false,locations:[location],hidden:false,track:{origin:{kind:'local',id:file.id},title:file.title,artist:file.artist,album:file.album,durationMs:file.durationMs,metadata:{localFormat:file.extension},qualities:[]}}) as typeof next[number]);byID.set(file.id,next[next.length-1]!);}
        }
        next.forEach(validate);if(result.folders.some(folder=>!rootIDs.has(folder.rootId)))throw Error('扫描目录不在授权范围');const updated=validateLocalScan({...scan,folders:result.folders,dirty:false});await this.persist(next,updated);this.publish(next,updated);
        return{count:this.visible.length,unreadable:result.failed.length};
      }catch(error){await Promise.allSettled(created.map(file=>this.native.removeAudio(file.id,file.extension)));throw error;}
    });this.tail=run.catch(()=>{});return run;
  }
  // Index removal retains owned files and their resolver/lyric references.
  // A single serialized record write makes multi-row actions atomic.
  private changeRecords(patch:(files:readonly LocalAudioRecord[])=>readonly LocalAudioRecord[]) {
    const run=this.tail.then(async()=>{const next=patch(this.files);next.forEach(validate);await this.persist(next);this.publish(next);});
    this.tail=run.catch(()=>{});return run;
  }
  toggleFavorite(id:string) {
    return this.changeRecords(files=>{const item=files.find(file=>file.id===id);if(!item)throw new Error('本地音频已缺失，请重新导入');return files.map(file=>file.id===id?{...file,favorite:!file.favorite}:file);});
  }
  removeFromIndex(ids:readonly string[]) {
    const wanted=new Set(ids);
    return this.changeRecords(files=>files.map(file=>wanted.has(file.id)?{...file,hidden:true}:file));
  }
  restoreIndex() {return this.changeRecords(files=>files.map(file=>file.hidden?{...file,hidden:false}:file));}
  setFavorites(ids:readonly string[],favorite:boolean) {
    const wanted=new Set(ids);
    return this.changeRecords(files=>{
      const available=new Set(files.map(file=>file.id));
      if([...wanted].some(id=>!available.has(id)))throw new Error('本地音频已缺失，请重新导入');
      return files.map(file=>wanted.has(file.id)?{...file,favorite}:file);
    });
  }
  remove(id:string) {
    const run=this.tail.then(async()=>{
      const file=this.files.find(file=>file.id===id);if(!file)return{pendingCleanup:false};
      const token=await this.native.beginRemoval(file.id,file.extension),next=this.files.filter(file=>file.id!==id);
      try{await this.persist(next);}
      catch(error){await this.native.finishRemoval(token,true);throw error;}
      this.publish(next);
      try{await this.native.finishRemoval(token,false);return{pendingCleanup:false};}catch{return{pendingCleanup:true};}
    });this.tail=run.catch(()=>{});return run;
  }
  async resolve(track:Track) {const file=this.files.find(file=>track.origin.kind==='local'&&file.id===track.origin.id);if(!file)throw new PlaybackMessageError('本地音频未导入此设备，请重新导入');try{return{url:await this.native.resolveAudio(file.id,file.extension),quality:'original'};}catch{throw new PlaybackMessageError('本地音频文件不可用，请重新导入或检查存储空间');}}
  lyric(track:Track) {return this.files.find(file=>track.origin.kind==='local'&&file.id===track.origin.id)?.lyric??'';}
  async cover(track:Track) {return track.origin.kind==='local'?(await this.native.localArtwork(track.origin.id))??undefined:undefined;}
}
