import http from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const xml='<multistatus xmlns="DAV:"/>',credentials='Basic '+Buffer.from('fixture-user:fixture-password').toString('base64');
let externalHits=0,outsideHits=0,verified=0;
const external=http.createServer((req,res)=>{externalHits++;res.end(xml);});await new Promise(resolve=>external.listen(0,'127.0.0.1',resolve));
const server=http.createServer((req,res)=>{
  if(!req.url.startsWith('/dav/')){outsideHits++;res.end(xml);return;}
  if(req.method!=='PROPFIND'||req.headers.depth!=='1'||req.headers.authorization!==credentials){res.writeHead(400);res.end();return;}
  let body='';req.on('data',part=>body+=part);req.on('end',()=>{
    assert.match(body,/<d:propfind/);verified++;
    if(req.url==='/dav/unauthorized'){res.writeHead(401);res.end();return;}
    if(req.url==='/dav/large'){res.writeHead(207);res.end('x'.repeat(2097153));return;}
    if(req.url==='/dav/slow'){setTimeout(()=>{if(!res.destroyed){res.writeHead(207);res.end(xml);}},200);return;}
    const redirects={ '/dav/redirect':'/dav/music', '/dav/outside':'/outside', '/dav/loop':'/dav/loop', '/dav/external':`http://127.0.0.1:${external.address().port}/dav/music`};
    if(redirects[req.url]){res.writeHead(307,{Location:redirects[req.url]});res.end();return;}
    res.writeHead(207,{'Content-Type':'application/xml'});res.end(xml);
  });
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
function run(path,cancel=false){return new Promise((resolve,reject)=>{
  const child=spawn('build/tests/native-webdav-http',[`http://127.0.0.1:${server.address().port}/dav/`,path,...(cancel?['cancel']:[])]);let out='',err='';
  child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('WebDAV native request exceeded test deadline'));},15000);
  child.on('error',error=>{clearTimeout(timeout);reject(error);});child.on('close',code=>{clearTimeout(timeout);if(code===0)resolve(out.trim());else reject(new Error(`WebDAV test process failed ${code}: ${err.slice(-200)}`));});
});}
try{
  assert.equal(await run('music'),`status=207 bytes=${Buffer.byteLength(xml)}`);assert.match(await run('redirect'),/^status=207/);
  assert.match(await run('100%25.mp3'),/^status=207/);assert.match(await run('literal%2520name.mp3'),/^status=207/);assert.equal(await run('%252e%252e/private'),'error=2');
  assert.equal(await run('outside'),'error=2');assert.equal(await run('external'),'error=2');assert.equal(externalHits,0);assert.equal(outsideHits,0);
  assert.equal(await run('loop'),'error=2');assert.equal(await run('large'),'error=4');assert.equal(await run('unauthorized'),'status=401 bytes=0');
  assert.equal(await run('slow',true),'error=-999');assert.equal(await run('%2e%2e/private'),'error=2');assert.equal(await run('encoded%2fprivate'),'error=2');
  assert.ok(verified>=12);console.log('Native WebDAV HTTP checks passed: actual Basic/PROPFIND/Depth, safe redirect, blocked cross-origin/root without credential leakage, redirect cap, body bound, status preservation and cancellation');
}finally{server.closeAllConnections();external.closeAllConnections();await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>external.close(resolve))]);}
