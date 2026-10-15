import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {silentMP3} from './fixtures/silent-mp3.mjs';
const audio=silentMP3(),auth='Basic '+Buffer.from('fixture-user:fixture-password').toString('base64');
const directory=mkdtempSync('build/tests/dav-formats-'),wav=Buffer.alloc(44+48000*2*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
for(let i=0;i<(wav.length-44)/2;i++)wav.writeInt16LE(Math.round(1500*Math.sin(2*Math.PI*1000*i/48000)),44+i*2);
writeFileSync(`${directory}/tone.wav`,wav);
for(const [name,format,encoding] of [['tone.m4a','m4af','aac'],['tone.aac','adts','aac'],['tone.aiff','AIFF','BEI16'],['tone16.flac','flac','flac'],['tone24.wav','WAVE','LEI24']])execFileSync('/usr/bin/afconvert',['-f',format,'-d',encoding,`${directory}/tone.wav`,`${directory}/${name}`]);
execFileSync('/usr/bin/afconvert',['-f','flac','-d','flac',`${directory}/tone24.wav`,`${directory}/tone24.flac`]);
const formats=new Map(['tone.wav','tone.m4a','tone.aac','tone.aiff','tone16.flac','tone24.flac'].map(name=>[name,readFileSync(`${directory}/${name}`)]));
let outside=0,external=0,valid=0,ifMatch=0,ranges=0;
const other=createServer((req,res)=>{external++;res.end();});await new Promise(resolve=>other.listen(0,'127.0.0.1',resolve));
const server=createServer((req,res)=>{
  if(!req.url.startsWith('/dav/')){outside++;res.end();return;}
  if(req.headers.authorization!==auth){res.writeHead(401);res.end();return;}valid++;
  if(req.headers['if-match']==='"fixture-v1"')ifMatch++;
  if(req.url==='/dav/redirect.mp3'){res.writeHead(307,{Location:'/dav/tone.mp3'});res.end();return;}
  if(req.url==='/dav/outside.mp3'||req.url==='/dav/external.mp3'){res.writeHead(307,{Location:req.url.includes('external')?`http://127.0.0.1:${other.address().port}/dav/tone.mp3`:'/outside'});res.end();return;}
  const name=req.url.slice('/dav/'.length),bytes=formats.get(name)??audio,mime={wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',aiff:'audio/aiff',flac:'audio/flac'}[name.split('.').at(-1)]??'audio/mpeg';
  res.setHeader('Content-Type',mime);res.setHeader('Accept-Ranges','bytes');res.setHeader('ETag',req.url==='/dav/mismatch.mp3'?'"wrong-version"':'"fixture-v1"');
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){ranges++;const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;if(start>bytes.length-1){res.writeHead(416);res.end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);res.end(bytes.subarray(start,end+1));}else res.end(bytes);
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root=`http://127.0.0.1:${server.address().port}/dav/`,key=createHash('sha256').update(root+'tone-v1').digest('hex');
function run(path,mode='play',cacheKey=key,start=0){return new Promise((resolve,reject)=>{const child=spawn('build/tests/native-webdav-media',[root,path,mode,cacheKey,String(start)]);let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Native DAV media exceeded deadline'));},30000);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);try{resolve({code,value:JSON.parse(out.trim())});}catch{reject(new Error(`Native DAV media output missing (${code}): ${err.slice(-200)}`));}});});}
try{
  const metadata=await run('tone.mp3','inspect');assert.equal(metadata.code,0);assert.equal(metadata.value.title,'Synthetic tagged tone');assert.equal(metadata.value.artist,'Fixture artist');assert.equal(metadata.value.album,'Fixture album');assert.match(metadata.value.lyric,/Synthetic embedded lyric/);assert.equal(metadata.value.artwork,true);assert.ok(metadata.value.durationMs>1900);
  const play=await run('redirect.mp3');assert.equal(play.code,0);assert.equal(play.value.ended,true);assert.ok(play.value.pcm>0);
  for(const name of formats.keys()){const id=createHash('sha256').update(root+name).digest('hex'),metadata=await run(name,'inspect',id);assert.equal(metadata.code,0,`Remote metadata: ${name}`);assert.ok(metadata.value.durationMs>1800);const played=await run(name,'play',id,1);assert.equal(played.code,0,`Remote decode/seek: ${name}`);assert.ok(played.value.pcm>0);assert.ok(played.value.firstPlayingPosition>=.9,`First progress must reflect the requested seek: ${name}`);}
  for(const path of ['outside.mp3','external.mp3','mismatch.mp3']){const result=await run(path,'play',createHash('sha256').update(root+path).digest('hex'));assert.equal(result.code,1);assert.equal(result.value.failed,true);}
  assert.equal(outside,0);assert.equal(external,0);assert.ok(valid>0);assert.equal(ifMatch,valid);assert.ok(ranges>0);
  await new Promise(resolve=>server.close(resolve));const cached=await run('redirect.mp3','cache-only');assert.equal(cached.code,0);assert.ok(cached.value.pcm>0);
  const absent=await run('tone.mp3','cache-only','f'.repeat(64));assert.equal(absent.code,1);
  console.log('Native WebDAV media checks passed: authenticated ranges/redirect, remote ID3/cover/embedded LRC/duration; MP3/WAV/M4A/AAC/AIFF/16-bit and 24-bit FLAC actual decode/PCM/initial seek, ETag mismatch/credential scope rejection and cache-only playback after server shutdown');
}finally{server.closeAllConnections();other.closeAllConnections();server.close();await new Promise(resolve=>other.close(resolve));rmSync(directory,{recursive:true,force:true});}
