import { validateLibrary, type LibraryState } from './library.ts';
import type {Track} from '../domain/track.ts';
export interface LibraryBackup {format:'nexus-music';version:1;exportedAt:string;library:LibraryState}
function cleanTrack(track:Track):Track {
  const secret=/password|authorization|cookie|api[_-]?key|token|credential|secret|rawscript/i;
  const metadata=JSON.parse(JSON.stringify(track.metadata,(key,value)=>{
    if(secret.test(key))return undefined;
    if(typeof value==='string'&&/^https?:\/\//i.test(value)){
      try{const url=new URL(value);if(url.username||url.password||[...url.searchParams.keys()].some(key=>secret.test(key)||['u','p','t','s'].includes(key)))return undefined;}catch{return undefined;}
    }
    return value;
  })) as Record<string,unknown>;
  return {origin:track.origin.kind==='online'?{kind:'online',platform:track.origin.platform,id:track.origin.id}:{kind:'navidrome',accountId:track.origin.accountId,id:track.origin.id},title:track.title,artist:track.artist,
    ...(track.album!==undefined?{album:track.album}:{}),...(track.durationMs!==undefined?{durationMs:track.durationMs}:{}),
    ...(track.origin.kind==='online'&&track.artwork?{artwork:track.artwork}:{}),metadata,qualities:track.qualities.map(item=>({...item}))};
}
function cleanLibrary(library:LibraryState):LibraryState {
  return{version:1,favorites:library.favorites.map(cleanTrack),history:library.history.map(item=>({track:cleanTrack(item.track),playedAt:item.playedAt})),
    playlists:library.playlists.map(playlist=>({id:playlist.id,title:playlist.title,createdAt:playlist.createdAt,updatedAt:playlist.updatedAt,entries:playlist.entries.map(entry=>({id:entry.id,track:cleanTrack(entry.track)}))}))};
}
export function encodeBackup(library:LibraryState,now=new Date()):string {
  validateLibrary(library);
  return JSON.stringify({format:'nexus-music',version:1,exportedAt:now.toISOString(),library:cleanLibrary(library)} satisfies LibraryBackup,null,2);
}
export function decodeBackup(text:string):LibraryBackup {
  if(text.length>32*1024*1024)throw new Error('备份文件超过32MiB');
  const value=JSON.parse(text) as LibraryBackup;
  if(value?.format!=='nexus-music'||value.version!==1||typeof value.exportedAt!=='string')throw new Error('无法识别的音枢备份版本');
  validateLibrary(value.library);return{...value,library:cleanLibrary(value.library)};
}
