import {trackRows,viewTrackRows} from './trackList.ts';
import type {Track} from './track.ts';

export const localSortFields=['title','duration','modifiedAt','addedAt','artist','album'] as const;
export type LocalSortField=typeof localSortFields[number];
export type LocalSortDirection='asc'|'desc';
export const localSortLabels:Record<LocalSortField,string>={title:'名称',duration:'时长',modifiedAt:'文件修改时间',addedAt:'添加时间',artist:'艺术家',album:'专辑'};
interface LocalSortable {id:string;track:Track;addedAt?:number;modifiedAt?:number}
const collator=new Intl.Collator('zh-Hans',{numeric:true,sensitivity:'base'});
export function viewLocalAudio<T extends LocalSortable>(files:readonly T[],query:string,field:LocalSortField,direction:LocalSortDirection):T[]{
  const rows=viewTrackRows(trackRows(files.map(file=>file.track),files.map(file=>file.id)),query,'original');
  const sign=direction==='asc'?1:-1;
  return rows.sort((a,b)=>{
    const x=files[a.originalIndex]!,y=files[b.originalIndex]!;
    let order=0;
    if(field==='duration'||field==='modifiedAt'||field==='addedAt'){
      const left=field==='duration'?x.track.durationMs:x[field],right=field==='duration'?y.track.durationMs:y[field];
      // Missing historical timestamps stay unknown, and sort last in either direction.
      const knownLeft=typeof left==='number'&&Number.isFinite(left),knownRight=typeof right==='number'&&Number.isFinite(right);
      if(knownLeft!==knownRight)return knownLeft?-1:1;
      if(knownLeft&&knownRight){
        order=left!-right!;
        if(field==='addedAt'&&order===0)return sign*(a.originalIndex-b.originalIndex);
      }
    }else order=collator.compare(x.track[field]??'',y.track[field]??'');
    return sign*(order||collator.compare(x.track.title,y.track.title))||a.originalIndex-b.originalIndex;
  }).map(row=>files[row.originalIndex]!);
}
