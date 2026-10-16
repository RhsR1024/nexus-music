import {silentMP3} from './fixtures/silent-mp3.mjs';
import { createServer } from 'node:http';
import { spawn,execFileSync } from 'node:child_process';
import { openSync, closeSync,writeFileSync,readFileSync,mkdirSync,rmSync,watch,statSync,readSync } from 'node:fs';
import {resolve,sep} from 'node:path';
import { createHash } from 'node:crypto';

let localFixtureDirectory;
function seedLocalAudio() {
  if(localFixtureDirectory)return;
  try {
    const groups=execFileSync('xcrun',['simctl','get_app_container',process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D','com.apple.DocumentsApp','groups'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
    const container=groups.split('\n').find(line=>line.startsWith('group.com.apple.FileProvider.LocalStorage\t'))?.split('\t')[1];if(!container)return;
    localFixtureDirectory=resolve(container,'File Provider Storage','Nexus UITest Fixtures');mkdirSync(localFixtureDirectory,{recursive:true});writeFileSync(resolve(localFixtureDirectory,'Synthetic Tagged Tone.mp3'),silentMP3(1200));
  } catch { /* Fresh CI simulator: install happens after this process starts. */ }
}
seedLocalAudio();
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
const counts={requests:{},authFailures:0,authSuccesses:0};
const matchingUI=process.argv.slice(2).some(target=>target.endsWith('/testOnlineMatching')||target.endsWith('/testSourceHealth')||target.endsWith('/testPublicComments'));
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
const song=()=>({id:'fixture-song',title:'Synthetic tone',artist:'Fixture artist',album:'Synthetic album',coverArt:'fixture-cover',duration:12,suffix:'wav',...(starred?{starred:'2026-01-01T00:00:00Z'}:{})});
const server = createServer(async (req, res) => {
  if(req.url==='/matching-source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(matchingScript);return;}
  if(req.url==='/health-source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(healthScript);return;}
  if(req.url.startsWith('/matching-audio/')){
    if(!matchingUI){res.writeHead(404);res.end();return;}
    counts.matchAudio??={};counts.matchAudio[req.url]=(counts.matchAudio[req.url]??0)+1;
    res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),matchingAudio.length-1):matchingAudio.length-1;if(start>=matchingAudio.length){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${matchingAudio.length}`);res.end(matchingAudio.subarray(start,end+1));}else res.end(matchingAudio);return;
  }
  if(req.url==='/nexus-ui-test-online-adapter'){
    if(!matchingUI){res.writeHead(404);res.end();return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const {url,request}=JSON.parse(Buffer.concat(chunks).toString());const parsed=new URL(url);
    counts.online??={};counts.online[parsed.hostname]=(counts.online[parsed.hostname]??0)+1;
    res.setHeader('Content-Type','application/json');
    if(parsed.hostname==='music.163.com'&&parsed.pathname.includes('/api/v1/resource/comments/')){
      const offset=Number(parsed.searchParams.get('offset')??0);counts.comments??={first:0,next:0};
      const comment=id=>({commentId:id,content:`Synthetic comment ${id}`,user:{nickname:'Fixture reader'},time:1000,likedCount:3});
      if(offset===0){counts.comments.first++;res.end(JSON.stringify({code:200,hotComments:[{...comment('9'),content:'Synthetic hot comment'}],comments:[comment('1'),comment('2')],total:3,more:true}));}
      else {counts.comments.next++;res.end(JSON.stringify(counts.comments.next===1?{code:503}:{code:200,comments:[comment('3')],total:3,more:false}));}return;
    }
    if(parsed.hostname==='music.163.com'){res.end(JSON.stringify({code:200,result:{songCount:1,songs:[{id:'1001',name:'Synthetic match tone',ar:[{name:'Fixture artist'}],al:{name:'Original fixture'},dt:120000,sq:{size:1000}}]}}));return;}
    if(parsed.hostname==='u.y.qq.com'){
      const body=JSON.parse(request.body),param=body['music.search.SearchCgiService']?.param,page=param?.page_num??1;
      const song=(mid,live=false)=>({mid,title:'Synthetic match tone'+(live?' (Live)':''),singer:[{name:'Fixture artist'}],album:{name:live?'Manual fixture':'Matched fixture'},interval:120,file:{media_mid:mid,size_flac:1000}});
      res.end(JSON.stringify({code:0,'music.search.SearchCgiService':{code:0,data:{body:{song:{sum:2,list:page===1?[song(param?.query?.includes('slow')?'fixture-slow':'fixture-match'),song('fixture-live',true)]:[]}}}}}));return;
    }
    if(parsed.hostname==='search.kuwo.cn'){res.end(JSON.stringify({abslist:[],TOTAL:0}));return;}
    if(parsed.hostname==='songsearch.kugou.com'){res.end(JSON.stringify({error_code:0,data:{lists:[],total:0}}));return;}
    if(parsed.hostname==='jadeite.migu.cn'){res.end(JSON.stringify({code:'000000',songResultData:{resultList:[],totalCount:0}}));return;}
    res.writeHead(400);res.end();return;
  }
  if(req.url==='/source.js'){seedLocalAudio();res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fixture);return;}
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
  const authenticated=params.get('u')==='fixture-user'&&params.get('t')===createHash('md5').update('fixture-password'+params.get('s')).digest('hex');
  if(authenticated)counts.authSuccesses++;else counts.authFailures++;
  const respond=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({'subsonic-response':{status:'ok',version:'1.16.1',...body}}));};
  if(!authenticated){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({'subsonic-response':{status:'failed',error:{code:40,message:'fixture auth failure'}}}));return;}
  const method=url.pathname.split('/').at(-1).replace('.view','');
  counts.requests[method]=(counts.requests[method]??0)+1;
  if(method==='stream'){
    res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),audio.length-1):audio.length-1;if(start>=audio.length){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${audio.length}`);res.end(audio.subarray(start,end+1));}else res.end(audio);return;
  }
  if(method==='getCoverArt'){res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));return;}
  if(method==='ping')respond({type:'Navidrome',serverVersion:'0.64.0'});
  else if(method==='getOpenSubsonicExtensions')respond({openSubsonicExtensions:[{name:'songLyrics',versions:[1]}]});
  else if(method==='getAlbumList2')respond({albumList2:{album:[{id:'fixture-album',name:'Synthetic album',artist:'Fixture artist',coverArt:'fixture-cover',songCount:1}]}});
  else if(method==='getAlbum')respond({album:{id:'fixture-album',name:'Synthetic album',song:[song()]}});
  else if(method==='search3')respond({searchResult3:{song:[song()]}});
  else if(method==='getLyricsBySongId')respond({lyricsList:{structuredLyrics:[{lang:'en',synced:true,line:[{start:0,value:'Synthetic lyric one'},{start:6000,value:'Synthetic lyric two'}],cueLine:[{index:0,start:0,end:6000,value:'Synthetic lyric one',cue:[{byteStart:0,byteEnd:9,start:0,end:2000,value:'Synthetic '},{byteStart:10,byteEnd:15,start:2000,end:4000,value:'lyric '},{byteStart:16,byteEnd:18,start:4000,end:6000,value:'one'}]},{index:1,start:6000,end:12000,value:'Synthetic lyric two',cue:[{byteStart:0,byteEnd:9,start:6000,end:8000,value:'Synthetic '},{byteStart:10,byteEnd:15,start:8000,end:10000,value:'lyric '},{byteStart:16,byteEnd:18,start:10000,end:12000,value:'two'}]}]}]}});
  else if(method==='star'||method==='unstar'){starred=method==='star';respond({});}
  else if(method==='getArtists')respond({artists:{index:[]}});
  else if(method==='getPlaylists')respond({playlists:{playlist:[]}});
  else respond({});
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18439, '127.0.0.1', resolve); });
const log = openSync('build/logs/ui-catalog.log', 'w+');
const logWatcher=watch('build/logs/ui-catalog.log',()=>{if(localFixtureDirectory)return;const size=statSync('build/logs/ui-catalog.log').size,tail=Buffer.alloc(Math.min(4096,size));readSync(log,tail,0,tail.length,Math.max(0,size-tail.length));if(tail.toString().includes('Test Case')||tail.toString().includes('Running tests'))seedLocalAudio();});
try {
  const args = ['test','-parallel-testing-enabled','NO', '-workspace', 'ios/app.xcworkspace', '-scheme', 'app', '-configuration', 'Release',
    '-destination', `platform=iOS Simulator,id=${process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D'}`,
    '-derivedDataPath', 'build/DerivedData', '-resultBundlePath', `build/SourceUITests-${Date.now()}.xcresult`, 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-'];
  for(const target of process.argv.slice(2))args.push(`-only-testing:${target}`);
  if(matchingUI)args.push(`ENTRY_FILE=${resolve('tests/e2e/entry.tsx')}`);
  else args.push('-skip-testing:NexusMusicUITests/SourceSettingsTests/testOnlineMatching','-skip-testing:NexusMusicUITests/SourceSettingsTests/testSourceHealth','-skip-testing:NexusMusicUITests/SourceSettingsTests/testPublicComments');
  const child = spawn('xcodebuild', args, { stdio: ['ignore', log, log] });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
  console.log(`iOS source UI test exit: ${code}; log: build/logs/ui-catalog.log`);
} finally { logWatcher.close();writeFileSync('build/logs/ui-server-counts.json',JSON.stringify(counts,null,2));closeSync(log); server.closeAllConnections(); server.close();if(localFixtureDirectory)rmSync(localFixtureDirectory,{recursive:true,force:true}); }
