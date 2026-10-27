import {Share} from 'react-native';
import {requireNativeModule} from 'expo';
interface NativeAudioExport {exportAudioFiles(uris:readonly string[]):Promise<boolean>;exportCoverJPEG(input:string,target:string):Promise<string>}
const native=()=>requireNativeModule<NativeAudioExport>('NexusFiles');
import {Directory,File,Paths} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type {AudioExportFiles} from '../storage/offlineExport.ts';
export const offlineAudioExportFiles:AudioExportFiles={
  stage(uri,name){
    const source=new File(uri),handle=source.open();let header:Uint8Array;
    try{header=handle.readBytes(16);}finally{handle.close();}
    const directory=new Directory(Paths.cache,`nexus-audio-export-${Crypto.randomUUID()}`);
    directory.create();try{const target=new File(directory,name(header));source.copy(target);const digest=source.md5;if(target.size!==source.size||!digest||target.md5!==digest)throw Error('音频副本校验失败');return{uri:target.uri,addText:(name,text)=>{const file=new File(directory,name);file.write(text);return file.uri;},addCover:async(name,uri)=>native().exportCoverJPEG(uri,new File(directory,name).uri),remove:()=>{try{directory.delete();}catch{/* Do not mask the OS sheet result; cache remains disposable. */}}};}catch(error){try{directory.delete();}catch{}throw error;}
  },
  async share(uri,additional){if(additional?.length){await native().exportAudioFiles([uri,...additional]);}else{await Share.share({url:uri,title:'导出离线音频'});}},
};
