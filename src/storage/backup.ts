import { validateLibrary, type LibraryState } from './library.ts';
import {cleanTrack} from './cleanTrack.ts';
import {cleanPlaybackStats,emptyPlaybackStats,type PlaybackStatsState,validatePlaybackStats} from './playbackStats.ts';
export {cleanTrack} from './cleanTrack.ts';
export interface LibraryBackup {format:'nexus-music';version:1;exportedAt:string;library:LibraryState;statistics?:PlaybackStatsState}
function cleanLibrary(library:LibraryState):LibraryState {
  return{version:1,favorites:library.favorites.map(cleanTrack),history:library.history.map(item=>({track:cleanTrack(item.track),playedAt:item.playedAt})),
    playlists:library.playlists.map(playlist=>({id:playlist.id,title:playlist.title,createdAt:playlist.createdAt,updatedAt:playlist.updatedAt,entries:playlist.entries.map(entry=>({id:entry.id,track:cleanTrack(entry.track)}))})),
    ...(library.matches?{matches:library.matches.map(match=>({method:match.method,updatedAt:match.updatedAt,original:cleanTrack(match.original),target:cleanTrack(match.target)}))}:{}),
    ...(library.lyricChoices?{lyricChoices:library.lyricChoices.map(choice=>({original:cleanTrack(choice.original),mode:choice.mode,...(choice.target?{target:cleanTrack(choice.target)}:{}),updatedAt:choice.updatedAt}))}:{})};
}
export function encodeBackup(library:LibraryState,now=new Date(),statistics:PlaybackStatsState=emptyPlaybackStats):string {
  validateLibrary(library);
  return JSON.stringify({format:'nexus-music',version:1,exportedAt:now.toISOString(),library:cleanLibrary(library),statistics:cleanPlaybackStats(statistics)} satisfies LibraryBackup,null,2);
}
export function decodeBackup(text:string):LibraryBackup {
  if(text.length>32*1024*1024)throw new Error('备份文件超过32MiB');
  const value=JSON.parse(text) as LibraryBackup;
  if(value?.format!=='nexus-music'||value.version!==1||typeof value.exportedAt!=='string')throw new Error('无法识别的音枢备份版本');
  validateLibrary(value.library);const statistics=value.statistics===undefined?emptyPlaybackStats:validatePlaybackStats(value.statistics);return{format:'nexus-music',version:1,exportedAt:value.exportedAt,library:cleanLibrary(value.library),statistics:cleanPlaybackStats(statistics)};
}
