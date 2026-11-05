import {themeCovers} from './fixtures/theme-covers.mjs';
import {photoArtwork} from './fixtures/photo-artwork.mjs';
import {fixtureFont} from './fixtures/font.mjs';
import {silentMP3} from './fixtures/silent-mp3.mjs';
import { createServer } from 'node:http';
import { spawn,execFileSync } from 'node:child_process';
import { openSync, closeSync,writeFileSync,readFileSync,mkdirSync,rmSync,watch,statSync,readSync,existsSync,readdirSync,realpathSync } from 'node:fs';
import {basename,resolve,sep} from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {fileSha256,sourceSnapshot,installedBundleSnapshot,externalInputSnapshot} from './lib/ui-provenance.mjs';
import {loadReferenceScene} from './lib/reference-scene.mjs';
import {exportFailureEvidence} from './export-failure-evidence.mjs';
import {ThemeObservation} from './lib/theme-observation.mjs';

const runDirectory=process.env.NEXUS_UI_RUN_DIR??'build/logs';
const popularArtistsUI=process.argv.slice(2).some(target=>(target.endsWith('/testLivePopularArtists')||target.endsWith('/testLiveNewAlbums')));
const miguAlbumImportUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveMiguAlbumImportPersistence'));
const livePublicCatalogUI=popularArtistsUI||miguAlbumImportUI;
const derivedDataPath=process.env.NEXUS_UI_DERIVED_DATA??'build/DerivedData';
if(process.env.NEXUS_UI_RUN_DIR&&existsSync(resolve(runDirectory,'run-manifest.json')))throw new Error('Refusing to overwrite a capture run manifest');
// Intel simulators cannot link the prebuilt Release Hermes (missing inspector
// symbols); Debug links the debug framework and is for local visual iteration
// only. Formal evidence stays Release.
const configuration=process.env.NEXUS_UI_CONFIGURATION??'Release';
if(!['Debug','Release'].includes(configuration))throw new Error(`Unsupported NEXUS_UI_CONFIGURATION: ${configuration}`);
const liveDownloadDestinationUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadDestination'));
const liveManagedAttachmentsUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveManagedDownloadAttachments'));
const liveDownloadCoverUI=process.argv.slice(2).some(target=>/\/testLiveDownloadCover(?:Large|Small)$/.test(target));
const liveDownloadAttachmentsUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadAttachments'));
const liveDownloadExportUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadNamingExport'));
const liveBackupSettingsUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveBackupSettings'));
const systemVolumeUI=process.argv.slice(2).some(target=>target.endsWith('/testSystemAndAppVolumeControlsPreservePlayback'));
const liveThemeConfigUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveThemeConfig'));
const liveStatisticsSyncUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveStatisticsSync'));
const liveLocalUI=process.argv.slice(2).some(target=>/\/testLive(?:Local(?:IndexActions|Sorting|FolderScan|PlaylistBatch)|ListeningStatistics|StatisticsSync|BackupSettings|RestoredTimeline|ThemeConfig|RetainedAudio|DownloadPolicy|DiscoveryRandom|Similar(?:Songs|Controls)|PlayerDownloadQualityChoice|SongShare|SongDownloadEntries|SongDownloadQualityChoice|DownloadNaming|DownloadNamingExport|DownloadAttachments|DownloadQuality|DownloadCover(?:Large|Small)|ManagedDownloadAttachments|DownloadDestination|QQWebLogin|KugouQrLogin|PlatformRecommendations|QQDailyAuthorization|BackgroundPersistence|AccountMVEntry|AccountAlbumEntry|AccountPlaylistEntry|QQPlaylistEntry|KugouPlaylistEntry|KugouQrPhoto(?:Denied|Save)|QQComputerPairing|PlaylistSearch|AlbumSearch|ArtistSearch|MVSearch|SearchAssistance|MiguSearchAssistance|CatalogFavorites)$/.test(target));
if(Boolean(process.env.NEXUS_UI_LOCAL_AUDIO)!==liveLocalUI||(liveLocalUI&&process.argv.slice(2).length!==1))throw new Error('Real local audio requires its single explicit live local target and audio path');
const liveLocalPath=liveLocalUI?realpathSync(process.env.NEXUS_UI_LOCAL_AUDIO):null;
const liveLocalFolderUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveLocalFolderScan'));
const liveLocalSorting=liveLocalFolderUI||process.argv.slice(2).some(target=>/\/(?:testLiveLocal(?:Sorting|PlaylistBatch)|testLiveRetainedAudio)$/.test(target));
if(Boolean(process.env.NEXUS_UI_LOCAL_AUDIO_SECOND)!==liveLocalSorting)throw new Error('Real two-song local verification requires a second actual audio file and its explicit target');
const liveLocalPaths=liveLocalPath?[liveLocalPath,...(liveLocalSorting?[realpathSync(process.env.NEXUS_UI_LOCAL_AUDIO_SECOND)]:[])]:[];
const liveBackgroundUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveBackgroundPersistence'));
if(Boolean(process.env.NEXUS_UI_LOCAL_IMAGE)!==liveBackgroundUI)throw new Error('A public cover image requires the single live background persistence target');
const liveImagePath=liveBackgroundUI?realpathSync(process.env.NEXUS_UI_LOCAL_IMAGE):null;
if(liveImagePath&&(basename(liveImagePath)!=='Shape-cover.jpg'||statSync(liveImagePath).size<1000||statSync(liveImagePath).size>10000000))throw new Error('Live background requires the complete public Shape-cover.jpg');
const liveInputPaths=[...liveLocalPaths,...(liveImagePath?[liveImagePath]:[])];
const liveLocalSnapshot=liveLocalPath?externalInputSnapshot(liveInputPaths):null;
if(liveLocalPaths.some(path=>!/\.mp3$/i.test(path)||statSync(path).size<100000||statSync(path).size>30000000))throw new Error('Real local audio must be a complete MP3 of 100 KB–30 MB');
let localFixtureDirectory,wayfarerFixtureAudioPath;
function seedLocalAudio() {
  if(localFixtureDirectory)return;
  try {
    const groups=execFileSync('xcrun',['simctl','get_app_container',process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D','com.apple.DocumentsApp','groups'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
    const container=groups.split('\n').find(line=>line.startsWith('group.com.apple.FileProvider.LocalStorage\t'))?.split('\t')[1];if(!container)return;
    localFixtureDirectory=resolve(container,'File Provider Storage',liveLocalFolderUI?'Nexus Real Scan':'Nexus UITest Fixtures');mkdirSync(localFixtureDirectory,{recursive:true});
    if(liveLocalPath){
      const seeded=liveInputPaths.map((path,index)=>{const directory=liveLocalFolderUI&&index===1?resolve(localFixtureDirectory,'Albums'):localFixtureDirectory;mkdirSync(directory,{recursive:true});const destination=resolve(directory,basename(path));writeFileSync(destination,readFileSync(path));return [path,destination];});
      if(seeded.some(([path,destination])=>fileSha256(destination)!==fileSha256(path)))throw new Error('Real audio copy hash mismatch');
      console.log('[ui-real-audio] unchanged public audio copied into Files');return;
    }
    writeFileSync(resolve(localFixtureDirectory,'Synthetic Tagged Tone.mp3'),silentMP3(1200));writeFileSync(resolve(localFixtureDirectory,'Nexus Fixture.ttf'),fixtureFont());
    // Deterministic original image for the real Files picker path. Production
    // code performs the resize/re-encode and metadata stripping after import.
    writeFileSync(resolve(localFixtureDirectory,'Nexus Visual Fixture.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
    const list=Array.from({length:1000},(_,i)=>({id:`wy_${i<2?'90071992547409931234':i}`,name:i<2?'Duplicate fixture':`Fixture song ${i}`,singer:'Synthetic artist',source:'wy',interval:i<2?'03:00':'01:00',meta:{songId:i<2?'90071992547409931234':String(i),albumName:i<2?'Repeated album':'Bulk album'}}));
    writeFileSync(resolve(localFixtureDirectory,'Nexus Playlist Fixture.json'),JSON.stringify({type:'playListPart_v2',data:{name:'Nexus list fixture',list}}));
    const wayfarerFixtureTrackId=`WAYFARER${Date.now().toString(36).toUpperCase()}`;
    wayfarerFixtureAudioPath=`/matching-audio/${wayfarerFixtureTrackId}.wav`;
    const wayfarerTrack=(id,providerId,title,durationMs=120000)=>({
      id:`${providerId}:${id}`,providerId,title,artist:'Fixture artist',album:'Synthetic Wayfarer album',durationMs,
      artworkUri:'https://private.invalid/cover?token=fixture-secret',sourceKind:'url',sourceUri:'https://private.invalid/media?password=fixture-secret',
      sourceUserAgent:'fixture-secret',sourceResolvedQuality:'flac',sourceResolvedProviderId:'private-source',
    });
    const wayfarer={
      version:1,createdAtMs:1,
      sources:[
        {id:'private-source',endpoint:'https://private.invalid',username:'fixture-user',password:'fixture-secret',script:'private-source-script'},
        {id:'private-source-two',apiKey:'fixture-secret',rootPath:'/private/root'},
      ],
      settings:{password:'fixture-secret',sourceScript:'private-source-script',androidOnly:true},
      favorites:{ids:['lx:tx:WAYFARERFAVORITE'],tracks:[wayfarerTrack('WAYFARERFAVORITE','lx:tx','Wayfarer Favorite')]},
      playlists:[
        {id:'private-playlist-a',title:'Nexus Wayfarer Fixture A',subtitle:'private',tracks:[
          wayfarerTrack('1001','lx:wy','Wayfarer first'),
          wayfarerTrack(wayfarerFixtureTrackId,'lx:tx','Wayfarer second'),
          wayfarerTrack('1001','lx:wy','Wayfarer first'),
        ]},
        {id:'private-playlist-b',title:'Nexus Wayfarer Fixture B',subtitle:'private',tracks:[
          wayfarerTrack('90071992547409931234','lx:qishui','Wayfarer Qishui'),
          wayfarerTrack('private','lx:unsupported','Wayfarer unsupported'),
        ]},
      ],
    };
    writeFileSync(resolve(localFixtureDirectory,'Nexus Wayfarer Fixture.json'),JSON.stringify(wayfarer));
    const lxmc={type:'playListPart_v2',data:{name:'Nexus LXMC fixture',list:[
      {id:'2829_abcdef',name:'KG fixture',singer:'Synthetic artist',source:'kg',interval:'4:00',meta:{songId:'2829',hash:'abcdef',qualitys:[{type:'128k',size:'3.56M',hash:'h1'}],_qualitys:{'128k':{size:'3.56M',hash:'h1'}}}},
      {id:'tx_MID',name:'TX fixture',singer:'Synthetic artist',source:'tx',interval:'3:02',meta:{songId:'MID',id:'9007199254740993123',strMediaMid:'MID_HI',qualitys:[{type:'320k',size:'9.99M'}]}},
      {id:'kg_2829_abcdef',name:'KG fixture',singer:'Synthetic artist',source:'kg',interval:'4:00',meta:{songId:'2829',hash:'abcdef'}},
    ]}};
    writeFileSync(resolve(localFixtureDirectory,'Nexus LXMC Fixture.lxmc'),gzipSync(Buffer.from(JSON.stringify(lxmc))));
    for(const name of ['Synthetic Tagged Tone.mp3','Nexus Fixture.ttf','Nexus Visual Fixture.png','Nexus Playlist Fixture.json','Nexus Wayfarer Fixture.json','Nexus LXMC Fixture.lxmc']){
      const path=resolve(localFixtureDirectory,name);if(!existsSync(path)||statSync(path).size===0)throw new Error(`Fixture not written: ${name}`);
    }
    console.log(`[ui-fixtures] ${localFixtureDirectory}`);
  } catch (error) {
    // Fresh CI simulator: the Files app container may not exist yet.
    console.warn(`[ui-fixtures] ${error instanceof Error?error.message:String(error)}`);
  }
}
seedLocalAudio();
// Explicit local opt-in: serve unchanged private scripts only to the simulator.
// These bytes are never imported by Metro or written into the app bundle.
const liveSongShareUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveSongShare'));
const liveSimilarSongsUI=process.argv.slice(2).some(target=>/\/testLive(?:Similar(?:Songs|Controls)|DiscoveryRandom)$/.test(target));
const liveSongDownloadUI=process.argv.slice(2).some(target=>/\/testLive(?:SongDownload(?:Entries|QualityChoice)|PlayerDownloadQualityChoice)$/.test(target));
const liveDownloadNamingUI=liveSongShareUI||liveSimilarSongsUI||liveSongDownloadUI||process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadNaming'));
const liveCatalogUI=liveDownloadNamingUI||process.argv.slice(2).some(target=>/\/testLiveSource(?:Catalog|Playback|SearchStates)$/.test(target));
const liveDownloadUI=liveSongDownloadUI||process.argv.slice(2).some(target=>/\/testLiveDownload(?:Batch|Naming)$/.test(target));
if(liveDownloadUI&&process.argv.slice(2).length!==1)throw new Error('Real download batch requires its single explicit live target');
let liveSources=[];
if(liveCatalogUI){
  if(!process.env.NEXUS_LX_SOURCE_DIRECTORY)throw new Error('Live source catalog requires an explicit local directory');
  const directory=realpathSync(process.env.NEXUS_LX_SOURCE_DIRECTORY);
  const visit=folder=>readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
    const path=resolve(folder,entry.name);
    if(entry.isSymbolicLink())throw new Error('Live source directory must not contain symbolic links');
    return entry.isDirectory()?visit(path):entry.isFile()&&/\.js$/i.test(entry.name)?[path]:[];
  });
  if(liveDownloadNamingUI&&!/^[a-f0-9]{64}$/.test(process.env.NEXUS_UI_DOWNLOAD_SOURCE_SHA256??''))throw new Error('Real naming requires an explicit source SHA256');
  liveSources=visit(directory).filter(path=>!liveDownloadNamingUI||fileSha256(path)===process.env.NEXUS_UI_DOWNLOAD_SOURCE_SHA256).map(path=>{
    const script=readFileSync(path,'utf8');
    if(Buffer.byteLength(script)>8*1024*1024)throw new Error('Live source exceeds import size limit');
    const header=script.slice(0,16384).match(/^\s*(?:\/\*([\s\S]*?)\*\/|((?:\/\/[^\n]*\n)+))/)?.[0]??'';
    const name=(header.match(/@name\s+([^\r\n]*)/)?.[1]??'').replace(/\*\/$/,'').trim().slice(0,128)||path.split(sep).at(-1).replace(/\.js$/i,'').slice(0,128);
    return {path,script,name,sha256:fileSha256(path)};
  });
  if(!liveSources.length||liveSources.length>32)throw new Error('Live source count outside catalog limit');
  mkdirSync(runDirectory,{recursive:true});
  writeFileSync(resolve(runDirectory,'private-source-manifest.json'),JSON.stringify(liveSources.map(({path,name,sha256})=>({path,name,sha256})),null,2));
  console.log(`Live local sources: ${liveSources.length}; contents remain private`);
}
let fixture = `/**\n * @name Nexus UI Test Source\n * @version 1.0-test\n */\nlx.on('request', async()=>{throw new Error('test only')});\nlx.send('inited',{sources:{wy:{name:'Fixture',actions:['musicUrl'],qualitys:['128k']}}});`;
if(process.env.NEXUS_LX_VALIDATION_SOURCE){
  const directory=resolve('resource/V261008'),path=resolve(directory,process.env.NEXUS_LX_VALIDATION_SOURCE);
  if(!path.startsWith(directory+sep)||!path.endsWith('.js'))throw new Error('Validation source must be a local JS fixture');
  const script=readFileSync(path,'utf8');
  fixture=script.replace(/@name[^\r\n]*/, '@name Nexus Live Validation Source');
  if(!fixture.includes('@name Nexus Live Validation Source'))fixture='/** @name Nexus Live Validation Source */\n'+fixture;
}
const audio = Buffer.alloc(44+48000*2*12);
audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(48000,24);audio.writeUInt32LE(96000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40);
for(let i=0;i<(audio.length-44)/2;i++)audio.writeInt16LE(Math.round(1000*Math.sin(2*Math.PI*1000*i/48000)),44+i*2);
let starred=false;
const backupDirectories=new Set(['/backup-dav/','/sync-dav/']),backupFiles=new Map();
let syncHoldNextRead=false;const syncHeldReads=[];
const counts={requests:{},authFailures:0,authSuccesses:0};
counts.accountFm={mode:'normal',holdNext:false,held:0,released:0,requests:[],authFailures:0,daily:0,coverMetadata:0};
let heldAccountFmResponses=[];
let wyRepliesNextPageFails=true;
let qqCommentsMode='normal',qqCommentsNextPageFails=true,qqRepliesNextPageFails=true,qqRepliesMode='normal',miguCommentsMode='normal',miguCommentsNextPageFails=true,miguRepliesNextPageFails=true,miguRepliesMode='normal',kuwoCommentsMode='normal',kuwoCommentsNextPageFails=true,kugouCommentsMode='normal',kugouCommentsNextPageFails=true,kugouRepliesNextPageFails=true;
const amllLyricsUI=process.argv.slice(2).some(target=>target.endsWith('/testAMLLProfileLyrics')||target.endsWith('/testAMLLProfileLyricsAtAccessibilityXXXL'));
const sequentialLyricsUI=process.argv.slice(2).some(target=>target.endsWith('/testSequentialTTMLLyrics'));
const timedLyricsUI=amllLyricsUI||sequentialLyricsUI;
if(timedLyricsUI&&process.argv.slice(2).length!==1)throw new Error('Timed TTML requires its single explicit target so malformed-TTML fallback coverage stays separate');
const matchingUI=timedLyricsUI||process.argv.slice(2).some(target=>target.endsWith('/testCrossPlatformLyrics')||target.endsWith('/testOnlineMatching')||target.endsWith('/testSourceHealth')||target.endsWith('/testPublicComments')||target.endsWith('/testPublicQQComments')||target.endsWith('/testPublicMiguComments')||target.endsWith('/testPublicKuwoComments')||target.endsWith('/testPublicKugouComments')||target.endsWith('/testWayfarerAppImport'));
const discoveryUI=process.argv.slice(2).some(target=>target.endsWith('/testDiscoverySongActions')||target.endsWith('/testStyleRecommendation'));
const searchUI=process.argv.slice(2).some(target=>target.endsWith('/testSearchHistoryAndStates')||target.endsWith('/testUnifiedSongAlbumArtistSearch')||target.endsWith('/testUnifiedSearchAggregateFivePlatformMatrix'));
const qishuiUI=process.argv.slice(2).some(target=>target.endsWith('/testQishuiPublicPlaylistImport'));
const accountFmUI=process.argv.slice(2).some(target=>target.endsWith('/testAccountFmStationContinuation'));
const fixtureOnlineUI=matchingUI||discoveryUI||searchUI||qishuiUI||accountFmUI;
const unifiedSearchScript=`/**\n * @name Nexus Unified Search Fixture\n * @version 1.0-test\n */
lx.on('request',async({source,action})=>{
  if(action!=='musicUrl')throw new Error('unsupported fixture action');
  return 'http://127.0.0.1:18439/unified-search-audio/'+source+'.wav';
});
lx.send('inited',{sources:{wy:{name:'Unified Search WY',actions:['musicUrl'],qualitys:['128k']},tx:{name:'Unified Search TX',actions:['musicUrl'],qualitys:['128k']},kw:{name:'Unified Search KW',actions:['musicUrl'],qualitys:['128k']},kg:{name:'Unified Search KG',actions:['musicUrl'],qualitys:['128k']},mg:{name:'Unified Search MG',actions:['musicUrl'],qualitys:['128k']}}});`;
const navidromeNavigationUI=process.argv.slice(2).some(target=>target.endsWith('/testNavidromeBrowseHistory'));
const structuredLyricsUI=process.argv.slice(2).some(target=>target.endsWith('/testStructuredNavidromeLyrics'));
const classicReferenceUI=process.argv.slice(2).some(target=>target.endsWith('/testVisualLabClassicReferenceDirect'));
const vinylReferenceUI=process.argv.slice(2).some(target=>target.endsWith('/testVisualLabVinylReferenceDirect'));
const referenceUI=classicReferenceUI||vinylReferenceUI;
if(Boolean(process.env.NEXUS_UI_REFERENCE_SCENE)!==referenceUI)throw new Error('Reference scene requires its single explicit reference capture target and local JSON');
const referenceScene=referenceUI?loadReferenceScene(process.env.NEXUS_UI_REFERENCE_SCENE,vinylReferenceUI?93:266):null;
const classicShortUI=process.argv.slice(2).some(target=>target.endsWith('/testVisualLabClassicShortDirect'));
const classicUI=classicReferenceUI||structuredLyricsUI||classicShortUI||vinylReferenceUI||process.argv.slice(2).some(target=>target.endsWith('/testVisualLabClassicDirect'));
const appearanceUI=process.argv.slice(2).some(target=>target.endsWith('/testVisualLabAppearanceDirect'));
if((appearanceUI||classicUI)&&(process.argv.slice(2).length!==1||fixtureOnlineUI))throw new Error('The appearance capture entry requires its single explicit test target');
const coverThemeUI=process.argv.slice(2).some(target=>target.endsWith('/testGlobalCoverThemeChangesAcrossPages'));
const playlistCoverUI=process.argv.slice(2).some(target=>target.endsWith('/testLibraryPlaylistCoverURL'));
const entryFile=vinylReferenceUI?'tests/e2e/vinyl.tsx':classicUI?'tests/e2e/classic.tsx':appearanceUI?'tests/e2e/appearance.tsx':fixtureOnlineUI||coverThemeUI?'tests/e2e/entry.tsx':null;
const themeObservation=new ThemeObservation();
// Optional public recording for this functional race regression. Controlled
// artwork identities remain test data and are not visual acceptance evidence.
const themeAudioPath=process.env.NEXUS_UI_THEME_AUDIO?realpathSync(process.env.NEXUS_UI_THEME_AUDIO):null;
let themeAudioDuration=null,themeAudioSnapshot=null;
if(themeAudioPath){
  if(!coverThemeUI||process.argv.slice(2).length!==1||!themeAudioPath.endsWith('.mp3'))throw Error('Theme audio requires the single cover-theme regression and a complete MP3');
  const expected=process.env.NEXUS_UI_THEME_AUDIO_SHA256;
  if(!/^[a-f0-9]{64}$/.test(expected??'')||fileSha256(themeAudioPath)!==expected)throw Error('Theme audio SHA-256 mismatch');
  if(statSync(themeAudioPath).size>30*1024*1024)throw Error('Theme audio exceeds the bounded regression input');
  const info=execFileSync('/usr/bin/afinfo',['-r',themeAudioPath],{encoding:'utf8',env:{...process.env,LC_ALL:'C'}});
  themeAudioDuration=Number(/estimated duration:\s*([\d.]+) sec/.exec(info)?.[1]);
  if(!Number.isFinite(themeAudioDuration)||themeAudioDuration<=0||themeAudioDuration>1800)throw Error('Theme recording duration unavailable or outside the bounded input');
  themeAudioSnapshot=externalInputSnapshot([themeAudioPath]);
}
const offlineUI=process.argv.slice(2).some(target=>['/testDownloadSettingsAndOfflinePlayback','/testDownloadTaskBatchActions'].some(suffix=>target.endsWith(suffix)));
let blockOfflineStream=false,holdOfflineFull=false;
const offlineCounts={full:0,resumed:0,blocked:0,heldFull:0,fullFinished:0};
let qishuiHoldFirst=false;
const heldQishuiResponses=[];
let holdDiscoveryDetail=false;
let truncateDiscoveryPlaylist=true;
let amLongQueue=false;
let pagerDiscovery=false,pagerReplacement=false,pagerFailNext=false;
const pagerPages=[];
const heldDiscoveryResponses=[];
let discoveryDetailMode='normal',playlistLinkMode='normal',holdNextPlaylistLink=false,playlistLinkRequests=0;
const heldPlaylistLinkResponses=[];
let styleCategoryMode='normal',stylePlaylistMode='normal',holdNextStyleCategories=false,holdStylePlaylists=false;
const failedStyleTags=new Set(),heldStyleCategoryResponses=[],heldStylePlaylistResponses=[];
const transitionVersion=String(Date.now()),heldThemeResponses=[],releasedThemeColors=new Set();
let transitionFixture=false,themeRecorder;

const matchingAudio=Buffer.alloc(44+48000*2*120);audio.copy(matchingAudio,0,0,44);matchingAudio.writeUInt32LE(matchingAudio.length-8,4);matchingAudio.writeUInt32LE(matchingAudio.length-44,40);
for(let offset=44;offset<matchingAudio.length;offset+=audio.length-44)audio.copy(matchingAudio,offset,44,Math.min(audio.length,44+matchingAudio.length-offset));
const matchingScript=`/**\n * @name Nexus Matching Fixture\n * @version 1.0-test\n */
lx.on('request',async({source,action,info})=>{
  if(action!=='musicUrl')throw new Error('unsupported fixture action');
  if(source==='wy')throw new Error('synthetic original unavailable');
  return 'http://127.0.0.1:18439/matching-audio/'+info.musicInfo.meta.songmid+'.wav';
});
lx.send('inited',{sources:{wy:{name:'Fixture WY',actions:['musicUrl'],qualitys:['flac','320k','128k']},tx:{name:'Fixture TX',actions:['musicUrl'],qualitys:['flac','320k','128k']}}});`;
const healthScript=matchingScript.replace('Nexus Matching Fixture','Nexus Health Fixture').replace("return 'http://127.0.0.1:18439/matching-audio/'","if(info.musicInfo.meta.songmid==='fixture-slow')await new Promise(resolve=>setTimeout(resolve,5000)); return 'http://127.0.0.1:18439/matching-audio/'");
// UI transport/skin/font checks need a track that stays active while XCTest
// scrolls and queries accessibility on slower runners. Natural EOF is covered
// by the native playback tests; serve truthful 120-second metadata and bytes.
const navidromeDuration=themeAudioDuration??referenceScene?.duration??120;
const navidromeAudio=themeAudioPath?readFileSync(themeAudioPath):referenceScene?Buffer.alloc(44+48000*2*navidromeDuration):matchingAudio;
if(referenceScene){
  matchingAudio.copy(navidromeAudio,0,0,44);navidromeAudio.writeUInt32LE(navidromeAudio.length-8,4);navidromeAudio.writeUInt32LE(navidromeAudio.length-44,40);
  for(let offset=44;offset<navidromeAudio.length;offset+=audio.length-44)audio.copy(navidromeAudio,offset,44,Math.min(audio.length,44+navidromeAudio.length-offset));
}
// Version the synthetic recording when its bytes change. Existing test devices
// can still contain the original 12-second recording in the normal audio cache.
const photoArtworkVersion=String(Date.now()),photoArtworkKinds=['portrait','landscape','missing','corrupt'];
const photoCoverRequests=counts.photoCoverRequests={};
const photoSongs=()=>photoArtworkKinds.map(kind=>({...song(),id:`photo-${kind}-${photoArtworkVersion}`,title:`${kind} artwork tone`,coverArt:`photo-${kind}-${photoArtworkVersion}`}));
const song=()=>({id:referenceScene?'fixture-classic-reference-v2-'+referenceScene.id:structuredLyricsUI?'fixture-classic-structured-sparse-v1':classicUI?(classicShortUI?'fixture-classic-two-lines-v1':'fixture-classic-three-lines-v1'):'fixture-song-120s-v2',title:classicUI?'嗜好':'Synthetic tone',artist:classicUI?'颜人中':'Fixture artist',album:'Synthetic album',coverArt:referenceScene?'fixture-cover-reference-v2-'+referenceScene.id:'fixture-cover-motion-v1',duration:navidromeDuration,suffix:themeAudioPath?'mp3':'wav',...(starred?{starred:'2026-01-01T00:00:00Z'}:{})});
const amQueueSongs=()=>[song(),...Array.from({length:7},(_,index)=>({...song(),id:`fixture-long-${index+2}`,title:`Synthetic tone ${index+2}`}))];
const isClientAbort = error => {
  const code=error?.code??'';
  const message=String(error?.message??error);
  return ['ECONNRESET','ECONNABORTED','ERR_STREAM_PREMATURE_CLOSE'].includes(code)||['aborted','premature close'].includes(message.toLowerCase());
};
const handleRequest = async (req, res) => {
  try {
  if(accountFmUI&&req.url?.startsWith('/account-fm-fixture-control')){
    res.setHeader('Content-Type','application/json');
    res.setHeader('Cache-Control','no-store');
    const control=new URL(req.url,'http://127.0.0.1'),mode=control.searchParams.get('mode');
    if(control.searchParams.has('reset')){
      counts.accountFm={mode:'normal',holdNext:false,held:0,released:0,requests:[],authFailures:0,daily:0,coverMetadata:0};
      heldAccountFmResponses=[];
    }
    if(mode&&['normal','empty','error'].includes(mode))counts.accountFm.mode=mode;
    if(control.searchParams.has('holdNext'))counts.accountFm.holdNext=true;
    if(control.searchParams.has('release')){
      const replies=heldAccountFmResponses.splice(0);
      counts.accountFm.released+=replies.length;
      counts.accountFm.held=0;
      for(const send of replies)send();
    }
    res.end(JSON.stringify({...counts.accountFm,requestCount:counts.accountFm.requests.length}));return;
  }
  if(liveCatalogUI&&req.url==='/live-source-index'){
    counts.liveSourceIndex=(counts.liveSourceIndex??0)+1;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(liveSources.map(({name},index)=>({name,index}))));return;
  }
  const liveIndex=liveCatalogUI?req.url?.match(/^\/live-source-(\d+)\.js$/):null;
  if(liveIndex){
    counts.liveSourceImports=(counts.liveSourceImports??0)+1;
    const source=liveSources[Number(liveIndex[1])];
    if(!source){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(source.script);return;
  }

  if(referenceScene&&req.url==='/classic-reference-scene'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({lyrics:referenceScene.lyrics}));return;}
  if(req.url.startsWith('/am-fixture-control')){const control=new URL(req.url,'http://127.0.0.1');amLongQueue=control.searchParams.get('longQueue')==='1';res.setHeader('Content-Type','application/json');res.end(JSON.stringify({longQueue:amLongQueue}));return;}
  if(req.url==='/photo-artwork-fixture-control'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:photoArtworkVersion,requests:photoCoverRequests}));return;}

  if(coverThemeUI&&req.url.startsWith('/nexus-ui-test-theme-observation')){
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    if(req.method==='GET'){
      res.end(JSON.stringify(themeObservation.poll(new URL(req.url,'http://127.0.0.1').searchParams.get('boot'))));return;
    }
    if(req.method!=='POST'){res.writeHead(405);res.end('{}');return;}
    let bytes=0;const chunks=[];
    for await(const chunk of req){bytes+=chunk.length;if(bytes>4_000_000){res.writeHead(413);res.end('{}');return;}chunks.push(chunk);}
    let value;try{value=JSON.parse(Buffer.concat(chunks).toString());}catch{res.writeHead(400);res.end('{}');return;}
    if(!themeObservation.accept(value)){res.writeHead(409);res.end('{}');return;}
    const saved=structuredClone(themeObservation.result);
    for(const view of saved.native??[]){
      if(view.png){
        const file=`theme-observation-${saved.nonce}-${view.instanceID}.png`,data=Buffer.from(view.png,'base64');
        writeFileSync(resolve(runDirectory,file),data);
        view.pngSha256=createHash('sha256').update(data).digest('hex');view.pngFile=file;delete view.png;
      }
    }
    themeObservation.result=saved;
    writeFileSync(resolve(runDirectory,`theme-observation-${saved.nonce}.json`),JSON.stringify(saved,null,2)+'\n');
    res.end('{"accepted":true}');return;
  }
  if(coverThemeUI&&req.url.startsWith('/theme-fixture-control')){
    // This endpoint observes changing in-flight requests, never cached data.
    res.setHeader('Cache-Control','no-store');
    counts.themeControlPolls=(counts.themeControlPolls??0)+1;
    const control=new URL(req.url,'http://127.0.0.1');
    if(control.searchParams.has('checkpoint')){
      themeObservation.begin(control.searchParams.get('observationBoot'),control.searchParams.get('checkpoint'));
    }
    if(control.searchParams.has('observationNonce')){
      const result=themeObservation.result;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({observation:result?.boot===control.searchParams.get('observationBoot')&&result?.nonce===control.searchParams.get('observationNonce')?result:null}));return;
    }
    if(control.searchParams.has('transition'))transitionFixture=true;
    const release=control.searchParams.get('release');
    if(release){
      // A cover can time out while simulator recording starts. Keep the barrier
      // open for retries even if its original response has already closed.
      releasedThemeColors.add(release);
      counts.transitionReleaseCommands??=[];counts.transitionReleaseCommands.push(release);
      for(let i=heldThemeResponses.length-1;i>=0;i--)if(heldThemeResponses[i].color===release)heldThemeResponses.splice(i,1)[0].send();
    }
    if(control.searchParams.has('record')){
      const file=resolve('build/logs',`ambient-transition-${transitionVersion}.mp4`);
      themeRecorder=spawn('xcrun',['simctl','io',process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D','recordVideo','--codec=h264',file],{stdio:['ignore','ignore','pipe']});
      const recorder=themeRecorder;
      let recorderOutput='';
      const recorderStartedAt=Date.now();
      try{await new Promise((resolve,reject)=>{
        // The iOS 27 hosted simulator exceeded the old 15s readiness budget.
        // This barrier runs before the production cover timeout starts.
        const timer=setTimeout(()=>reject(new Error('Simulator video readiness exceeded 60s')),60000);
        const finish=error=>{clearTimeout(timer);error?reject(error):resolve();};
        recorder.once('error',finish);recorder.once('exit',()=>finish(new Error('Simulator video exited before readiness')));
        recorder.stderr.on('data',data=>{recorderOutput=(recorderOutput+data.toString()).slice(-8192);if(recorderOutput.includes('Recording started'))finish();});
      });}catch(error){
        counts.recorderFailure={message:String(error),elapsedMs:Date.now()-recorderStartedAt,stderr:recorderOutput,exitCode:recorder.exitCode,signalCode:recorder.signalCode};
        recorder.kill('SIGINT');themeRecorder=undefined;res.writeHead(500);res.end(JSON.stringify({error:'Simulator video readiness failed'}));return;
      }
      counts.recorderStartupMs=Date.now()-recorderStartedAt;
      // Opt-in fault injection proves recorder readiness cannot consume a
      // production cover request's timeout. Only this isolated fixture uses it.
      const readyDelay=Number(process.env.NEXUS_UI_THEME_RECORD_READY_DELAY_MS??0);
      if(Number.isFinite(readyDelay)&&readyDelay>0&&readyDelay<=15000){counts.recorderReadyDelayMs=readyDelay;await new Promise(resolve=>setTimeout(resolve,readyDelay));}
      counts.transitionVideo=file;
    }
    if(control.searchParams.has('stop')&&themeRecorder){const recorder=themeRecorder;themeRecorder=undefined;recorder.kill('SIGINT');await new Promise(resolve=>recorder.once('exit',resolve));}
    const heldColors=[...new Set(heldThemeResponses.map(item=>item.color))];
    const heldAgesMs=Object.fromEntries(heldColors.map(color=>[color,Math.max(...heldThemeResponses.filter(item=>item.color===color).map(item=>Date.now()-item.startedAt))]));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({held:heldColors.length,heldColors,heldAgesMs}));return;
  }
  if(discoveryUI&&req.url.startsWith('/discovery-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1');
    if(control.searchParams.has('holdNext'))holdDiscoveryDetail=true;
    if(control.searchParams.has('completePlaylist'))truncateDiscoveryPlaylist=false;
    if(control.searchParams.has('pager'))pagerDiscovery=true;
    if(control.searchParams.has('replace'))pagerReplacement=true;
    if(control.searchParams.has('failNext'))pagerFailNext=true;
    const detail=control.searchParams.get('detail');if(detail&&['normal','empty','error'].includes(detail))discoveryDetailMode=detail;
    const link=control.searchParams.get('shortLink');if(link&&['normal','connection','error'].includes(link))playlistLinkMode=link;
    if(control.searchParams.has('holdShortNext'))holdNextPlaylistLink=true;
    const categories=control.searchParams.get('styleCategories');if(categories&&['normal','error','empty'].includes(categories))styleCategoryMode=categories;
    const playlists=control.searchParams.get('stylePlaylists');if(playlists&&['normal','empty','error'].includes(playlists))stylePlaylistMode=playlists;
    if(control.searchParams.has('holdStyleCategories'))holdNextStyleCategories=true;
    if(control.searchParams.has('holdStylePlaylists'))holdStylePlaylists=control.searchParams.get('holdStylePlaylists')!=='0';
    const failures=control.searchParams.get('failStyleTags');if(failures!==null){failedStyleTags.clear();for(const tag of failures.split(',').filter(Boolean))failedStyleTags.add(tag);}
    if(control.searchParams.has('release'))for(const send of heldDiscoveryResponses.splice(0))send();
    if(control.searchParams.has('releaseShort'))for(const send of heldPlaylistLinkResponses.splice(0))send();
    if(control.searchParams.has('releaseStyle'))for(const send of [...heldStyleCategoryResponses.splice(0),...heldStylePlaylistResponses.splice(0)])send();
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({held:heldDiscoveryResponses.length,heldShort:heldPlaylistLinkResponses.length,playlistLinkRequests,heldStyleCategories:heldStyleCategoryResponses.length,heldStylePlaylists:heldStylePlaylistResponses.length,categoryMode:styleCategoryMode,playlistMode:stylePlaylistMode,failedStyleTags:[...failedStyleTags]}));return;
  }
  if(req.url.startsWith('/qq-comments-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1'),mode=control.searchParams.get('mode');
    if(mode&&['normal','empty','error'].includes(mode))qqCommentsMode=mode;
    if(control.searchParams.has('reset')){qqCommentsNextPageFails=true;qqRepliesNextPageFails=true;qqRepliesMode='normal';}
    const repliesMode=control.searchParams.get('replies');if(repliesMode&&['normal','empty'].includes(repliesMode))qqRepliesMode=repliesMode;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:qqCommentsMode,nextPageFails:qqCommentsNextPageFails,repliesMode:qqRepliesMode,repliesNextPageFails:qqRepliesNextPageFails,replyPages:counts.qqReplies?.pages??[]}));return;
  }
  if(req.url.startsWith('/migu-comments-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1'),mode=control.searchParams.get('mode');
    if(mode&&['normal','empty','error'].includes(mode))miguCommentsMode=mode;
    const repliesMode=control.searchParams.get('replies');if(repliesMode&&['normal','empty'].includes(repliesMode))miguRepliesMode=repliesMode;
    if(control.searchParams.has('reset')){miguCommentsNextPageFails=true;miguRepliesNextPageFails=true;miguRepliesMode='normal';}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:miguCommentsMode,nextPageFails:miguCommentsNextPageFails,repliesMode:miguRepliesMode}));return;
  }
  if(req.url.startsWith('/kuwo-comments-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1'),mode=control.searchParams.get('mode');
    if(mode&&['normal','empty','error'].includes(mode))kuwoCommentsMode=mode;
    if(control.searchParams.has('reset'))kuwoCommentsNextPageFails=true;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:kuwoCommentsMode,nextPageFails:kuwoCommentsNextPageFails}));return;
  }
  if(req.url.startsWith('/kugou-comments-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1'),mode=control.searchParams.get('mode');
    if(mode&&['normal','empty','error'].includes(mode))kugouCommentsMode=mode;
    if(control.searchParams.has('reset')){kugouCommentsNextPageFails=true;kugouRepliesNextPageFails=true;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:kugouCommentsMode,nextPageFails:kugouCommentsNextPageFails,repliesNextPageFails:kugouRepliesNextPageFails}));return;
  }
  if(req.url.startsWith('/qishui-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1');
    if(control.searchParams.has('reset'))qishuiHoldFirst=false;
    if(control.searchParams.get('hold')==='1')qishuiHoldFirst=true;
    if(control.searchParams.has('release'))for(const send of heldQishuiResponses.splice(0))send();
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({holdFirst:qishuiHoldFirst,held:heldQishuiResponses.length}));return;
  }
  if(offlineUI&&req.url.startsWith('/offline-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1');
    if(control.searchParams.has('block'))blockOfflineStream=control.searchParams.get('block')==='1';
    if(control.searchParams.has('pauseWindow'))holdOfflineFull=control.searchParams.get('pauseWindow')==='1';
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...offlineCounts,streams:counts.requests.stream??0}));return;
  }
  if(req.url==='/matching-source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(matchingScript);return;}
  if(req.url==='/health-source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(healthScript);return;}
  if(req.url==='/unified-search-source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(unifiedSearchScript);return;}
  if(searchUI&&req.url==='/unified-search-request-count'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({count:counts.unifiedSearchRequests??0}));return;
  }
  if(req.url==='/wayfarer-fixture-state'){
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({matchAudio:counts.matchAudio??{},online:counts.online??{},expectedMatchingAudio:wayfarerFixtureAudioPath}));return;
  }
  if(req.url.startsWith('/matching-audio/')){
    if(!matchingUI){res.writeHead(404);res.end();return;}
    counts.matchAudio??={};counts.matchAudio[req.url]=(counts.matchAudio[req.url]??0)+1;
    res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),matchingAudio.length-1):matchingAudio.length-1;if(start>=matchingAudio.length){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${matchingAudio.length}`);res.end(matchingAudio.subarray(start,end+1));}else res.end(matchingAudio);return;
  }
  if(req.url.startsWith('/unified-search-audio/')){
    if(!searchUI&&!accountFmUI){res.writeHead(404);res.end();return;}
    counts.unifiedSearchAudio??={};counts.unifiedSearchAudio[req.url]=(counts.unifiedSearchAudio[req.url]??0)+1;
    res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),matchingAudio.length-1):matchingAudio.length-1;if(start>=matchingAudio.length){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${matchingAudio.length}`);res.end(matchingAudio.subarray(start,end+1));}else res.end(matchingAudio);return;
  }
  if(req.url==='/nexus-ui-test-playlist-link-expander'){
    if(!discoveryUI){res.writeHead(404);res.end();return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const parsed=JSON.parse(Buffer.concat(chunks).toString());
    if(typeof parsed.url!=='string'||new URL(parsed.url).hostname!=='163cn.tv'){res.writeHead(400);res.end();return;}
    playlistLinkRequests++;counts.playlistLink={requests:playlistLinkRequests};
    if(playlistLinkMode==='error'){res.writeHead(503);res.end();return;}
    res.setHeader('Content-Type','application/json');
    if(playlistLinkMode==='connection'){res.end(JSON.stringify({connectionError:true}));return;}
    const send=()=>{if(!res.destroyed)res.end(JSON.stringify({url:'https://music.163.com/#/playlist?id=101'}));};
    if(holdNextPlaylistLink){holdNextPlaylistLink=false;heldPlaylistLinkResponses.push(send);counts.playlistLink.held=(counts.playlistLink.held??0)+1;}else send();
    return;
  }
  if(req.url==='/nexus-ui-test-online-adapter'){
    if(!fixtureOnlineUI){res.writeHead(404);res.end();return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const {url,request}=JSON.parse(Buffer.concat(chunks).toString());const parsed=new URL(url);
    counts.online??={};counts.online[parsed.hostname]=(counts.online[parsed.hostname]??0)+1;
    res.setHeader('Content-Type','application/json');
    if(accountFmUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/weapi/v3/discovery/recommend/songs'){
      counts.accountFm.daily++;
      res.end(JSON.stringify({code:200,data:{dailySongs:[]}}));return;
    }
    if(accountFmUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/weapi/v1/radio/get'){
      const number=counts.accountFm.requests.length+1,cookie=String(request.headers?.Cookie??request.headers?.cookie??'');
      const authenticated=/MUSIC_U=synthetic-fm(?:;|$)/.test(cookie);
      if(!authenticated)counts.accountFm.authFailures++;
      counts.accountFm.requests.push({number,authenticated});
      if(counts.accountFm.mode==='error'){
        res.end(JSON.stringify({code:503}));return;
      }
      if(counts.accountFm.mode==='empty'){
        res.end(JSON.stringify({code:200,data:[]}));return;
      }
      const track=value=>({id:String(8100+value),name:`Synthetic account FM ${value}`,ar:[{id:'fixture-fm-artist',name:'Account FM artist'}],al:{id:'fixture-fm-album',name:'Account FM album'},dt:120000});
      const ids=number===1?[1,2,3,4]:number===2?[5,6,3,5]:[7];
      const send=()=>{if(!res.destroyed)res.end(JSON.stringify({code:200,data:ids.map(track)}));};
      if(counts.accountFm.holdNext){
        counts.accountFm.holdNext=false;
        counts.accountFm.held++;
        heldAccountFmResponses.push(()=>{
          counts.accountFm.held=Math.max(0,counts.accountFm.held-1);
          send();
        });
        return;
      }
      send();return;
    }
    if(accountFmUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/api/v3/song/detail'){
      counts.accountFm.coverMetadata++;
      res.end(JSON.stringify({code:200,songs:[]}));return;
    }
    if(qishuiUI&&parsed.hostname==='beta-luna.douyin.com'&&parsed.pathname==='/luna/playlist/detail'){
      const body=JSON.parse(request.body),id='90071992547409931234',cursor=String(body.cursor);
      counts.qishui??={pages:[],held:0};counts.qishui.pages.push({playlistId:body.playlist_id,cursor,count:body.count});
      const media=(trackId,name)=>({entity:{track_wrapper:{track:{id:trackId,name,artists:[{name:'Fixture artist'}],duration:120000}}}});
      const response={playlist:{id,title:'Synthetic Qishui playlist',count_tracks:3},media_resources:cursor==='0'?[media(id,'Synthetic Qishui one'),media('qishui_track_two','Synthetic Qishui two')]:[media(id,'Synthetic Qishui one')],has_more:cursor==='0',next_cursor:cursor==='0'?'1':''};
      const send=()=>{if(!res.destroyed)res.end(JSON.stringify(response));};
      if(cursor==='0'&&qishuiHoldFirst){qishuiHoldFirst=false;heldQishuiResponses.push(send);counts.qishui.held++;return;}
      send();return;
    }
    if(discoveryUI&&parsed.hostname==='wapi.kuwo.cn'&&parsed.pathname.endsWith('/getRcmPlayList')){
      res.end(JSON.stringify({data:{total:1,data:[{id:'101',name:'Synthetic completeness playlist',total:3}]}}));return;
    }
    if(discoveryUI&&parsed.hostname==='nplserver.kuwo.cn'&&parsed.pathname==='/pl.svc'){
      counts.discovery??={lists:0,details:0};counts.discovery.completeness=(counts.discovery.completeness??0)+1;
      if(pagerDiscovery){
        const page=Number(parsed.searchParams.get('pn'));pagerPages.push(page);counts.discovery.pagerPages=pagerPages;
        if(pagerFailNext){pagerFailNext=false;counts.discovery.pagerFailures=(counts.discovery.pagerFailures??0)+1;res.end(JSON.stringify({error:'Original synthetic pager failure'}));return;}
        const offset=page*100;
        res.end(JSON.stringify({title:'Synthetic pager playlist',total:101,musiclist:Array.from({length:page===0?100:page===1?1:0},(_,index)=>({id:String((pagerReplacement?9400:9300)+offset+index),name:index===0?`Recovery marker ${pagerReplacement?'replacement ':''}${page===0?'one':'two'}`:`Synthetic filler ${offset+index}`,artist:'Fixture artist',album:'Fixture pager album',duration:120}))}));return;
      }
      res.end(JSON.stringify({title:'Synthetic completeness playlist',total:truncateDiscoveryPlaylist?3:2,musiclist:['one','two'].map((word,index)=>({id:String(9201+index),name:`Synthetic completeness ${word}`,artist:'Fixture artist',album:'Fixture album',duration:120}))}));return;
    }
    if(discoveryUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/api/playlist/catalogue'){
      counts.discovery??={lists:0,details:0};counts.discovery.styleCategoryRequests=(counts.discovery.styleCategoryRequests??0)+1;
      if(styleCategoryMode==='error'){res.end(JSON.stringify({code:503}));return;}
      if(styleCategoryMode==='empty'){res.end(JSON.stringify({code:200,categories:{},sub:[]}));return;}
      const body={code:200,categories:{'0':'语种','1':'风格','2':'场景','3':'情感','4':'主题'},sub:[
        {name:'华语',category:0},{name:'流行',category:1},{name:'说唱',category:1},{name:'电子',category:1},{name:'民谣',category:1},{name:'金属',category:1},
        {name:'伤感',category:3},{name:'治愈',category:3},{name:'校园',category:4},{name:'夜晚',category:2},{name:'学习',category:2},
      ]};
      const send=()=>{if(!res.destroyed)res.end(JSON.stringify(body));};
      if(holdNextStyleCategories){holdNextStyleCategories=false;heldStyleCategoryResponses.push(send);counts.discovery.styleCategoryHeld=(counts.discovery.styleCategoryHeld??0)+1;}else send();return;
    }
    if(discoveryUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/api/playlist/list'){
      counts.discovery??={lists:0,details:0};counts.discovery.lists++;
      const category=parsed.searchParams.get('cat');
      if(category&&category!=='全部'){
        counts.discovery.stylePlaylistRequests=(counts.discovery.stylePlaylistRequests??0)+1;
        if(stylePlaylistMode==='empty'){res.end(JSON.stringify({code:200,more:false,playlists:[]}));return;}
        if(stylePlaylistMode==='error'||failedStyleTags.has(category)){res.end(JSON.stringify({code:503}));return;}
        const all=[
          {id:'201',name:'Synthetic shared playlist',description:'Original shared fixture',trackCount:3,coverImgUrl:'http://127.0.0.1:18439/discovery-cover.png'},
          {id:`tag-${category}`,name:`Synthetic ${category} playlist`,description:'Original tag fixture',trackCount:2,coverImgUrl:'http://127.0.0.1:18439/discovery-cover.png'},
        ];
        const playlists=['流行','说唱','华语','治愈','夜晚'].includes(category)?all:[all[1]];
        const send=()=>{if(!res.destroyed)res.end(JSON.stringify({code:200,more:false,playlists}));};
        if(holdStylePlaylists){heldStylePlaylistResponses.push(send);counts.discovery.stylePlaylistHeld=(counts.discovery.stylePlaylistHeld??0)+1;}else send();return;
      }
      res.end(JSON.stringify({code:200,more:false,playlists:[{id:'101',name:'Synthetic discovery playlist',description:'Original UI fixture',trackCount:2,coverImgUrl:'http://127.0.0.1:18439/discovery-cover.png'}]}));return;
    }
    if(discoveryUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/api/v6/playlist/detail'){
      counts.discovery??={lists:0,details:0};counts.discovery.details++;
      if(discoveryDetailMode==='error'){res.end(JSON.stringify({code:503}));return;}
      const title=parsed.searchParams.get('id')==='201'?'Synthetic shared playlist':'Synthetic discovery playlist';
      const tracks=['one','two'].map((word,index)=>({id:String(9101+index),name:`Synthetic discovery ${word}`,ar:[{name:'Fixture artist'}],al:{name:'Synthetic discovery album',picUrl:'http://127.0.0.1:18439/discovery-cover.png'},dt:120000}));
      const selected=discoveryDetailMode==='empty'?[]:tracks;
      const send=()=>{if(!res.destroyed)res.end(JSON.stringify({code:200,playlist:{name:title,trackIds:selected.map(({id})=>({id})),tracks:selected}}));};
      if(holdDiscoveryDetail){holdDiscoveryDetail=false;heldDiscoveryResponses.push(send);counts.discovery.held=(counts.discovery.held??0)+1;}else send();return;
    }
    if(parsed.hostname==='music.163.com'&&parsed.pathname==='/api/resource/comment/floor/get'){
      const root=parsed.searchParams.get('parentCommentId'),time=parsed.searchParams.get('time');
      counts.wyReplies??={times:[],errors:0,empty:0};counts.wyReplies.times.push(time);
      if(root==='9'&&time==='2000'&&wyRepliesNextPageFails){wyRepliesNextPageFails=false;counts.wyReplies.errors++;res.end(JSON.stringify({code:503}));return;}
      const reply=(id,content)=>({commentId:id,parentCommentId:root,content,user:{nickname:'WY reply reader',avatarUrl:'http://cdn.example/wy-reply.jpg'},ipLocation:{location:'上海'},time:1500,likedCount:2,beReplied:[{content:'Synthetic WY quoted target',user:{nickname:'WY target reader'}}]});
      const values=root==='9'?(time==='-1'?[reply('201','Synthetic WY full reply one'),reply('202','Synthetic WY full reply two')]:[reply('203','Synthetic WY full reply three'),reply('204','Synthetic WY full reply four')]):[];
      if(root!=='9')counts.wyReplies.empty++;
      res.end(JSON.stringify({code:200,data:{ownerComment:{commentId:root},comments:values,bestComments:[],totalCount:root==='9'&&time==='-1'?4:0,hasMore:root==='9'&&time==='-1',time:time==='-1'?2000:3000}}));return;
    }
    if(parsed.hostname==='music.163.com'&&parsed.pathname.includes('/api/v1/resource/comments/')){
      const offset=Number(parsed.searchParams.get('offset')??0);counts.comments??={first:0,next:0};
      const comment=id=>({commentId:id,content:`Synthetic comment ${id}`,user:{nickname:'Fixture reader',avatarUrl:`http://cdn.example/avatar-${id}.jpg?token=private`},ipLocation:{location:'上海'},time:1000,likedCount:3});
      if(offset===0){counts.comments.first++;res.end(JSON.stringify({code:200,hotComments:[{...comment('9'),content:'Synthetic hot comment'}],comments:[comment('1'),comment('2')],total:3,more:true}));}
      else {counts.comments.next++;res.end(JSON.stringify(counts.comments.next===1?{code:503}:{code:200,comments:[comment('3')],total:3,more:false}));}return;
    }
    if(parsed.hostname==='music.163.com'&&parsed.pathname==='/api/song/lyric'){
      counts.lyrics??={wy:0,tx:0};counts.lyrics.wy++;
      if(timedLyricsUI){
        const counter=amllLyricsUI?'ttmlAmll':'ttmlSeq';counts.lyrics[counter]=(counts.lyrics[counter]??0)+1;
        res.end(JSON.stringify({
          ttml:amllLyricsUI?'<tt xmlns="http://www.w3.org/ns/ttml" xmlns:amll="http://www.example.com/ns/amll" xmlns:tts="http://www.w3.org/ns/ttml#styling"><body dur="120s"><div begin="10" end="80"><p begin="00:10" end="30"><span begin="10" end="10.5">Synthetic </span><span begin="10.5" end="30">rich lyric</span></p><p begin="00:30" end="60"><span begin="30" end="60">Second rich line</span></p><p begin="01:00" end="01:10"><span tts:ruby="container"><span tts:ruby="base">漢字</span><span tts:ruby="textContainer"><span tts:ruby="text" begin="60" end="61">kanji</span></span></span><ruby><rb>音</rb><rtc><rt begin="61" end="61.5">yin</rt></rtc></ruby><ruby><rbc><rb begin="61.5" end="62">多</rb><rb begin="62" end="63">基</rb></rbc><rtc><rt>duo</rt><rt>ji</rt></rtc></ruby><ruby><rbc><rb begin="63" end="64">双</rb></rbc><rtc tts:rubyPosition="before"><rt>shuang</rt></rtc><rtc tts:rubyPosition="after"><rt>sou</rt></rtc></ruby><span begin="64" end="70"> ruby tail</span></p><p begin="01:10" end="01:15"><span tts:ruby="container" tts:rubyAlign="start"><span tts:ruby="base" begin="70" end="71">起边</span><span tts:ruby="textContainer"><span tts:ruby="text">st</span></span></span><span tts:ruby="container" tts:rubyAlign="center"><span tts:ruby="base" begin="71" end="72">中间</span><span tts:ruby="textContainer"><span tts:ruby="text">md</span></span></span><span tts:ruby="container" tts:rubyAlign="end"><span tts:ruby="base" begin="72" end="73">到尾</span><span tts:ruby="textContainer"><span tts:ruby="text">ed</span></span></span></p><p begin="01:15" end="01:20"><span tts:ruby="container" tts:rubyAlign="withBase"><span tts:ruby="base">一二三四五六七八九十甲乙丙丁戊己庚辛壬癸</span><span tts:ruby="textContainer"><span tts:ruby="text">abcdefghijklmnopqrst</span></span></span></p></div></body></tt>':'<tt xmlns="http://www.w3.org/ns/ttml"><body><div timeContainer="seq"><p timeContainer="seq" dur="30s"><span dur="500ms">Synthetic </span><span dur="29500ms">rich lyric</span></p><p dur="30s">Second rich line</p></div></body></tt>',
          lrc:'[00:00.000]Sequential TTML fallback must not be selected',
        }));return;
      }
      res.end(JSON.stringify({ttml:'<tt>',lxlyric:' ',lyric:'',lrc:'[00:00.000]<0,500>Synthetic <500,500>rich lyric\n[00:30.000]<0,1000>Second rich line'}));return;
    }
    if(parsed.hostname==='app.c.nf.migu.cn'&&parsed.pathname==='/MIGUM3.0/user/comment/stack/101/v1.0'){
      const start=Number(parsed.searchParams.get('start'));counts.miguReplies??={starts:[],errors:[]};counts.miguReplies.starts.push(start);
      if(miguCommentsMode==='error'||(start===20&&miguRepliesNextPageFails)){miguRepliesNextPageFails=false;counts.miguReplies.errors.push(start);res.end(JSON.stringify({code:'500',data:{}}));return;}
      const reply=(id,content,extra={})=>({replyId:id,replyInfo:content,replyTime:'2024-01-03 04:05:06',user:{nickName:`Migu reply reader ${id}`},opNumItem:{thumbNum:2},...extra});
      const values=miguCommentsMode==='empty'||miguRepliesMode==='empty'?[]:start===0?[reply('201','Synthetic Migu full reply one',{targetComment:'Synthetic Migu quoted target',targetUser:{nickName:'Migu target reader'}}),reply('202','Synthetic Migu full reply two')]:[reply('203','Synthetic Migu full reply three'),reply('204','Synthetic Migu full reply four')];
      const total=miguCommentsMode==='empty'||miguRepliesMode==='empty'?0:41;
      res.end(JSON.stringify({code:'000000',data:{replyTotalCount:total,mainCommentItem:{commentId:'101',targetResourceId:parsed.searchParams.get('resourceId'),targetResourceType:'2',replyTotalCount:total,replyComments:values}}}));return;
    }
    if(parsed.hostname==='app.c.nf.migu.cn'&&parsed.pathname==='/MIGUM3.0/user/comment/stack/v1.0'){
      const cursor=parsed.searchParams.get('commentId')??'',resource=parsed.searchParams.get('resourceId');
      counts.miguComments??={pages:[],errors:0,empty:0,resources:[]};counts.miguComments.pages.push(cursor?'next':'first');counts.miguComments.resources.push(resource);
      if(miguCommentsMode==='error'){counts.miguComments.errors++;res.end(JSON.stringify({code:'500',data:{}}));return;}
      if(miguCommentsMode==='empty'){counts.miguComments.empty++;res.end(JSON.stringify({code:'000000',data:{commentNums:'0',cfgHotCount:'0',comments:[],hotComments:[],targetInfo:{title:'Shape of You',subTitle:'Ed Sheeran'}}}));return;}
      const item=(id,content,extra={})=>({commentId:id,commentInfo:content,commentTime:'2024-01-02 03:04',opNumItem:{thumbNum:3},user:{nickName:`Migu reader ${id}`},replyTotalCount:0,replyComments:[],...extra});
      const hot=item('900','Synthetic Migu hot');
      const root=item('101','Synthetic Migu root',{opNumItem:{thumbNum:7},replyTotalCount:41});
      const reply=item('102','Synthetic Migu original long text '.repeat(8).trim(),{replyTotalCount:1,replyComments:[{replyId:'1021',replyInfo:'Synthetic Migu reply',replyTime:'2024-01-03 04:05',user:{nickName:'Migu reply reader'}}]});
      const page2=item('103','Synthetic Migu second page');
      if(cursor&&miguCommentsNextPageFails){miguCommentsNextPageFails=false;counts.miguComments.errors++;res.end(JSON.stringify({code:'500',data:{}}));return;}
      res.end(JSON.stringify({code:'000000',data:{commentNums:cursor?'43':'41',cfgHotCount:'1',comments:cursor?[page2]:[root,reply],hotComments:cursor?[]:[hot],...(cursor?{}:{targetInfo:{title:'Shape of You',subTitle:'Ed Sheeran'}})}}));return;
    }
    if(parsed.hostname==='ncomment.kuwo.cn'&&parsed.pathname==='/com.s'){
      const hot=parsed.searchParams.get('type')==='get_rec_comment',start=Number(parsed.searchParams.get('start'));
      counts.kuwoComments??={starts:[],errors:0,empty:0};counts.kuwoComments.starts.push({hot,start});
      if(kuwoCommentsMode==='error'){counts.kuwoComments.errors++;res.end(JSON.stringify({code:'503'}));return;}
      if(kuwoCommentsMode==='empty'){counts.kuwoComments.empty++;res.end(JSON.stringify({code:'200',result:'ok',comments:[],hot_comments:[],comments_counts:0,hot_comments_counts:0}));return;}
      const item=(id,msg,extra={})=>({id,msg,time:'1700000000',like_num:'3',u_name:`Kuwo reader ${id}`,...extra});
      if(!hot&&start===20&&kuwoCommentsNextPageFails){kuwoCommentsNextPageFails=false;counts.kuwoComments.errors++;res.end(JSON.stringify({code:'503'}));return;}
      const values=hot?[item('900','Synthetic Kuwo hot')]:start===0?[item('101','Synthetic Kuwo root'),item('102','Synthetic Kuwo original long text '.repeat(8).trim(),{child_comments:[{id:'1021',msg:'Synthetic Kuwo reply',u_name:'Kuwo reply reader'}]})]:[item('103','Synthetic Kuwo second page')];
      res.end(JSON.stringify({code:'200',result:'ok',comments:hot?[]:values,hot_comments:hot?values:[],comments_counts:start?'43':'41',hot_comments_counts:hot?1:0,offset:start+20}));return;
    }
    if(parsed.hostname==='gateway.kugou.com'&&parsed.pathname.startsWith('/r/v1/rank/')){
      const hot=parsed.pathname.endsWith('/topliked'),page=Number(parsed.searchParams.get('p'));
      counts.kugouComments??={pages:[],errors:0,empty:0};counts.kugouComments.pages.push({hot,page});
      if(kugouCommentsMode==='error'){counts.kugouComments.errors++;res.end(JSON.stringify({err_code:1}));return;}
      if(kugouCommentsMode==='empty'){counts.kugouComments.empty++;res.end(JSON.stringify({err_code:0,current_page:page,childrenid:24748592,list:[],count:0}));return;}
      if(!hot&&page===2&&kugouCommentsNextPageFails){kugouCommentsNextPageFails=false;counts.kugouComments.errors++;res.end(JSON.stringify({err_code:1}));return;}
      const item=(id,content,extra={})=>({id,content,user_name:`Kugou reader ${id}`,addtimestamp:1700000000,like:{likenum:3},reply_num:0,...extra});
      const list=hot?[item('900','Synthetic Kugou hot 🎵👩‍💻❤️👨‍👩‍👧‍👦')]:page===1?[item('101','Synthetic Kugou root',{reply_num:41}),item('102','Synthetic Kugou original long text '.repeat(8).trim(),{pcontent:'Synthetic Kugou original quoted text 🚀',puser:'Kugou original reader'})]:[item('103','Synthetic Kugou second page')];
      res.end(JSON.stringify({err_code:0,current_page:page,childrenid:24748592,list,count:page===1?41:43}));return;
    }
    if(parsed.hostname==='gateway.kugou.com'&&parsed.pathname==='/index.php'&&parsed.searchParams.get('r')==='commentsv2/getReplyWithLike'){
      const page=Number(parsed.searchParams.get('p')??0);counts.kugouReplies??={pages:[],errors:[],empty:0};counts.kugouReplies.pages.push(page);
      if(kugouCommentsMode==='error'){counts.kugouReplies.errors.push(page);res.end(JSON.stringify({err_code:1}));return;}
      if(kugouCommentsMode==='empty'){counts.kugouReplies.empty++;res.end(JSON.stringify({err_code:0,current_page:page,childrenid:24748592,tid:'101',list:[],comments_num:0}));return;}
      if(page===2&&kugouRepliesNextPageFails){kugouRepliesNextPageFails=false;counts.kugouReplies.errors.push(page);res.end(JSON.stringify({err_code:1}));return;}
      const reply=(id,content)=>({id,content,user_name:`Kugou reply reader ${id}`,addtimestamp:1700000100,like:{likenum:2},reply_num:0});
      const list=page===1?[reply('201','Synthetic Kugou full reply one'),reply('202','Synthetic Kugou full reply two')]:[reply('203','Synthetic Kugou full reply three'),reply('204','Synthetic Kugou full reply four')];
      res.end(JSON.stringify({err_code:0,current_page:page,childrenid:24748592,tid:'101',list,comments_num:41}));return;
    }
    if(parsed.hostname==='c.y.qq.com'){counts.lyrics??={wy:0,tx:0};counts.lyrics.tx++;res.end(JSON.stringify({lyric:'[00:00.000]Synthetic original lyric\n[00:30.000]Second original line'}));return;}
    if(parsed.hostname==='music.163.com'){
      if(searchUI&&['/api/cloudsearch/pc','/api/search/get/web'].includes(parsed.pathname))counts.unifiedSearchRequests=(counts.unifiedSearchRequests??0)+1;
      if(searchUI&&parsed.pathname==='/api/cloudsearch/pc'){
        const body=new URLSearchParams(request.body??'');
        if(body.get('s')==='Unified fixture'&&body.get('type')==='1004'){
          res.end(JSON.stringify({code:200,result:{mvCount:1,mvs:[{id:5001,name:'Unified fixture MV',artistName:'Fixture artist',duration:242500,cover:'http://127.0.0.1:18439/unified-mv-cover.png'}]}}));return;
        }
      }
      if(searchUI&&parsed.pathname==='/api/album/2001'){
        res.end(JSON.stringify({code:200,album:{size:1,artist:{name:'Fixture artist'}},songs:[{id:'1001',name:'Unified fixture album track',ar:[{name:'Fixture artist'}],al:{name:'Unified fixture album'},dt:120000}]}));return;
      }
      if(searchUI&&parsed.pathname==='/api/artist/3001'){
        res.end(JSON.stringify({code:200,artist:{id:'3001',name:'Unified fixture artist',musicSize:20,albumSize:2},hotSongs:[{id:'1001',name:'Unified fixture artist track',ar:[{name:'Fixture artist'}],al:{name:'Unified fixture album'},dt:120000}]}));return;
      }
      if(searchUI&&parsed.pathname==='/api/v6/playlist/detail'){
        res.end(JSON.stringify({code:200,playlist:{id:4001,name:'Unified fixture playlist',trackIds:[],tracks:[]}}));return;
      }
      if(parsed.pathname==='/api/search/get/web'&&req.method==='POST'){
        const body=new URLSearchParams(request.body??''),type=body.get('type'),query=body.get('s'),offset=Number(body.get('offset')??0);
        if(type==='10'){
          res.end(JSON.stringify({code:200,result:{albumCount:1,albums:[{id:query==='Unified aggregate fixture'?'2101':'2001',name:query==='Unified aggregate fixture'?'Unified aggregate album WY':'Unified fixture album',artist:{name:'Fixture artist'},size:12,publishTime:0}]}}));return;
        }
        if(type==='100'){
          res.end(JSON.stringify({code:200,result:{artistCount:1,artists:[{id:query==='Unified aggregate fixture'?'3101':'3001',name:query==='Unified aggregate fixture'?'Unified aggregate artist WY':'Unified fixture artist',musicSize:20,albumSize:2}]}}));return;
        }
        if(type==='1000'){
          res.end(JSON.stringify({code:200,result:{playlistCount:1,playlists:[{id:'4001',name:'Unified fixture playlist',creator:{nickname:'Fixture editor'},trackCount:8}]}}));return;
        }
        if(query==='Unified fixture'||query==='Unified aggregate fixture'){
          const aggregate=query==='Unified aggregate fixture';
          const songs=offset===0?aggregate?[{id:'1101',name:'Unified aggregate song WY',ar:[{name:'Fixture artist'}],al:{name:'Unified aggregate album WY'},dt:120000}]:[{id:'1001',name:'Unified fixture song',ar:[{name:'Fixture artist'}],al:{name:'Unified fixture album'},dt:120000},{id:'1002',name:'Unified second song',ar:[{name:'Fixture artist'}],al:{name:'Unified fixture album'},dt:121000}]:!aggregate&&offset===30?[{id:'1031',name:'Unified second page song',ar:[{name:'Fixture artist'}],al:{name:'Unified fixture album'},dt:122000}]:[];
          res.end(JSON.stringify({code:200,result:{songCount:aggregate?1:61,songs}}));return;
        }
      }
      res.end(JSON.stringify({code:200,result:{songCount:1,songs:[{id:'1001',name:'Synthetic match tone',ar:[{name:'Fixture artist'}],al:{name:'Original fixture'},dt:120000,sq:{size:1000}}]}}));return;
    }
    if(parsed.hostname==='u.y.qq.com'){
      const body=JSON.parse(request.body);
      if(body.req_0?.method==='GetNewCommentList'){
        const param=body.req_0.param,page=Number(param?.PageNum??0);
        counts.qqComments??={pages:[],errors:0,empty:0};counts.qqComments.pages.push(page);
        if(qqCommentsMode==='error'){counts.qqComments.errors++;res.end(JSON.stringify({code:0,req_0:{code:1,data:{SubCode:1}}}));return;}
        if(qqCommentsMode==='empty'){counts.qqComments.empty++;res.end(JSON.stringify({code:0,req_0:{code:0,data:{SubCode:0,CommentList:{Total:0,HasMore:0,Comments:[]},CommentList2:{Total:0,HasMore:0,Comments:[]},TotalVer:'fixture-empty'}}}));return;}
        if(page===1&&qqCommentsNextPageFails){qqCommentsNextPageFails=false;counts.qqComments.errors++;res.end(JSON.stringify({code:0,req_0:{code:1,data:{SubCode:1}}}));return;}
        if(page===1&&param?.LastCommentSeqNo!=='101'){counts.qqComments.errors++;res.end(JSON.stringify({code:0,req_0:{code:1,data:{SubCode:1}}}));return;}
        const root=(id,content,nick,seq,replyCount,extra={})=>({CmId:id,RootCmId:null,Content:content,Nick:nick,Location:'广东',PubTime:1700000000+Number(seq),PraiseNum:3,ReplyCnt:replyCount,SeqNo:seq,...extra});
        const rootID='1!qqroot';
        const hot=root('1!qqhot','Synthetic QQ hot root','QQ hot reader','90',2);
        const latestRoot=root(rootID,'Synthetic QQ root','QQ latest reader','100',41);
        const latestOther=root('1!qqlatest','Synthetic QQ latest second root','QQ second latest reader','101',0);
        const page2=root('1!qqpage2','Synthetic QQ second page','QQ page two reader','102',0);
        const commentList=page===0?{Total:41,HasMore:1,Comments:[latestRoot,latestOther]}:{Total:43,HasMore:0,Comments:[page2]};
        res.end(JSON.stringify({code:0,req_0:{code:0,data:{SubCode:0,CommentList:commentList,CommentList2:page===0?{Total:1,HasMore:0,Comments:[hot]}:{Total:0,HasMore:0,Comments:[]},TotalVer:'fixture-v1'}}}));return;
      }
      if(body.req_0?.method==='GetReplyCommentList'){
        const param=body.req_0.param,page=Number(param?.PageNum??0);
        counts.qqReplies??={pages:[],errors:0,empty:0};counts.qqReplies.pages.push({page,rank:param?.LastRankScore,seq:param?.LastCommentSeqNo,root:param?.RootCmId});
        if(param?.RootCmId!=='1!qqroot'||param?.RankType!==0){counts.qqReplies.errors++;res.end(JSON.stringify({code:0,req_0:{code:1,data:{SubCode:1}}}));return;}
        if(qqRepliesMode==='empty'){counts.qqReplies.empty++;res.end(JSON.stringify({code:0,req_0:{code:0,data:{SubCode:0,CommentList:{Total:41,HasMore:0,Comments:[]}}}}));return;}
        if(page===1&&qqRepliesNextPageFails){qqRepliesNextPageFails=false;counts.qqReplies.errors++;res.end(JSON.stringify({code:0,req_0:{code:1,data:{SubCode:1}}}));return;}
        if(page===1&&(param?.LastRankScore!=='8'||param?.LastCommentSeqNo!=='202')){counts.qqReplies.errors++;res.end(JSON.stringify({code:0,req_0:{code:1,data:{SubCode:1}}}));return;}
        const reply=(id,content,nick,rank,seq)=>({CmId:id,RootCmId:null,Content:content,Nick:nick,Location:'上海',PubTime:1700000200+Number(seq),PraiseNum:2,RankScore:rank,SeqNo:seq,RepliedComments:[{CmId:'1!qqroot',Nick:'QQ original reader',Content:'Synthetic QQ root'}]});
        const commentList=page===0?{Total:41,HasMore:1,Comments:[reply('1!qqreply1','Synthetic QQ full reply one','QQ reply reader', '9','201'),reply('1!qqreply2','Synthetic QQ full reply two','QQ reply reader two','8','202')]}:{Total:0,HasMore:0,Comments:[reply('1!qqreply3','Synthetic QQ full reply three','QQ reply reader three','7','203')]};
        res.end(JSON.stringify({code:0,req_0:{code:0,data:{SubCode:0,CommentList:commentList}}}));return;
      }
      if(body.req?.module==='music.pf_song_detail_svr'){
        const mid=body.req.param?.song_mid;
        res.end(JSON.stringify({code:0,req:{code:0,data:{track_info:{id:9068436,mid}}}}));return;
      }
      if(body.req&&body.req.module!=='music.search.SearchCgiService'){res.end(JSON.stringify({code:1}));return;}
      const wrappedSearch=body.req?.module==='music.search.SearchCgiService',service=body['music.search.SearchCgiService'],param=wrappedSearch?body.req.param:service?.param,page=param?.page_num??1,searchType=param?.search_type,aggregate=param?.query==='Unified aggregate fixture';
      const searchResponse=payload=>wrappedSearch?{code:0,req:payload}:{code:0,'music.search.SearchCgiService':payload};
      if(aggregate&&searchType===2){res.end(JSON.stringify(searchResponse({code:0,data:{body:{album:{sum:1,list:[{albumMID:'tx-aggregate-album',albumName:'Unified aggregate album TX',singerName:'Fixture artist',song_count:8,albumPic:'https://example.com/tx-album.jpg'}]}}}})));return;}
      if(aggregate&&searchType===1){res.end(JSON.stringify(searchResponse({code:0,data:{body:{singer:{sum:1,list:[{singerMID:'tx-aggregate-artist',singerName:'Unified aggregate artist TX',songNum:20,albumNum:2}]}}}})));return;}
      const song=(mid,live=false)=>({mid,title:'Synthetic match tone'+(live?' (Live)':''),singer:[{name:'Fixture artist'}],album:{name:live?'Manual fixture':'Matched fixture'},interval:120,file:{media_mid:mid,size_flac:1000}});
      const aggregateSong={id:'tx-aggregate-song-id',mid:'tx-aggregate-song',title:'Unified aggregate song TX',singer:[{name:'Fixture artist'}],album:{mid:'tx-aggregate-album',name:'Unified aggregate album TX'},interval:120,file:{media_mid:'tx-aggregate-song',size_128mp3:1000}};
      res.end(JSON.stringify(searchResponse({code:0,data:{body:{song:{sum:aggregate?1:2,list:page===1?aggregate?[aggregateSong]:[song(param?.query?.includes('slow')?'fixture-slow':'fixturematch01'),song('fixture-live',true)]:[]}}}})));return;
    }
    if(parsed.hostname==='search.kuwo.cn'){
      const aggregate=parsed.searchParams.get('all')==='Unified aggregate fixture';
      if(parsed.searchParams.get('all')==='Shape of You'){res.end(JSON.stringify({abslist:[{MUSICRID:'MUSIC_26445261',SONGNAME:'Shape of You',ARTIST:'Fixture artist'}],TOTAL:1}));return;}
      if(aggregate&&parsed.searchParams.get('ft')==='album'){res.end(JSON.stringify({albumlist:[{albumid:'kw-aggregate-album',name:'Unified aggregate album KW',artist:'Fixture artist',musiccnt:'6'}],total:'1'}));return;}
      if(aggregate&&parsed.searchParams.get('ft')==='artist'){res.end(JSON.stringify({abslist:[{ARTISTID:'kw-aggregate-artist',ARTIST:'Unified aggregate artist KW',SONGNUM:'10',ALBUMNUM:'1'}],TOTAL:'1'}));return;}
      if(aggregate){res.end(JSON.stringify({abslist:[{MUSICRID:'MUSIC_kw-aggregate-song',SONGNAME:'Unified aggregate song KW',ARTIST:'Fixture artist',ALBUM:'Unified aggregate album KW'}],TOTAL:1}));return;}
      res.end(JSON.stringify({abslist:[],TOTAL:0}));return;
    }
    if(parsed.hostname==='songsearch.kugou.com'){
      if(parsed.searchParams.get('keyword')==='Shape of You'){res.end(JSON.stringify({error_code:0,data:{lists:[{FileHash:'B6A303C9CDA8E6C4C0B2FB0B23A570C6',Audioid:24748592,OriSongName:'Shape of You',SingerName:'Fixture artist'}],total:1}}));return;}
      if(parsed.searchParams.get('keyword')==='Unified aggregate fixture'){res.end(JSON.stringify({error_code:0,data:{lists:[{FileHash:'kg-aggregate-song-hash',Audioid:24748600,OriSongName:'Unified aggregate song KG',SingerName:'Fixture artist',AlbumName:'Unified aggregate album KG'}],total:1}}));return;}
      res.end(JSON.stringify({error_code:0,data:{lists:[],total:0}}));return;
    }
    if(parsed.hostname==='msearch.kugou.com'&&parsed.searchParams.get('keyword')==='Unified aggregate fixture'){
      if(parsed.pathname==='/api/v3/search/album'){res.end(JSON.stringify({errcode:0,data:{total:1,info:[{albumid:'kg-aggregate-album',albumname:'Unified aggregate album KG',singername:'Fixture artist',songcount:5}]}}));return;}
      if(parsed.pathname==='/api/v3/search/singer'){res.end(JSON.stringify({status:1,errcode:0,data:[{singerid:'kg-aggregate-artist',singername:'Unified aggregate artist KG',songcount:8}]}));return;}
    }
    if(parsed.hostname==='jadeite.migu.cn'){
      if(parsed.searchParams.get('text')==='Shape of You'){res.end(JSON.stringify({code:'000000',songResultData:{resultList:[{songId:'1104719773',copyrightId:'6005753HF0D',name:'Shape of You',singers:[{name:'Ed Sheeran'}],audioFormats:[]}],totalCount:1}}));return;}
      if(parsed.searchParams.get('text')==='Unified aggregate fixture'){
        const searchSwitch=JSON.parse(parsed.searchParams.get('searchSwitch'));
        if(searchSwitch.song){res.end(JSON.stringify({code:'000000',songResultData:{resultList:[[{songId:'mg-aggregate-song',copyrightId:'mg-aggregate-copyright',name:'Unified aggregate song MG',singers:[{name:'Fixture artist'}],audioFormats:[]}]],totalCount:1}}));return;}
        if(searchSwitch.album){res.end(JSON.stringify({code:'000000',albumResultData:{result:[{id:'9002001',resourceType:'2003',name:'Unified aggregate album MG',singer:'Fixture artist'}],totalCount:1}}));return;}
        if(searchSwitch.singer){res.end(JSON.stringify({code:'000000',singerResultData:{result:[{id:'mg-aggregate-artist',name:'Unified aggregate artist MG',songCount:7,albumCount:1}],totalCount:1}}));return;}
      }
      res.end(JSON.stringify({code:'000000',songResultData:{resultList:[],totalCount:0}}));return;
    }
    res.writeHead(400);res.end();return;
  }
  if(req.url==='/discovery-cover.png'&&discoveryUI){res.setHeader('Content-Type','image/png');res.end(Buffer.from(themeCovers.red,'base64'));return;}
  if(req.url==='/unified-mv-cover.png'&&searchUI){res.setHeader('Content-Type','image/png');res.end(Buffer.from(themeCovers.multi,'base64'));return;}
  if(req.url==='/playlist-cover.png'&&playlistCoverUI){res.setHeader('Content-Type','image/png');res.end(Buffer.from(themeCovers.red,'base64'));return;}
  if(req.url==='/source.js'){seedLocalAudio();res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fixture);return;}
  if(req.url==='/sync-fixture/state'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({gets:counts.backup?.get??0,puts:counts.backup?.put??0,held:syncHeldReads.length}));return;
  }
  if(req.url==='/sync-fixture/hold-next-read'){syncHoldNextRead=true;res.end('ok');return;}
  if(req.url==='/sync-fixture/release-reads'){
    syncHoldNextRead=false;
    for(const release of syncHeldReads.splice(0))release();
    res.end('ok');return;
  }
  if(req.url==='/sync-fixture/remote-edit'){
    counts.syncEdits=(counts.syncEdits??0)+1;
    const entry=[...backupFiles].find(([path,body])=>path.startsWith('/sync-dav/')&&path.endsWith('/library-v1.json'));
    if(!entry){res.writeHead(404);res.end();return;}
    const [path,body]=entry,document=JSON.parse(body),playlist=document.records.find(record=>record.kind==='playlist'&&!record.deleted&&record.payload.title.startsWith('Sync original '));
    if(!playlist){res.writeHead(400);res.end();return;}
    playlist.payload.title=playlist.payload.title.replace('Sync original ','Sync cloud ');playlist.payload.updatedAt+=1;document.revision+=1;document.deviceId='d'.repeat(32);
    backupFiles.set(path,JSON.stringify(document));res.end('ok');return;
  }
  if(liveStatisticsSyncUI&&req.url==='/statistics-probe-state'){
    const raw=[...backupFiles].find(([name])=>name.endsWith('/statistics-v1.json'))?.[1],file=raw?JSON.parse(raw):null;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({puts:counts.backup?.put??0,gets:counts.backup?.get??0,revision:file?.revision??0,tracks:file?.statistics.items.length??0,playCount:file?.statistics.items.reduce((n,x)=>n+x.playCount,0)??0}));return;
  }
  if(req.url.startsWith('/backup-dav/')||req.url.startsWith('/sync-dav/')){
    counts.backup??={propfind:0,mkcol:0,put:0,get:0,authFailures:0};
    if(req.headers.authorization!=='Basic '+Buffer.from('fixture-user:fixture-password').toString('base64')){counts.backup.authFailures++;res.writeHead(401);res.end();return;}
    if(req.method==='MKCOL'){counts.backup.mkcol++;const status=backupDirectories.has(req.url)?405:201;backupDirectories.add(req.url);res.writeHead(status);res.end();return;}
    if(req.method==='PUT'){
      counts.backup.put++;const previous=backupFiles.get(req.url),tag=previous===undefined?'':'"'+createHash('sha256').update(previous).digest('hex')+'"';
      if(req.headers['if-match']){if(req.headers['if-none-match']||req.headers['if-match']!==tag){res.writeHead(412);res.end();return;}}
      else if(req.headers['if-none-match']!=='*'){res.writeHead(400);res.end();return;}
      else if(previous!==undefined){res.writeHead(412);res.end();return;}
      const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts).toString('utf8');const parsed=JSON.parse(body);
      if(!(['nexus-music','nexus-music-sync'].includes(parsed.format)||liveStatisticsSyncUI&&parsed.format==='nexus-listening-statistics')||/fixture-password|fixture-secret|Authorization/.test(body)){res.writeHead(400);res.end();return;}
      backupFiles.set(req.url,body);if(liveBackupSettingsUI&&parsed.format==='nexus-music'){writeFileSync(resolve(runDirectory,'actual-cloud-backup.json'),body);if(!localFixtureDirectory)throw Error('real backup Files directory unavailable');writeFileSync(resolve(localFixtureDirectory,'Actual Public Music Backup.json'),body);}
      if(parsed.format==='nexus-music'&&!liveBackupSettingsUI)backupFiles.set(req.url.slice(0,req.url.lastIndexOf('/')+1)+'broken.json','{synthetic invalid JSON');res.writeHead(previous===undefined?201:204,{ETag:'"'+createHash('sha256').update(body).digest('hex')+'"'});res.end();return;
    }
    if(req.method==='GET'){
      counts.backup.get++;
      if(req.url.startsWith('/sync-dav/')&&syncHoldNextRead){syncHoldNextRead=false;await new Promise(done=>syncHeldReads.push(done));}
      if(!backupFiles.has(req.url)){res.writeHead(404);res.end();return;}const body=backupFiles.get(req.url),tag='"'+createHash('sha256').update(body).digest('hex')+'"';if(req.headers['if-match']&&req.headers['if-match']!==tag){res.writeHead(412);res.end();return;}res.writeHead(200,{'Content-Type':'application/json',ETag:tag});res.end(body);return;
    }
    if(req.method==='PROPFIND'){
      counts.backup.propfind++;if(!backupDirectories.has(req.url)&&!backupFiles.has(req.url)){res.writeHead(404);res.end();return;}
      const row=(path,directory)=>`<d:response><d:href>${path}</d:href><d:propstat><d:prop><d:resourcetype>${directory?'<d:collection/>':''}</d:resourcetype>${directory?'':`<d:getcontentlength>${Buffer.byteLength(backupFiles.get(path))}</d:getcontentlength><d:getetag>&quot;${createHash('sha256').update(backupFiles.get(path)).digest('hex')}&quot;</d:getetag>`}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
      const children=req.headers.depth==='1'?[...backupDirectories,...backupFiles.keys()].filter(path=>path!==req.url&&path.startsWith(req.url)&&!path.slice(req.url.length).replace(/\/$/,'').includes('/')):[];
      res.writeHead(207,{'Content-Type':'application/xml'});res.end(`<d:multistatus xmlns:d="DAV:">${[req.url,...children].map(path=>row(path,backupDirectories.has(path))).join('')}</d:multistatus>`);return;
    }
    res.writeHead(405);res.end();return;
  }
  if(req.url.startsWith('/dav/')){
    counts.dav??={propfind:0,ranges:0,authFailures:0};
    if(req.headers.authorization!=='Basic '+Buffer.from('fixture-user:fixture-password').toString('base64')){counts.dav.authFailures++;res.writeHead(401);res.end();return;}
    const bytes=silentMP3(1200),file='/dav/album/Remote%20Fixture.mp3';
    if(req.method==='PROPFIND'){
      counts.dav.propfind++;res.statusCode=207;res.setHeader('Content-Type','application/xml');
      const row=(href,name,directory)=>`<d:response><d:href>${href}</d:href><d:propstat><d:prop><d:displayname>${name}</d:displayname><d:resourcetype>${directory?'<d:collection/>':''}</d:resourcetype>${directory?'':`<d:getcontentlength>${bytes.length}</d:getcontentlength><d:getetag>&quot;fixture-v1&quot;</d:getetag>`}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
      const rows=req.url==='/dav/'?row('/dav/','Root',true)+row('/dav/album/','Fixture album',true):req.url==='/dav/album/'?row('/dav/album/','Fixture album',true)+row(file,'Remote Fixture.mp3',false):row(file,'Remote Fixture.mp3',false);
      res.end(`<d:multistatus xmlns:d="DAV:">${rows}</d:multistatus>`);return;
    }
    if(req.url!==file){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type','audio/mpeg');res.setHeader('ETag','"fixture-v1"');res.setHeader('Accept-Ranges','bytes');
    if(req.headers['if-match']&&req.headers['if-match']!=='"fixture-v1"'){res.writeHead(412);res.end();return;}
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){counts.dav.ranges++;const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;if(start>=bytes.length){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);res.end(bytes.subarray(start,end+1));}else res.end(bytes);return;
  }

  const url=new URL(req.url,'http://127.0.0.1'),chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  const params=req.method==='POST'?new URLSearchParams(Buffer.concat(chunks).toString()):url.searchParams;
  const authenticated=(params.get('u')==='fixture-user'||params.get('u')==='fixture-photo'||navidromeNavigationUI&&['fixture-browser','fixture-browser-two'].includes(params.get('u'))||coverThemeUI&&params.get('u')==='fixture-theme')&&params.get('t')===createHash('md5').update('fixture-password'+params.get('s')).digest('hex');
  if(authenticated)counts.authSuccesses++;else counts.authFailures++;
  const respond=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({'subsonic-response':{status:'ok',version:'1.16.1',...body}}));};
  if(!authenticated){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({'subsonic-response':{status:'failed',error:{code:40,message:'fixture auth failure'}}}));return;}
  const method=url.pathname.split('/').at(-1).replace('.view','');
  counts.requests[method]=(counts.requests[method]??0)+1;
  if(method==='stream'){
    if(offlineUI){
      counts.offline=offlineCounts;
      if(blockOfflineStream){offlineCounts.blocked++;res.writeHead(503);res.end();return;}
      if(!req.headers.range)offlineCounts.full++;
      if(req.headers['if-range'])offlineCounts.resumed++;
      const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??''),start=Number(range?.[1]??0),end=range?.[2]?Math.min(Number(range[2]),navidromeAudio.length-1):navidromeAudio.length-1;
      if(start>=navidromeAudio.length||end<start){res.writeHead(416);res.end();return;}
      res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');res.setHeader('ETag','"offline-fixture-v1"');res.setHeader('Content-Length',end-start+1);
      if(range){res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${navidromeAudio.length}`);}
      // Keep a real, progressing partial response until the test pauses it.
      // Ordinary playback Range requests and resumed downloads retain full speed.
      let cursor=start,held=false;const timer=setInterval(()=>{const waiting=holdOfflineFull&&!range&&cursor-start>=262144;if(waiting&&!held){held=true;offlineCounts.heldFull++;}const next=Math.min(cursor+(waiting?1:32768),end+1);res.write(navidromeAudio.subarray(cursor,next));cursor=next;if(cursor>end){clearInterval(timer);if(!range)offlineCounts.fullFinished++;res.end();}},100);
      res.once('close',()=>clearInterval(timer));return;
    }
    const audio=navidromeAudio;
    res.setHeader('Content-Type',themeAudioPath?'audio/mpeg':'audio/wav');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),audio.length-1):audio.length-1;if(start>=audio.length){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${audio.length}`);res.end(audio.subarray(start,end+1));}else res.end(audio);return;
  }
  if(method==='getCoverArt'){
    if(referenceScene&&params.get('id')===song().coverArt){res.setHeader('Content-Type','image/png');res.end(referenceScene.cover);return;}
    // Restored tracks from another capture must never poison its private cover cache.
    if(params.get('id')?.startsWith('fixture-cover-reference-')){res.writeHead(404);res.end();return;}
    if(params.get('u')==='fixture-photo'){
      const kind=photoArtworkKinds.find(kind=>params.get('id')===`photo-${kind}-${photoArtworkVersion}`);
      if(kind){photoCoverRequests[kind]=(photoCoverRequests[kind]??0)+1;
        if(kind==='missing'){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type','image/png');res.end(kind==='corrupt'?Buffer.from('Original deliberately invalid image fixture'):photoArtwork[kind].png);return;
      }
    }
    if(coverThemeUI){counts.themeCoverIds??=[];counts.themeCoverIds.push(params.get('id'));}
    // A simulator can restore the preceding run's current track before this
    // test selects its new album. Only this run's identities are barriers.
    if(coverThemeUI&&params.get('id')?.startsWith('transition-')&&params.get('id').endsWith(`-${transitionVersion}`)){
      const color=params.get('id').split('-')[1];
      const startedAt=Date.now();
      const event=(type)=>{counts.transitionEvents??=[];counts.transitionEvents.push({color,type,at:Date.now(),ageMs:Date.now()-startedAt});};
      event('request');
      const held={color,startedAt,send:()=>{event('release');counts.transitionReleases??=[];counts.transitionReleases.push(color);if(color==='missing'){res.writeHead(404);res.end();}else{res.setHeader('Content-Type','image/png');res.end(Buffer.from(themeCovers[color],'base64'));}}};
      if(releasedThemeColors.has(color)){held.send();return;}
      heldThemeResponses.push(held);
      res.once('close',()=>{event('close');const index=heldThemeResponses.indexOf(held);if(index>=0)heldThemeResponses.splice(index,1);});return;
    }
    res.setHeader('Content-Type','image/png');res.end(Buffer.from(coverThemeUI&&params.get('u')==='fixture-theme'?themeCovers[params.get('id')]??themeCovers.red:themeCovers.multi,'base64'));return;
  }
  if(navidromeNavigationUI&&['fixture-browser','fixture-browser-two'].includes(params.get('u'))){
    counts.ndBrowser??={methods:{},streams:[]};counts.ndBrowser.methods[method]=(counts.ndBrowser.methods[method]??0)+1;
    const albums=Array.from({length:65},(_,i)=>({id:`browser-album-${i}`,name:`Browser album ${i}`,artist:'Browser artist'}));
    const songs=Array.from({length:120},(_,i)=>({...song(),id:`browser-song-${i}`,title:`Browser song ${i}`,coverArt:undefined}));
    if(method==='getAlbumList2'){respond({albumList2:{album:albums.slice(Number(params.get('offset')??0),Number(params.get('offset')??0)+50)}});return;}
    if(method==='getArtists'){respond({artists:{index:[{artist:Array.from({length:120},(_,i)=>({id:`browser-artist-${i}`,name:`Browser artist ${i}`}))}]}});return;}
    if(method==='getArtist'){respond({artist:{id:params.get('id'),name:'Browser artist detail',album:albums}});return;}
    if(method==='getAlbum'){respond({album:{id:params.get('id'),name:'Browser album detail',song:songs}});return;}
    if(method==='search3'){const offset=Number(params.get('songOffset')??0);respond({searchResult3:{song:songs.slice(offset,offset+50)}});return;}
    if(method==='getPlaylists'){respond({playlists:{playlist:Array.from({length:120},(_,i)=>({id:`browser-list-${i}`,name:`Browser list ${i}`,owner:'Fixture owner'}))}});return;}
    if(method==='getPlaylist'){respond({playlist:{id:params.get('id'),name:'Browser playlist detail',entry:songs}});return;}
  }
  if(method==='ping')respond({type:'Navidrome',serverVersion:'0.64.0'});
  else if(method==='getOpenSubsonicExtensions')respond({openSubsonicExtensions:[{name:'songLyrics',versions:[1]}]});
  else if(method==='getAlbumList2')respond({albumList2:{album:[{id:'fixture-album',name:'Synthetic album',artist:'Fixture artist',coverArt:'fixture-cover',songCount:params.get('u')==='fixture-photo'?4:coverThemeUI&&params.get('u')==='fixture-theme'?3:params.get('u')==='fixture-user'&&amLongQueue?8:1}]}});
  else if(method==='getAlbum')respond({album:{id:'fixture-album',name:'Synthetic album',song:params.get('u')==='fixture-photo'?photoSongs():coverThemeUI&&params.get('u')==='fixture-theme'?[...['red','blue','multi'].map(color=>({...song(),id:color,title:`${color} cover tone`,coverArt:color})),...(transitionFixture?['red','blue','missing'].map(color=>({...song(),id:`transition-${color}`,title:`transition ${color} tone`,coverArt:`transition-${color}-${transitionVersion}`})):[])]:params.get('u')==='fixture-user'&&amLongQueue?amQueueSongs():[song()]}});
  else if(method==='search3')respond({searchResult3:{song:[song()]}});
  else if(method==='getLyricsBySongId'&&structuredLyricsUI)respond({lyricsList:{structuredLyrics:params.get('enhanced')==='true'?[{
    lang:'en',synced:true,agents:[{id:'lead',role:'main'},{id:'guest',role:'voice'}],
    line:[{start:0,value:'Synthetic lyric one'},{start:6000,value:'Synthetic lyric two'},{start:12000,value:'Guest Lead'},{start:18000,value:'前👩‍💻中é后'}],
    cueLine:[
      {index:0,agentId:'lead',value:'Synthetic lyric one',cue:[{byteStart:0,byteEnd:9,start:0,value:'Synthetic '},{byteStart:10,byteEnd:15,start:2000,value:'lyric '},{byteStart:16,byteEnd:18,start:4000,value:'one'}]},
      {index:1,agentId:'lead',start:6000,end:12000,value:'Synthetic lyric two',cue:[{byteStart:0,byteEnd:9,start:8000,end:9000},{byteStart:10,byteEnd:18,start:7000,end:10000}]},
      {index:2,agentId:'guest',start:12000,end:18000,value:'Guest',cue:[{byteStart:0,byteEnd:4,start:12000,end:18000}]},
      {index:2,agentId:'lead',start:13000,end:18000,value:'Lead',cue:[{byteStart:0,byteEnd:3,start:13000,end:18000}]},
      {index:3,agentId:'lead',start:18000,end:30000,value:'前👩‍💻中é后',cue:[{byteStart:3,byteEnd:13,start:19000,end:21000,value:'👩‍💻'},{byteStart:17,byteEnd:18,start:22000,end:24000,value:'é'}]},
    ],
  }]:[]}});
  else if(method==='getLyricsBySongId'&&referenceScene)respond({lyricsList:{structuredLyrics:[{lang:'zh',synced:true,line:referenceScene.lyrics.map((value,index)=>({start:[0,260000,280000][index],value}))}]}});
  else if(method==='getLyricsBySongId'&&classicUI)respond({lyricsList:{structuredLyrics:[{lang:'zh',synced:true,line:[{start:0,value:'这是一行合成歌词文字'},{start:100000,value:'音枢经典播放器三行布局测试'},...(classicShortUI?[]:[{start:116000,value:'下一行用于验证歌词排版'}])]}]}});
  else if(method==='getLyricsBySongId')respond({lyricsList:{structuredLyrics:[{lang:'en',synced:true,line:[{start:0,value:'Synthetic lyric one'},{start:6000,value:'Synthetic lyric two'}],cueLine:[{index:0,start:0,end:6000,value:'Synthetic lyric one',cue:[{byteStart:0,byteEnd:9,start:0,end:2000,value:'Synthetic '},{byteStart:10,byteEnd:15,start:2000,end:4000,value:'lyric '},{byteStart:16,byteEnd:18,start:4000,end:6000,value:'one'}]},{index:1,start:6000,end:navidromeDuration*1000,value:'Synthetic lyric two',cue:[{byteStart:0,byteEnd:9,start:6000,end:8000,value:'Synthetic '},{byteStart:10,byteEnd:15,start:8000,end:10000,value:'lyric '},{byteStart:16,byteEnd:18,start:10000,end:navidromeDuration*1000,value:'two'}]}]}]}});
  else if(method==='star'||method==='unstar'){starred=method==='star';respond({});}
  else if(method==='getArtists')respond({artists:{index:[]}});
  else if(method==='getPlaylists')respond({playlists:{playlist:[]}});
  else respond({});
  } catch (error) {
    if (isClientAbort(error)) {
      counts.clientAborts=(counts.clientAborts??0)+1;
      counts.lastClientAbort={code:error?.code??null,message:String(error?.message??error),url:req.url??null};
      if(!res.destroyed&&!res.writableEnded)res.end();
      return;
    }
    counts.fixtureRequestFailures=(counts.fixtureRequestFailures??0)+1;
    counts.lastFixtureRequestFailure={message:String(error?.stack??error),url:req.url??null};
    console.error(`Fixture request failed for ${req.url??'<unknown>'}: ${error?.stack??error}`);
    if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});
    if(!res.destroyed&&!res.writableEnded)res.end(JSON.stringify({error:'fixture request failed'}));
    if(!process.exitCode)process.exitCode=1;
  }
};
const server = createServer((req, res) => { void handleRequest(req, res); });
server.on('clientError',(error,socket)=>{
  if(isClientAbort(error)){
    counts.clientAborts=(counts.clientAborts??0)+1;
    counts.lastClientAbort={code:error?.code??null,message:String(error?.message??error),url:null};
  } else {
    counts.fixtureRequestFailures=(counts.fixtureRequestFailures??0)+1;
    counts.lastFixtureRequestFailure={message:String(error?.stack??error),url:null};
    console.error(`Fixture HTTP client error: ${error?.stack??error}`);
    if(!process.exitCode)process.exitCode=1;
  }
  socket.destroy();
});
// The real local-file test never uses fixture HTTP routes. Give its harness an
// ephemeral port so an unrelated online regression can keep its fixed port.
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(livePublicCatalogUI||liveLocalUI&&!liveStatisticsSyncUI&&!liveBackupSettingsUI&&!liveDownloadNamingUI?0:18439, '127.0.0.1', resolve); });
mkdirSync(runDirectory,{recursive:true});
const logPath=resolve(runDirectory,'ui-catalog.log');
const sourceBefore=sourceSnapshot();
const log = openSync(logPath, 'w+');
let installedDuringTest;
const logWatcher=watch(logPath,()=>{
  if(localFixtureDirectory&&(!livePublicCatalogUI||installedDuringTest))return;
  const size=statSync(logPath).size,tail=Buffer.alloc(Math.min(4096,size));
  readSync(log,tail,0,tail.length,Math.max(0,size-tail.length));
  const text=tail.toString();
  if(livePublicCatalogUI&&!installedDuringTest&&text.includes('Test Case')&&(text.includes('PopularArtistsTests')||text.includes('MiguAlbumImportTests'))){
    const snapshot=installedBundleSnapshot(process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D');
    if(snapshot.digest){
      installedDuringTest={observedAt:new Date().toISOString(),sourceDigest:sourceBefore.digest,snapshot};
      writeFileSync(resolve(runDirectory,'installed-during-test.json'),JSON.stringify(installedDuringTest,null,2)+'\n');
    }
  }
  if(!localFixtureDirectory&&(text.includes('Test Case')||text.includes('Running tests')))seedLocalAudio();
});
try {
  const resultPath = `build/SourceUITests-${Date.now()}.xcresult`;
  console.log(`UI capture result: ${resultPath}; log: ${logPath}`);
  const fixturePath=entryFile??'scripts/test-ui.mjs';
  const runManifest={schemaVersion:1,startedAt:new Date().toISOString(),resultBundle:resolve(resultPath),sourceBefore,configuration,fixture:{path:fixturePath,sha256:sourceBefore.files[fixturePath]},simulator:process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D'};
  if(referenceScene)runManifest.externalInputs={before:referenceScene.snapshot,requiredPaths:referenceScene.paths};
  if(liveLocalPath)runManifest.externalInputs={before:liveLocalSnapshot,requiredPaths:liveInputPaths};
  if(themeAudioPath){runManifest.externalInputs={before:themeAudioSnapshot,requiredPaths:[themeAudioPath]};runManifest.fixture.audio={path:themeAudioPath,duration:themeAudioDuration,sha256:fileSha256(themeAudioPath)};}
  writeFileSync(resolve(runDirectory,'run-manifest.json'),JSON.stringify(runManifest,null,2)+'\n');
  const args = ['test','-parallel-testing-enabled','NO', '-workspace', 'ios/app.xcworkspace', '-scheme', 'app', '-configuration', configuration,
    '-destination', `platform=iOS Simulator,id=${process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D'}`,
    '-derivedDataPath', derivedDataPath, '-resultBundlePath', resultPath, 'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'FORCE_BUNDLING=1'];
  for(const target of process.argv.slice(2))args.push(`-only-testing:${target}`);
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveMiguSearchAssistance')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveMiguSearchAssistance');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveSearchAssistance')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveSearchAssistance');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveArtistSearch')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveArtistSearch');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveMiguArtistSongs')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveMiguArtistSongs');
  if(!miguAlbumImportUI)args.push('-skip-testing:NexusMusicUITests/MiguAlbumImportTests');
  if(!process.argv.slice(2).some(target=>(target.endsWith('/testLivePopularArtists')||target.endsWith('/testLiveNewAlbums'))))args.push('-skip-testing:NexusMusicUITests/PopularArtistsTests');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveMiguArtistAlbums')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveMiguArtistAlbums');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveCatalogFavorites')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveCatalogFavorites');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveMVSearch')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveMVSearch');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveMVMediaLifecycle')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveMVMediaLifecycle');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveAlbumSearch')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveAlbumSearch');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLivePlaylistSearch')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLivePlaylistSearch');
  if(!liveLocalUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalIndexActions','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalSorting','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalFolderScan','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalPlaylistBatch','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveListeningStatistics');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveRestoredTimeline')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveRestoredTimeline');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveQQComputerPairing')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveQQComputerPairing');
  for(const target of ['testLiveKugouQrPhotoDenied','testLiveKugouQrPhotoSave'])if(!process.argv.slice(2).some(value=>value.endsWith('/'+target)))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/'+target);
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveKugouPlaylistEntry')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveKugouPlaylistEntry');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveQQPlaylistEntry')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveQQPlaylistEntry');
  for(const target of ['testLiveAccountMVEntry','testLiveAccountAlbumEntry','testLiveAccountPlaylistEntry'])if(!process.argv.slice(2).some(value=>value.endsWith('/'+target)))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/'+target);
  if(!liveBackgroundUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveBackgroundPersistence');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveThemeConfig')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveThemeConfig');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveRetainedAudio')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveRetainedAudio');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadPolicy')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadPolicy');
  if(!liveBackupSettingsUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveBackupSettings');
  if(!liveStatisticsSyncUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveStatisticsSync');
  if(!liveCatalogUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveSourceCatalog','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveSourcePlayback','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveSourceSearchStates');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadBatch')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadBatch');
  for(const target of ['testLiveSongDownloadEntries','testLiveSongDownloadQualityChoice','testLivePlayerDownloadQualityChoice','testLiveSimilarSongs','testLiveSimilarControls','testLiveDiscoveryRandom','testLiveSongShare'])if(!process.argv.slice(2).some(value=>value.endsWith('/'+target)))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/'+target);
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadNaming')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadNaming');
  if(!liveDownloadExportUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadNamingExport');
  if(!liveDownloadAttachmentsUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadAttachments');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadQuality')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadQuality');
  if(!liveManagedAttachmentsUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveManagedDownloadAttachments');
  if(!liveDownloadDestinationUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadDestination');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveQQDailyAuthorization')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveQQDailyAuthorization');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLivePlatformRecommendations')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLivePlatformRecommendations');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveQQWebLogin')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveQQWebLogin');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveKugouQrLogin')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveKugouQrLogin');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveNeteaseCommentReplies')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveNeteaseCommentReplies');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveNeteasePublicComments')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveNeteasePublicComments');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveQQPublicComments')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveQQPublicComments');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveMiguPublicComments')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveMiguPublicComments');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveKuwoPublicComments')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveKuwoPublicComments');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveKugouPublicComments')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveKugouPublicComments');
  for(const variant of ['Large','Small'])if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadCover'+variant)))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadCover'+variant);
  // Always spell out the entry: a previous fixture build must not leak into a
  // later normal-navigation or distribution build via incremental settings.
  args.push(`ENTRY_FILE=${resolve(entryFile??'index.ts')}`);
  if(!fixtureOnlineUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testCrossPlatformLyrics','-skip-testing:NexusMusicUITests/SourceSettingsTests/testOnlineMatching','-skip-testing:NexusMusicUITests/SourceSettingsTests/testSourceHealth','-skip-testing:NexusMusicUITests/SourceSettingsTests/testPublicComments','-skip-testing:NexusMusicUITests/SourceSettingsTests/testPublicQQComments','-skip-testing:NexusMusicUITests/SourceSettingsTests/testPublicMiguComments','-skip-testing:NexusMusicUITests/SourceSettingsTests/testPublicKuwoComments','-skip-testing:NexusMusicUITests/SourceSettingsTests/testPublicKugouComments','-skip-testing:NexusMusicUITests/SourceSettingsTests/testDiscoverySongActions','-skip-testing:NexusMusicUITests/SourceSettingsTests/testStyleRecommendation','-skip-testing:NexusMusicUITests/SourceSettingsTests/testSearchHistoryAndStates','-skip-testing:NexusMusicUITests/SourceSettingsTests/testUnifiedSongAlbumArtistSearch','-skip-testing:NexusMusicUITests/SourceSettingsTests/testUnifiedSearchAggregateFivePlatformMatrix','-skip-testing:NexusMusicUITests/SourceSettingsTests/testQishuiPublicPlaylistImport','-skip-testing:NexusMusicUITests/SourceSettingsTests/testWayfarerAppImport','-skip-testing:NexusMusicUITests/SourceSettingsTests/testAccountFmStationContinuation');
  if(!sequentialLyricsUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testSequentialTTMLLyrics');
  if(!amllLyricsUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testAMLLProfileLyrics','-skip-testing:NexusMusicUITests/SourceSettingsTests/testAMLLProfileLyricsAtAccessibilityXXXL');
  if(!navidromeNavigationUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testNavidromeBrowseHistory');
  if(!systemVolumeUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testSystemAndAppVolumeControlsPreservePlayback');
  if(!structuredLyricsUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testStructuredNavidromeLyrics');
  if(!classicReferenceUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testVisualLabClassicReferenceDirect');
  if(!classicUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testVisualLabClassicDirect','-skip-testing:NexusMusicUITests/SourceSettingsTests/testVisualLabClassicShortDirect');
  if(!appearanceUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testVisualLabAppearanceDirect');
  runManifest.buildArguments=args;
  runManifest.toolchain={node:process.version,xcode:execFileSync('xcodebuild',['-version'],{encoding:'utf8'}).trim()};
  runManifest.buildEnvironmentSha256=createHash('sha256').update(JSON.stringify(Object.fromEntries(['NODE_BINARY','NODE_OPTIONS','PYTHONPATH','DEVELOPER_DIR','ENTRY_FILE','RCT_NEW_ARCH_ENABLED','USE_HERMES','USE_PREBUILT_RNCORE','USE_RN_DEP','NEXUS_UI_CONFIGURATION'].map(key=>[key,process.env[key]??null])))).digest('hex');
  writeFileSync(resolve(runDirectory,'run-manifest.json'),JSON.stringify(runManifest,null,2)+'\n');
  const child = spawn('xcodebuild', args, { stdio: ['ignore', log, log] });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
  if(code===0&&timedLyricsUI&&!(counts.lyrics?.[amllLyricsUI?'ttmlAmll':'ttmlSeq']>0)){
    console.error('Timed TTML fixture was not requested; cached lyrics cannot prove this case');
    process.exitCode=1;
  }
  // Observe actual installed bytes while XCTest is running. Xcode may shut
  // down an initially idle destination during teardown; retain that failure
  // separately and keep the timestamped in-test observation as provenance.
  const installedAfterTest=installedBundleSnapshot(runManifest.simulator);
  Object.assign(runManifest,{finishedAt:new Date().toISOString(),exitCode:process.exitCode,sourceAfter:sourceSnapshot(),installedBundle:installedAfterTest.digest?installedAfterTest:installedDuringTest?.snapshot??installedAfterTest,installedAfterTest,...(installedDuringTest?{installedDuringTest}:{}) ,resultInfoSha256:existsSync(resolve(resultPath,'Info.plist'))?fileSha256(resolve(resultPath,'Info.plist')):null});
  runManifest.sourceUnchanged=runManifest.sourceBefore.digest===runManifest.sourceAfter.digest;
  if(referenceScene){runManifest.externalInputs.after=externalInputSnapshot(referenceScene.paths);runManifest.externalInputs.unchanged=runManifest.externalInputs.before.digest===runManifest.externalInputs.after.digest;if(!runManifest.externalInputs.unchanged)process.exitCode=1;}
  if(liveLocalPath){runManifest.externalInputs.after=externalInputSnapshot(liveInputPaths);runManifest.externalInputs.unchanged=liveLocalSnapshot.digest===runManifest.externalInputs.after.digest;if(!runManifest.externalInputs.unchanged)process.exitCode=1;}
  if(themeAudioPath){runManifest.externalInputs.after=externalInputSnapshot([themeAudioPath]);runManifest.externalInputs.unchanged=themeAudioSnapshot.digest===runManifest.externalInputs.after.digest;if(!runManifest.externalInputs.unchanged)process.exitCode=1;}
  writeFileSync(resolve(runDirectory,'run-manifest.json'),JSON.stringify(runManifest,null,2)+'\n');
  if(code===0&&counts.transitionVideo){
    try{
      const verification=execFileSync('xcrun',['swift',resolve('scripts/verify-ambient-transition-video.swift'),counts.transitionVideo],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
      writeFileSync(counts.transitionVideo+'.verification.txt',verification);console.log(verification.trim());
    }catch(error){process.exitCode=1;console.error('Production transition video verification failed:',error.message);}
  }
  console.log(`iOS source UI test exit: ${code}; log: ${logPath}`);
  // Keep individual failure messages visible even when the failed test is far
  // above the workflow's final 100 log lines. Never change the xcodebuild status.
  try {
    const summaryJSON=execFileSync('xcrun',['xcresulttool','get','test-results','summary','--path',resultPath],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
    writeFileSync(resolve(runDirectory,'ui-summary.json'),summaryJSON);
    const summary=JSON.parse(summaryJSON);
    console.log(`UI results: ${summary.passedTests} passed, ${summary.failedTests} failed, ${summary.skippedTests} skipped; ${resultPath}`);
    for(const failure of summary.testFailures??[])console.error(`${failure.testIdentifierString}: ${failure.failureText}`);
    if(summary.failedTests>0){
      try{console.log(`Failure screenshots and text: ${exportFailureEvidence(resultPath,summary.testFailures.map(failure=>failure.testIdentifierString))}`);}
      catch(error){console.error(`Failure attachment export unavailable: ${error.message}; original result: ${resultPath}`);}
    }
  } catch { console.error(`UI summary unavailable; inspect ${resultPath} and build/logs/ui-catalog.log`); }
} finally {
  if(themeRecorder)themeRecorder.kill('SIGINT');logWatcher.close();writeFileSync(resolve(runDirectory,'ui-server-counts.json'),JSON.stringify(counts,null,2));
  if(liveStatisticsSyncUI){const remote=[...backupFiles].find(([name])=>name.endsWith('/statistics-v1.json'))?.[1];if(remote)writeFileSync(resolve(runDirectory,'actual-cloud-statistics.json'),remote);}
  // Observe the actual OS Save-to-Files output before removing this harness's
  // temporary Files directory. Never generate or seed a theme import document.
  if(liveThemeConfigUI&&localFixtureDirectory){
    try{
      const names=readdirSync(localFixtureDirectory).filter(name=>/^nexus-theme-\d+\.json$/.test(name));
      if(names.length!==1)throw Error('Expected one actual saved theme file');
      const path=resolve(localFixtureDirectory,names[0]),body=readFileSync(path),savedSha256=fileSha256(path);
      writeFileSync(resolve(runDirectory,'actual-saved-theme.json'),body);
      const archivedSha256=fileSha256(resolve(runDirectory,'actual-saved-theme.json'));if(savedSha256!==archivedSha256)throw Error('Actual saved theme hash mismatch');
      writeFileSync(resolve(runDirectory,'actual-saved-theme-receipt.json'),JSON.stringify({name:names[0],bytes:body.length,savedSha256,archivedSha256,temporaryOriginalRemovedAfterArchiving:true},null,2));
    }catch(error){console.error(`Actual theme export archival failed: ${error.message}`);if(!process.exitCode)process.exitCode=1;}
  }
  // Preserve the file actually emitted by the OS activity before deleting
  // this harness-owned folder; never seed the named export itself.
  if(((liveDownloadNamingUI&&!liveSongDownloadUI&&!liveSimilarSongsUI&&!liveSongShareUI)||liveDownloadExportUI)&&localFixtureDirectory){
    try{
      const names=readdirSync(localFixtureDirectory).filter(name=>name.includes('__')&&/\.(mp3|m4a|flac|wav|aiff|ogg|aac)$/i.test(name));
      if(names.length!==1)throw Error('Expected one actual named audio export');
      const source=resolve(localFixtureDirectory,names[0]);if(statSync(source).size>30000000)throw Error('Unexpected export size');
      const target=resolve(runDirectory,'actual-saved-audio'+names[0].slice(names[0].lastIndexOf('.')));writeFileSync(target,readFileSync(source));
      const savedSha256=fileSha256(source),archivedSha256=fileSha256(target);if(savedSha256!==archivedSha256)throw Error('Saved audio archive changed');
      writeFileSync(resolve(runDirectory,'actual-saved-audio-receipt.json'),JSON.stringify({name:names[0],bytes:statSync(source).size,savedSha256,archivedSha256,temporaryOriginalRemovedAfterArchiving:true},null,2));
    }catch(error){console.error(`Actual named audio archival failed: ${error.message}`);if(!process.exitCode)process.exitCode=1;}
  }
  if((liveDownloadAttachmentsUI||liveDownloadCoverUI||liveManagedAttachmentsUI)&&localFixtureDirectory){
    try{
      const names=readdirSync(localFixtureDirectory).filter(name=>/^Ed Sheeran__Shape of You\.(?:mp3|lrc|jpg|meta\.json)$/.test(name));
      if(names.length!==4)throw Error('Expected four actual OS-exported companion files');
      const target=resolve(runDirectory,'actual-attachment-exports');mkdirSync(target);const files=[];
      for(const name of names){const source=resolve(localFixtureDirectory,name),bytes=statSync(source).size;if(bytes<=0||bytes>30000000)throw Error('Unexpected attachment size');const sha256=fileSha256(source);writeFileSync(resolve(target,name),readFileSync(source));if(fileSha256(resolve(target,name))!==sha256)throw Error('Attachment archive changed');files.push({name,bytes,sha256});}
      writeFileSync(resolve(runDirectory,'actual-attachments-receipt.json'),JSON.stringify({files,originalsRemovedAfterArchiving:true},null,2));
    }catch(error){console.error(`Actual companion export archival failed: ${error.message}`);if(!process.exitCode)process.exitCode=1;}
  }
  if(liveDownloadDestinationUI&&localFixtureDirectory){
    try{
      const names=readdirSync(localFixtureDirectory).filter(name=>/^Ed Sheeran__Shape of You(?: \(2\))?\.(?:mp3|lrc|jpg|meta\.json)$/.test(name));if(names.length!==8)throw Error('Expected two actual four-file destination groups');
      const target=resolve(runDirectory,'actual-destination-copies');mkdirSync(target);const files=[];for(const name of names){const source=resolve(localFixtureDirectory,name),bytes=statSync(source).size,sha256=fileSha256(source);if(bytes<=0||bytes>30000000)throw Error('Unexpected destination copy size');writeFileSync(resolve(target,name),readFileSync(source));if(fileSha256(resolve(target,name))!==sha256)throw Error('Destination archive changed');files.push({name,bytes,sha256});}
      writeFileSync(resolve(runDirectory,'actual-destination-receipt.json'),JSON.stringify({files,originalsRemovedOnlyFromHarnessOwnedFolderAfterArchiving:true},null,2));
    }catch(error){console.error(`Actual destination archival failed: ${error.message}`);if(!process.exitCode)process.exitCode=1;}
  }
  closeSync(log); server.closeAllConnections(); server.close();if(localFixtureDirectory)rmSync(localFixtureDirectory,{recursive:true,force:true});
}
