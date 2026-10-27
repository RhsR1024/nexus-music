import type {DownloadQualityPreferences} from '../domain/downloadQuality.ts';
import type {Quality} from '../domain/quality.ts';
import type {OnlinePlatform,Track} from '../domain/track.ts';
import type {MediaResolver,ResolvedMedia} from '../playback/controller.ts';
import type {LibraryStore} from '../storage/library.ts';
import {throwIfAborted} from './async.ts';
import type {CrossPlatformMatcher} from './crossPlatformMatcher.ts';
import {MatchedResolver} from './matchedResolver.ts';
import {MultiSourceResolver,type LXTransport} from './multiSourceResolver.ts';
import type {SourceRegistry} from './sourceRegistry.ts';
export interface DownloadResolver extends MediaResolver {resolve(track:Track,signal:AbortSignal,excluded?:ReadonlySet<string>):Promise<ResolvedMedia&{requestedQuality?:Quality}>}
interface DownloadResolutionPreferences extends DownloadQualityPreferences {quality:Quality;autoMatch:boolean}
/** Capture one policy per request; downloads never publish a playback match. */
export function createDownloadResolver(deps:{registry:SourceRegistry;transport:LXTransport;matcher:Pick<CrossPlatformMatcher,'candidates'>;library:Pick<LibraryStore,'matchFor'|'setMatch'>;preferences:()=>DownloadResolutionPreferences;enrich:(track:Track,signal:AbortSignal)=>Promise<Track>;other:MediaResolver;hash:(value:string)=>Promise<string>}):DownloadResolver{
 return {async resolve(track,signal,excluded){
  if(track.origin.kind!=='online'&&track.origin.kind!=='imported')return deps.other.resolve(track,signal,excluded);
  const snapshot=deps.preferences(),policy={...snapshot.downloadQualities},quality=snapshot.quality,autoMatch=snapshot.autoMatch;
  const preference=(platform:OnlinePlatform)=>policy[platform]??quality;
  const matched=new MatchedResolver({matcher:deps.matcher,library:deps.library,hash:deps.hash,autoMatch:()=>autoMatch,quality:()=>quality,qualityForPlatform:preference,persistMatches:false,
   available:()=>[...new Set(deps.registry.getSnapshot().filter(source=>deps.registry.isCurrent(source)).flatMap(source=>source.capabilities.filter(capability=>capability.actions.includes('musicUrl')).map(capability=>capability.platform)))],
   router:{resolve:async(target,child,blocked,scope)=>{
    let playable=target;try{playable=await deps.enrich(target,child);}catch{throwIfAborted(child);}
    const selected=playable.origin.kind==='online'?preference(playable.origin.platform):quality;
    return new MultiSourceResolver(deps.registry,deps.transport,()=>selected).resolve(playable,child,blocked,scope);
   }}});
  return matched.resolve(track,signal,excluded);
 }};
}
