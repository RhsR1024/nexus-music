import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

const fixture = `/**\n * @name Nexus UI Test Source\n * @version 1.0-test\n */\nlx.on('request', async()=>{throw new Error('test only')});\nlx.send('inited',{sources:{wy:{name:'Fixture',actions:['musicUrl'],qualitys:['128k']}}});`;
const server = createServer((req, res) => {
  if (req.url !== '/source.js') { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(fixture);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18439, '127.0.0.1', resolve); });
const log = openSync('build/logs/ui-catalog.log', 'w');
try {
  const args = ['test', '-workspace', 'ios/app.xcworkspace', '-scheme', 'app', '-configuration', 'Release',
    '-destination', 'platform=iOS Simulator,id=BD3F486B-04DE-4BA7-9E58-64F10166B39D',
    '-derivedDataPath', 'build/DerivedData', '-resultBundlePath', `build/SourceUITests-${Date.now()}.xcresult`, 'CODE_SIGNING_ALLOWED=NO'];
  const child = spawn('xcodebuild', args, { stdio: ['ignore', log, log] });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
  console.log(`iOS source UI test exit: ${code}; log: build/logs/ui-catalog.log`);
} finally { closeSync(log); server.closeAllConnections(); server.close(); }
