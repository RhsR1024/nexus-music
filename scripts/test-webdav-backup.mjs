import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const credentials='Basic '+Buffer.from('fixture-user:fixture-password').toString('base64'),json=JSON.stringify({fixture:'音枢合成备份'}),sha=body=>createHash('sha256').update(body).digest('hex');
let outsideHits=0,externalHits=0,verified=0;
const files=new Map(),etags=new Map(),directories=new Set();
const external=http.createServer((req,res)=>{externalHits++;res.end(json);});await new Promise(resolve=>external.listen(0,'127.0.0.1',resolve));
const server=http.createServer((req,res)=>{
  if(!req.url.startsWith('/backup/')){outsideHits++;res.end();return;}
  assert.equal(req.headers.authorization,credentials);assert.equal(req.headers.depth,undefined);verified++;
  const chunks=[];req.on('data',part=>chunks.push(part));req.on('end',()=>{
    const body=Buffer.concat(chunks).toString('utf8');
    if(req.url==='/backup/write-redirect'){res.writeHead(307,{Location:'/backup/redirect-target'});res.end();return;}
    if(req.method==='MKCOL'){assert.equal(body,'');const status=directories.has(req.url)?405:201;directories.add(req.url);res.writeHead(status);res.end();return;}
    if(req.method==='PUT'){
      assert.equal(req.headers['content-type'],'application/json; charset=utf-8');assert.equal(body,json);
      if(req.headers['if-match']){
        assert.equal(req.headers['if-none-match'],undefined);
        if(req.headers['if-match']!==etags.get(req.url)){res.writeHead(412);res.end();return;}
        files.set(req.url,body);etags.set(req.url,'"fixture-next"');res.writeHead(204,{ETag:'"fixture-next"'});res.end();return;
      }
      assert.equal(req.headers['if-none-match'],'*');if(files.has(req.url)){res.writeHead(412);res.end();return;}files.set(req.url,body);etags.set(req.url,'"fixture"');res.writeHead(201,{ETag:'"fixture"'});res.end();return;
    }
    assert.equal(req.method,'GET');assert.equal(body,'');
    if(req.url==='/backup/unauthorized'){res.writeHead(401);res.end();return;}
    if(req.url==='/backup/etag'){assert.equal(req.headers['if-match'],'"fixture"');res.writeHead(412);res.end();return;}
    const redirects={'/backup/redirect':'/backup/data.json','/backup/outside':'/outside','/backup/external':`http://127.0.0.1:${external.address().port}/backup/data.json`};
    if(redirects[req.url]){res.writeHead(302,{Location:redirects[req.url]});res.end();return;}
    if(req.url==='/backup/invalid'){res.end(Buffer.from([0xff,0xfe]));return;}
    if(req.url==='/backup/large-header'){res.writeHead(200,{'Content-Length':32*1024*1024+1});res.end(Buffer.alloc(32*1024*1024+1,120));return;}
    if(req.url==='/backup/large-chunks'){res.writeHead(200);for(let i=0;i<33;i++)res.write(Buffer.alloc(1024*1024,120));res.end();return;}
    if(req.url==='/backup/slow'){setTimeout(()=>{if(!res.destroyed)res.end(json);},250);return;}
    if(req.headers['if-match']&&req.headers['if-match']!==(etags.get(req.url)??'"fixture"')){res.writeHead(412);res.end();return;}
    res.writeHead(200,{ETag:etags.get(req.url)??'"fixture"','Content-Type':'application/json'});res.end(files.get(req.url)??json);
  });
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const temp=await mkdtemp(join(tmpdir(),'nexus-backup-')),bodyFile=join(temp,'fixture.json'),huge=join(temp,'oversized.json');await writeFile(bodyFile,json);await writeFile(huge,'音'.repeat(12*1024*1024));
function run(path,operation='GET',body='',etag='',cancel=false){return new Promise((resolve,reject)=>{
  const child=spawn('build/tests/native-webdav-backup',[`http://127.0.0.1:${server.address().port}/backup/`,path,operation,body,etag,...(cancel?['cancel']:[])]);let out='',err='';
  child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Native backup deadline exceeded'));},20000);
  child.on('error',error=>{clearTimeout(timeout);reject(error);});child.on('close',code=>{clearTimeout(timeout);code===0?resolve(out.trim()):reject(new Error(`Native backup process failed ${code}: ${err.slice(-200)}`));});
});}
try{
  assert.match(await run('folder/','MKCOL'),/^status=201/);assert.match(await run('folder/','MKCOL'),/^status=405/);
  assert.match(await run('data.json','PUT',bodyFile),/^status=201/);assert.match(await run('data.json','PUT',bodyFile),/^status=412/);assert.equal(files.size,1);
  const expected=`status=200 bytes=${Buffer.byteLength(json)} etag="fixture" sha=${sha(json)}`;
  assert.equal(await run('data.json','GET','','"fixture"'),expected);assert.equal(await run('redirect'),expected);assert.match(await run('etag','GET','','"fixture"'),/^status=412/);
  assert.equal(await run('write-redirect','PUT',bodyFile),'error=2');assert.equal(files.has('/backup/redirect-target'),false);
  for(const path of ['outside','external','%252e%252e/private','nested%2fsecret'])assert.equal(await run(path),'error=2');assert.equal(externalHits,0);assert.equal(outsideHits,0);
  for(const path of ['invalid','large-header','large-chunks'])assert.equal(await run(path),'error=4',path);assert.match(await run('unauthorized'),/^status=401/);assert.equal(await run('slow','GET','','',true),'error=-999');
  const before=verified;for(const args of [['data.json','POST'],['data.json','PUT',''],['data.json','PUT',huge],['data.json','GET',bodyFile],['data.json','PUT',bodyFile,'W/"weak"'],['folder/','MKCOL','','"fixture"'],['data.json','GET','','W/"weak"'],['data.json','GET','','"fixture"\r\nX: injection']])assert.equal(await run(...args),'error=1');assert.equal(verified,before);
  assert.match(await run('cas.json','PUT',bodyFile),/^status=201/);
  assert.match(await run('cas.json','PUT',bodyFile,'"fixture"'),/^status=204/);
  assert.match(await run('cas.json','PUT',bodyFile,'"fixture"'),/^status=412/);
  assert.match(await run('cas.json','GET','','"fixture"'),/^status=412/);
  assert.match(await run('cas.json','GET','','"fixture-next"'),/^status=200 .*etag="fixture-next"/);
  console.log('Native WebDAV backup passed: actual Basic/MKCOL/PUT/GET, conditional no-overwrite and If-Match, Unicode bytes/SHA, write-redirect rejection, read scope, UTF8/32MiB limits, status and cancellation');
}finally{server.closeAllConnections();external.closeAllConnections();await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>external.close(resolve))]);await rm(temp,{recursive:true,force:true});}
