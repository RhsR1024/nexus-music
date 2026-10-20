import {silentMP3} from './fixtures/silent-mp3.mjs';
import {createHash,randomUUID} from 'node:crypto';
import { spawn,execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const rate = 48000, frames = rate * 2, body = Buffer.alloc(frames * 2), header = Buffer.alloc(44);
for (let i = 0; i < frames; i++) body.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 1000 * i / rate) * 2500), i * 2);
header.write('RIFF'); header.writeUInt32LE(36 + body.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(body.length, 40);
writeFileSync('build/tests/tone-tagged.mp3',silentMP3());
const wav = Buffer.concat([header, body]); writeFileSync('build/tests/tone.wav', wav);
execFileSync('/usr/bin/afconvert',['-f','m4af','-d','aac','-b','128000','build/tests/tone.wav','build/tests/tone-aac.m4a']);
execFileSync('/usr/bin/afconvert',['-f','adts','-d','aac','build/tests/tone.wav','build/tests/tone.aac']);
execFileSync('/usr/bin/afconvert',['-f','AIFF','-d','BEI16','build/tests/tone.wav','build/tests/tone.aiff']);
execFileSync('/usr/bin/afconvert',['-f','WAVE','-d','LEI24','build/tests/tone.wav','build/tests/tone24.wav']);
execFileSync('/usr/bin/afconvert',['-f','flac','-d','flac','build/tests/tone.wav','build/tests/tone-16.flac']);
execFileSync('/usr/bin/afconvert',['-f','flac','-d','flac','build/tests/tone24.wav','build/tests/tone-24.flac']);
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'audio/wav'); res.setHeader('Accept-Ranges', 'bytes');
  const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (range) {
    const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), wav.length-1) : wav.length-1;
    if (start >= wav.length) { res.writeHead(416); res.end(); return; }
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${wav.length}`); res.end(wav.subarray(start, end+1));
  } else res.end(wav);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
async function play(url,start=0,key,sleepMode) {
  const child = spawn('build/tests/native-playback', [url,String(start),...(key||sleepMode?[key??'']:[]),...(sleepMode?[sleepMode]:[])]);
  let stdout = '', stderr = ''; child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
  const code = await new Promise(resolve => child.on('exit', resolve));
  assert.equal(code, 0, `Native playback failed: ${stdout}; ${stderr.slice(-1000)}`);
  const result = JSON.parse(stdout); assert.equal(result.pcmSupported, true); assert.equal(result.ended, !sleepMode||sleepMode==='statistics');if(sleepMode&&sleepMode!=='statistics')assert.equal(result.sleepPaused,true);
  assert.ok(result.readyDuration>1.9&&result.readyDuration<2.3,`Ready must expose the decoded duration, including paused/cached media: ${JSON.stringify(result)}`);
  assert.ok(result.maximumDuration>1.9&&result.maximumDuration<2.3,'Duration must stay consistent through progress, seek and stop');
  assert.ok(result.listenedMs>0,'Real playback must accumulate native listening time');assert.equal(result.sessionCount,1);
  if(sleepMode==='statistics'){assert.equal(result.pauseStarted,true);assert.equal(result.pauseStable,true);assert.equal(typeof result.seekPosition,'number');assert.ok(result.seekPosition>1.1&&result.seekPosition<1.3,'Completed seek must publish its exact new position to the shared player state');assert.ok(result.listenedMs>400&&result.listenedMs<result.elapsedMs-250,`Pause must be excluded and seek cannot add more than active wall time: ${JSON.stringify(result)}`);}
}
try {
  await play(pathToFileURL(resolve('build/tests/tone.wav')).href);
  await play(`http://127.0.0.1:${server.address().port}/tone.wav`);
  await play(`http://127.0.0.1:${server.address().port}/tone.wav`,.5);
  for(const format of ['tone-aac.m4a','tone-16.flac','tone-24.flac','tone-tagged.mp3'])await play(pathToFileURL(resolve(`build/tests/${format}`)).href,.25);
  for(const format of ['tone.wav','tone.aac','tone.aiff','tone-aac.m4a','tone-16.flac','tone-24.flac','tone-tagged.mp3']){
    const source=resolve(`build/tests/${format}`),opaque=source+'.audio',before=createHash('sha256').update(readFileSync(source)).digest('hex');
    copyFileSync(source,opaque);await play(pathToFileURL(opaque).href,.25);
    assert.equal(createHash('sha256').update(readFileSync(opaque)).digest('hex'),before,'Playback aliases must not change the durable download bytes');
  }
  const aliasDirectory=resolve(process.env.HOME,'Library/Caches/NexusPlaybackAliases');
  assert.equal(readdirSync(aliasDirectory).filter(name=>name.startsWith('nexus-playback-')).length,0,'Stopping the engine must release its temporary playback alias');
  const cacheKey=createHash('sha256').update(randomUUID()).digest('hex');
  await play(`http://127.0.0.1:${server.address().port}/tone.wav`,0,cacheKey);
  await play('http://127.0.0.1:1/unreachable.wav',0,cacheKey);
  for(const mode of ['duration','track'])await play(pathToFileURL(resolve('build/tests/tone.wav')).href,0,undefined,mode);
  await play(pathToFileURL(resolve('build/tests/tone.wav')).href,0,undefined,'statistics');
  const rejected=spawn('build/tests/native-playback',['ipod-library://item/untrusted']);let rejectedOutput='';rejected.stdout.on('data',data=>{rejectedOutput+=data;});const rejectedCode=await new Promise(resolve=>rejected.on('exit',resolve));assert.equal(rejectedCode,1);assert.equal(JSON.parse(rejectedOutput).failed,true);
  console.log('Native AVPlayer checks passed: WAV/AAC/MP3/16-bit FLAC/24-bit FLAC plus seven opaque offline containers/alias cleanup, initial seek, HTTP ranges, cached playback without network, real PCM tap/FFT, natural end, native timed/track-end pause');
} finally { server.closeAllConnections(); server.close(); }
