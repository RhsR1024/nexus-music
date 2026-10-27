import {bounded} from '../providers/async.ts';
import type {DownloadNaming} from '../domain/downloadNaming.ts';
import {audioFileExtension,downloadBasename} from '../domain/downloadNaming.ts';
import {exportAudioMetadata,exportLRC,validateDownloadAttachments,type DownloadAttachments} from '../domain/downloadAttachments.ts';
import type {LyricDocument} from '../lyrics/parser.ts';
import type {Track} from '../domain/track.ts';
import type {OfflineDownloadRecord,OfflineDownloadStore} from './offlineDownloads.ts';
export interface StagedAudioExport {uri:string;remove():void;addText?(name:string,text:string):string;addCover?(name:string,uri:string):Promise<string>}
export interface AudioExportFiles {stage(uri:string,name:(header:Uint8Array)=>string):StagedAudioExport;share(uri:string,additional?:readonly string[]):Promise<void>}
export interface AudioExportAttachments extends DownloadAttachments {signal:AbortSignal;lyrics(track:Track,signal:AbortSignal):Promise<LyricDocument>;cover(track:Track,signal:AbortSignal):Promise<string|undefined>}
export class OfflineExportUnavailable extends Error {constructor(message:string){super(message);this.name='OfflineExportUnavailable';}}
function active(signal?:AbortSignal){if(signal?.aborted)throw Error('导出已取消');}
/** Stage under the index's mutation lock; fetch companion content and show OS UI outside it. */
export async function exportOfflineAudio(store:OfflineDownloadStore,id:string,naming:DownloadNaming,files:AudioExportFiles,attachments?:AudioExportAttachments):Promise<void>{
 if(attachments)validateDownloadAttachments(attachments);active(attachments?.signal);let record:OfflineDownloadRecord|undefined,stem='',container='';
 const staged=await store.prepareExport(id,(value,uri)=>{record=value;stem=downloadBasename(value.track,naming);return files.stage(uri,header=>{container=audioFileExtension(header);return`${stem}.${container}`;});});
 try{
  active(attachments?.signal);const additional:string[]=[];
  if(attachments?.downloadAttachLyrics){if(!staged.addText)throw Error('附加导出不可用');let text:string;try{text=exportLRC(await bounded(child=>attachments.lyrics(record!.track,child),attachments.signal,25000));}catch{active(attachments.signal);throw new OfflineExportUnavailable('歌词暂不可用，未导出。请重试或关闭附加歌词。');}active(attachments.signal);additional.push(staged.addText(stem+'.lrc',text));}
  if(attachments?.downloadAttachCover){if(!staged.addCover)throw Error('附加导出不可用');let cover:string|undefined;try{cover=await bounded(child=>attachments.cover(record!.track,child),attachments.signal,20000);}catch{active(attachments.signal);}active(attachments.signal);if(!cover)throw new OfflineExportUnavailable('封面暂不可用，未导出。请重试或关闭附加封面。');additional.push(await staged.addCover(stem+'.jpg',cover));}
  if(attachments?.downloadAttachMetadata){if(!staged.addText)throw Error('附加导出不可用');additional.push(staged.addText(stem+'.meta.json',exportAudioMetadata(record!.track,record!.bytes,record!.digest!,container)));}
  active(attachments?.signal);await files.share(staged.uri,additional);
 }finally{staged.remove();}
}
