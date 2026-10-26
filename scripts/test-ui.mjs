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

const runDirectory=process.env.NEXUS_UI_RUN_DIR??'build/logs';
if(process.env.NEXUS_UI_RUN_DIR&&existsSync(resolve(runDirectory,'run-manifest.json')))throw new Error('Refusing to overwrite a capture run manifest');
// Intel simulators cannot link the prebuilt Release Hermes (missing inspector
// symbols); Debug links the debug framework and is for local visual iteration
// only. Formal evidence stays Release.
const configuration=process.env.NEXUS_UI_CONFIGURATION??'Release';
if(!['Debug','Release'].includes(configuration))throw new Error(`Unsupported NEXUS_UI_CONFIGURATION: ${configuration}`);
const liveBackupSettingsUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveBackupSettings'));
const liveThemeConfigUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveThemeConfig'));
const liveStatisticsSyncUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveStatisticsSync'));
const liveLocalUI=process.argv.slice(2).some(target=>/\/testLive(?:Local(?:IndexActions|Sorting|FolderScan|PlaylistBatch)|ListeningStatistics|StatisticsSync|BackupSettings|RestoredTimeline|ThemeConfig|RetainedAudio)$/.test(target));
if(Boolean(process.env.NEXUS_UI_LOCAL_AUDIO)!==liveLocalUI||(liveLocalUI&&process.argv.slice(2).length!==1))throw new Error('Real local audio requires its single explicit live local target and audio path');
const liveLocalPath=liveLocalUI?realpathSync(process.env.NEXUS_UI_LOCAL_AUDIO):null;
const liveLocalFolderUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveLocalFolderScan'));
const liveLocalSorting=liveLocalFolderUI||process.argv.slice(2).some(target=>/\/(?:testLiveLocal(?:Sorting|PlaylistBatch)|testLiveRetainedAudio)$/.test(target));
if(Boolean(process.env.NEXUS_UI_LOCAL_AUDIO_SECOND)!==liveLocalSorting)throw new Error('Real two-song local verification requires a second actual audio file and its explicit target');
const liveLocalPaths=liveLocalPath?[liveLocalPath,...(liveLocalSorting?[realpathSync(process.env.NEXUS_UI_LOCAL_AUDIO_SECOND)]:[])]:[];
const liveLocalSnapshot=liveLocalPath?externalInputSnapshot(liveLocalPaths):null;
if(liveLocalPaths.some(path=>!/\.mp3$/i.test(path)||statSync(path).size<100000||statSync(path).size>30000000))throw new Error('Real local audio must be a complete MP3 of 100 KB–30 MB');
let localFixtureDirectory;
function seedLocalAudio() {
  if(localFixtureDirectory)return;
  try {
    const groups=execFileSync('xcrun',['simctl','get_app_container',process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D','com.apple.DocumentsApp','groups'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
    const container=groups.split('\n').find(line=>line.startsWith('group.com.apple.FileProvider.LocalStorage\t'))?.split('\t')[1];if(!container)return;
    localFixtureDirectory=resolve(container,'File Provider Storage',liveLocalFolderUI?'Nexus Real Scan':'Nexus UITest Fixtures');mkdirSync(localFixtureDirectory,{recursive:true});
    if(liveLocalPath){
      const seeded=liveLocalPaths.map((path,index)=>{const directory=liveLocalFolderUI&&index===1?resolve(localFixtureDirectory,'Albums'):localFixtureDirectory;mkdirSync(directory,{recursive:true});const destination=resolve(directory,basename(path));writeFileSync(destination,readFileSync(path));return [path,destination];});
      if(seeded.some(([path,destination])=>fileSha256(destination)!==fileSha256(path)))throw new Error('Real audio copy hash mismatch');
      console.log('[ui-real-audio] unchanged public audio copied into Files');return;
    }
    writeFileSync(resolve(localFixtureDirectory,'Synthetic Tagged Tone.mp3'),silentMP3(1200));writeFileSync(resolve(localFixtureDirectory,'Nexus Fixture.ttf'),fixtureFont());
    // Deterministic original image for the real Files picker path. Production
    // code performs the resize/re-encode and metadata stripping after import.
    writeFileSync(resolve(localFixtureDirectory,'Nexus Visual Fixture.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
    const list=Array.from({length:1000},(_,i)=>({id:`wy_${i<2?'90071992547409931234':i}`,name:i<2?'Duplicate fixture':`Fixture song ${i}`,singer:'Synthetic artist',source:'wy',interval:i<2?'03:00':'01:00',meta:{songId:i<2?'90071992547409931234':String(i),albumName:i<2?'Repeated album':'Bulk album'}}));
    writeFileSync(resolve(localFixtureDirectory,'Nexus Playlist Fixture.json'),JSON.stringify({type:'playListPart_v2',data:{name:'Nexus list fixture',list}}));
    const lxmc={type:'playListPart_v2',data:{name:'Nexus LXMC fixture',list:[
      {id:'2829_abcdef',name:'KG fixture',singer:'Synthetic artist',source:'kg',interval:'4:00',meta:{songId:'2829',hash:'abcdef',qualitys:[{type:'128k',size:'3.56M',hash:'h1'}],_qualitys:{'128k':{size:'3.56M',hash:'h1'}}}},
      {id:'tx_MID',name:'TX fixture',singer:'Synthetic artist',source:'tx',interval:'3:02',meta:{songId:'MID',id:'9007199254740993123',strMediaMid:'MID_HI',qualitys:[{type:'320k',size:'9.99M'}]}},
      {id:'kg_2829_abcdef',name:'KG fixture',singer:'Synthetic artist',source:'kg',interval:'4:00',meta:{songId:'2829',hash:'abcdef'}},
    ]}};
    writeFileSync(resolve(localFixtureDirectory,'Nexus LXMC Fixture.lxmc'),gzipSync(Buffer.from(JSON.stringify(lxmc))));
    for(const name of ['Synthetic Tagged Tone.mp3','Nexus Fixture.ttf','Nexus Visual Fixture.png','Nexus Playlist Fixture.json','Nexus LXMC Fixture.lxmc']){
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
const liveCatalogUI=process.argv.slice(2).some(target=>/\/testLiveSource(?:Catalog|Playback|SearchStates)$/.test(target));
const liveDownloadUI=process.argv.slice(2).some(target=>target.endsWith('/testLiveDownloadBatch'));
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
  liveSources=visit(directory).map(path=>{
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
const counts={requests:{},authFailures:0,authSuccesses:0};
const matchingUI=process.argv.slice(2).some(target=>target.endsWith('/testCrossPlatformLyrics')||target.endsWith('/testOnlineMatching')||target.endsWith('/testSourceHealth')||target.endsWith('/testPublicComments'));
const discoveryUI=process.argv.slice(2).some(target=>target.endsWith('/testDiscoverySongActions'));
const searchUI=process.argv.slice(2).some(target=>target.endsWith('/testSearchHistoryAndStates'));
const fixtureOnlineUI=matchingUI||discoveryUI||searchUI;
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
const entryFile=vinylReferenceUI?'tests/e2e/vinyl.tsx':classicUI?'tests/e2e/classic.tsx':appearanceUI?'tests/e2e/appearance.tsx':fixtureOnlineUI?'tests/e2e/entry.tsx':null;
const coverThemeUI=process.argv.slice(2).some(target=>target.endsWith('/testGlobalCoverThemeChangesAcrossPages'));
const offlineUI=process.argv.slice(2).some(target=>['/testDownloadSettingsAndOfflinePlayback','/testDownloadTaskBatchActions'].some(suffix=>target.endsWith(suffix)));
let blockOfflineStream=false;
const offlineCounts={full:0,resumed:0,blocked:0};
let holdDiscoveryDetail=false;
let truncateDiscoveryPlaylist=true;
let amLongQueue=false;
let pagerDiscovery=false,pagerReplacement=false,pagerFailNext=false;
const pagerPages=[];
const heldDiscoveryResponses=[];
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
const navidromeDuration=referenceScene?.duration??120;
const navidromeAudio=referenceScene?Buffer.alloc(44+48000*2*navidromeDuration):matchingAudio;
if(referenceScene){
  matchingAudio.copy(navidromeAudio,0,0,44);navidromeAudio.writeUInt32LE(navidromeAudio.length-8,4);navidromeAudio.writeUInt32LE(navidromeAudio.length-44,40);
  for(let offset=44;offset<navidromeAudio.length;offset+=audio.length-44)audio.copy(navidromeAudio,offset,44,Math.min(audio.length,44+navidromeAudio.length-offset));
}
// Version the synthetic recording when its bytes change. Existing test devices
// can still contain the original 12-second recording in the normal audio cache.
const photoArtworkVersion=String(Date.now()),photoArtworkKinds=['portrait','landscape','missing','corrupt'];
const photoCoverRequests=counts.photoCoverRequests={};
const photoSongs=()=>photoArtworkKinds.map(kind=>({...song(),id:`photo-${kind}-${photoArtworkVersion}`,title:`${kind} artwork tone`,coverArt:`photo-${kind}-${photoArtworkVersion}`}));
const song=()=>({id:referenceScene?'fixture-classic-reference-v2-'+referenceScene.id:structuredLyricsUI?'fixture-classic-structured-sparse-v1':classicUI?(classicShortUI?'fixture-classic-two-lines-v1':'fixture-classic-three-lines-v1'):'fixture-song-120s-v2',title:classicUI?'嗜好':'Synthetic tone',artist:classicUI?'颜人中':'Fixture artist',album:'Synthetic album',coverArt:referenceScene?'fixture-cover-reference-v2-'+referenceScene.id:'fixture-cover-motion-v1',duration:navidromeDuration,suffix:'wav',...(starred?{starred:'2026-01-01T00:00:00Z'}:{})});
const amQueueSongs=()=>[song(),...Array.from({length:7},(_,index)=>({...song(),id:`fixture-long-${index+2}`,title:`Synthetic tone ${index+2}`}))];
const server = createServer(async (req, res) => {
  if(liveCatalogUI&&req.url==='/live-source-index'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(liveSources.map(({name},index)=>({name,index}))));return;
  }
  const liveIndex=liveCatalogUI?req.url?.match(/^\/live-source-(\d+)\.js$/):null;
  if(liveIndex){
    const source=liveSources[Number(liveIndex[1])];
    if(!source){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(source.script);return;
  }

  if(referenceScene&&req.url==='/classic-reference-scene'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({lyrics:referenceScene.lyrics}));return;}
  if(req.url.startsWith('/am-fixture-control')){const control=new URL(req.url,'http://127.0.0.1');amLongQueue=control.searchParams.get('longQueue')==='1';res.setHeader('Content-Type','application/json');res.end(JSON.stringify({longQueue:amLongQueue}));return;}
  if(req.url==='/photo-artwork-fixture-control'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:photoArtworkVersion,requests:photoCoverRequests}));return;}

  if(coverThemeUI&&req.url.startsWith('/theme-fixture-control')){
    // This endpoint observes changing in-flight requests, never cached data.
    res.setHeader('Cache-Control','no-store');
    counts.themeControlPolls=(counts.themeControlPolls??0)+1;
    const control=new URL(req.url,'http://127.0.0.1');
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
      try{await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Simulator video did not start')),15000);
        const finish=error=>{clearTimeout(timer);error?reject(error):resolve();};
        recorder.once('error',finish);recorder.once('exit',()=>finish(new Error('Simulator video exited before readiness')));
        recorder.stderr.on('data',data=>{if(data.toString().includes('Recording started'))finish();});
      });}catch{recorder.kill('SIGINT');themeRecorder=undefined;res.writeHead(500);res.end();return;}
      // Opt-in fault injection proves recorder readiness cannot consume a
      // production cover request's timeout. Only this isolated fixture uses it.
      const readyDelay=Number(process.env.NEXUS_UI_THEME_RECORD_READY_DELAY_MS??0);
      if(Number.isFinite(readyDelay)&&readyDelay>0&&readyDelay<=15000){counts.recorderReadyDelayMs=readyDelay;await new Promise(resolve=>setTimeout(resolve,readyDelay));}
      counts.transitionVideo=file;
    }
    if(control.searchParams.has('stop')&&themeRecorder){const recorder=themeRecorder;themeRecorder=undefined;recorder.kill('SIGINT');await new Promise(resolve=>recorder.once('exit',resolve));}
    const heldColors=[...new Set(heldThemeResponses.map(item=>item.color))];
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({held:heldColors.length,heldColors}));return;
  }
  if(discoveryUI&&req.url.startsWith('/discovery-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1');
    if(control.searchParams.has('holdNext'))holdDiscoveryDetail=true;
    if(control.searchParams.has('completePlaylist'))truncateDiscoveryPlaylist=false;
    if(control.searchParams.has('pager'))pagerDiscovery=true;
    if(control.searchParams.has('replace'))pagerReplacement=true;
    if(control.searchParams.has('failNext'))pagerFailNext=true;
    if(control.searchParams.has('release'))for(const send of heldDiscoveryResponses.splice(0))send();
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({held:heldDiscoveryResponses.length}));return;
  }
  if(offlineUI&&req.url.startsWith('/offline-fixture-control')){
    const control=new URL(req.url,'http://127.0.0.1');
    if(control.searchParams.has('block'))blockOfflineStream=control.searchParams.get('block')==='1';
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...offlineCounts,streams:counts.requests.stream??0}));return;
  }
  if(req.url==='/matching-source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(matchingScript);return;}
  if(req.url==='/health-source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(healthScript);return;}
  if(req.url.startsWith('/matching-audio/')){
    if(!matchingUI){res.writeHead(404);res.end();return;}
    counts.matchAudio??={};counts.matchAudio[req.url]=(counts.matchAudio[req.url]??0)+1;
    res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),matchingAudio.length-1):matchingAudio.length-1;if(start>=matchingAudio.length){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${matchingAudio.length}`);res.end(matchingAudio.subarray(start,end+1));}else res.end(matchingAudio);return;
  }
  if(req.url==='/nexus-ui-test-online-adapter'){
    if(!fixtureOnlineUI){res.writeHead(404);res.end();return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const {url,request}=JSON.parse(Buffer.concat(chunks).toString());const parsed=new URL(url);
    counts.online??={};counts.online[parsed.hostname]=(counts.online[parsed.hostname]??0)+1;
    res.setHeader('Content-Type','application/json');
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
    if(discoveryUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/api/playlist/list'){
      counts.discovery??={lists:0,details:0};counts.discovery.lists++;
      res.end(JSON.stringify({code:200,more:false,playlists:[{id:'101',name:'Synthetic discovery playlist',description:'Original UI fixture',trackCount:2,coverImgUrl:'http://127.0.0.1:18439/discovery-cover.png'}]}));return;
    }
    if(discoveryUI&&parsed.hostname==='music.163.com'&&parsed.pathname==='/api/v6/playlist/detail'){
      counts.discovery??={lists:0,details:0};counts.discovery.details++;
      const tracks=['one','two'].map((word,index)=>({id:String(9101+index),name:`Synthetic discovery ${word}`,ar:[{name:'Fixture artist'}],al:{name:'Synthetic discovery album',picUrl:'http://127.0.0.1:18439/discovery-cover.png'},dt:120000}));
      const send=()=>{if(!res.destroyed)res.end(JSON.stringify({code:200,playlist:{name:'Synthetic discovery playlist',trackIds:tracks.map(({id})=>({id})),tracks}}));};
      if(holdDiscoveryDetail){holdDiscoveryDetail=false;heldDiscoveryResponses.push(send);counts.discovery.held=(counts.discovery.held??0)+1;}else send();return;
    }
    if(parsed.hostname==='music.163.com'&&parsed.pathname.includes('/api/v1/resource/comments/')){
      const offset=Number(parsed.searchParams.get('offset')??0);counts.comments??={first:0,next:0};
      const comment=id=>({commentId:id,content:`Synthetic comment ${id}`,user:{nickname:'Fixture reader'},time:1000,likedCount:3});
      if(offset===0){counts.comments.first++;res.end(JSON.stringify({code:200,hotComments:[{...comment('9'),content:'Synthetic hot comment'}],comments:[comment('1'),comment('2')],total:3,more:true}));}
      else {counts.comments.next++;res.end(JSON.stringify(counts.comments.next===1?{code:503}:{code:200,comments:[comment('3')],total:3,more:false}));}return;
    }
    if(parsed.hostname==='music.163.com'&&parsed.pathname==='/api/song/lyric'){counts.lyrics??={wy:0,tx:0};counts.lyrics.wy++;res.end(JSON.stringify({ttml:'<tt>',lxlyric:' ',lyric:'',lrc:'[00:00.000]<0,500>Synthetic <500,500>rich lyric\n[00:30.000]<0,1000>Second rich line'}));return;}
    if(parsed.hostname==='c.y.qq.com'){counts.lyrics??={wy:0,tx:0};counts.lyrics.tx++;res.end(JSON.stringify({lyric:'[00:00.000]Synthetic original lyric\n[00:30.000]Second original line'}));return;}
    if(parsed.hostname==='music.163.com'){res.end(JSON.stringify({code:200,result:{songCount:1,songs:[{id:'1001',name:'Synthetic match tone',ar:[{name:'Fixture artist'}],al:{name:'Original fixture'},dt:120000,sq:{size:1000}}]}}));return;}
    if(parsed.hostname==='u.y.qq.com'){
      const body=JSON.parse(request.body);if(body.req){res.end(JSON.stringify({code:1}));return;}const param=body['music.search.SearchCgiService']?.param,page=param?.page_num??1;
      const song=(mid,live=false)=>({mid,title:'Synthetic match tone'+(live?' (Live)':''),singer:[{name:'Fixture artist'}],album:{name:live?'Manual fixture':'Matched fixture'},interval:120,file:{media_mid:mid,size_flac:1000}});
      res.end(JSON.stringify({code:0,'music.search.SearchCgiService':{code:0,data:{body:{song:{sum:2,list:page===1?[song(param?.query?.includes('slow')?'fixture-slow':'fixture-match'),song('fixture-live',true)]:[]}}}}}));return;
    }
    if(parsed.hostname==='search.kuwo.cn'){res.end(JSON.stringify({abslist:[],TOTAL:0}));return;}
    if(parsed.hostname==='songsearch.kugou.com'){res.end(JSON.stringify({error_code:0,data:{lists:[],total:0}}));return;}
    if(parsed.hostname==='jadeite.migu.cn'){res.end(JSON.stringify({code:'000000',songResultData:{resultList:[],totalCount:0}}));return;}
    res.writeHead(400);res.end();return;
  }
  if(req.url==='/discovery-cover.png'&&discoveryUI){res.setHeader('Content-Type','image/png');res.end(Buffer.from(themeCovers.red,'base64'));return;}
  if(req.url==='/source.js'){seedLocalAudio();res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fixture);return;}
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
    if(req.method==='GET'){counts.backup.get++;if(!backupFiles.has(req.url)){res.writeHead(404);res.end();return;}const body=backupFiles.get(req.url),tag='"'+createHash('sha256').update(body).digest('hex')+'"';if(req.headers['if-match']&&req.headers['if-match']!==tag){res.writeHead(412);res.end();return;}res.writeHead(200,{'Content-Type':'application/json',ETag:tag});res.end(body);return;}
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
  const authenticated=(params.get('u')==='fixture-user'||params.get('u')==='fixture-photo'||coverThemeUI&&params.get('u')==='fixture-theme')&&params.get('t')===createHash('md5').update('fixture-password'+params.get('s')).digest('hex');
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
      let cursor=start;const timer=setInterval(()=>{const next=Math.min(cursor+32768,end+1);res.write(navidromeAudio.subarray(cursor,next));cursor=next;if(cursor>end){clearInterval(timer);res.end();}},100);
      res.once('close',()=>clearInterval(timer));return;
    }
    const audio=navidromeAudio;
    res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);
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
      const held={color,send:()=>{counts.transitionReleases??=[];counts.transitionReleases.push(color);if(color==='missing'){res.writeHead(404);res.end();}else{res.setHeader('Content-Type','image/png');res.end(Buffer.from(themeCovers[color],'base64'));}}};
      if(releasedThemeColors.has(color)){held.send();return;}
      heldThemeResponses.push(held);
      res.once('close',()=>{const index=heldThemeResponses.indexOf(held);if(index>=0)heldThemeResponses.splice(index,1);});return;
    }
    res.setHeader('Content-Type','image/png');res.end(Buffer.from(coverThemeUI&&params.get('u')==='fixture-theme'?themeCovers[params.get('id')]??themeCovers.red:themeCovers.multi,'base64'));return;
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
});
// The real local-file test never uses fixture HTTP routes. Give its harness an
// ephemeral port so an unrelated online regression can keep its fixed port.
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(liveLocalUI&&!liveStatisticsSyncUI&&!liveBackupSettingsUI?0:18439, '127.0.0.1', resolve); });
mkdirSync(runDirectory,{recursive:true});
const logPath=resolve(runDirectory,'ui-catalog.log');
const sourceBefore=sourceSnapshot();
const log = openSync(logPath, 'w+');
const logWatcher=watch(logPath,()=>{if(localFixtureDirectory)return;const size=statSync(logPath).size,tail=Buffer.alloc(Math.min(4096,size));readSync(log,tail,0,tail.length,Math.max(0,size-tail.length));if(tail.toString().includes('Test Case')||tail.toString().includes('Running tests'))seedLocalAudio();});
try {
  const resultPath = `build/SourceUITests-${Date.now()}.xcresult`;
  console.log(`UI capture result: ${resultPath}; log: ${logPath}`);
  const fixturePath=entryFile??'scripts/test-ui.mjs';
  const runManifest={schemaVersion:1,startedAt:new Date().toISOString(),resultBundle:resolve(resultPath),sourceBefore,configuration,fixture:{path:fixturePath,sha256:sourceBefore.files[fixturePath]},simulator:process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D'};
  if(referenceScene)runManifest.externalInputs={before:referenceScene.snapshot,requiredPaths:referenceScene.paths};
  if(liveLocalPath)runManifest.externalInputs={before:liveLocalSnapshot,requiredPaths:liveLocalPaths};
  writeFileSync(resolve(runDirectory,'run-manifest.json'),JSON.stringify(runManifest,null,2)+'\n');
  const args = ['test','-parallel-testing-enabled','NO', '-workspace', 'ios/app.xcworkspace', '-scheme', 'app', '-configuration', configuration,
    '-destination', `platform=iOS Simulator,id=${process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D'}`,
    '-derivedDataPath', 'build/DerivedData', '-resultBundlePath', resultPath, 'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'FORCE_BUNDLING=1'];
  for(const target of process.argv.slice(2))args.push(`-only-testing:${target}`);
  if(!liveLocalUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalIndexActions','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalSorting','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalFolderScan','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveLocalPlaylistBatch','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveListeningStatistics');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveRestoredTimeline')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveRestoredTimeline');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveThemeConfig')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveThemeConfig');
  if(!process.argv.slice(2).some(target=>target.endsWith('/testLiveRetainedAudio')))args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveRetainedAudio');
  if(!liveBackupSettingsUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveBackupSettings');
  if(!liveStatisticsSyncUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveStatisticsSync');
  if(!liveCatalogUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveSourceCatalog','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveSourcePlayback','-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveSourceSearchStates');
  if(!liveDownloadUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testLiveDownloadBatch');
  // Always spell out the entry: a previous fixture build must not leak into a
  // later normal-navigation or distribution build via incremental settings.
  args.push(`ENTRY_FILE=${resolve(entryFile??'index.ts')}`);
  if(!fixtureOnlineUI)args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testCrossPlatformLyrics','-skip-testing:NexusMusicUITests/SourceSettingsTests/testOnlineMatching','-skip-testing:NexusMusicUITests/SourceSettingsTests/testSourceHealth','-skip-testing:NexusMusicUITests/SourceSettingsTests/testPublicComments','-skip-testing:NexusMusicUITests/SourceSettingsTests/testDiscoverySongActions','-skip-testing:NexusMusicUITests/SourceSettingsTests/testSearchHistoryAndStates');
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
  Object.assign(runManifest,{finishedAt:new Date().toISOString(),exitCode:code,sourceAfter:sourceSnapshot(),installedBundle:installedBundleSnapshot(runManifest.simulator),resultInfoSha256:existsSync(resolve(resultPath,'Info.plist'))?fileSha256(resolve(resultPath,'Info.plist')):null});
  runManifest.sourceUnchanged=runManifest.sourceBefore.digest===runManifest.sourceAfter.digest;
  if(referenceScene){runManifest.externalInputs.after=externalInputSnapshot(referenceScene.paths);runManifest.externalInputs.unchanged=runManifest.externalInputs.before.digest===runManifest.externalInputs.after.digest;if(!runManifest.externalInputs.unchanged)process.exitCode=1;}
  if(liveLocalPath){runManifest.externalInputs.after=externalInputSnapshot(liveLocalPaths);runManifest.externalInputs.unchanged=liveLocalSnapshot.digest===runManifest.externalInputs.after.digest;if(!runManifest.externalInputs.unchanged)process.exitCode=1;}
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
  closeSync(log); server.closeAllConnections(); server.close();if(localFixtureDirectory)rmSync(localFixtureDirectory,{recursive:true,force:true});
}
