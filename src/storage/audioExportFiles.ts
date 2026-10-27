import {Share} from 'react-native';
import {requireNativeModule} from 'expo';
interface NativeAudioExport {stageAudioExport(input:string,target:string):Promise<string>;exportAudioFiles(uris:readonly string[]):Promise<boolean>;exportCoverJPEG(input:string,target:string,maximum:number):Promise<string>}
const native=()=>requireNativeModule<NativeAudioExport>('NexusFiles');
import {Directory,File,Paths} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type {AudioExportFiles} from './offlineExport.ts';
export const offlineAudioExportFiles:AudioExportFiles={
  async stage(uri,name){
    const source=new File(uri),handle=source.open();let header:Uint8Array;
    try{header=handle.readBytes(16);}finally{handle.close();}
    const directory=new Directory(Paths.cache,`nexus-audio-export-${Crypto.randomUUID()}`);
    directory.create();try{const target=new File(directory,name(header));await native().stageAudioExport(source.uri,target.uri);return{uri:target.uri,addText:(name,text)=>{const file=new File(directory,name);file.write(text);return file.uri;},addCover:async(name,uri,maximum=512)=>native().exportCoverJPEG(uri,new File(directory,name).uri,maximum),remove:()=>{try{directory.delete();}catch{/* Do not mask the OS sheet result; cache remains disposable. */}}};}catch(error){try{directory.delete();}catch{}throw error;}
  },
  async share(uri,additional){if(additional?.length){await native().exportAudioFiles([uri,...additional]);}else{await Share.share({url:uri,title:'导出离线音频'});}},
};
