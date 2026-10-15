import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { openSync, closeSync,writeFileSync,readFileSync } from 'node:fs';
import {resolve,sep} from 'node:path';
import { createHash } from 'node:crypto';

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
const song=()=>({id:'fixture-song',title:'Synthetic tone',artist:'Fixture artist',album:'Synthetic album',coverArt:'fixture-cover',duration:12,suffix:'wav',...(starred?{starred:'2026-01-01T00:00:00Z'}:{})});
const server = createServer(async (req, res) => {
  if(req.url==='/source.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fixture);return;}
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
  else if(method==='getLyricsBySongId')respond({lyricsList:{structuredLyrics:[{lang:'en',synced:true,line:[{start:0,value:'Synthetic lyric one'},{start:6000,value:'Synthetic lyric two'}]}]}});
  else if(method==='star'||method==='unstar'){starred=method==='star';respond({});}
  else if(method==='getArtists')respond({artists:{index:[]}});
  else if(method==='getPlaylists')respond({playlists:{playlist:[]}});
  else respond({});
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18439, '127.0.0.1', resolve); });
const log = openSync('build/logs/ui-catalog.log', 'w');
try {
  const args = ['test', '-workspace', 'ios/app.xcworkspace', '-scheme', 'app', '-configuration', 'Release',
    '-destination', `platform=iOS Simulator,id=${process.env.NEXUS_SIMULATOR_ID??'BD3F486B-04DE-4BA7-9E58-64F10166B39D'}`,
    '-derivedDataPath', 'build/DerivedData', '-resultBundlePath', `build/SourceUITests-${Date.now()}.xcresult`, 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-'];
  for(const target of process.argv.slice(2))args.push(`-only-testing:${target}`);
  const child = spawn('xcodebuild', args, { stdio: ['ignore', log, log] });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
  console.log(`iOS source UI test exit: ${code}; log: build/logs/ui-catalog.log`);
} finally { writeFileSync('build/logs/ui-server-counts.json',JSON.stringify(counts,null,2));closeSync(log); server.closeAllConnections(); server.close(); }
