import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const rate = 48000, frames = rate * 2, body = Buffer.alloc(frames * 2), header = Buffer.alloc(44);
for (let i = 0; i < frames; i++) body.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 1000 * i / rate) * 2500), i * 2);
header.write('RIFF'); header.writeUInt32LE(36 + body.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(body.length, 40);
const wav = Buffer.concat([header, body]); writeFileSync('build/tests/tone.wav', wav);
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
async function play(url) {
  const child = spawn('build/tests/native-playback', [url]);
  let stdout = '', stderr = ''; child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
  const code = await new Promise(resolve => child.on('exit', resolve));
  assert.equal(code, 0, `Native playback failed: ${stdout}; ${stderr.slice(-1000)}`);
  const result = JSON.parse(stdout); assert.equal(result.pcmSupported, true); assert.equal(result.ended, true);
}
try {
  await play(pathToFileURL(resolve('build/tests/tone.wav')).href);
  await play(`http://127.0.0.1:${server.address().port}/tone.wav`);
  console.log('Native AVPlayer checks passed: local/progressive HTTP range playback, real PCM tap/FFT, natural end');
} finally { server.closeAllConnections(); server.close(); }
