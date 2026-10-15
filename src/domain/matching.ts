import {trackKey,type Track} from './track.ts';
export function originalSignature(track:Track){return JSON.stringify([trackKey(track.origin),track.title,track.artist,track.durationMs??null]);}
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const artists=(value:string)=>value.split(/\s*(?:\/|、|&|,|，|;|；|\bfeat\.?\b)\s*/i).map(normalize).filter(Boolean).sort().join('|');
const edition=(value:string)=>[...value.toLowerCase().matchAll(/live|remix|cover|伴奏|翻唱|纯音乐|现场|dj|instrumental|sped\s*up|slowed/g)].map(v=>v[0].replace(/\s/g,'')).sort().join('|');
export interface MatchScore {score:number;automatic:boolean;reason:string}
export function scoreCandidate(original:Track,target:Track):MatchScore{
  const sameTitle=!!normalize(original.title)&&normalize(original.title)===normalize(target.title);
  const sameArtist=!!artists(original.artist)&&artists(original.artist)===artists(target.artist);
  const sameEdition=edition(original.title)===edition(target.title);
  const known=original.durationMs!==undefined&&target.durationMs!==undefined&&original.durationMs>0&&target.durationMs>0;
  const near=known&&Math.abs(original.durationMs!-target.durationMs!)<=Math.max(3000,original.durationMs!*.02);
  const score=(sameTitle?45:0)+(sameArtist?35:0)+(sameEdition?5:0)+(near?15:0);
  return{score,automatic:sameTitle&&sameArtist&&sameEdition&&near,reason:!sameEdition?'版本标记不同':!sameTitle?'标题需确认':!sameArtist?'歌手需确认':!known?'时长缺失，需确认':!near?'时长差异，需确认':'标题、歌手、版本及时间一致'};
}
