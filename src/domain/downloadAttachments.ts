import type {Track} from './track.ts';
import type {LyricDocument} from '../lyrics/parser.ts';
export interface DownloadAttachments {downloadAttachLyrics:boolean;downloadAttachCover:boolean;downloadAttachMetadata:boolean}
export const downloadAttachmentDefaults:DownloadAttachments={downloadAttachLyrics:false,downloadAttachCover:false,downloadAttachMetadata:false};
export function validateDownloadAttachments(value:DownloadAttachments){for(const key of Object.keys(downloadAttachmentDefaults) as (keyof DownloadAttachments)[])if(typeof value[key]!=='boolean')throw Error('附加文件设置无效');}
function boundedText(text:string,maximum:number){let bytes=0;for(const char of text){const cp=char.codePointAt(0)!;bytes+=cp<=127?1:cp<=2047?2:cp<=65535?3:4;if(bytes>maximum)throw Error('附加文件过大');}return text;}
function cleanLine(text:string){return text.replace(/[\r\n\p{Cc}\p{Cs}]+/gu,' ').trim();}
/** Preserve lyric timestamps; playback offsets and word-level rendering remain local. */
export function exportLRC(document:LyricDocument):string{
 const output:string[]=[];
 if(document.synced){for(const line of document.lines){if(!Number.isFinite(line.startMs)||line.startMs<0||line.startMs>86400000)throw Error('歌词时间无效');const centiseconds=Math.round(line.startMs/10),minutes=Math.floor(centiseconds/6000),seconds=Math.floor(centiseconds%6000/100),fraction=centiseconds%100,stamp=`[${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(fraction).padStart(2,'0')}]`;for(const text of [line.text,line.translation,line.romanization])if(text?.trim())output.push(stamp+cleanLine(text));}}
 else for(const text of document.plain)if(text.trim())output.push(cleanLine(text));
 if(!output.length)throw Error('歌词暂不可用');return boundedText(output.join('\n')+'\n',1048576);
}
/** Explicit public song/file fields only; no origin ids, URLs, headers or metadata bag. */
export function exportAudioMetadata(track:Track,bytes:number,digest:string,container:string):string{
 if(!Number.isSafeInteger(bytes)||bytes<=0||!/^\w{2,5}$/.test(container)||!/^[a-f\d]{32}$/i.test(digest))throw Error('音频元数据无效');
 return boundedText(JSON.stringify({format:'nexus-audio-metadata',version:1,title:track.title,artist:track.artist,...(track.album?{album:track.album}:{}),...(track.durationMs!==undefined?{durationMs:track.durationMs}:{}),audio:{container,bytes,md5:digest.toLowerCase()}},null,2)+'\n',65536);
}
