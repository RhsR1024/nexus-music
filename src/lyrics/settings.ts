export type LyricAlignment='auto'|'left'|'center';
export function normalizeLyricOffsets(value:unknown):Record<string,number> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('单曲歌词偏移无效');
  const entries=Object.entries(value);if(entries.length>5000)throw new Error('单曲歌词设置过多');
  for(const [key,offset] of entries)if(!key||key.length>512||typeof offset!=='number'||!Number.isFinite(offset)||Math.abs(offset)>600000)throw new Error('单曲歌词偏移无效');
  return Object.fromEntries(entries.filter(([,offset])=>offset!==0));
}
export function lyricOffset(global:number,perTrack:Readonly<Record<string,number>>,key:string) {return global+(Object.prototype.hasOwnProperty.call(perTrack,key)?perTrack[key]!:0);}
