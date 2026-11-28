import {readSimilarSongs} from '../providers/similarSongs.ts';
import {ArtistProvider} from '../providers/artists.ts';
import {createDownloadSubmission} from './downloadSubmission.ts';
import {createDownloadQualityProbe} from './downloadQualityProbe.ts';
import {SearchAssistanceProvider} from '../providers/searchAssistance.ts';
import {SearchAssistanceCoordinator} from '../providers/searchAssistanceCoordinator.ts';
import {VideoProvider} from '../providers/videos.ts';
import {NeteasePodcastsProvider} from '../providers/neteasePodcasts.ts';
import {AlbumProvider} from '../providers/albums.ts';
import {PlaylistSearchProvider,type PlaylistSearchItem} from '../providers/playlistSearch.ts';
import {QQAccountTransfer} from '../providers/qqAccountTransfer.ts';
import {DownloadDestinationSettings,type DestinationNative} from '../storage/downloadDestination.ts';
import {DownloadDelivery} from '../storage/downloadDelivery.ts';
import {offlineAudioExportFiles} from '../storage/audioExportFiles.ts';
import {captureAttachmentPolicy} from '../domain/downloadAttachmentPolicy.ts';
import {ManagedDownloadAttachments} from '../storage/managedDownloadAttachments.ts';
import {createManagedAttachmentFiles} from '../storage/managedAttachmentFiles.ts';
import {createDownloadResolver} from '../providers/downloadResolver.ts';
import {createSongFavorites} from './songFavorites.ts';
import {VisualAssetStore,VisualColorCache,type VisualNative} from '../storage/visualAssets.ts';
import {CoverThemeStore} from '../appearance/coverTheme.ts';
import {PublicComments} from '../providers/comments.ts';
import {bindManualMatches,bindMatchPolicy} from '../playback/matchBinding.ts';
import {SourceHealth} from '../providers/sourceHealth.ts';
import {NetworkDiagnosticsCoordinator,pickBestDiagnosticSample,type SystemNetworkInfo} from '../providers/networkDiagnostics.ts';
import {applyPlatformSourceRouting} from '../domain/platformRouting.ts';
import {loadAudioProbe,loadNativeDiagnosticLX} from '../providers/nativeLX.ts';
import {createSourceDiagnostics} from '../providers/sourceDiagnostics.ts';
import {DAVNativeTransport,type DAVNativeModule} from '../providers/davNativeTransport.ts';
import {WebDAVAccounts} from '../providers/webdavAccounts.ts';
import {WebDAVMedia} from '../providers/webdavMedia.ts';
import {AppState} from 'react-native';
import {DeviceMediaStore,type DeviceMediaNative} from '../providers/deviceMedia.ts';
import {requireNativeModule,requireOptionalNativeModule} from 'expo';
import {LocalAudioStore,type LocalAudioNative} from '../storage/localAudio.ts';
import { DiscoveryProvider } from '../providers/discovery.ts';
import {CrossPlatformMatcher} from '../providers/crossPlatformMatcher.ts';
import {MatchedResolver} from '../providers/matchedResolver.ts';
import {AccountPlaybackResolver} from '../providers/accountPlaybackResolver.ts';
import {AccountFeatureCache} from '../providers/accountFeatureCache.ts';
import {ACCOUNT_INSIGHTS_VERSION,AccountInsightsStore} from '../providers/accountInsights.ts';
import {BodianAccountStore,BodianProvider,BodianQrLoginCoordinator} from '../providers/bodian.ts';
import {QishuiAccountStore,QishuiProvider} from '../providers/qishui.ts';
import {AccountDiscoveryClient} from '../providers/accountDiscovery.ts';
import {GlobalRadioApi,GlobalRadioStore,validRadioStreamURL} from '../providers/globalRadio.ts';
import {DlnaCastController,type DlnaNativeBridge} from '../providers/dlna.ts';
import {AUDIO_MATCH_RECORD_VERSION,AudioMatchCoordinator,type AudioMatchNativeBridge} from '../providers/audioMatch.ts';
import {CarIntegrationCoordinator,type CarNativeBridge} from '../platform/carIntegration.ts';
import {formatBluetoothLyric} from '../lyrics/bluetoothLyrics.ts';
import {throwIfAborted} from '../providers/async.ts';
import { restoreRecord } from '../storage/recovery.ts';
import { FontStore } from '../storage/fonts.ts';
import { LyricService } from '../lyrics/service.ts';
import {LyricSelection} from '../lyrics/selection.ts';
import {LyricPreview,miniLyricText} from '../lyrics/preview.ts';
import {convertLyricScript} from '../lyrics/chineseScript.ts';
import {lyricOffset} from '../lyrics/settings.ts';
import * as Crypto from 'expo-crypto';
import * as Font from 'expo-font';
import { openRepository } from '../storage/nativeDatabase.ts';
import {CoverService} from '../providers/covers.ts';
import { decodeKRC, decodeQRC, fetchSourceScript, loadNativeCovers, loadNativeLX, probeSourceUpdateAlert, subscribeSourceUpdateAlerts } from '../providers/nativeLX.ts';
import { SourceRegistry } from '../providers/sourceRegistry.ts';
import { SourceCatalog } from '../providers/sourceCatalog.ts';
import { PreferenceStore } from './preferences.ts';
import { SearchHistoryStore } from '../storage/searchHistory.ts';
import { DevicePlaylistStore } from '../storage/devicePlaylists.ts';
import { MultiSourceResolver } from '../providers/multiSourceResolver.ts';
import { createPlaybackSession } from '../playback/nativeSession.ts';
import { PreloadCache, startPreloadCoordinator } from '../playback/preloadCache.ts';
import { AccountFmStation } from '../playback/accountFmStation.ts';
import { OnlineProvider } from '../providers/online.ts';
import { SearchCoordinator,PagedSearchCoordinator } from '../providers/searchCoordinator.ts';
import { currentEntry, makeQueue, append, appendMany, enqueueNext, enqueueNextMany } from '../domain/queue.ts';
import { trackKey, trackPlatform } from '../domain/track.ts';
import type { MusicPlatform, OnlinePlatform, Track } from '../domain/track.ts';
import {requestJSON,type HTTPClient,type TextHTTPClient} from '../providers/http.ts';
import type {PlaybackTraceSink} from '../playback/diagnostics.ts';
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
import {AccountRecommendedPlaylists} from '../providers/accountRecommendedPlaylists.ts';
import {AccountPlaylists} from '../providers/accountPlaylists.ts';
import {AccountAlbums} from '../providers/accountAlbums.ts';
import {AccountMVs} from '../providers/accountMVs.ts';
import {QQPlaylists} from '../providers/qqPlaylists.ts';
import {QQFavoriteClient} from '../providers/qqFavorite.ts';
import {NeteaseFavoriteClient} from '../providers/neteaseFavorite.ts';
import {NeteasePlaylistCreateClient} from '../providers/neteasePlaylistCreate.ts';
import {NeteasePlaylistDeleteClient} from '../providers/neteasePlaylistDelete.ts';
import {NeteasePlaylistTracksClient} from '../providers/neteasePlaylistTracks.ts';
import {KugouPlaylists} from '../providers/kugouPlaylists.ts';
import {KugouQrPhoto} from '../providers/kugouQrPhoto.ts';
import {loginQrPhotoNative} from '../storage/loginQrPhoto.ts';
import {KugouDailyClient} from '../providers/kugouDaily.ts';
import {QQDailyClient} from '../providers/qqDaily.ts';
import {QQDailyAuthorization} from '../providers/qqDailyAuthorization.ts';
import {AccountFmClient} from '../providers/accountFm.ts';
import {AccountHeartbeat} from '../providers/accountHeartbeat.ts';
import {MusicWebLoginCoordinator} from '../providers/musicWebLogin.ts';
import {NeteaseQrLoginClient,NeteaseQrLoginCoordinator} from '../providers/neteaseQrLogin.ts';
import {KugouLoginClient} from '../providers/kugouLogin.ts';
import {KugouLoginCoordinator} from '../providers/kugouLoginCoordinator.ts';
import {QQAccountProfileClient} from '../providers/qqAccountProfile.ts';
import {loadNativeMusicAuth} from '../providers/nativeMusicAuth.ts';
import {NeteaseAccountProfileClient} from '../providers/neteaseAccountProfile.ts';
import {resolvePlaylistLink,type PlaylistLinkExpander} from '../providers/playlistLink.ts';

