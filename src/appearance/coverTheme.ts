import {currentEntry} from '../domain/queue.ts';
import type {Track} from '../domain/track.ts';
import type {PlaybackState} from '../playback/controller.ts';

interface Observable<T> {getSnapshot:()=>T;subscribe:(listener:()=>void)=>()=>void}
export interface CoverTheme {color?:string;uri?:string}
const empty:CoverTheme={};

// Observes media identity, never PCM or playback position. The store publishes
// only a changed cover/theme; progress events do not cause a React render.
export class CoverThemeStore {
  private value:CoverTheme=empty;
  private listeners=new Set<()=>void>();
  private abort?:AbortController;
  private key='';
  private unsubscribes:(()=>void)[];
  private playback:Observable<PlaybackState>;
  private preferences:Observable<{coverColor:boolean}>;
  private covers:{loadTrack(track:Track,signal:AbortSignal):Promise<string|undefined>};
  private colors:{color(uri:string):Promise<string>};
  constructor(playback:Observable<PlaybackState>,preferences:Observable<{coverColor:boolean}>,covers:{loadTrack(track:Track,signal:AbortSignal):Promise<string|undefined>},colors:{color(uri:string):Promise<string>}){
    this.playback=playback;this.preferences=preferences;this.covers=covers;this.colors=colors;
    this.unsubscribes=[playback.subscribe(this.refresh),preferences.subscribe(this.refresh)];this.refresh();
  }
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:CoverTheme){if(value.color===this.value.color&&value.uri===this.value.uri)return;this.value=value;for(const listener of this.listeners)listener();}
  private refresh=()=>{
    const state=this.playback.getSnapshot(),entry=currentEntry(state.queue);
    // A stored/manual match is not proof that this recording is playing.
    const track=this.preferences.getSnapshot().coverColor&&entry?(state.media?.matchedTrack??entry.track):undefined;
    const key=track?JSON.stringify([entry!.id,track.origin,track.artwork,track.metadata.coverArtId,track.metadata.davVersion,track.metadata.deviceSignature]):'';
    if(key===this.key)return;
    this.key=key;this.abort?.abort();this.publish(empty);
    if(!track)return;
    const abort=new AbortController();this.abort=abort;
    void this.covers.loadTrack(track,abort.signal).then(async uri=>{
      if(!uri||abort.signal.aborted)return;
      const color=await this.colors.color(uri);
      if(!abort.signal.aborted&&/^#[0-9a-f]{6}$/i.test(color))this.publish({uri,color});
    }).catch(()=>{});
  };
  // Account/cache/source changes invalidate even an unchanged song identifier.
  invalidate=()=>{this.key='';this.refresh();};
  rejectImage=(uri:string)=>{if(this.value.uri===uri)this.publish({color:this.value.color});};
  dispose(){this.abort?.abort();for(const unsubscribe of this.unsubscribes)unsubscribe();this.listeners.clear();}
}
