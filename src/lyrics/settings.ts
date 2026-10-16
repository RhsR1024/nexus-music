export type LyricAlignment='auto'|'left'|'center';
export interface LyricStyle {activeColor:string;inactiveColor:string;lineHeight:number;spacing:number;blur:number;emphasis:boolean}
export const lyricStyleDefaults:LyricStyle={activeColor:'auto',inactiveColor:'auto',lineHeight:1.35,spacing:8,blur:0,emphasis:true};
export function normalizeLyricStyle(value:unknown):LyricStyle {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('歌词样式无效');
  const style=value as LyricStyle,color=(value:unknown)=>value==='auto'||typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
  if(!color(style.activeColor)||!color(style.inactiveColor)||typeof style.emphasis!=='boolean'||
    !Number.isFinite(style.lineHeight)||style.lineHeight<1.1||style.lineHeight>2||
    !Number.isFinite(style.spacing)||style.spacing<0||style.spacing>32||!Number.isFinite(style.blur)||style.blur<0||style.blur>4)throw new Error('歌词样式无效');
  return {...style};
}
export function normalizeLyricOffsets(value:unknown):Record<string,number> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('单曲歌词偏移无效');
  const entries=Object.entries(value);if(entries.length>5000)throw new Error('单曲歌词设置过多');
  for(const [key,offset] of entries)if(!key||key.length>512||typeof offset!=='number'||!Number.isFinite(offset)||Math.abs(offset)>600000)throw new Error('单曲歌词偏移无效');
  return Object.fromEntries(entries.filter(([,offset])=>offset!==0));
}
export function lyricOffset(global:number,perTrack:Readonly<Record<string,number>>,key:string) {return global+(Object.prototype.hasOwnProperty.call(perTrack,key)?perTrack[key]!:0);}