export async function createServices(options:{onlineHTTP?:HTTPClient;onlineTextHTTP?:TextHTTPClient;playlistLinkExpander?:PlaylistLinkExpander}={}) {
  const repository = await openRepository();
  const recoveryWarnings:string[]=[];
  const restore=async(key:string,label:string,run:()=>Promise<void>,maxVersion=1)=>{const ok=await restoreRecord(repository,key,run,Crypto.randomUUID,maxVersion);if(!ok)recoveryWarnings.push(`${label}数据无法读取，原始记录已隔离保留，其他功能继续可用。`);return ok;};
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
  const qqProfile=new QQAccountProfileClient({http:options.onlineHTTP??requestJSON});
  const qqFavorite=new QQFavoriteClient({http:options.onlineHTTP??requestJSON,sha1:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value),accounts:musicAccounts});
  const neteaseFavorite=new NeteaseFavoriteClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  const neteasePlaylist=new NeteasePlaylistCreateClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  const neteasePlaylistDelete=new NeteasePlaylistDeleteClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  const neteasePlaylistTracks=new NeteasePlaylistTracksClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  const kugouLoginClient=new KugouLoginClient({http:options.onlineHTTP??requestJSON,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),nonce:Crypto.randomUUID});
  const kugouLogin=new KugouLoginCoordinator({client:kugouLoginClient,accounts:musicAccounts});
  const nativeMusicAuth=loadNativeMusicAuth();
  const neteaseQrLogin=new NeteaseQrLoginCoordinator({
    client:new NeteaseQrLoginClient({
      nativeRequest:nativeMusicAuth.neteaseQrRequest
        ?(path,formBody,cookieHeader)=>nativeMusicAuth.neteaseQrRequest!(path,formBody,cookieHeader)
        :undefined,
    }),
    profile:neteaseProfile,
    accounts:musicAccounts,
    hash,
  });
  const musicAuth={wy:new MusicAuthFlow<Record<string,unknown>>(),tx:new MusicAuthFlow<Record<string,unknown>>(),kg:new MusicAuthFlow<Record<string,unknown>>()};
  const musicWebLogin=new MusicWebLoginCoordinator({native:nativeMusicAuth,flow:musicAuth.wy,accounts:musicAccounts,profile:neteaseProfile,qqProfile,hash,uuid:Crypto.randomUUID});
  const fonts=new FontStore(repository);await restore('fonts.v1','字体',()=>fonts.restore());
  await Font.loadAsync({CupertinoIcons:require('../../assets/fonts/CupertinoIcons.ttf')});
  const library=new LibraryStore(repository,Crypto.randomUUID,Date.now,libraryMutations,()=>preferences.getSnapshot().playlistAddPosition);await restore('library.v1','音乐库',()=>library.restore());
  const playbackStats=new PlaybackStatsStore(repository,Date.now,libraryMutations,Crypto.randomUUID);await restore('playbackStats.v1','播放统计',()=>playbackStats.restore());
  // Recommendations are derived from local library/statistics only. No Sollin
  // account, private endpoint, or remote recommendation protocol is involved.
  const recommendations=new LocalRecommendationStore(library,playbackStats,Date.now);
  const qqDailyClient=new QQDailyClient({http:options.onlineHTTP??requestJSON});
  const qqDailyAuthorization=new QQDailyAuthorization({native:loadNativeMusicAuth(),accounts:musicAccounts,profile:qqProfile,daily:qqDailyClient,hash,uuid:Crypto.randomUUID});
  const qqAccountTransfer=new QQAccountTransfer({native:loadNativeMusicAuth(),accounts:musicAccounts,profile:qqProfile,hash,uuid:Crypto.randomUUID});
  const kugouQrPhoto=new KugouQrPhoto({login:kugouLogin,native:loginQrPhotoNative,uuid:Crypto.randomUUID});
  const neteaseQrPhoto=new KugouQrPhoto({login:neteaseQrLogin,native:loginQrPhotoNative,uuid:Crypto.randomUUID});
  const accountPlaylists=new AccountPlaylists({http:options.onlineHTTP??requestJSON,accounts:musicAccounts,profile:neteaseProfile,library,qq:new QQPlaylists({http:options.onlineHTTP??requestJSON,profile:qqProfile}),kugou:new KugouPlaylists({http:options.onlineHTTP??requestJSON,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value)})});
  const accountAlbums=new AccountAlbums({http:options.onlineHTTP??requestJSON,accounts:musicAccounts,profile:neteaseProfile});
  const accountMVs=new AccountMVs({http:options.onlineHTTP??requestJSON,accounts:musicAccounts,profile:neteaseProfile});
  const accountDaily=new AccountDailyClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts,kugou:new KugouDailyClient({http:options.onlineHTTP??requestJSON,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value)}),qq:qqDailyClient});
  const accountRecommendedPlaylists=new AccountRecommendedPlaylists({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  const accountFm=new AccountFmClient({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  const accountHeartbeat=new AccountHeartbeat({http:options.onlineHTTP??requestJSON,accounts:musicAccounts});
  musicAccounts.subscribe(()=>{accountDaily.clear();accountRecommendedPlaylists.clear();accountFm.clear();accountHeartbeat.clear();});
  const nativeLX = loadNativeLX();
  const registry = new SourceRegistry(nativeLX);
  const catalog = new SourceCatalog(registry, repository, script => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, script));
  await restore('sources.v1','音源',()=>catalog.restore());
  // Capture runtime LX updateAlert events emitted by any initialized source script.
  subscribeSourceUpdateAlerts(event => {
    if (event?.id && typeof event.payload === 'string') {
      void catalog.recordUpdateAlert(event.id, event.payload).catch(() => {});
    }
  });
  // Source initialization can require network/timeouts. Keep the UI available,
  // but wait for restored sources before resolving recovered downloads.
  const sourcesReady = catalog.restoreEnabled();
  // Quietly check all imported sources for updates in the background after startup settles.
  void sourcesReady.then(() => {
    setTimeout(() => {
      void catalog.checkAllUpdates({
        probeAlert: probeSourceUpdateAlert,
        fetchScript: fetchSourceScript,
      }).catch(() => {});
    }, 2500);
  }).catch(() => {});
  const online = new OnlineProvider({http:options.onlineHTTP, md5: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, value), sha1: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, value), deviceId: Crypto.randomUUID });
  const covers=new CoverService(loadNativeCovers(),hash,registry,nativeLX,async(account,id,signal,size)=>(await accounts.client(account)).mediaURL('getCoverArt',{id,size},signal),(track,signal)=>track.origin.kind==='webdav'?davMedia.cover(track,signal):track.origin.kind==='device'?deviceMedia.cover(track):localAudio.cover(track),(track,signal)=>online.artwork(track,signal));
  const playbackQualityFor=(platform:MusicPlatform)=>preferences.getSnapshot().playbackQualities[platform]??preferences.getSnapshot().quality;
  const resolver = new MultiSourceResolver(registry, nativeLX, () => preferences.getSnapshot().quality, 10000, {
    qualityForPlatform: playbackQualityFor,
    degradeMode: () => preferences.getSnapshot().smartDegradeMode,
    crossScript: () => preferences.getSnapshot().smartCrossScript,
    sourceRouting: () => preferences.getSnapshot().platformSourceRouting,
  });
  const matching=new CrossPlatformMatcher(online);
  const comments=new PublicComments(options.onlineHTTP,{md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),nonce:Crypto.randomUUID});
  const openDiagnostic=createSourceDiagnostics(catalog,loadNativeDiagnosticLX(),Crypto.randomUUID);
  const audioProbe=loadAudioProbe(Crypto.randomUUID);
  const sourceHealth=new SourceHealth({registry,open:openDiagnostic,online,probe:audioProbe});
  const qishui=new QishuiProvider(options.onlineHTTP);
  const qishuiAccount=new QishuiAccountStore(repository,nativeSecrets);
  await restore('qishui.account.v1','汽水曲库与漫游',()=>qishuiAccount.restore());
  const loginQishui=()=>qishuiAccount.loginWithWebView({native:nativeMusicAuth,uuid:Crypto.randomUUID,http:options.onlineHTTP});
  const bodianAccount=new BodianAccountStore(repository,nativeSecrets,Crypto.randomUUID);
  await restore('bodian.account.v1','波点音乐账号',()=>bodianAccount.restore());
  const bodian=new BodianProvider({http:options.onlineHTTP??requestJSON,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),deviceId:bodianAccount.getSnapshot().deviceId});
  const bodianQrLogin=new BodianQrLoginCoordinator({provider:bodian,account:bodianAccount});
  const bodianQrPhoto=new KugouQrPhoto({login:bodianQrLogin,native:loginQrPhotoNative,uuid:Crypto.randomUUID});
  const accountFeatureCache=new AccountFeatureCache(repository);
  await restore('accountFeature.cache.v1','账号歌单缓存',()=>accountFeatureCache.restore());
  const accountInsights=new AccountInsightsStore({
    repository,
    http:options.onlineHTTP??requestJSON,
    md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),
    musicAccounts,
    qishui,
    qishuiAccount,
    bodian,
    bodianAccount,
  });
  await restore('accountInsights.v1','账号会员与统计信息',()=>accountInsights.restore(),ACCOUNT_INSIGHTS_VERSION);
  const accountDiscovery=new AccountDiscoveryClient({http:options.onlineHTTP??requestJSON,sha1:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value),accounts:musicAccounts,neteaseProfile});
  const radioApi=new GlobalRadioApi({http:options.onlineHTTP});
  const radioStore=new GlobalRadioStore(repository);
  await restore('radio.v1','全球电台',()=>radioStore.restore());
  const accountPlaybackResolver=new AccountPlaybackResolver({
    enabled:()=>preferences.getSnapshot().preferAccountPlayback,
    quality:()=>preferences.getSnapshot().quality,
    qualityForPlatform:playbackQualityFor,
    musicAccounts,
    bodian,
    bodianAccount,
    qishui,
    qishuiAccount,
    matcher:matching,
    autoMatch:()=>preferences.getSnapshot().autoMatch,
    http:options.onlineHTTP??requestJSON,
    md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),
    hash,
  });
  const matchedResolver=new MatchedResolver({matcher:matching,library,router:{resolve:async(track,signal,excluded,scope,trace,originPlatform)=>{let playable=track;try{playable=await online.enrich(track,signal);}catch{throwIfAborted(signal);}return resolver.resolve(playable,signal,excluded,scope,trace,originPlatform);}},autoMatch:()=>preferences.getSnapshot().autoMatch,quality:()=>preferences.getSnapshot().quality,qualityForPlatform:(platform,originPlatform)=>preferences.getSnapshot().playbackQualities[platform]??(originPlatform?preferences.getSnapshot().playbackQualities[originPlatform]:undefined)??preferences.getSnapshot().quality,hash,
    available:(originPlatform?:MusicPlatform)=>{
      const ready=registry.getSnapshot().filter(source=>registry.isCurrent(source));
      const routing=preferences.getSnapshot().platformSourceRouting;
      const out:OnlinePlatform[]=[];
      for(const platform of ['wy','tx','kw','kg','mg'] as const){
        const routed=applyPlatformSourceRouting(ready,platform,routing,originPlatform);
        if(routed.some(source=>source.capabilities.some(value=>value.platform===platform&&value.actions.includes('musicUrl')))){
          out.push(platform);
        }
      }
      return out;
    },
    directAvailable:(platform:MusicPlatform)=>{
      const ready=registry.getSnapshot().filter(source=>registry.isCurrent(source));
      const routed=applyPlatformSourceRouting(ready,platform,preferences.getSnapshot().platformSourceRouting);
      return routed.some(source=>source.capabilities.some(value=>value.platform===platform&&value.actions.includes('musicUrl')));
    }});
  const preloadCache=new PreloadCache({maxEntries:12,ttlMs:180_000});
  const preloadQualityFor=(track:Track)=>{const platform=trackPlatform(track);return platform?playbackQualityFor(platform):preferences.getSnapshot().quality;};
  const preloadRevision=()=>JSON.stringify([
    registry.getSnapshot().filter(source=>registry.isCurrent(source)).map(source=>[source.id,source.revision]),
    preferences.getSnapshot().smartDegradeMode,
    preferences.getSnapshot().smartCrossScript,
    preferences.getSnapshot().autoMatch,
    preferences.getSnapshot().preferAccountPlayback,
    preferences.getSnapshot().quality,
    preferences.getSnapshot().playbackQualities,
    preferences.getSnapshot().platformSourceRouting,
    musicAccounts.getSnapshot().map(a=>[a.id,a.platform]),
    bodianAccount.getSnapshot().loggedIn,
    qishuiAccount.getSnapshot().loggedIn,
  ]);
  const resolveTrack=async(track:Track,signal:AbortSignal,excluded?:ReadonlySet<string>,trace?:PlaybackTraceSink)=>{
    const mark=(title:string,sourceName:string)=>trace?.({stage:'source',status:'success',title,sourceName});
    if(track.origin.kind==='webdav'){const media=await davMedia.resolve(track,signal);mark('读取 WebDAV 媒体','WebDAV');return media;}
    if(track.origin.kind==='device'){const media=await deviceMedia.resolve(track);trace?.({stage:'source',status:'success',title:'读取系统媒体库条目',sourceName:'系统媒体库'});return media;}
    if(track.origin.kind==='local'){const media=await localAudio.resolve(track);trace?.({stage:'source',status:'success',title:'读取本机音频文件',sourceName:'本机文件'});return media;}
    if(track.origin.kind==='radio'){
      const streamUrl=typeof track.metadata.streamUrl==='string'?validRadioStreamURL(track.metadata.streamUrl):undefined;
      if(!streamUrl)throw new Error('该电台流地址无效，请尝试其他电台');
      trace?.({stage:'source',status:'success',title:'连接全球电台直播流',sourceName:'全球电台'});
      return {url:streamUrl,headers:{'User-Agent':'NexusMusic/1.0 RadioPlayer'}};
    }
    if(track.origin.kind==='navidrome'){trace?.({stage:'source',status:'info',title:'向 Navidrome 请求原始媒体',sourceName:'Navidrome'});const media=await(await accounts.client(track.origin.accountId)).resolve(track,signal);const result={...media,cacheKey:await hash(JSON.stringify([trackKey(track.origin),'original']))};trace?.({stage:'source',status:'success',title:'取得 Navidrome 原始媒体',sourceName:'Navidrome'});return result;}
    const direct=await accountPlaybackResolver.resolve(track,signal,excluded,trace);
    if(direct)return direct;
    try{
      return await matchedResolver.resolve(track,signal,excluded,trace);
    }catch(lxError){
      throwIfAborted(signal);
      const publicFallback=await accountPlaybackResolver.resolvePublicFallback(track,signal,excluded,trace);
      if(publicFallback)return publicFallback;
      throw lxError;
    }
  };
  const downloadResolver=createDownloadResolver({registry,transport:nativeLX,matcher:matching,library,preferences:preferences.getSnapshot,enrich:(track,signal)=>online.enrich(track,signal),other:{resolve:resolveTrack},hash});
  let playbackController:ReturnType<typeof createPlaybackSession>['controller']|undefined;
  const downloadDestination=new DownloadDestinationSettings(requireNativeModule<DestinationNative>('NexusFiles'),preferences.getSnapshot,Crypto.randomUUID);
  await downloadDestination.restore().catch(()=>{recoveryWarnings.push('保存目录暂不可用，请在下载设置中重新选择；原音频保留。');});
  const attachmentFiles=createManagedAttachmentFiles();
  const offlineDownloads=new OfflineDownloadStore(repository,{resolve:async(track,signal,preferredQuality)=>{
    const media=await downloadResolver.resolve(track,signal,undefined,preferredQuality);if(!/^https?:$/.test(new URL(media.url).protocol))throw new Error('此来源不支持离线保存');
    // Navidrome changes its signed salt/token on each resolve. Its existing
    // account/song/original cache identity is stable; other sources stay strict.
    return track.origin.kind==='navidrome'?{...media,resumeIdentity:media.cacheKey}:media;
  },files:createOfflineDownloadFiles(),captureDestination:()=>downloadDestination.capture(),captureAttachments:track=>captureAttachmentPolicy(track,preferences.getSnapshot()),reservedBytes:()=>attachmentFiles.usedBytes(),concurrency:()=>preferences.getSnapshot().downloadConcurrency,uuid:Crypto.randomUUID,now:Date.now,maxTotalBytes:()=>preferences.getSnapshot().offlineLimitMB*1048576,isInUse:track=>{
    const state=playbackController?.getSnapshot();if(state?.intent!=='playing')return false;
    const current=state.queue.entries.find(entry=>entry.id===state.queue.currentId)?.track;
    return !!current&&trackKey(current.origin)===trackKey(track.origin);
  }});
  await restore('offlineDownloads.v1','离线下载',()=>offlineDownloads.restore());
  const resolvePlayback=async(track:Track,signal:AbortSignal,excluded:ReadonlySet<string>|undefined,trace?:PlaybackTraceSink)=>{
    const saved=await offlineDownloads.resolve(track);
    if(saved){
      trace?.({stage:'offline',status:'success',title:'命中永久离线文件',detail:'本轮不会请求在线音源'});
      return saved;
    }
    if(!excluded?.size&&(track.origin.kind==='online'||track.origin.kind==='imported')){
      const cached=preloadCache.get(track,preloadQualityFor(track),preloadRevision());
      if(cached){
        trace?.({stage:'source',status:'success',title:'命中下一首预加载缓存',detail:'已提前完成跨源解析，直接起播'});
        return cached;
      }
    }
    if(track.origin.kind==='online'||track.origin.kind==='imported')trace?.({stage:'offline',status:'info',title:'永久离线文件未命中',detail:'继续按当前播放规则解析'});
    return resolveTrack(track,signal,excluded,trace);
  };
  const playback = createPlaybackSession({resolve:(track,signal,excluded)=>resolvePlayback(track,signal,excluded),resolveWithTrace:resolvePlayback}, preferences,{covers,library});
  playbackController=playback.controller;
  const preloader=startPreloadCoordinator({
    cache:preloadCache,
    controller:playback.controller,
    enabled:()=>preferences.getSnapshot().preloadNextTrack,
    count:()=>preferences.getSnapshot().preloadCount,
    repeat:()=>preferences.getSnapshot().repeat,
    qualityFor:preloadQualityFor,
    sourceRevision:preloadRevision,
    resolve:(track,signal)=>resolveTrack(track,signal),
  });
  let lastPreloadRev=preloadRevision(),lastPreloadEnabled=preferences.getSnapshot().preloadNextTrack,lastPreloadCount=preferences.getSnapshot().preloadCount;
  registry.subscribe(()=>{
    const rev=preloadRevision();
    if(rev!==lastPreloadRev){lastPreloadRev=rev;preloader.invalidate();}
  });
  preferences.subscribe(()=>{
    const rev=preloadRevision(),snap=preferences.getSnapshot();
    if(rev!==lastPreloadRev||snap.preloadCount!==lastPreloadCount){lastPreloadRev=rev;lastPreloadCount=snap.preloadCount;preloader.invalidate();}
    if(snap.preloadNextTrack!==lastPreloadEnabled){lastPreloadEnabled=snap.preloadNextTrack;preloader.refresh();}
  });
  const syncAccountPreload=()=>{
    const rev=preloadRevision();
    if(rev!==lastPreloadRev){lastPreloadRev=rev;preloader.invalidate();}
  };
  musicAccounts.subscribe(syncAccountPreload);
  bodianAccount.subscribe(syncAccountPreload);
  qishuiAccount.subscribe(syncAccountPreload);
  const accountFmStation=new AccountFmStation({client:accountFm,accounts:musicAccounts,playback:playback.controller,uuid:Crypto.randomUUID});
  musicAccounts.subscribe(()=>accountFmStation.stop());
  bindManualMatches(library,playback.controller);bindMatchPolicy(library,preferences,playback.controller);
  try{
    const saved=await repository.get<SavedQueue>('queue.v1');
    if(saved){playback.controller.setQueue(decodeQueue(saved));const cursor=await repository.get<SavedCursor>('queue.cursor.v1');if(cursor)playback.controller.restoreCursor(cursor.entryId,cursor.seconds);}
  }catch{recoveryWarnings.push('上次播放队列无法恢复，已从暂停状态开始；音乐库仍保留。');}
  const coverTheme=new CoverThemeStore(playback.controller,preferences,covers,visualColors);
  const picSourceSignature=()=>JSON.stringify(registry.getSnapshot().filter(source=>registry.isCurrent(source)&&source.capabilities.some(item=>item.actions.includes('pic'))).map(source=>[source.id,source.revision]));
  let lastPicSources=picSourceSignature();
  accounts.subscribe(coverTheme.invalidate);davAccounts.subscribe(coverTheme.invalidate);
  registry.subscribe(()=>{
    const next=picSourceSignature();
    if(next===lastPicSources)return;
    lastPicSources=next;
    // Already-resolved cover art does not depend on newly initialized LX sources.
    // Skipping redundant invalidations prevents full-screen theme flashes on launch and batch import.
    if(!coverTheme.getSnapshot().uri)coverTheme.invalidate();
  });
  deviceMedia.subscribe(coverTheme.invalidate);localAudio.subscribe(coverTheme.invalidate);
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
  const searchAssistance=new SearchAssistanceCoordinator(new SearchAssistanceProvider({http:options.onlineHTTP,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),deviceId:Crypto.randomUUID}));
  const artists=new ArtistProvider({http:options.onlineHTTP,textHTTP:options.onlineTextHTTP,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),sha1:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value),deviceId:Crypto.randomUUID});
  const artistSearch=new PagedSearchCoordinator(artists,item=>item.id);
  const videos=new VideoProvider({http:options.onlineHTTP,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),sha1:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value),deviceId:Crypto.randomUUID});
  const podcasts=new NeteasePodcastsProvider({http:options.onlineHTTP});
  const videoSearch=new PagedSearchCoordinator(videos,item=>item.id);
  const albums=new AlbumProvider({http:options.onlineHTTP,textHTTP:options.onlineTextHTTP,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),sha1:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,value),deviceId:Crypto.randomUUID});
  const albumSearch=new PagedSearchCoordinator(albums,item=>item.id);
  const playlistSearch=new PagedSearchCoordinator<PlaylistSearchItem>(new PlaylistSearchProvider({http:options.onlineHTTP,md5:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5,value),deviceId:Crypto.randomUUID}),item=>item.id);
  const rawLyrics=new LyricService(registry,nativeLX,async(track,signal)=>{
    if(track.origin.kind==='webdav')return davMedia.lyric(track,signal);
    if(track.origin.kind==='device')return deviceMedia.lyric(track);
    if(track.origin.kind==='local')return localAudio.lyric(track);
    if(track.origin.kind==='imported'&&track.origin.platform==='bodian')return bodian.lyric(track,signal);
    if(track.origin.kind==='imported'&&track.origin.platform==='qishui'){const cookie=await qishuiAccount.sessionCookieHeader();return qishui.lyric(track,cookie,signal);}
    if(track.origin.kind!=='navidrome')return '';
    return(await accounts.client(track.origin.accountId)).lyrics(track.origin.id,track.artist,track.title,signal);
  },options.onlineHTTP,decodeKRC,decodeQRC);
  const lyrics=new LyricSelection(rawLyrics,matching,library);
  const systemLyricPreview=new LyricPreview((track,signal)=>lyrics.load(track,signal));
  const floatingLyricsMod=requireOptionalNativeModule<{updateFloatingLyric?:(text:string|null,enabled:boolean,locked:boolean)=>Promise<void>}>('NexusLyrics');
  let systemLyricLoadedKey='',systemLyricSentKey='',floatingLyricSentKey='';
  const syncSystemLyrics=()=>{
    const pref=preferences.getSnapshot(),state=playback.controller.getSnapshot(),entry=currentEntry(state.queue);
    const activePlay=!!entry&&state.intent==='playing'&&state.phase==='ready';
    if(!pref.systemLyricsEnabled&&!pref.floatingLyricsEnabled){
      if(systemLyricSentKey!==''){systemLyricSentKey='';playback.setSystemLyricLine(null,pref.systemLyricsPosition);}
      if(floatingLyricSentKey!==''){floatingLyricSentKey='';void floatingLyricsMod?.updateFloatingLyric?.(null,false,pref.floatingLyricsLocked)?.catch(()=>{});}
      return;
    }
    if(!entry||(!activePlay&&pref.bluetoothLyricsRestoreOnPause)){
      if(systemLyricSentKey!==''){systemLyricSentKey='';playback.setSystemLyricLine(null,pref.systemLyricsPosition);}
    }
    if(!entry||!activePlay){
      if(floatingLyricSentKey!==''){floatingLyricSentKey='';void floatingLyricsMod?.updateFloatingLyric?.(null,false,pref.floatingLyricsLocked)?.catch(()=>{});}
      if(!entry||pref.bluetoothLyricsRestoreOnPause)return;
    }
    const savedMatch=entry.track.origin.kind==='imported'||entry.track.origin.kind==='online'?library.matchFor(entry.track):undefined;
    const lyricTrack=state.media?.matchedTrack??(entry.track.origin.kind==='imported'?savedMatch?.target:savedMatch?.method==='manual'&&!state.media?savedMatch.target:undefined)??entry.track;
    const sig=`${trackKey(lyricTrack.origin)}:${JSON.stringify(library.lyricChoiceFor(lyricTrack)??null)}`;
    if(systemLyricLoadedKey!==sig){systemLyricLoadedKey=sig;void systemLyricPreview.load(lyricTrack);}
    const preview=systemLyricPreview.getSnapshot();
    const raw=miniLyricText(preview.document,state.position*1000,lyricOffset(pref.lyricOffsetMs,pref.lyricOffsets,trackKey(lyricTrack.origin)));
    const converted=raw?convertLyricScript(raw,pref.lyricChineseMode):null;
    if(pref.systemLyricsEnabled&&(activePlay||!pref.bluetoothLyricsRestoreOnPause)){
      const btLine=formatBluetoothLyric(converted,lyricTrack,pref.systemLyricsPosition,pref.bluetoothLyricsOrder);
      const nextKey=`${pref.systemLyricsPosition}:${pref.bluetoothLyricsOrder}:${btLine??''}`;
      if(nextKey!==systemLyricSentKey){systemLyricSentKey=nextKey;playback.setSystemLyricLine(btLine,pref.systemLyricsPosition);}
    } else if(systemLyricSentKey!==''){
      systemLyricSentKey='';playback.setSystemLyricLine(null,pref.systemLyricsPosition);
    }
    if(pref.floatingLyricsEnabled&&activePlay){
      const nextFloat=`${pref.floatingLyricsLocked}:${converted??''}`;
      if(nextFloat!==floatingLyricSentKey){floatingLyricSentKey=nextFloat;void floatingLyricsMod?.updateFloatingLyric?.(converted,true,pref.floatingLyricsLocked)?.catch(()=>{});}
    } else if(floatingLyricSentKey!==''){
      floatingLyricSentKey='';void floatingLyricsMod?.updateFloatingLyric?.(null,false,pref.floatingLyricsLocked)?.catch(()=>{});
    }
  };
  playback.controller.subscribe(syncSystemLyrics);
  preferences.subscribe(syncSystemLyrics);
  systemLyricPreview.subscribe(syncSystemLyrics);
  library.subscribe(syncSystemLyrics);
  const managedAttachments=new ManagedDownloadAttachments(repository,{downloads:offlineDownloads,files:attachmentFiles,maximumBytes:()=>preferences.getSnapshot().offlineLimitMB*1048576,lyrics:async(track,signal)=>(await lyrics.load(track,signal)).document,cover:(track,signal,size)=>covers.loadForExport(track,signal,size)});
  if(!await restore('managedDownloadAttachments.v1','下载附加文件',()=>managedAttachments.restore()))await managedAttachments.restore().catch(()=>{});
  const downloadDelivery=new DownloadDelivery(repository,{downloads:offlineDownloads,attachments:managedAttachments,destination:downloadDestination,files:offlineAudioExportFiles});
  if(!await restore('downloadDelivery.v1','目录保存',()=>downloadDelivery.restore()))await downloadDelivery.restore().catch(()=>{});
  accounts.subscribe(()=>{lyrics.clear();systemLyricLoadedKey='';});
  let previousDAVAccounts=davAccounts.getSnapshot();
  davAccounts.subscribe(()=>{const old=previousDAVAccounts;previousDAVAccounts=davAccounts.getSnapshot();lyrics.clear();systemLyricLoadedKey='';const state=playback.controller.getSnapshot(),origin=state.queue.entries.find(item=>item.id===state.queue.currentId)?.track.origin;if(origin?.kind==='webdav'&&old.find(item=>item.id===origin.accountId)!==previousDAVAccounts.find(item=>item.id===origin.accountId))playback.controller.setQueue({...state.queue,currentId:null,priorityIds:[]});});
  deviceMedia.subscribe(()=>{const state=deviceMedia.getSnapshot();if(state.authorization!=='authorized'||state.stale){lyrics.clear();systemLyricLoadedKey='';}});
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
  davSync.start();davSync.setForeground(AppState.currentState==='active');
  AppState.addEventListener('change',state=>{davSync.setForeground(state==='active');if(state==='active')void davSync.previewIfConfigured();});
  void davSync.previewIfConfigured();
  const songFavorites=createSongFavorites(library,localAudio);
  const probeDownloadQuality=createDownloadQualityProbe(downloadResolver);
  const submitDownloads=createDownloadSubmission(offlineDownloads);
  const nativeAux=requireOptionalNativeModule<DlnaNativeBridge&AudioMatchNativeBridge&CarNativeBridge&{getNetworkStatus?:()=>Promise<Partial<SystemNetworkInfo>>}>('NexusNative');
  const networkDiagnostics=new NetworkDiagnosticsCoordinator({
    registry,
    displayNameForSource:source=>catalog.getSnapshot().find(item=>item.id===source.id)?.displayName??source.name,
    openDiagnostic,
    discover:async(platform,signal)=>{
      if(platform==='qishui'){
        const charts=await qishui.fetchCharts(signal).catch(()=>[]);
        if(charts.length>0)return charts.length;
        const pub=await qishui.publicDiagnosticTrack(signal);
        return pub?1:0;
      }
      if(platform==='bodian'){
        const session=bodianAccount.getSnapshot().loggedIn?await bodianAccount.session().catch(()=>null):null;
        const playlists=await bodian.recommendedPlaylists(signal,session).catch(()=>[]);
        if(playlists.length>0)return playlists.length;
        const charts=await bodian.charts(signal,session);
        return charts.length;
      }
      const page=await discovery.playlists(platform,1,undefined,signal,8).catch(()=>({items:[] as readonly unknown[],hasMore:false,page:1}));
      if(page.items.length>0)return page.items.length;
      const ranks=await discovery.rankings(platform,signal);
      return ranks.length;
    },
    searchSample:async(platform,keyword,signal)=>{
      if(platform==='qishui'){
        const snap=qishuiAccount.getSnapshot();
        const localTrack=snap.recent[0]??snap.liked[0]??snap.playlists[0]?.tracks[0];
        if(localTrack&&/^\d{5,30}$/.test(localTrack.origin.id))return localTrack;
        const charts=await qishui.fetchCharts(signal).catch(()=>[]);
        for(const chart of charts){
          if(chart.previewTracks.length>0)return chart.previewTracks[0];
        }
        const firstChart=charts[0];
        if(firstChart){
          const tracks=await qishui.fetchChartTracks(firstChart.id,signal).catch(()=>[]);
          if(tracks[0])return tracks[0];
        }
        return qishui.publicDiagnosticTrack(signal);
      }
      if(platform==='bodian'){
        const session=bodianAccount.getSnapshot().loggedIn?await bodianAccount.session().catch(()=>null):null;
        const res=await bodian.searchSongs(keyword,1,signal,session);
        return pickBestDiagnosticSample(res.items,'bodian',keyword)??res.items[0];
      }
      const res=await online.search(platform,keyword,1,signal,10).catch(()=>({items:[] as readonly Track[],page:1,hasMore:false}));
      const directHit=pickBestDiagnosticSample(res.items,platform,keyword);
      if(directHit)return directHit;
      // Fallback to first track from platform public playlist when unsigned search returns 0 (e.g. Kugou WebFilter).
      const pls=await discovery.playlists(platform,1,undefined,signal,5).catch(()=>({items:[] as readonly {id:string}[],page:1,hasMore:false}));
      const firstPl=pls.items[0];
      if(!firstPl)return undefined;
      const detail=await discovery.detail(platform,firstPl.id,1,signal,false,5).catch(()=>({title:'',items:[] as readonly Track[],page:1,hasMore:false}));
      return detail.items.find(item=>item.origin.kind==='online'&&item.origin.platform===platform);
    },
    resolveSample:(track,signal)=>resolveTrack(track,signal),
    matchSample:async(track,signal)=>{
      const res=await matching.candidates(track,signal).catch(()=>({items:[] as readonly {track:Track;automatic:boolean}[],failedPlatforms:[]}));
      const seen=new Set<OnlinePlatform>();
      const out:Track[]=[];
      for(const item of res.items){
        if(item.track.origin.kind!=='online')continue;
        if(seen.has(item.track.origin.platform))continue;
        if(!item.automatic&&out.length>0)continue;
        seen.add(item.track.origin.platform);
        out.push(item.track);
      }
      return out;
    },
    enrichOnlineTrack:(track,signal)=>online.enrich(track,signal),
    probe:audioProbe,
    readNetworkStatus:async()=>nativeAux?.getNetworkStatus?nativeAux.getNetworkStatus():undefined,
  });
  const dlna=new DlnaCastController({native:nativeAux,repository});
  await restore('dlna.v1','DLNA 投屏记录',()=>dlna.restore());
  const audioMatch=new AudioMatchCoordinator({native:nativeAux,repository,secrets:nativeSecrets,search:(platform,q,page,signal,limit)=>online.search(platform,q,page,signal,limit)});
  await restore('audioMatch.v1','听歌识曲记录',()=>audioMatch.restore(),AUDIO_MATCH_RECORD_VERSION);
  const carIntegration=new CarIntegrationCoordinator({native:nativeAux,library,actions:{playTracks,resume:()=>{void playback.controller.play();},pause:()=>playback.controller.pause(),next:(dir)=>playback.next(dir)}});
  carIntegration.start();
  return { similarSongs:readSimilarSongs, probeDownloadQuality, submitDownloads, searchAssistance, accountMVs, accountAlbums, accountDiscovery, accountHeartbeat, accountFeatureCache, accountInsights, accountPlaybackResolver, bodian, bodianAccount, bodianQrLogin, bodianQrPhoto, videos, podcasts, radioApi, radioStore, dlna, audioMatch, carIntegration, networkDiagnostics, videoSearch, artists, artistSearch, albums, albumSearch, playlistSearch, qqAccountTransfer, kugouQrPhoto, neteaseQrPhoto, accountPlaylists, accountRecommendedPlaylists, qqDailyAuthorization, qqFavorite, neteaseFavorite, neteasePlaylist, neteasePlaylistDelete, neteasePlaylistTracks, snapshotBackup, songFavorites, coverTheme, davStatistics, davSync, repository, visualAssets, visualColors, davAccounts, davBackups, davMedia, deviceMedia, devicePlaylists, localAudio, offlineDownloads, managedAttachments, downloadDestination, downloadDelivery, nativeLX, registry, catalog, preferences, searchHistory, resolver, playback, playbackStats, recommendations, accountDaily, accountFm, accountFmStation, covers, online, matching, comments, sourceHealth, qishui, qishuiAccount, loginQishui, search, discovery, resolvePlaylistLink:(input:string,platform:OnlinePlatform,signal:AbortSignal)=>resolvePlaylistLink(input,platform,signal,options.playlistLinkExpander), playTracks, addToQueue, addTracksToQueue, restoreBackup, accounts, musicAccounts, musicAuth, musicWebLogin, neteaseQrLogin, kugouLogin, neteaseProfile, qqProfile, library, lyrics, fonts, recoveryWarnings };
}
export type Services = Awaited<ReturnType<typeof createServices>>;
let pending: Promise<Services> | undefined;
export function getServices() {
  if (!pending) pending = createServices().catch(error => { pending = undefined; throw error; });
  return pending;
}
