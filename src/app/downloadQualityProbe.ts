import type {DownloadResolver} from '../providers/downloadResolver.ts';
import {throwIfAborted} from '../providers/async.ts';
import type {Quality} from '../domain/quality.ts';
import type {Track} from '../domain/track.ts';
/** Routing only: no address, task or playback match is published. */
export function createDownloadQualityProbe(resolver:Pick<DownloadResolver,'resolve'>){
 return async(track:Track,preferredQuality:Quality,signal:AbortSignal)=>{
  throwIfAborted(signal);
  if(track.origin.kind!=='online')throw Error('此来源不提供单次音质检测');
  try{
   const media=await resolver.resolve(track,signal,undefined,preferredQuality);throwIfAborted(signal);
   if(!/^https?:$/.test(new URL(media.url).protocol))throw Error('Invalid route');
   return {requestedQuality:preferredQuality,reportedQuality:media.quality};
  }catch{throwIfAborted(signal);throw Error('未检测到可用解析，请检查音源或更换档位后重试');}
 };
}
