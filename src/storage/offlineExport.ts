import type {DownloadNaming} from '../domain/downloadNaming.ts';
import {audioFileExtension,downloadBasename} from '../domain/downloadNaming.ts';
import type {OfflineDownloadStore} from './offlineDownloads.ts';
export interface StagedAudioExport {uri:string;remove():void}
export interface AudioExportFiles {stage(uri:string,name:(header:Uint8Array)=>string):StagedAudioExport;share(uri:string):Promise<void>}
/** Stage under the index's mutation lock; keep the OS sheet outside it. */
export async function exportOfflineAudio(store:OfflineDownloadStore,id:string,naming:DownloadNaming,files:AudioExportFiles):Promise<void>{
  const staged=await store.prepareExport(id,(record,uri)=>files.stage(uri,header=>`${downloadBasename(record.track,naming)}.${audioFileExtension(header)}`));
  try{await files.share(staged.uri);}finally{staged.remove();}
}
