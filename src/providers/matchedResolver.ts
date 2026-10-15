import {trackKey,type OnlinePlatform,type Track} from '../domain/track.ts';
import {fallbackQualities,type Quality} from '../domain/quality.ts';
import {scoreCandidate} from '../domain/matching.ts';
import type {LibraryStore} from '../storage/library.ts';
import {throwIfAborted} from './async.ts';
import type {CrossPlatformMatcher} from './crossPlatformMatcher.ts';
import type {MultiSourceResolver,RoutedMedia} from './multiSourceResolver.ts';
export class MatchedResolver {
  private deps:{matcher:Pick<CrossPlatformMatcher,'candidates'>;library:Pick<LibraryStore,'matchFor'|'setMatch'>;router:Pick<MultiSourceResolver,'resolve'>;available:()=>readonly OnlinePlatform[];quality:()=>Quality;hash:(value:string)=>Promise<string>};
  constructor(deps:MatchedResolver['deps']){this.deps=deps;}
  async resolve(original:Track,signal:AbortSignal,excluded:ReadonlySet<string>=new Set()):Promise<RoutedMedia>{
    throwIfAborted(signal);if(original.origin.kind!=='imported')throw new Error('匹配只处理导入歌曲');
    const platforms=this.deps.available();if(!platforms.length)throw new Error('请先启用LX音源，再匹配其他平台播放');
    const saved=this.deps.library.matchFor(original);let targets:Track[]=[];
    if(saved?.method==='manual')targets=[saved.target];
    else{
      const result=await this.deps.matcher.candidates(original,signal,platforms),selected=new Set<OnlinePlatform>();
      if(saved&&saved.target.origin.kind==='online'&&platforms.includes(saved.target.origin.platform)&&scoreCandidate(original,saved.target).automatic){targets.push(saved.target);selected.add(saved.target.origin.platform);}
      for(const candidate of result.items){const target=candidate.track;if(candidate.automatic&&target.origin.kind==='online'&&!selected.has(target.origin.platform)){targets.push(target);selected.add(target.origin.platform);}}
      if(!targets.length)throw new Error(result.failedPlatforms.length===platforms.length?'平台搜索暂不可用，请重试匹配':'未找到可靠匹配，请打开“匹配歌曲”确认候选');
    }
    // Quality is the outer loop: a lower-quality match must not win before
    // another platform has tried the user's preferred quality.
    for(const quality of fallbackQualities(this.deps.quality()))for(const target of targets){
      throwIfAborted(signal);const targetKey=trackKey(target.origin),blocked=new Set<string>();
      for(const value of excluded){try{const pair=JSON.parse(value);if(Array.isArray(pair)&&pair[0]===targetKey&&typeof pair[1]==='string')blocked.add(pair[1]);}catch{/* Unknown attempts are not applied to another song. */}}
      let media:RoutedMedia;
      try{media=await this.deps.router.resolve(target,signal,blocked,[quality]);}catch{throwIfAborted(signal);continue;}
      throwIfAborted(signal);const cacheKey=await this.deps.hash(JSON.stringify([trackKey(original.origin),targetKey,media.sourceFingerprint,media.quality]));throwIfAborted(signal);
      if(!saved||trackKey(saved.target.origin)!==targetKey){try{await this.deps.library.setMatch(original,target,saved?.method==='manual'?'manual':'automatic');}catch{throw new Error('无法保存匹配结果，请检查存储空间后重试');}}
      throwIfAborted(signal);return{...media,routeKey:JSON.stringify([targetKey,media.routeKey]),cacheKey};
    }
    throw new Error('匹配歌曲的可用音源均失败，请重试或更换匹配');
  }
}
