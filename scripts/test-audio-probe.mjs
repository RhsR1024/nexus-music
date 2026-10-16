import http from 'node:http';import{spawn}from'node:child_process';import assert from'node:assert/strict';
const header=Buffer.alloc(128);header.write('RIFF');header.write('WAVE',8);let leaked=0,hits=0;
const server=http.createServer((req,res)=>{
 hits++;if(req.headers.authorization||req.headers.cookie)leaked++;
 assert.equal(req.headers.range,'bytes=0-4095');
 if(req.url==='/redirect'){res.writeHead(302,{Location:'/audio','Set-Cookie':'private=secret'});res.end();return;}
 if(req.url==='/loop'){res.writeHead(302,{Location:'/loop'});res.end();return;}
 if(req.url==='/credentials'){res.writeHead(302,{Location:`http://user:PRIVATE@127.0.0.1:${server.address().port}/audio`});res.end();return;}
 if(req.url==='/slow'){setTimeout(()=>{if(!res.destroyed)res.end(header);},13000).unref();return;}
 if(req.url==='/http-error'){res.writeHead(403);res.end('PRIVATE');return;}
 if(req.url==='/auth'){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Fixture"'});res.end('PRIVATE');return;}
 if(req.url==='/html'){res.writeHead(200,{'Content-Type':'audio/mpeg'});res.end('<html>PRIVATE error</html>');return;}
 if(req.url==='/large'){res.writeHead(200);res.write(Buffer.alloc(8192,65));const timer=setInterval(()=>res.write(Buffer.alloc(8192,65)),10);res.on('close',()=>clearInterval(timer));return;}
 if(req.url==='/bad-range'){res.writeHead(206,{'Content-Range':'bytes 10-127/128'});res.end(header);return;}
 if(req.url==='/bad-total'){res.writeHead(206,{'Content-Range':'bytes 0-127/10'});res.end(header);return;}
 if(req.url==='/empty'){res.end();return;}
 if(req.url==='/split'){res.writeHead(206,{'Content-Range':'bytes 0-127/128'});res.write(header.subarray(0,4));setTimeout(()=>{if(!res.destroyed)res.end(header.subarray(4));},20);return;}
 if(req.url==='/flac'){res.writeHead(206,{'Content-Range':'bytes 0-3/4'});res.end('fLaC');return;}
 if(req.url==='/mp4'){res.writeHead(200);res.end(Buffer.from([0,0,0,12,...Buffer.from('ftypisom')]));return;}
 res.writeHead(206,{'Content-Range':'bytes 0-127/128','Content-Type':'audio/wav','Set-Cookie':'private=secret'});res.end(header);
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root=`http://127.0.0.1:${server.address().port}`;
function run(path,cancel=false){return new Promise((resolve,reject)=>{const child=spawn('build/tests/native-audio-probe',[path.startsWith('/')?root+path:path,...(cancel?['cancel']:[])]);let output='';child.stdout.on('data',b=>output+=b);child.stderr.resume();const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Probe exceeded deadline'));},18000);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(Error(`Probe process failed ${code}`));else{try{resolve(JSON.parse(output));}catch{reject(Error('Probe output is not JSON'));}}});});}
try{
 for(const path of ['/audio','/redirect','/split']){const value=await run(path);assert.equal(value.state,'header');assert.equal(value.format,'wav');assert.equal(value.status,206);assert.ok(value.bytes<=4096);assert.doesNotMatch(JSON.stringify(value),/PRIVATE|https?:|cookie|secret/);}
 assert.equal((await run('/flac')).format,'flac');assert.equal((await run('/mp4')).format,'mp4');assert.equal((await run('/loop')).state,'redirect-error');assert.equal((await run('/credentials')).state,'redirect-error');
 assert.deepEqual(await run('/http-error'),{bytes:0,state:'http-error',status:403});assert.deepEqual(await run('/auth'),{bytes:0,state:'http-error',status:401});assert.equal((await run('/html')).state,'unrecognized');assert.equal((await run('/empty')).state,'unrecognized');
 const large=await run('/large');assert.equal(large.state,'unrecognized');assert.equal(large.bytes,4096);assert.equal((await run('/bad-range')).state,'range-error');assert.equal((await run('/bad-total')).state,'range-error');
 assert.equal((await run('/slow',true)).state,'cancelled');const start=Date.now();assert.equal((await run('/slow')).state,'timeout');assert.ok(Date.now()-start<15000);
 assert.equal((await run('file:///PRIVATE')).state,'invalid-url');assert.equal((await run('http://user:PRIVATE@127.0.0.1/audio')).state,'invalid-url');assert.equal(leaked,0);assert.ok(hits>=19);
 console.log('Audio URL probe passed: real Range/split response, WAV/FLAC/MP4 headers, no cookie/auth forwarding, bounded ignored Range, redirects, status/HTML/malformed range, timeout/cancel, no private URL in output.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
