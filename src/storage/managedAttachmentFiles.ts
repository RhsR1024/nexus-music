import {Directory,File,Paths} from 'expo-file-system';
import {requireNativeModule} from 'expo';
import * as Crypto from 'expo-crypto';
import {validateAttachmentPolicy,type DownloadAttachmentPolicy} from '../domain/downloadAttachmentPolicy.ts';
import type {ManagedAttachmentFiles} from './managedDownloadAttachments.ts';
const names=['lyrics.lrc','cover.jpg','song.meta.json'] as const;
const expected=(p:DownloadAttachmentPolicy)=>names.filter(name=>name==='lyrics.lrc'?p.downloadAttachLyrics:name==='cover.jpg'?p.downloadAttachCover:p.downloadAttachMetadata);
const safe=(name:string)=>/^[a-f0-9-]{8,80}\.(?:audio|mp3|m4a|aac|flac|wav|aiff)$/.test(name);
interface Manifest {version:1;audioMD5:string;policy:DownloadAttachmentPolicy;files:{name:string;bytes:number;md5:string}[]}
export function createManagedAttachmentFiles():ManagedAttachmentFiles{
 const root=new Directory(Paths.document,'offline-attachments');root.create({intermediates:true,idempotent:true});
 const directory=(name:string)=>{if(!safe(name))throw Error('附加文件路径无效');return new Directory(root,name);};
 const valid=(name:string,policy:DownloadAttachmentPolicy,digest:string|undefined)=>{try{
  const dir=directory(name),manifestFile=new File(dir,'manifest.json');if(!manifestFile.exists||manifestFile.size>4096)return false;
  const manifest=JSON.parse(manifestFile.textSync()) as Manifest;if(manifest.version!==1||!digest||manifest.audioMD5!==digest.toLowerCase()||JSON.stringify(validateAttachmentPolicy(manifest.policy))!==JSON.stringify(policy)||!Array.isArray(manifest.files)||manifest.files.length!==expected(policy).length)return false;
  const wanted=expected(policy);if(new Set(manifest.files.map(x=>x.name)).size!==wanted.length)return false;
  return manifest.files.every(item=>{if(!wanted.includes(item.name as typeof names[number])||!Number.isSafeInteger(item.bytes)||item.bytes<=0||item.bytes>2097152||!/^[a-f\d]{32}$/i.test(item.md5))return false;const file=new File(dir,item.name);return file.exists&&file.size===item.bytes&&file.md5===item.md5;});
 }catch{return false;}};
 // Only folders with our marker, exact UUID name and bounded marker are stale
 // managed preparations. Do not touch simultaneous user export staging.
 for(const value of new Directory(Paths.cache).list())if(value instanceof Directory&&/^nexus-audio-export-[a-fA-F0-9-]{36}$/.test(value.name)){const marker=new File(value,'managed-preparation.json');if(marker.exists&&marker.size<=128){try{if(marker.textSync()==='nexus-managed-attachments-v1')value.delete();}catch{/* Keep unreadable artifacts for later recovery. */}}}
 return{
  valid,
  remove(name){const dir=directory(name);if(dir.exists)dir.delete();},
  prune(retained){for(const value of root.list())if(value instanceof Directory&&safe(value.name)&&!retained.has(value.name))value.delete();},
  usedBytes(){let bytes=0;for(const dir of root.list())if(dir instanceof Directory&&safe(dir.name))for(const file of dir.list())if(file instanceof File)bytes+=file.size;return bytes;},
  lyric:name=>new File(directory(name),'lyrics.lrc').textSync(),cover:name=>new File(directory(name),'cover.jpg').uri,
  stage(audioURI){
   const source=new File(audioURI),audioMD5=source.md5,handle=source.open();let header:Uint8Array;try{header=handle.readBytes(16);}finally{handle.close();}
   const temporary=new Directory(Paths.cache,'nexus-audio-export-'+Crypto.randomUUID());temporary.create();let committed=false;try{new File(temporary,'managed-preparation.json').write('nexus-managed-attachments-v1');}catch(error){temporary.delete();throw error;}
   return{
    header,
    text(name,body){new File(temporary,name).write(body);},
    async cover(uri,maximum){await requireNativeModule<{exportCoverJPEG(input:string,target:string,maximum:number):Promise<string>}>('NexusFiles').exportCoverJPEG(uri,new File(temporary,'cover.jpg').uri,maximum);},
    bytes(){return temporary.list().reduce((sum,file)=>sum+(file instanceof File?file.size:0),2048);},
    commit(name,policy){
     const entries=expected(policy).map(name=>{const file=new File(temporary,name),md5=file.md5;if(!file.exists||file.size<=0||file.size>2097152||!md5)throw Error('附加文件不完整');return{name,bytes:file.size,md5};});
     new File(temporary,'manifest.json').write(JSON.stringify({version:1,audioMD5,policy:validateAttachmentPolicy(policy),files:entries}));
     const destination=directory(name);if(destination.exists)destination.delete();temporary.move(destination);committed=true;try{const marker=new File(destination,'managed-preparation.json');if(marker.exists)marker.delete();}catch{/* A committed bundle remains valid with its ownership marker. */}
    },
    remove(){if(!committed&&temporary.exists)temporary.delete();},
   };
  },
 };
}
