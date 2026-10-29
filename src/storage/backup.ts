import { validateLibrary, type LibraryState } from './library.ts';
import {cleanBackupSettings,type BackupSettings} from './backupSettings.ts';
import type {Preferences} from '../app/preferences.ts';
import {safePublicURL,cleanTrack} from './cleanTrack.ts';
import {cleanCatalogFavorite} from './catalogFavorites.ts';
import {cleanPlaybackStats,emptyPlaybackStats,type PlaybackStatsState,validatePlaybackStats} from './playbackStats.ts';
export {cleanTrack} from './cleanTrack.ts';
export interface LibraryBackup {format:'nexus-music';version:1|2;exportedAt:string;library:LibraryState;statistics?:PlaybackStatsState;settings?:BackupSettings}
export function cleanLibrary(library:LibraryState):LibraryState {
  validateLibrary(library);
  return{version:1,favorites:library.favorites.map(cleanTrack),history:library.history.map(item=>({track:cleanTrack(item.track),playedAt:item.playedAt})),
    playlists:library.playlists.map(playlist=>({id:playlist.id,title:playlist.title,createdAt:playlist.createdAt,updatedAt:playlist.updatedAt,...(playlist.description!==undefined?{description:playlist.description}:{}),...(playlist.coverUrl&&safePublicURL(playlist.coverUrl)?{coverUrl:playlist.coverUrl}:{}),entries:playlist.entries.map(entry=>({id:entry.id,track:cleanTrack(entry.track)}))})),
    ...(library.catalogFavorites?{catalogFavorites:library.catalogFavorites.map(cleanCatalogFavorite)}:{}),
    ...(library.matches?{matches:library.matches.map(match=>({method:match.method,updatedAt:match.updatedAt,original:cleanTrack(match.original),target:cleanTrack(match.target)}))}:{}),
    ...(library.lyricChoices?{lyricChoices:library.lyricChoices.map(choice=>({original:cleanTrack(choice.original),mode:choice.mode,...(choice.target?{target:cleanTrack(choice.target)}:{}),updatedAt:choice.updatedAt}))}:{})};
}
function checkBackupSize(text:string){let bytes=0;if(text.length>32*1024*1024)throw Error('备份文件超过32MiB');for(const point of text){const code=point.codePointAt(0)!;bytes+=code<128?1:code<2048?2:code<65536?3:4;if(bytes>32*1024*1024)throw Error('备份文件超过32MiB');}}
export function encodeBackup(library:LibraryState,now=new Date(),statistics:PlaybackStatsState=emptyPlaybackStats,preferences?:Preferences):string {
  validateLibrary(library);
  // Old readers whitelist v1 library fields and would silently discard saved
  // catalogs. A new envelope makes them reject this restore without data loss.
  const version=library.catalogFavorites?.length?2:1;
  const text=JSON.stringify({format:'nexus-music',version,exportedAt:now.toISOString(),library:cleanLibrary(library),statistics:cleanPlaybackStats(statistics),...(preferences?{settings:cleanBackupSettings({version:1,preferences})}:{})} satisfies LibraryBackup,null,2);checkBackupSize(text);return text;
}
export function decodeBackup(text:string):LibraryBackup {
  checkBackupSize(text);
  const value=JSON.parse(text) as LibraryBackup;
  if(value?.format!=='nexus-music'||![1,2].includes(value.version)||typeof value.exportedAt!=='string')throw new Error('无法识别的音枢备份版本');
  validateLibrary(value.library);const statistics=value.statistics===undefined?emptyPlaybackStats:validatePlaybackStats(value.statistics);return{format:'nexus-music',version:value.version,exportedAt:value.exportedAt,library:cleanLibrary(value.library),statistics:cleanPlaybackStats(statistics),...(value.settings!==undefined?{settings:cleanBackupSettings(value.settings)}:{})};
}
