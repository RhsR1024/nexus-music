import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import type {LibraryStore,LyricChoice} from '../storage/library.ts';
import type {CrossPlatformMatcher,MatchQuery} from '../providers/crossPlatformMatcher.ts';
import {bounded,throwIfAborted} from '../providers/async.ts';
import {normalizeLyrics,type LyricResult} from './normalize.ts';
import type {LyricService} from './service.ts';
export interface SelectedLyrics extends LyricResult {source:Track;mode:LyricChoice['mode'];warning?:string}
export function lyricRank(value:LyricResult,durationMs?:number):number {
  const doc=value.document,lines=doc.lines.filter(line=>!!line.text.trim()&&!line.background);
  if(!doc.synced||!lines.length)return doc.plain.some(line=>line.trim())?1:0;
  const end=Math.max(...lines.map(line=>Math.max(line.startMs,line.endMs??0,...(line.words??[]).map(word=>word.endMs))));
  if(durationMs&&end>durationMs+Math.max(3000,durationMs*.05))return 0;
  const words=lines.filter(line=>line.words?.length).length;
  return 100+(words?100:0)+words/lines.length*20+lines.filter(line=>line.translation||line.romanization).length/lines.length;
}
export class LyricSelection {
  private raw:Pick<LyricService,'load'>&Partial<Pick<LyricService,'clear'>>;private matcher:Pick<CrossPlatformMatcher,'candidates'>;private library:Pick<LibraryStore,'lyricChoiceFor'|'setLyricChoice'>;private revision=0;
  constructor(raw:Pick<LyricService,'load'>&Partial<Pick<LyricService,'clear'>>,matcher:Pick<CrossPlatformMatcher,'candidates'>,library:Pick<LibraryStore,'lyricChoiceFor'|'setLyricChoice'>){this.raw=raw;this.matcher=matcher;this.library=library;}
  clear(){this.revision++;this.raw.clear?.();}
  candidates(track:Track,signal:AbortSignal,options:MatchQuery={}){return this.matcher.candidates(track,signal,undefined,options);}
  preview(track:Track,signal:AbortSignal){return bounded(child=>this.raw.load(track,child),signal,12000);}
  choose(track:Track,mode:LyricChoice['mode'],target?:Track,signal?:AbortSignal){return this.library.setLyricChoice(track,mode,target,signal);}
  async load(track:Track,signal:AbortSignal):Promise<SelectedLyrics>{
    throwIfAborted(signal);const choice=this.library.lyricChoiceFor(track),mode=choice?.mode??'original',revision=this.revision;
    const finish=(value:SelectedLyrics)=>{throwIfAborted(signal);if(this.revision!==revision||this.library.lyricChoiceFor(track)!==choice)throw new Error('歌词选择已变化');return value;};
    let base:LyricResult=normalizeLyrics(''),baseFailed=false;
    try{base=await this.preview(track,signal);}catch{throwIfAborted(signal);baseFailed=true;}
    const fallback:SelectedLyrics={...base,source:track,mode,...(baseFailed?{warning:'原歌词暂时无法获取，可重试'}:{})};
    if(mode==='original')return finish(fallback);
    if(mode==='manual'&&choice?.target){
      try{const value=await this.preview(choice.target,signal);throwIfAborted(signal);if(lyricRank(value)>0)return finish({...value,source:choice.target,mode});}catch{throwIfAborted(signal);}
      return finish({...fallback,warning:'指定歌词暂不可用，已保留原歌词；可重试或重新选择'});
    }
    if(!['online','imported'].includes(track.origin.kind))return finish(fallback);
    let best=fallback,bestRank=lyricRank(base,track.durationMs),failed=false;
    let tracks:Track[]=[];const values:(LyricResult|undefined)[]=[];
    try{
      await bounded(async child=>{
        const candidates=await this.candidates(track,child);failed=candidates.failedPlatforms.length>0;
        const platforms=new Set<string>();
        tracks=candidates.items.filter(item=>{const origin=item.track.origin;if(!item.automatic||origin.kind!=='online'||platforms.has(origin.platform))return false;platforms.add(origin.platform);return true;}).slice(0,5).map(item=>item.track);let index=0;
        const worker=async()=>{while(index<tracks.length){const position=index++,candidate=tracks[position]!;
          try{const value=await this.preview(candidate,child);throwIfAborted(child);values[position]=value;
          }catch{throwIfAborted(child);failed=true;}
        }};
        await Promise.all([worker(),worker()]);
      },signal,25000);
    }catch{throwIfAborted(signal);failed=true;}
    throwIfAborted(signal);
    for(let index=0;index<tracks.length;index++){const value=values[index];if(!value)continue;const rank=lyricRank(value,track.durationMs);if(rank>bestRank){bestRank=rank;best={...value,source:tracks[index]!,mode};}}
    return finish({...best,...(failed?{warning:trackKey(best.source.origin)===trackKey(track.origin)?'部分歌词候选暂不可用，已保留原歌词':'部分歌词候选暂不可用，使用已取得的最佳结果'}:{})});
  }
}
