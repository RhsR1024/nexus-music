import {isFlowPalette,type FlowPalette} from '../domain/appearance.ts';
import {currentEntry} from '../domain/queue.ts';
import type {Track} from '../domain/track.ts';
import type {PlaybackState} from '../playback/controller.ts';

interface Observable<T> {getSnapshot:()=>T;subscribe:(listener:()=>void)=>()=>void}
interface CoverPreferences {coverColor:boolean;globalBackgroundMotion?:boolean}
export interface CoverTheme {color?:string;uri?:string;flowPalette?:FlowPalette;pending?:true}
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
  private preferences:Observable<CoverPreferences>;
  private covers:{loadTrack(track:Track,signal:AbortSignal):Promise<string|undefined>};
  private colors:{color(uri:string):Promise<string>;flowPalette?(uri:string):Promise<readonly string[]>};
  constructor(playback:Observable<PlaybackState>,preferences:Observable<CoverPreferences>,covers:{loadTrack(track:Track,signal:AbortSignal):Promise<string|undefined>},colors:{color(uri:string):Promise<string>;flowPalette?(uri:string):Promise<readonly string[]>}){
    this.playback=playback;this.preferences=preferences;this.covers=covers;this.colors=colors;
    this.unsubscribes=[playback.subscribe(this.refresh),preferences.subscribe(this.refresh)];this.refresh();
  }
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:CoverTheme){if(value.color===this.value.color&&value.uri===this.value.uri&&value.flowPalette===this.value.flowPalette&&value.pending===this.value.pending)return;this.value=value;for(const listener of this.listeners)listener();}
  private refresh=()=>{
    const state=this.playback.getSnapshot(),entry=currentEntry(state.queue);
    // A stored/manual match is not proof that this recording is playing.
    const preferences=this.preferences.getSnapshot();
    const track=(preferences.coverColor||preferences.globalBackgroundMotion)&&entry?(state.media?.matchedTrack??entry.track):undefined;
    const key=track?JSON.stringify([entry!.id,track.origin,track.artwork,track.metadata.coverArtId,track.metadata.davVersion,track.metadata.deviceSignature]):'';
    if(key===this.key)return;
    this.key=key;this.abort?.abort();this.publish(track?{pending:true}:empty);
    if(!track)return;
    const abort=new AbortController();this.abort=abort;
    void this.covers.loadTrack(track,abort.signal).then(uri=>{
      if(abort.signal.aborted)return;
      if(!uri){this.publish(empty);return;}
      // Flow can show a decoded cover even if palette extraction fails. A late
      // palette must not resurrect an image rejected by the rendered layer.
      this.publish(this.colors.flowPalette?{uri,pending:true}:{uri});
      const apply=(patch:Partial<CoverTheme>)=>{if(!abort.signal.aborted&&this.value.uri===uri)this.publish({...this.value,...patch});};
      const finishPalette=(patch:Partial<CoverTheme>={})=>{
        if(abort.signal.aborted||this.value.uri!==uri)return;
        const {pending,...current}=this.value;this.publish({...current,...patch});
      };
      void this.colors.color(uri).then(color=>{if(/^#[0-9a-f]{6}$/i.test(color))apply({color});}).catch(()=>{});
      if(this.colors.flowPalette)void this.colors.flowPalette(uri).then(value=>{
        finishPalette(isFlowPalette(value)?{flowPalette:Object.freeze([value[0],value[1],value[2]]),...(!this.value.color?{color:value[0]}:{})}:{});
      }).catch(()=>finishPalette());
    }).catch(()=>{if(!abort.signal.aborted)this.publish(empty);});
  };
  // Account/cache/source changes invalidate even an unchanged song identifier.
  invalidate=()=>{this.key='';this.refresh();};
  rejectImage=(uri:string)=>{if(this.value.uri===uri)this.publish(this.value.color?{color:this.value.color}:empty);};
  dispose(){this.abort?.abort();for(const unsubscribe of this.unsubscribes)unsubscribe();this.listeners.clear();}
}
