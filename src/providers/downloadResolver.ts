import type {DownloadQualityPreferences} from '../domain/downloadQuality.ts';
import {applyPlatformSourceRouting,type PlatformSourceRouting} from '../domain/platformRouting.ts';
import {qualityOrder,type Quality} from '../domain/quality.ts';
import type {MusicPlatform,OnlinePlatform,Track} from '../domain/track.ts';
import type {MediaResolver,ResolvedMedia} from '../playback/controller.ts';
import type {LibraryStore} from '../storage/library.ts';
import {throwIfAborted} from './async.ts';
import type {CrossPlatformMatcher} from './crossPlatformMatcher.ts';
import {MatchedResolver} from './matchedResolver.ts';
import {MultiSourceResolver,type LXTransport} from './multiSourceResolver.ts';
import type {SourceRegistry} from './sourceRegistry.ts';
export interface DownloadResolver {resolve(track:Track,signal:AbortSignal,excluded?:ReadonlySet<string>,preferredQuality?:Quality):Promise<ResolvedMedia>}
interface DownloadResolutionPreferences extends DownloadQualityPreferences {quality:Quality;autoMatch:boolean;platformSourceRouting?:PlatformSourceRouting}
/** Capture one policy per request; downloads never publish a playback match. */
export function createDownloadResolver(deps:{registry:SourceRegistry;transport:LXTransport;matcher:Pick<CrossPlatformMatcher,'candidates'>;library:Pick<LibraryStore,'matchFor'|'setMatch'>;preferences:()=>DownloadResolutionPreferences;enrich:(track:Track,signal:AbortSignal)=>Promise<Track>;other:MediaResolver;hash:(value:string)=>Promise<string>}):DownloadResolver{
 return {async resolve(track,signal,excluded,preferredQuality){
  if(preferredQuality!==undefined&&!qualityOrder.includes(preferredQuality))throw Error('任务下载音质选择无效');
  if(track.origin.kind!=='online'&&track.origin.kind!=='imported')return deps.other.resolve(track,signal,excluded);
  const snapshot=deps.preferences(),policy={...snapshot.downloadQualities},quality=snapshot.quality,autoMatch=snapshot.autoMatch,routing=snapshot.platformSourceRouting;
  const preference=(platform:MusicPlatform)=>preferredQuality??(platform==='wy'||platform==='tx'||platform==='kw'||platform==='kg'||platform==='mg'?policy[platform]:undefined)??quality;
  const matched=new MatchedResolver({matcher:deps.matcher,library:deps.library,hash:deps.hash,autoMatch:()=>autoMatch,quality:()=>quality,qualityForPlatform:preference,persistMatches:false,
   available:(originPlatform?:MusicPlatform)=>{
    const ready=deps.registry.getSnapshot().filter(source=>deps.registry.isCurrent(source));
    const platforms=new Set<OnlinePlatform>();
    for(const platform of ['wy','tx','kw','kg','mg'] as const){
     const routed=applyPlatformSourceRouting(ready,platform,routing,originPlatform);
     if(routed.some(source=>source.capabilities.some(capability=>capability.platform===platform&&capability.actions.includes('musicUrl')))){
      platforms.add(platform);
     }
    }
    return [...platforms];
   },
   router:{resolve:async(target,child,blocked,scope,trace,originPlatform)=>{
    let playable=target;try{playable=await deps.enrich(target,child);}catch{throwIfAborted(child);}
    const selected=playable.origin.kind==='online'?preference(playable.origin.platform):quality;
    return new MultiSourceResolver(deps.registry,deps.transport,()=>selected,8000,{sourceRouting:()=>routing??{}}).resolve(playable,child,blocked,scope,trace,originPlatform);
   }}});
  return matched.resolve(track,signal,excluded);
 }};
}
