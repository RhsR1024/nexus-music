import {originalSignature,scoreCandidate,type MatchScore} from '../domain/matching.ts';
import {trackKey,type OnlinePlatform,type Track} from '../domain/track.ts';
import {throwIfAborted} from './async.ts';
import type {OnlineProvider} from './online.ts';
export interface MatchCandidate extends MatchScore {track:Track}
export interface MatchCandidates {items:readonly MatchCandidate[];failedPlatforms:readonly OnlinePlatform[]}
const platforms:readonly OnlinePlatform[]=['wy','tx','kw','kg','mg'];
export class CrossPlatformMatcher {
  private provider:Pick<OnlineProvider,'search'>;
  private cache=new Map<string,{expires:number;value:MatchCandidates}>();
  constructor(provider:Pick<OnlineProvider,'search'>){this.provider=provider;}
  async candidates(track:Track,signal:AbortSignal,available:readonly OnlinePlatform[]=platforms):Promise<MatchCandidates>{
    throwIfAborted(signal);if(track.origin.kind!=='imported')throw new Error('此歌曲不需要跨平台匹配');
    const selected=platforms.filter(p=>available.includes(p)),key=JSON.stringify([originalSignature(track),selected]),cached=this.cache.get(key);
    if(cached&&cached.expires>Date.now())return cached.value;
    const query=`${track.title} ${track.artist}`.trim().slice(0,250);if(!query)throw new Error('原始歌曲缺少名称');
    let index=0;const found=new Map<string,MatchCandidate>(),failed:OnlinePlatform[]=[];
    const worker=async()=>{while(index<selected.length){const platform=selected[index++]!;throwIfAborted(signal);
      try{const page=await this.provider.search(platform,query,1,signal,8);throwIfAborted(signal);
        for(const target of page.items){if(target.origin.kind!=='online')continue;found.set(trackKey(target.origin),{track:target,...scoreCandidate(track,target)});}
      }catch{throwIfAborted(signal);failed.push(platform);}
    }};
    await Promise.all([worker(),worker()]);throwIfAborted(signal);
    const value={items:[...found.values()].sort((a,b)=>b.score-a.score),failedPlatforms:failed};
    if(!failed.length){this.cache.set(key,{expires:Date.now()+600000,value});while(this.cache.size>20)this.cache.delete(this.cache.keys().next().value!);}
    return value;
  }
}
