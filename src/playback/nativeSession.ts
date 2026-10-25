import {SystemMediaSession,type SystemMediaNative} from './systemMedia.ts';
import type {CoverService} from '../providers/covers.ts';
import type {LibraryStore} from '../storage/library.ts';
import {SleepStore} from './sleep.ts';
import { ShuffleNavigator } from '../domain/shuffle.ts';
import { requireNativeModule } from 'expo';
import { currentEntry, emptyQueue, advance, select } from '../domain/queue.ts';
import { PlaybackController, type MediaResolver, type PlaybackToken } from './controller.ts';
import type { PreferenceStore } from '../app/preferences.ts';
import type { Track } from '../domain/track.ts';
import type {ListeningSample} from '../storage/playbackStats.ts';
import {ListeningSessions} from './listening.ts';

interface NativePlayback extends SystemMediaNative {
  load(json: string, id: string, generation: number): Promise<void>;
  play(id: string, generation: number): Promise<void>;
  pause(generation: number): Promise<void>; stop(generation: number): Promise<void>;
  seek(seconds: number, id: string, generation: number): Promise<void>;
  cacheStatistics():Promise<{bytes:number;files:number;limitBytes:number}>;
  clearCache():Promise<void>;configureCache(megabytes:number):Promise<void>;
  configureSleep(seconds:number,finishCurrent:boolean):Promise<Record<string,unknown>>;
  sleepSnapshot():Promise<Record<string,unknown>>;
  configureVolume(value:number):Promise<void>;
  configureRate(value:number):Promise<void>;
  configureEQ(enabled: boolean, gains: readonly number[], preampDB: number): Promise<void>;
  addListener(event: string, callback: (event: Record<string, unknown>) => void): { remove(): void };
}
export class SpectrumStore {
  private value: { bands: readonly number[]; supported: boolean; headroomDB: number } = { bands: [], supported: false, headroomDB: 0 };
  private listeners = new Set<() => void>();
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  update(event: Record<string, unknown>) {
    this.value = { bands: Array.isArray(event.bands) ? event.bands.map(Number) : [], supported: event.supported === true, headroomDB: Number(event.headroomDB) || 0 };
    for (const listener of this.listeners) listener();
  }
}
export function createPlaybackSession(resolver: MediaResolver, preferences: PreferenceStore,system:{covers:CoverService;library:LibraryStore}) {
  const native = requireNativeModule<NativePlayback>('NexusPlayback');
  const systemMedia=new SystemMediaSession(native,system.covers,system.library);
  const spectrum = new SpectrumStore(),sleepStore=new SleepStore();
  // Keep the native player's rate in sync with the persisted preference so a
  // relaunch or a change from the settings page applies immediately.
  let appliedRate=preferences.getSnapshot().rate;
  void native.configureRate(appliedRate).catch(()=>{});
  preferences.subscribe(()=>{const rate=preferences.getSnapshot().rate;if(rate===appliedRate)return;appliedRate=rate;void native.configureRate(rate).catch(()=>{});});
  native.addListener('sleep',sleepStore.update);
  void native.sleepSnapshot().then(sleepStore.update).catch(()=>{});
  const playedListeners=new Set<(track:Track)=>void>();let lastPlayedGeneration=-1;
  const listeningListeners=new Set<(sample:ListeningSample)=>void>();
  const listeningSessions=new ListeningSessions();
  const safe = (work: Promise<unknown>, token?: PlaybackToken) => { void work.catch(() => { if (token) void controller.onError(token); }); };
  const controller = new PlaybackController(resolver, {
    stop: generation => {systemMedia.clear();safe(native.stop(generation));}, pause: generation => safe(native.pause(generation)),
    load: (resolved, token) => {
      const {matchedTrack,...media}=resolved;
      const original=currentEntry(controller.getSnapshot().queue)?.track,track=matchedTrack??original;
      const itemID=`${token.generation}:${token.entryId}`;
      const loaded=native.load(JSON.stringify({ ...media,systemItemID:itemID,systemFavorite:original?system.library.isFavorite(original):false, metadata: track ? { title: track.title, artist: track.artist, album: track.album } : {} }), token.entryId, token.generation);
      if(original&&track)systemMedia.load(original,track,itemID,loaded);
      safe(loaded,token);
    },
    play: token => safe(native.play(token.entryId, token.generation), token),
    seek: (seconds, token) => safe(native.seek(seconds, token.entryId, token.generation), token),
  }, emptyQueue);
  let previousIntent=controller.getSnapshot().intent;
  controller.subscribe(()=>{const intent=controller.getSnapshot().intent;if(intent==='paused'&&previousIntent==='playing')spectrum.update({...spectrum.getSnapshot(),bands:[]});previousIntent=intent;});
  const shuffle=new ShuffleNavigator();
  let lastShuffle=preferences.getSnapshot().shuffle;
  controller.subscribe(()=>{if(preferences.getSnapshot().shuffle)shuffle.observe(controller.getSnapshot().queue);});
  preferences.subscribe(()=>{const enabled=preferences.getSnapshot().shuffle;if(enabled!==lastShuffle){shuffle.reset();lastShuffle=enabled;}if(enabled)shuffle.observe(controller.getSnapshot().queue);});
  const next = (direction: 1 | -1 = 1) => {
    const state = controller.getSnapshot(), settings = preferences.getSnapshot();
    const entries = state.queue.entries;
    let queue = advance(state.queue, settings.repeat === 'all' ? 'all' : 'off');
    if(direction===-1&&state.position>3){controller.seek(0);return;}
    if (settings.shuffle && (direction===-1||!state.queue.priorityIds.length)) {
      queue=shuffle.next(state.queue,settings.repeat==='all',direction);
    } else if (direction === -1) {
      const index = entries.findIndex(entry => entry.id === state.queue.currentId);
      const previous = entries[index-1] ?? (settings.repeat === 'all' ? entries.at(-1) : entries[0]);
      if (previous) queue = select(state.queue, previous.id);
    }
    void controller.play(queue);
  };
  // Sollin E-1272 reference behaviour: while the user wants to play, a track
  // whose resolution fails skips to the next entry along the same repeat and
  // shuffle path, up to a bounded run before surfacing the failure.
  let skipFailures = 0;
  controller.subscribe(()=>{if(controller.getSnapshot().phase==='ready')skipFailures=0;});
  controller.setResolveFailureHandler(queue => {
    if (skipFailures >= 15) { skipFailures = 0; return false; }
    const settings = preferences.getSnapshot();
    let target = advance(queue, settings.repeat === 'all' ? 'all' : 'off');
    if (settings.shuffle && !queue.priorityIds.length) target = shuffle.next(queue, settings.repeat === 'all', 1);
    const nextId = target.currentId;
    if (!nextId || nextId === queue.currentId) { skipFailures = 0; return false; }
    skipFailures++;
    void controller.play(target);
    return true;
  });
  native.addListener('playback', event => {
    const token = { entryId: String(event.entryId), generation: Number(event.generation) };
    const before=controller.getSnapshot();
    const sample=listeningSessions.sample(event,before);
    if(sample)for(const listener of listeningListeners)listener(sample);
    controller.onProgress(token, Number(event.position), Number(event.duration), event.buffering === true);
    const current=controller.getSnapshot();
    if(event.playing===true&&Number(event.position)>0&&current.intent==='playing'&&token.generation===current.token?.generation&&token.entryId===current.queue.currentId&&lastPlayedGeneration!==token.generation){
      lastPlayedGeneration=token.generation;const track=currentEntry(current.queue)?.track;if(track)for(const listener of playedListeners)listener(track);
    }
    if (event.kind === 'ready') controller.onReady(token);
    if (event.kind === 'error') void controller.onError(token);
    if (event.kind === 'ended' && controller.getSnapshot().intent === 'playing' && controller.getSnapshot().token?.generation === token.generation && controller.getSnapshot().queue.currentId === token.entryId) {
      if (preferences.getSnapshot().repeat === 'one') void controller.play(); else next();
    }
  });
  native.addListener('spectrum', event => {
    if (event.generation === controller.getSnapshot().token?.generation && event.entryId === controller.getSnapshot().queue.currentId) spectrum.update(event);
  });
  native.addListener('remote', event => {
    if(event.action==='pause'){if(event.itemID&&!systemMedia.isCurrent(event.itemID))return;}
    else if(!systemMedia.isCurrent(event.itemID))return;
    if (event.action === 'favorite') {void systemMedia.favorite(event).catch(()=>{});}
    else if (event.action === 'pause') controller.pause(Number(event.generation) || 0);
    else if (event.action === 'play') void controller.play();
    else if (event.action === 'toggle') { if (controller.getSnapshot().intent === 'playing') controller.pause(); else void controller.play(); }
    else if (event.action === 'next') next(); else if (event.action === 'previous') next(-1);
    else if (event.action === 'seek') controller.seek(Number(event.seconds));
  });
  const configure = () => { const value = preferences.getSnapshot(); safe(native.configureVolume(value.volume)); safe(native.configureEQ(value.eqEnabled, value.gains, value.preampDB));safe(native.configureCache(value.cacheLimitMB)); };
  preferences.subscribe(configure); configure();
  return { controller, spectrum, next, sleep:{subscribe:sleepStore.subscribe,getSnapshot:sleepStore.getSnapshot,set:async(seconds:number,finishCurrent=false)=>{const value=await native.configureSleep(seconds,finishCurrent);sleepStore.update(value);if(finishCurrent&&value.mode!=='track')throw new Error('当前曲目尚未就绪');}}, cache:{statistics:()=>native.cacheStatistics(),clear:()=>native.clearCache()}, onListening:(listener:(sample:ListeningSample)=>void)=>{listeningListeners.add(listener);return()=>{listeningListeners.delete(listener);};}, onPlayed:(listener:(track:Track)=>void)=>{playedListeners.add(listener);return()=>{playedListeners.delete(listener);};}, setRate:async(value:number)=>{if(!Number.isFinite(value)||value<.5||value>3)throw new Error('播放倍速无效');await preferences.update({rate:value});await native.configureRate(value);} };
}
