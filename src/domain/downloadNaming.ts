import type {Track} from './track.ts';

export interface DownloadNaming {downloadNameOrder:'title-artist'|'artist-title';downloadNameSeparator:string}
export const downloadNamingDefaults:DownloadNaming={downloadNameOrder:'title-artist',downloadNameSeparator:' - '};
export function validateDownloadNaming(value:DownloadNaming):void{
  if(!['title-artist','artist-title'].includes(value.downloadNameOrder)||typeof value.downloadNameSeparator!=='string'||Array.from(value.downloadNameSeparator).length>12||/[\\/:*?"<>|\p{Cc}\p{Cf}\p{Cs}]/u.test(value.downloadNameSeparator))throw Error('命名分隔符最多12个字符，不能包含路径、控制或文件名保留字符');
}
// A portable basename, never a path. Keep metadata in the library untouched.
function component(value:string,fallback:string){return value.normalize('NFC').replace(/[\\/:*?"<>|\p{Cc}\p{Cf}\p{Cs}]/gu,'_').replace(/\s+/gu,' ').trim().replace(/^[. ]+|[. ]+$/g,'')||fallback;}
export function downloadBasename(track:Pick<Track,'title'|'artist'>,naming:DownloadNaming):string{
  validateDownloadNaming(naming);const parts=[component(track.title,'未命名歌曲'),component(track.artist,'未知艺术家')];
  if(naming.downloadNameOrder==='artist-title')parts.reverse();
  let name=parts.join(naming.downloadNameSeparator).replace(/^[. ]+|[. ]+$/g,'');
  // Leave room for the extension, including on Files providers with 255-byte limits.
  let length=0;name=Array.from(name).filter(char=>{const count=((char.codePointAt(0)??0)<=0x7f?1:char.codePointAt(0)!<=0x7ff?2:char.codePointAt(0)!<=0xffff?3:4);if(length+count>180){length=181;return false;}length+=count;return true;}).join('').replace(/[. ]+$/g,'');
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)?`_${name}`:name||'音频';
}
export function audioFileExtension(bytes:Uint8Array):string{
  const text=(start:number,length:number)=>String.fromCharCode(...bytes.slice(start,start+length));
  if(text(0,3)==='ID3')return'mp3';if(text(0,4)==='fLaC')return'flac';
  if(text(0,4)==='RIFF'&&text(8,4)==='WAVE')return'wav';
  if(text(0,4)==='FORM'&&['AIFF','AIFC'].includes(text(8,4)))return'aiff';
  if(text(0,4)==='OggS')return'ogg';if(text(4,4)==='ftyp')return'm4a';
  if(bytes[0]===255&&bytes.length>=2){const next=bytes[1]!;if((next&246)===240)return'aac';if((next&224)===224&&(next&6)!==0)return'mp3';}
  // A quality request or a URL suffix cannot establish the container.
  throw Error('无法识别音频文件格式，未导出');
}
