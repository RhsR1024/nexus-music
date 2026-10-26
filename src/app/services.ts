import {createSongFavorites} from './songFavorites.ts';
import {VisualAssetStore,VisualColorCache,type VisualNative} from '../storage/visualAssets.ts';
import {CoverThemeStore} from '../appearance/coverTheme.ts';
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
import {LyricSelection} from '../lyrics/selection.ts';
import * as Crypto from 'expo-crypto';
import * as Font from 'expo-font';
import { openRepository } from '../storage/nativeDatabase.ts';
import {CoverService} from '../providers/covers.ts';
import { decodeKRC, decodeQRC, loadNativeCovers, loadNativeLX } from '../providers/nativeLX.ts';
import { SourceRegistry } from '../providers/sourceRegistry.ts';
import { SourceCatalog } from '../providers/sourceCatalog.ts';
import { PreferenceStore } from './preferences.ts';
import { SearchHistoryStore } from '../storage/searchHistory.ts';
import { DevicePlaylistStore } from '../storage/devicePlaylists.ts';
import { MultiSourceResolver } from '../providers/multiSourceResolver.ts';
import { createPlaybackSession } from '../playback/nativeSession.ts';
import { AccountFmStation } from '../playback/accountFmStation.ts';
import { OnlineProvider } from '../providers/online.ts';
import { SearchCoordinator } from '../providers/searchCoordinator.ts';
import { makeQueue, append, appendMany, enqueueNext, enqueueNextMany } from '../domain/queue.ts';
import { trackKey } from '../domain/track.ts';
import type { Track } from '../domain/track.ts';
import {requestJSON,type HTTPClient} from '../providers/http.ts';
import { NavidromeAccounts } from '../providers/navidromeAccounts.ts';
import { NavidromeClient } from '../providers/navidrome.ts';
import { nativeSecrets } from '../storage/nativeSecrets.ts';
import {LibraryStore} from '../storage/library.ts';
import {PlaybackStatsStore} from '../storage/playbackStats.ts';
import {WebDAVStatistics} from '../storage/webdavStatistics.ts';
import {MutationQueue} from '../storage/mutations.ts';
import {createBackupRestore} from '../storage/restoreLibraryBackup.ts';
import {encodeBackup} from '../storage/backup.ts';
import {WebDAVBackups} from '../storage/webdavBackups.ts';
import {WebDAVSync} from '../storage/webdavSync.ts';
import { decodeQueue, type SavedCursor, type SavedQueue } from '../storage/queuePersistence.ts';
import {OfflineDownloadStore} from '../storage/offlineDownloads.ts';
import {createOfflineDownloadFiles} from '../storage/offlineFiles.ts';
import {LocalRecommendationStore} from '../providers/recommendations.ts';
import {MusicAccounts} from '../providers/musicAccounts.ts';
import {MusicAuthFlow} from '../providers/musicAuth.ts';
import {AccountDailyClient} from '../providers/accountDaily.ts';
import {AccountFmClient} from '../providers/accountFm.ts';
import {MusicWebLoginCoordinator} from '../providers/musicWebLogin.ts';
import {loadNativeMusicAuth} from '../providers/nativeMusicAuth.ts';
import {NeteaseAccountProfileClient} from '../providers/neteaseAccountProfile.ts';

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
  const visualNative=requireNativeModule<VisualNative>('NexusFiles'),visualAssets=new VisualAssetStore(repository,visualNative),visualColors=new VisualColorCache(visualNative);await restore('visualAssets.v1','外观图片',()=>visualAssets.restore());
  const libraryMutations=new MutationQueue();
  const preferences = new PreferenceStore(repository,libraryMutations); await restore('preferences.v1','偏好',()=>preferences.restore());
  const searchHistory = new SearchHistoryStore(repository); await restore('search.history.v1','搜索历史',()=>searchHistory.restore());
  const devicePlaylists = new DevicePlaylistStore(repository,Crypto.randomUUID); await restore('device.playlists.v1','本地歌单',()=>devicePlaylists.restore());
  const hash=(value:string)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,value);
  const davTransport=new DAVNativeTransport(requireNativeModule<DAVNativeModule>('NexusWebDAV'),Crypto.randomUUID);
  const davAccounts=new WebDAVAccounts(repository,nativeSecrets,hash,davTransport);await restore('webdav.accounts.v1','WebDAV',()=>davAccounts.restore());
  const davMedia=new WebDAVMedia(davAccounts,davTransport,hash);
  const accounts=new NavidromeAccounts(repository,nativeSecrets,hash,(account,credentials)=>new NavidromeClient(account,credentials,{md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),salt:Crypto.randomUUID}));
  await restore('navidrome.accounts.v1','连接',()=>accounts.restore());
  const musicAccounts=new MusicAccounts(repository,nativeSecrets,hash);
  await restore('music.accounts.v1','音乐平台账号',()=>musicAccounts.restore());
  const neteaseProfile=new NeteaseAccountProfileClient({http:options.onlineHTTP??requestJSON});
  const musicAuth={wy:new MusicAuthFlow<Record<string,unknown>>(),tx:new MusicAuthFlow<Record<string,unknown>>(),kg:new MusicAuthFlow<Record<string,unknown>>()};
  const musicWebLogin=new MusicWebLoginCoordinator({native:loadNativeMusicAuth(),flow:musicAuth.wy,accounts:musicAccounts,profile:neteaseProfile,hash,uuid:Crypto.randomUUID});
  const fonts=new FontStore(repository);await restore('fonts.v1','字体',()=>fonts.restore());
  await Font.loadAsync({CupertinoIcons:require('../../assets/fonts/CupertinoIcons.ttf')});
  const library=new LibraryStore(repository,Crypto.randomUUID,Date.now,libraryMutations);await restore('library.v1','音乐库',()=>library.restore());
  const playbackStats=new PlaybackStatsStore(repository,Date.now,libraryMutations,Crypto.randomUUID);await restore('playbackStats.v1','播放统计',()=>playbackStats.restore());
  // Recommendations are derived from local library/statistics only. No Sollin
  // account, private endpoint, or remote recommendation protocol is involved.
  const recommendations=new LocalRecommendationStore(library,playbackStats,Date.now);
  const accountDaily=new AccountDailyClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  const accountFm=new AccountFmClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  musicAccounts.subscribe(()=>{accountDaily.clear();accountFm.clear();});
  const nativeLX = loadNativeLX();
  const registry = new SourceRegistry(nativeLX);
  const catalog = new SourceCatalog(registry, repository, script => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, script));
  await restore('sources.v1','音源',()=>catalog.restore());
  // Source initialization can require network/timeouts. Keep the UI available,
  // but wait for restored sources before resolving recovered downloads.
  const sourcesReady = catalog.restoreEnabled();
  const online = new OnlineProvider({http:options.onlineHTTP, md5: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, value), sha1: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, value), deviceId: Crypto.randomUUID });
  const covers=new CoverService(loadNativeCovers(),hash,registry,nativeLX,async(account,id,signal,size)=>(await accounts.client(account)).mediaURL('getCoverArt',{id,size},signal),(track,signal)=>track.origin.kind==='webdav'?davMedia.cover(track,signal):track.origin.kind==='device'?deviceMedia.cover(track):localAudio.cover(track),(track,signal)=>online.artwork(track,signal));
  const resolver = new MultiSourceResolver(registry, nativeLX, () => preferences.getSnapshot().quality);
  const matching=new CrossPlatformMatcher(online);
  const comments=new PublicComments(options.onlineHTTP);
  const sourceHealth=new SourceHealth({registry,open:createSourceDiagnostics(catalog,loadNativeDiagnosticLX(),Crypto.randomUUID),online,probe:loadAudioProbe(Crypto.randomUUID)});
  const qishui=new QishuiProvider();
  const matchedResolver=new MatchedResolver({matcher:matching,library,router:{resolve:async(track,signal,excluded,scope)=>{let playable=track;try{playable=await online.enrich(track,signal);}catch{throwIfAborted(signal);}return resolver.resolve(playable,signal,excluded,scope);}},autoMatch:()=>preferences.getSnapshot().autoMatch,quality:()=>preferences.getSnapshot().quality,hash,
    available:()=>[...new Set(registry.getSnapshot().filter(source=>registry.isCurrent(source)).flatMap(source=>source.capabilities.filter(value=>value.actions.includes('musicUrl')).map(value=>value.platform)))]});
  const resolveTrack=async(track:Track,signal:AbortSignal,excluded?:ReadonlySet<string>)=>{
    if(track.origin.kind==='webdav')return davMedia.resolve(track,signal);
    if(track.origin.kind==='device')return deviceMedia.resolve(track);
    if(track.origin.kind==='local')return localAudio.resolve(track);
    if(track.origin.kind==='navidrome'){const media=await(await accounts.client(track.origin.accountId)).resolve(track,signal);return {...media,cacheKey:await hash(JSON.stringify([trackKey(track.origin),'original']))};}
    return matchedResolver.resolve(track,signal,excluded);
  };
  let playbackController:ReturnType<typeof createPlaybackSession>['controller']|undefined;
  const offlineDownloads=new OfflineDownloadStore(repository,{resolve:async(track,signal)=>{
    const media=await resolveTrack(track,signal);if(!/^https?:$/.test(new URL(media.url).protocol))throw new Error('此来源不支持离线保存');return media;
  },files:createOfflineDownloadFiles(),concurrency:()=>preferences.getSnapshot().downloadConcurrency,uuid:Crypto.randomUUID,now:Date.now,maxTotalBytes:()=>preferences.getSnapshot().offlineLimitMB*1048576,isInUse:track=>{
    const state=playbackController?.getSnapshot();if(state?.intent!=='playing')return false;
    const current=state.queue.entries.find(entry=>entry.id===state.queue.currentId)?.track;
    return !!current&&trackKey(current.origin)===trackKey(track.origin);
  }});
  await restore('offlineDownloads.v1','离线下载',()=>offlineDownloads.restore());
  const playback = createPlaybackSession({resolve:async(track,signal,excluded)=>{
    const saved=await offlineDownloads.resolve(track);if(saved)return saved;
    return resolveTrack(track,signal,excluded);
  }}, preferences,{covers,library});
  playbackController=playback.controller;
  const accountFmStation=new AccountFmStation({client:accountFm,accounts:musicAccounts,playback:playback.controller,uuid:Crypto.randomUUID});
  musicAccounts.subscribe(()=>accountFmStation.stop());
  bindManualMatches(library,playback.controller);bindMatchPolicy(library,preferences,playback.controller);
  try{
    const saved=await repository.get<SavedQueue>('queue.v1');
    if(saved){playback.controller.setQueue(decodeQueue(saved));const cursor=await repository.get<SavedCursor>('queue.cursor.v1');if(cursor)playback.controller.restoreCursor(cursor.entryId,cursor.seconds);}
  }catch{recoveryWarnings.push('上次播放队列无法恢复，已从暂停状态开始；音乐库仍保留。');}
  const coverTheme=new CoverThemeStore(playback.controller,preferences,covers,visualColors);
  accounts.subscribe(coverTheme.invalidate);davAccounts.subscribe(coverTheme.invalidate);registry.subscribe(coverTheme.invalidate);deviceMedia.subscribe(coverTheme.invalidate);localAudio.subscribe(coverTheme.invalidate);
  deviceMedia.subscribe(()=>{const current=playback.controller.getSnapshot(),entry=current.queue.entries.find(entry=>entry.id===current.queue.currentId);if(entry?.track.origin.kind==='device'&&deviceMedia.getSnapshot().authorization!=='authorized')playback.controller.setQueue({...current.queue,currentId:null,priorityIds:[]});});
  AppState.addEventListener('change',state=>{
    if(state!=='active')return;
    void deviceMedia.checkAuthorization().catch(()=>{});
    void sourcesReady.then(()=>offlineDownloads.resumeQueued()).catch(()=>{});
  });
  void sourcesReady.then(()=>offlineDownloads.resumeQueued()).catch(()=>{});
  let previous=playback.controller.getSnapshot(),lastCursorWrite=Date.now();
  playback.controller.subscribe(()=>{
    const state=playback.controller.getSnapshot(),cursor={entryId:state.queue.currentId,seconds:state.position};
    if(state.queue!==previous.queue){void repository.putMany([['queue.v1',{version:1,queue:state.queue}],['queue.cursor.v1',cursor]]).catch(()=>{});lastCursorWrite=Date.now();}
    else if((state.intent==='paused'&&previous.intent==='playing')||Date.now()-lastCursorWrite>5000){void repository.put('queue.cursor.v1',cursor).catch(()=>{});lastCursorWrite=Date.now();}
    previous=state;
  });
  playback.onPlayed(track=>{void library.played(track).catch(()=>{});});
  playback.onListening(sample=>{void playbackStats.record(sample).catch(()=>{});});
  accounts.subscribe(()=>{
    const state=playback.controller.getSnapshot(),origin=state.queue.entries.find(item=>item.id===state.queue.currentId)?.track.origin;
    if(origin?.kind==='navidrome'&&!accounts.getSnapshot().some(item=>item.id===origin.accountId)) playback.controller.setQueue({...state.queue,currentId:null,priorityIds:[]});
  });
  const discovery=new DiscoveryProvider(value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value),options.onlineHTTP);
  const search = new SearchCoordinator(online);
  const rawLyrics=new LyricService(registry,nativeLX,async(track,signal)=>{if(track.origin.kind==='webdav')return davMedia.lyric(track,signal);if(track.origin.kind==='device')return deviceMedia.lyric(track);if(track.origin.kind==='local')return localAudio.lyric(track);if(track.origin.kind!=='navidrome')return '';return(await accounts.client(track.origin.accountId)).lyrics(track.origin.id,track.artist,track.title,signal);},options.onlineHTTP,decodeKRC,decodeQRC);
  const lyrics=new LyricSelection(rawLyrics,matching,library);
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
  const addTracksToQueue=(tracks:readonly Track[],next=false)=>{if(!tracks.length)return;const queue=playback.controller.getSnapshot().queue;playback.controller.setQueue(next?enqueueNextMany(queue,tracks.map(track=>({id:Crypto.randomUUID(),track}))):appendMany(queue,tracks.map(track=>({id:Crypto.randomUUID(),track}))));};
  const restoreBackup=createBackupRestore({repository,mutations:libraryMutations,library,statistics:playbackStats,preferences});
  const snapshotBackup=(date=new Date())=>libraryMutations.run(async()=>encodeBackup(library.getSnapshot(),date,playbackStats.getSnapshot(),preferences.getSnapshot()));
  const davBackups=new WebDAVBackups({repository,accounts:davAccounts,transport:davTransport,hash,uuid:Crypto.randomUUID,
    snapshot:snapshotBackup,restore:backup=>restoreBackup(backup.library,backup.statistics!,backup.settings)});
  await restore('webdav.backup.v1','云备份目录',()=>davBackups.restore());
  const davStatistics=new WebDAVStatistics({repository,accounts:davAccounts,transport:davTransport,statistics:playbackStats,hash});
  await restore('webdav.statistics.v1','统计同步目录',()=>davStatistics.restore());
  const davSync=new WebDAVSync({repository,accounts:davAccounts,transport:davTransport,library,mutations:libraryMutations,uuid:Crypto.randomUUID});
  await restore('webdav.sync.v1','多设备同步',()=>davSync.restore());
  AppState.addEventListener('change',state=>{if(state==='active')void davSync.previewIfConfigured();});
  void davSync.previewIfConfigured();
  const songFavorites=createSongFavorites(library,localAudio);
  return { snapshotBackup, songFavorites, coverTheme, davStatistics, davSync, repository, visualAssets, visualColors, davAccounts, davBackups, davMedia, deviceMedia, devicePlaylists, localAudio, offlineDownloads, nativeLX, registry, catalog, preferences, searchHistory, resolver, playback, playbackStats, recommendations, accountDaily, accountFm, accountFmStation, covers, online, matching, comments, sourceHealth, qishui, search, discovery, playTracks, addToQueue, addTracksToQueue, restoreBackup, accounts, musicAccounts, musicAuth, musicWebLogin, neteaseProfile, library, lyrics, fonts, recoveryWarnings };
}
export type Services = Awaited<ReturnType<typeof createServices>>;
let pending: Promise<Services> | undefined;
export function getServices() {
  if (!pending) pending = createServices().catch(error => { pending = undefined; throw error; });
  return pending;
}
