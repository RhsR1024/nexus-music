import type {Track} from './track.ts';
import {safePublicURL} from './publicURL.ts';

export function playlistCoverSource(coverUrl:string|undefined, firstTrack?:Track):{url?:string;track?:Track}{
  const candidate=coverUrl?.trim();
  if(candidate&&safePublicURL(candidate))return{url:candidate};
  return{track:firstTrack};
}
