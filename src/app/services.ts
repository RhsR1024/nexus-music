import {PublicComments} from '../providers/comments.ts';
import {bindManualMatches,bindMatchPolicy} from '../playback/matchBinding.ts';
import {SourceHealth} from '../providers/sourceHealth.ts';
import {loadAudioProbe,loadNativeDiagnosticLX} from '../providers/nativeLX.ts';
import {createSourceDiagnostics} from '../providers/sourceDiagnostics.ts';
import {DAVNativeTransport,type DAVNativeModule} from '../providers/davNativeTransport.ts';
import {WebDAVAccounts} from '../providers/webdavAccounts.ts';
import {WebDAVMedia} from '../providers/webdavMedia.ts';
import {AppState} from 'react-native';
import {DeviceMediaStore,type DeviceMediaNative} from '../providers/deviceMedia.ts';
import {requireNativeModule} from 'expo';
import {LocalAudioStore,type LocalAudioNative} from '../storage/localAudio.ts';
import { DiscoveryProvider } from '../providers/discovery.ts';
import {CrossPlatformMatcher} from '../providers/crossPlatformMatcher.ts';
import {MatchedResolver} from '../providers/matchedResolver.ts';
import {QishuiProvider} from '../providers/qishui.ts';
import {throwIfAborted} from '../providers/async.ts';
import { restoreRecord } from '../storage/recovery.ts';
import { FontStore } from '../storage/fonts.ts';
import { LyricService } from '../lyrics/service.ts';
import * as Crypto from 'expo-crypto';
import { openRepository } from '../storage/nativeDatabase.ts';
import {CoverService} from '../providers/covers.ts';
import { decodeKRC, decodeQRC, loadNativeCovers, loadNativeLX } from '../providers/nativeLX.ts';
import { SourceRegistry } from '../providers/sourceRegistry.ts';
import { SourceCatalog } from '../providers/sourceCatalog.ts';
import { PreferenceStore } from './preferences.ts';
import { MultiSourceResolver } from '../providers/multiSourceResolver.ts';
import { createPlaybackSession } from '../playback/nativeSession.ts';
import { OnlineProvider } from '../providers/online.ts';
import { SearchCoordinator } from '../providers/searchCoordinator.ts';
import { makeQueue, append, enqueueNext } from '../domain/queue.ts';
import { trackKey } from '../domain/track.ts';
import type { Track } from '../domain/track.ts';
import type {HTTPClient} from '../providers/http.ts';
import { NavidromeAccounts } from '../providers/navidromeAccounts.ts';
import { NavidromeClient } from '../providers/navidrome.ts';
import { nativeSecrets } from '../storage/nativeSecrets.ts';
import { LibraryStore } from '../storage/library.ts';
import { decodeQueue, type SavedCursor, type SavedQueue } from '../storage/queuePersistence.ts';

