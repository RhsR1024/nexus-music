import type {LibraryStore} from '../storage/library.ts';
import type {PlaybackController} from './controller.ts';
import {currentEntry} from '../domain/queue.ts';
import {originalSignature} from '../domain/matching.ts';
import type {PreferenceStore} from '../app/preferences.ts';
export function bindManualMatches(library:LibraryStore,controller:PlaybackController){
  let previous=library.getSnapshot();
  return library.subscribe(()=>{
    const next=library.getSnapshot(),track=currentEntry(controller.getSnapshot().queue)?.track,old=previous;previous=next;if(!track)return;
    const signature=originalSignature(track),before=old.matches?.find(item=>originalSignature(item.original)===signature),after=next.matches?.find(item=>originalSignature(item.original)===signature);
    if(before!==after&&(before?.method==='manual'||after?.method==='manual'||(before!==undefined&&after===undefined)))controller.invalidateMediaFor(track);
  });
}
export function bindMatchPolicy(library:LibraryStore,preferences:PreferenceStore,controller:PlaybackController){
  let previous=preferences.getSnapshot().autoMatch;
  return preferences.subscribe(()=>{
    const enabled=preferences.getSnapshot().autoMatch;if(enabled===previous)return;previous=enabled;
    const state=controller.getSnapshot(),track=currentEntry(state.queue)?.track;
    if(track?.origin.kind==='online'&&library.matchFor(track)?.method!=='manual'&&(state.phase==='resolving'||state.media?.matchedTrack))controller.invalidateMediaFor(track);
  });
}
