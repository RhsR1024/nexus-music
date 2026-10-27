import {trackKey,type OnlinePlatform,type Track} from '../domain/track.ts';
import {fallbackQualities,qualityOrder,type Quality} from '../domain/quality.ts';
import {scoreCandidate} from '../domain/matching.ts';
import {PlaybackMessageError} from '../playback/errors.ts';
import type {LibraryStore} from '../storage/library.ts';
import {throwIfAborted} from './async.ts';
import type {CrossPlatformMatcher} from './crossPlatformMatcher.ts';
import type {MultiSourceResolver,RoutedMedia} from './multiSourceResolver.ts';
export class MatchedResolver {
  private deps:{matcher:Pick<CrossPlatformMatcher,'candidates'>;library:Pick<LibraryStore,'matchFor'|'setMatch'>;router:Pick<MultiSourceResolver,'resolve'>;available:()=>readonly OnlinePlatform[];quality:()=>Quality;qualityForPlatform?:(platform:OnlinePlatform)=>Quality;persistMatches?:boolean;autoMatch?:()=>boolean;hash:(value:string)=>Promise<string>};
  constructor(deps:MatchedResolver['deps']){this.deps=deps;}
  async resolve(original:Track,signal:AbortSignal,excluded:ReadonlySet<string>=new Set()):Promise<RoutedMedia>{
    throwIfAborted(signal);if(original.origin.kind!=='imported'&&original.origin.kind!=='online')throw new Error('此来源不支持在线匹配');
    const platforms=this.deps.available();if(!platforms.length)throw new PlaybackMessageError('请先启用LX音源，再播放或匹配歌曲');
    let saved=this.deps.library.matchFor(original),targets:Track[]|undefined=saved?.method==='manual'?[saved.target]:undefined;
    const originalKey=trackKey(original.origin),manual=saved?.method==='manual',automatic=original.origin.kind==='imported'||(this.deps.autoMatch?.()??true);
    const current=()=>{throwIfAborted(signal);if(this.deps.library.matchFor(original)!==saved)throw new PlaybackMessageError('匹配设置已更改，请重新播放');};
    const candidates=async()=>{
      if(targets)return targets;
      let result:Awaited<ReturnType<CrossPlatformMatcher['candidates']>>;
      try{result=await this.deps.matcher.candidates(original,signal,platforms);}catch{current();result={items:[],failedPlatforms:platforms};}
      const selected=new Set<OnlinePlatform>();
      current();targets=[];
      for(const candidate of result.items){const target=candidate.track;if(candidate.automatic&&target.origin.kind==='online'&&trackKey(target.origin)!==originalKey&&!selected.has(target.origin.platform)){targets.push(target);selected.add(target.origin.platform);}}
      // A cached automatic ID must not hide a freshly discovered replacement
      // from that platform when catalog IDs change or the old recording disappears.
      if(saved&&saved.target.origin.kind==='online'&&platforms.includes(saved.target.origin.platform)&&!selected.has(saved.target.origin.platform)&&scoreCandidate(original,saved.target).automatic)targets.push(saved.target);
      return targets;
    };
    const attempt=async(target:Track,quality:Quality):Promise<RoutedMedia|undefined>=>{
      current();const targetKey=trackKey(target.origin),blocked=new Set<string>();
      if(target.origin.kind!=='online'||!platforms.includes(target.origin.platform))return;
      if(this.deps.qualityForPlatform&&!fallbackQualities(this.deps.qualityForPlatform(target.origin.platform)).includes(quality))return;
      for(const value of excluded){try{const pair=JSON.parse(value);if(Array.isArray(pair)&&pair[0]===targetKey&&typeof pair[1]==='string')blocked.add(pair[1]);}catch{/* A route from another identity must not block this target. */}}
      let media:RoutedMedia;try{media=await this.deps.router.resolve(target,signal,blocked,[quality]);}catch{current();return;}
      current();const cacheKey=await this.deps.hash(JSON.stringify([originalKey,targetKey,media.sourceFingerprint,media.quality]));current();
      if(this.deps.persistMatches!==false&&targetKey!==originalKey&&(!saved||trackKey(saved.target.origin)!==targetKey)){
        try{await this.deps.library.setMatch(original,target,manual?'manual':'automatic',{signal,previous:saved});}
        catch{current();throw new PlaybackMessageError('无法保存匹配结果，请检查存储空间后重试');}
        saved=this.deps.library.matchFor(original);
      }
      current();return{...media,routeKey:JSON.stringify([targetKey,media.routeKey]),cacheKey,...(targetKey!==originalKey?{matchedTrack:target}:{})};
    };
    // Quality is the outer loop: a lower-quality match must not win before
    // another platform has tried the user's preferred quality.
    const qualities=this.deps.qualityForPlatform?qualityOrder.slice(Math.min(...platforms.map(platform=>qualityOrder.indexOf(this.deps.qualityForPlatform!(platform))))):fallbackQualities(this.deps.quality());
    for(const quality of qualities){
      if(!manual&&original.origin.kind==='online'){const media=await attempt(original,quality);if(media)return media;}
      if(manual||automatic){for(const target of await candidates()){const media=await attempt(target,quality);if(media)return media;}}
    }
    throw new PlaybackMessageError(manual?'指定版本的音源不可用，请更换版本或恢复自动匹配':automatic?'原曲与可靠匹配均不可用，请重试或打开“匹配歌曲”确认候选':'原曲音源不可用，可开启自动匹配或手动选择版本');
  }
}