export async function createServices(options:{onlineHTTP?:HTTPClient}={}) {
  const repository = await openRepository();
  const recoveryWarnings:string[]=[];
  const restore=async(key:string,label:string,run:()=>Promise<void>)=>{const ok=await restoreRecord(repository,key,run,Crypto.randomUUID);if(!ok)recoveryWarnings.push(`${label}数据无法读取，原始记录已隔离保留，其他功能继续可用。`);return ok;};
  const localAudio=new LocalAudioStore(repository,requireNativeModule<LocalAudioNative>('NexusFiles'));await restore('localAudio.v1','本地音频',()=>localAudio.restore());
  const mediaNative=requireNativeModule<DeviceMediaNative&{addListener(event:string,listener:()=>void):unknown}>('NexusMediaLibrary');
  const deviceMedia=new DeviceMediaStore(repository,mediaNative,Crypto.randomUUID);
  if(!await restore('deviceMedia.namespace.v1','设备媒体库',()=>deviceMedia.initialize()))await deviceMedia.initialize();
  await deviceMedia.checkAuthorization();
  mediaNative.addListener('changed',()=>{void deviceMedia.checkAuthorization().then(status=>{if(status==='authorized')deviceMedia.invalidate();}).catch(deviceMedia.invalidate);});
  const preferences = new PreferenceStore(repository); await restore('preferences.v1','偏好',()=>preferences.restore());
  const hash=(value:string)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,value);
  const davTransport=new DAVNativeTransport(requireNativeModule<DAVNativeModule>('NexusWebDAV'),Crypto.randomUUID);
  const davAccounts=new WebDAVAccounts(repository,nativeSecrets,hash,davTransport);await restore('webdav.accounts.v1','WebDAV',()=>davAccounts.restore());
  const davMedia=new WebDAVMedia(davAccounts,davTransport,hash);
  const accounts=new NavidromeAccounts(repository,nativeSecrets,hash,(account,credentials)=>new NavidromeClient(account,credentials,{md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),salt:Crypto.randomUUID}));
  await restore('navidrome.accounts.v1','连接',()=>accounts.restore());
  const fonts=new FontStore(repository);await restore('fonts.v1','字体',()=>fonts.restore());
  const library=new LibraryStore(repository,Crypto.randomUUID);await restore('library.v1','音乐库',()=>library.restore());
  const nativeLX = loadNativeLX();
  const registry = new SourceRegistry(nativeLX);
  const catalog = new SourceCatalog(registry, repository, script => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, script));
  await restore('sources.v1','音源',()=>catalog.restore());
  void catalog.restoreEnabled();
  const covers=new CoverService(loadNativeCovers(),hash,registry,nativeLX,async(account,id,signal)=>(await accounts.client(account)).mediaURL('getCoverArt',{id,size:512},signal),(track,signal)=>track.origin.kind==='webdav'?davMedia.cover(track,signal):track.origin.kind==='device'?deviceMedia.cover(track):localAudio.cover(track));
  const online = new OnlineProvider({http:options.onlineHTTP, md5: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, value), sha1: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, value), deviceId: Crypto.randomUUID });
  const resolver = new MultiSourceResolver(registry, nativeLX, () => preferences.getSnapshot().quality);
  const matching=new CrossPlatformMatcher(online);
  const comments=new PublicComments(options.onlineHTTP);
  const sourceHealth=new SourceHealth({registry,open:createSourceDiagnostics(catalog,loadNativeDiagnosticLX(),Crypto.randomUUID),online,probe:loadAudioProbe(Crypto.randomUUID)});
  const qishui=new QishuiProvider();
  const matchedResolver=new MatchedResolver({matcher:matching,library,router:{resolve:async(track,signal,excluded,scope)=>{let playable=track;try{playable=await online.enrich(track,signal);}catch{throwIfAborted(signal);}return resolver.resolve(playable,signal,excluded,scope);}},autoMatch:()=>preferences.getSnapshot().autoMatch,quality:()=>preferences.getSnapshot().quality,hash,
    available:()=>[...new Set(registry.getSnapshot().filter(source=>registry.isCurrent(source)).flatMap(source=>source.capabilities.filter(value=>value.actions.includes('musicUrl')).map(value=>value.platform)))]});
  const playback = createPlaybackSession({resolve:async(track,signal,excluded)=>{
    if(track.origin.kind==='webdav')return davMedia.resolve(track,signal);
    if(track.origin.kind==='device')return deviceMedia.resolve(track);
    if(track.origin.kind==='local')return localAudio.resolve(track);
    if(track.origin.kind==='navidrome'){const media=await(await accounts.client(track.origin.accountId)).resolve(track,signal);return {...media,cacheKey:await hash(JSON.stringify([trackKey(track.origin),'original']))};}
    return matchedResolver.resolve(track,signal,excluded);
  }}, preferences);
  bindManualMatches(library,playback.controller);bindMatchPolicy(library,preferences,playback.controller);
  try{
    const saved=await repository.get<SavedQueue>('queue.v1');
    if(saved){playback.controller.setQueue(decodeQueue(saved));const cursor=await repository.get<SavedCursor>('queue.cursor.v1');if(cursor)playback.controller.restoreCursor(cursor.entryId,cursor.seconds);}
  }catch{recoveryWarnings.push('上次播放队列无法恢复，已从暂停状态开始；音乐库仍保留。');}
  deviceMedia.subscribe(()=>{const current=playback.controller.getSnapshot(),entry=current.queue.entries.find(entry=>entry.id===current.queue.currentId);if(entry?.track.origin.kind==='device'&&deviceMedia.getSnapshot().authorization!=='authorized')playback.controller.setQueue({...current.queue,currentId:null,priorityIds:[]});});
  AppState.addEventListener('change',state=>{if(state==='active')void deviceMedia.checkAuthorization().catch(()=>{});});
  let previous=playback.controller.getSnapshot(),lastCursorWrite=Date.now();
  playback.controller.subscribe(()=>{
    const state=playback.controller.getSnapshot(),cursor={entryId:state.queue.currentId,seconds:state.position};
    if(state.queue!==previous.queue){void repository.putMany([['queue.v1',{version:1,queue:state.queue}],['queue.cursor.v1',cursor]]).catch(()=>{});lastCursorWrite=Date.now();}
    else if((state.intent==='paused'&&previous.intent==='playing')||Date.now()-lastCursorWrite>5000){void repository.put('queue.cursor.v1',cursor).catch(()=>{});lastCursorWrite=Date.now();}
    previous=state;
  });
  playback.onPlayed(track=>{void library.played(track).catch(()=>{});});
  accounts.subscribe(()=>{
    const state=playback.controller.getSnapshot(),origin=state.queue.entries.find(item=>item.id===state.queue.currentId)?.track.origin;
    if(origin?.kind==='navidrome'&&!accounts.getSnapshot().some(item=>item.id===origin.accountId)) playback.controller.setQueue({...state.queue,currentId:null,priorityIds:[]});
  });
  const discovery=new DiscoveryProvider(value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value));
  const search = new SearchCoordinator(online);
  const lyrics=new LyricService(registry,nativeLX,async(track,signal)=>{if(track.origin.kind==='webdav')return davMedia.lyric(track,signal);if(track.origin.kind==='device')return deviceMedia.lyric(track);if(track.origin.kind==='local')return localAudio.lyric(track);if(track.origin.kind!=='navidrome')return '';return(await accounts.client(track.origin.accountId)).lyrics(track.origin.id,track.artist,track.title,signal);},undefined,decodeKRC,decodeQRC);
  accounts.subscribe(()=>lyrics.clear());
  let previousDAVAccounts=davAccounts.getSnapshot();
  davAccounts.subscribe(()=>{const old=previousDAVAccounts;previousDAVAccounts=davAccounts.getSnapshot();lyrics.clear();const state=playback.controller.getSnapshot(),origin=state.queue.entries.find(item=>item.id===state.queue.currentId)?.track.origin;if(origin?.kind==='webdav'&&old.find(item=>item.id===origin.accountId)!==previousDAVAccounts.find(item=>item.id===origin.accountId))playback.controller.setQueue({...state.queue,currentId:null,priorityIds:[]});});
  deviceMedia.subscribe(()=>{const state=deviceMedia.getSnapshot();if(state.authorization!=='authorized'||state.stale)lyrics.clear();});
  const playTracks = (tracks: readonly Track[], index: number) => {
    const entries = tracks.map(track => ({id:Crypto.randomUUID(),track}));
    if (entries[index]) void playback.controller.play(makeQueue(entries, entries[index]!.id));
  };
  const addToQueue = (track: Track, next = false) => {
    const entry = {id:Crypto.randomUUID(),track}, queue = playback.controller.getSnapshot().queue;
    playback.controller.setQueue(next ? enqueueNext(queue,entry) : append(queue,entry));
  };
  return { repository, davAccounts, davMedia, deviceMedia, localAudio, nativeLX, registry, catalog, preferences, resolver, playback, covers, online, matching, comments, sourceHealth, qishui, search, discovery, playTracks, addToQueue, accounts, library, lyrics, fonts, recoveryWarnings };
}
export type Services = Awaited<ReturnType<typeof createServices>>;
let pending: Promise<Services> | undefined;
export function getServices() {
  if (!pending) pending = createServices().catch(error => { pending = undefined; throw error; });
  return pending;
}
