import {trackKey,type Track} from './track.ts';
export type TrackSort='original'|'title'|'artist'|'album'|'durationAsc'|'durationDesc';
export const trackSortOptions:readonly [TrackSort,string][]=[['original','原始顺序'],['title','歌名排序'],['artist','歌手排序'],['album','专辑排序'],['durationAsc','时长从短到长'],['durationDesc','时长从长到短']];
export interface TrackRow {key:string;track:Track;originalIndex:number}
export function trackRows(tracks:readonly Track[],entryIds?:readonly string[]):TrackRow[]{
  if(entryIds&&(entryIds.length!==tracks.length||new Set(entryIds).size!==entryIds.length||entryIds.some(id=>!id)))throw new Error('歌曲条目身份无效');
  const occurrences=new Map<string,number>();
  return tracks.map((track,originalIndex)=>{const identity=trackKey(track.origin),occurrence=occurrences.get(identity)??0;occurrences.set(identity,occurrence+1);return{key:entryIds?.[originalIndex]??JSON.stringify([identity,occurrence]),track,originalIndex};});
}
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().trim();
const collator=new Intl.Collator('zh-Hans',{numeric:true,sensitivity:'base'});
export function viewTrackRows(rows:readonly TrackRow[],query:string,sort:TrackSort):TrackRow[]{
  const words=normalize(query).split(/\s+/).filter(Boolean);
  const result=rows.filter(row=>{if(!words.length)return true;const text=normalize([row.track.title,row.track.artist,row.track.album??''].join(' '));return words.every(word=>text.includes(word));});
  if(sort==='original')return result;
  return result.sort((a,b)=>{
    if(sort==='durationAsc'||sort==='durationDesc'){
      const x=a.track.durationMs,y=b.track.durationMs,knownX=x!==undefined&&x>0,knownY=y!==undefined&&y>0;
      if(knownX!==knownY)return knownX?-1:1;
      return (knownX&&knownY?(x!-y!)*(sort==='durationDesc'?-1:1):0)||a.originalIndex-b.originalIndex;
    }
    return collator.compare(a.track[sort]??'',b.track[sort]??'')||a.originalIndex-b.originalIndex;
  });
}
export function selectedTrackRows(rows:readonly TrackRow[],selected:ReadonlySet<string>):TrackRow[]{return rows.filter(row=>selected.has(row.key));}
