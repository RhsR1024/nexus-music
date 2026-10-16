import {originalSignature,scoreCandidate,type MatchScore} from '../domain/matching.ts';
import {trackKey,type OnlinePlatform,type Track} from '../domain/track.ts';
import {bounded,throwIfAborted} from './async.ts';
import type {OnlineProvider} from './online.ts';
export interface MatchCandidate extends MatchScore {track:Track}
export interface MatchCandidates {items:readonly MatchCandidate[];failedPlatforms:readonly OnlinePlatform[]}
export interface MatchQuery {query?:string;page?:number;limit?:number;allowPrivate?:boolean}
const platforms:readonly OnlinePlatform[]=['wy','tx','kw','kg','mg'];
export class CrossPlatformMatcher {
  private provider:Pick<OnlineProvider,'search'>;
  private cache=new Map<string,{expires:number;value:MatchCandidates}>();
  constructor(provider:Pick<OnlineProvider,'search'>){this.provider=provider;}
  async candidates(track:Track,signal:AbortSignal,available:readonly OnlinePlatform[]=platforms,options:MatchQuery={}):Promise<MatchCandidates>{
    throwIfAborted(signal);if(track.origin.kind!=='imported'&&track.origin.kind!=='online'&&options.allowPrivate!==true)throw new Error('此歌曲不支持在线匹配');
    const page=options.page??1,limit=options.limit??8;if(!Number.isInteger(page)||page<1||page>10||!Number.isInteger(limit)||limit<1||limit>25)throw new Error('候选分页参数无效');
    const query=(options.query??`${track.title} ${track.artist}`).trim().slice(0,250);if(!query)throw new Error('原始歌曲缺少名称');
    const selected=platforms.filter(p=>available.includes(p)),originalKey=trackKey(track.origin),key=JSON.stringify([originalSignature(track),selected,query,page,limit]),cached=this.cache.get(key);
    if(cached&&cached.expires>Date.now())return cached.value;
    let index=0;const found=new Map<string,MatchCandidate>(),failed:OnlinePlatform[]=[];
    const worker=async()=>{while(index<selected.length){const platform=selected[index++]!;throwIfAborted(signal);
      try{const result=await bounded(child=>this.provider.search(platform,query,page,child,limit),signal,8000);throwIfAborted(signal);
        for(const target of result.items){if(target.origin.kind!=='online'||target.origin.platform!==platform||trackKey(target.origin)===originalKey)continue;found.set(trackKey(target.origin),{track:target,...scoreCandidate(track,target)});}
      }catch{throwIfAborted(signal);failed.push(platform);}
    }};
    await Promise.all([worker(),worker()]);throwIfAborted(signal);
    const value={items:[...found.values()].sort((a,b)=>b.score-a.score),failedPlatforms:failed};
    if(!failed.length){this.cache.set(key,{expires:Date.now()+600000,value});while(this.cache.size>20)this.cache.delete(this.cache.keys().next().value!);}
    return value;
  }
}
