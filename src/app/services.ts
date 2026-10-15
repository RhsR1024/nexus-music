import { DiscoveryProvider } from '../providers/discovery.ts';
import { restoreRecord } from '../storage/recovery.ts';
import { FontStore } from '../storage/fonts.ts';
import { LyricService } from '../lyrics/service.ts';
import * as Crypto from 'expo-crypto';
import { openRepository } from '../storage/nativeDatabase.ts';
import { loadNativeLX } from '../providers/nativeLX.ts';
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
import { NavidromeAccounts } from '../providers/navidromeAccounts.ts';
import { NavidromeClient } from '../providers/navidrome.ts';
import { nativeSecrets } from '../storage/nativeSecrets.ts';
import { LibraryStore } from '../storage/library.ts';
import { decodeQueue, type SavedCursor, type SavedQueue } from '../storage/queuePersistence.ts';

async function initialize() {
  const repository = await openRepository();
  const recoveryWarnings:string[]=[];
  const restore=async(key:string,label:string,run:()=>Promise<void>)=>{if(!await restoreRecord(repository,key,run,Crypto.randomUUID))recoveryWarnings.push(`${label}数据无法读取，原始记录已隔离保留，其他功能继续可用。`);};
  const preferences = new PreferenceStore(repository); await restore('preferences.v1','偏好',()=>preferences.restore());
  const hash=(value:string)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,value);
  const accounts=new NavidromeAccounts(repository,nativeSecrets,hash,(account,credentials)=>new NavidromeClient(account,credentials,{md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),salt:Crypto.randomUUID}));
  await restore('navidrome.accounts.v1','连接',()=>accounts.restore());
  const fonts=new FontStore(repository);await restore('fonts.v1','字体',()=>fonts.restore());
  const library=new LibraryStore(repository,Crypto.randomUUID);await restore('library.v1','音乐库',()=>library.restore());
  const nativeLX = loadNativeLX();
  const registry = new SourceRegistry(nativeLX);
  const catalog = new SourceCatalog(registry, repository, script => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, script));
  await restore('sources.v1','音源',()=>catalog.restore());
  void catalog.restoreEnabled();
  const resolver = new MultiSourceResolver(registry, nativeLX, () => preferences.getSnapshot().quality);
  const playback = createPlaybackSession({resolve:async(track,signal,excluded)=>{
    if(track.origin.kind==='navidrome'){const media=await(await accounts.client(track.origin.accountId)).resolve(track,signal);return {...media,cacheKey:await hash(JSON.stringify([trackKey(track.origin),'original']))};}
    const media=await resolver.resolve(track,signal,excluded);
    return {...media,cacheKey:await hash(JSON.stringify([trackKey(track.origin),await catalog.fingerprint(media.sourceId),media.quality]))};
  }}, preferences);
  try{
    const saved=await repository.get<SavedQueue>('queue.v1');
    if(saved){playback.controller.setQueue(decodeQueue(saved));const cursor=await repository.get<SavedCursor>('queue.cursor.v1');if(cursor)playback.controller.restoreCursor(cursor.entryId,cursor.seconds);}
  }catch{recoveryWarnings.push('上次播放队列无法恢复，已从暂停状态开始；音乐库仍保留。');}
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
  const online = new OnlineProvider({ md5: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, value), sha1: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, value), deviceId: Crypto.randomUUID });
  const discovery=new DiscoveryProvider(value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value));
  const search = new SearchCoordinator(online);
  const lyrics=new LyricService(registry,nativeLX,async(track,signal)=>{if(track.origin.kind!=='navidrome')return '';return(await accounts.client(track.origin.accountId)).lyrics(track.origin.id,track.artist,track.title,signal);});
  accounts.subscribe(()=>lyrics.clear());
  const playTracks = (tracks: readonly Track[], index: number) => {
    const entries = tracks.map(track => ({id:Crypto.randomUUID(),track}));
    if (entries[index]) void playback.controller.play(makeQueue(entries, entries[index]!.id));
  };
  const addToQueue = (track: Track, next = false) => {
    const entry = {id:Crypto.randomUUID(),track}, queue = playback.controller.getSnapshot().queue;
    playback.controller.setQueue(next ? enqueueNext(queue,entry) : append(queue,entry));
  };
  return { repository, nativeLX, registry, catalog, preferences, resolver, playback, online, search, discovery, playTracks, addToQueue, accounts, library, lyrics, fonts, recoveryWarnings };
}
export type Services = Awaited<ReturnType<typeof initialize>>;
let pending: Promise<Services> | undefined;
export function getServices() {
  if (!pending) pending = initialize().catch(error => { pending = undefined; throw error; });
  return pending;
}
