import type {Track} from '../domain/track.ts';
import type {OfflineDownloadStore,OfflineDownloadStatus} from '../storage/offlineDownloads.ts';
export interface DownloadSubmissionEntry{track:Track;id?:string;disposition:'submitted'|'existing'|'failed';status?:OfflineDownloadStatus;reason?:string}
export interface DownloadSubmission{entries:readonly DownloadSubmissionEntry[]}
export function downloadableTrack(track:Track){return track.origin.kind!=='local'&&track.origin.kind!=='device';}
/** User commands admit records, then schedule their existing owner. They do
 * not wait for transfers or change a paused/failed/cancelled existing intent. */
export function createDownloadSubmission(store:Pick<OfflineDownloadStore,'enqueue'|'start'>){
 return async(tracks:readonly Track[]):Promise<DownloadSubmission>=>{
  const entries:DownloadSubmissionEntry[]=[],scheduled=new Set<string>();
  for(const track of [...tracks]){
   if(!downloadableTrack(track)){entries.push({track,disposition:'failed',reason:'此来源无需或不支持另存下载'});continue;}
   try{
    const record=await store.enqueue(track);
    const submitted=record.status==='queued'||record.status==='downloading';
    entries.push({track,id:record.id,status:record.status,disposition:submitted?'submitted':'existing'});
    if(record.status==='queued'&&!scheduled.has(record.id)){scheduled.add(record.id);void Promise.resolve().then(()=>store.start(record.id)).catch(()=>{/* The canonical task remains visible; never claim transfer success. */});}
   }catch{entries.push({track,disposition:'failed',reason:'任务未创建，请检查存储后重试'});}
  }
  return{entries};
 };
}
