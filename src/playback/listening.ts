import {currentEntry} from '../domain/queue.ts';
import type {Track} from '../domain/track.ts';
import type {PlaybackState} from './controller.ts';
import type {ListeningSample} from '../storage/playbackStats.ts';

// Bind while a native media session belongs to the authoritative queue. Final
// pause/stop events can arrive after the controller has advanced its generation
// or selected the next entry; they still belong to this original track.
export class ListeningSessions {
  private tracks=new Map<string,{track:Track;entryId:string}>();
  sample(event:Record<string,unknown>,state:PlaybackState):ListeningSample|undefined {
    const session=event.listeningSession,ms=event.listenedMs;
    if(typeof session!=='string'||!session||session.length>128||typeof ms!=='number'||!Number.isFinite(ms)||ms<0)return;
    let binding=this.tracks.get(session);
    if(!binding){
      const entry=currentEntry(state.queue);
      if(!entry||event.entryId!==entry.id||event.generation!==state.token?.generation)return;
      binding={track:entry.track,entryId:entry.id};this.tracks.set(session,binding);
      while(this.tracks.size>128)this.tracks.delete(this.tracks.keys().next().value!);
    }
    if(event.entryId!==binding.entryId||!['listening','paused','ended','error','stopped'].includes(String(event.kind)))return;
    return{track:binding.track,session,listenedMs:ms};
  }
}
