import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {mkdtempSync,existsSync,statSync,unlinkSync,writeFileSync,openSync,closeSync,writeSync,renameSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStreamingDownload,safeDownloadValidator,type TransferFile} from '../src/storage/offlineTransfer.ts';

async function fixture(handler:(req:IncomingMessage,res:ServerResponse)=>void){
  const directory=mkdtempSync(join(tmpdir(),'nexus-transfer-'));
  class DiskFile implements TransferFile {
    path:string;
    constructor(name:string){this.path=join(directory,name);}
    get exists(){return existsSync(this.path);}
    get size(){return this.exists?statSync(this.path).size:0;}
    delete(){unlinkSync(this.path);}
    create(){writeFileSync(this.path,'');}
    open(){const fd=openSync(this.path,'r+');let offset=0,closed=false;return{
      get offset(){return offset;},set offset(value:number|null){offset=value??0;},
      writeBytes(bytes:Uint8Array){offset+=writeSync(fd,bytes,0,bytes.length,offset);},
      close(){if(closed)throw Error('closed');closeSync(fd);closed=true;},
    };}
    move(target:TransferFile){renameSync(this.path,(target as DiskFile).path);}
  }
  const server=createServer(handler);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert(address&&typeof address==='object');
  const url=`http://127.0.0.1:${address.port}/audio`;
  return {url,download:createStreamingDownload(name=>new DiskFile(name),fetch),
    seed:(bytes:string)=>writeFileSync(join(directory,'song.audio.part'),bytes),
    bytes:()=>readFileSync(join(directory,'song.audio'),'utf8'),
    finalExists:()=>existsSync(join(directory,'song.audio')),
    close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});},
  };
}

test('streaming adapter resumes the same entity to a real disk file and passes If-Range',async()=>{
  let requests=0,encodingHeader:string|undefined;
  const f=await fixture((req,res)=>{requests++;encodingHeader=req.headers['accept-encoding'];res.writeHead(206,{'Content-Range':'bytes 4-11/12','Content-Length':'8','ETag':'"v1"'});res.end('456789ab');});
  try{f.seed('0123');assert.equal(await f.download(f.url,'song.audio',undefined,{offset:4,validator:'"v1"'}),12);assert.equal(f.bytes(),'0123456789ab');assert.equal(requests,1);assert.match(encodingHeader??'',/identity/);}finally{await f.close();}
});

test('changed entities and malformed ranges restart once without splicing the old prefix',async()=>{
  for(const mode of ['entity','range','ignored','416']){
    let requests=0;
    const f=await fixture((req,res)=>{
      requests++;
      if(requests===1){assert.equal(req.headers.range,'bytes=4-');if(mode==='416'){res.writeHead(416);res.end();return;}if(mode==='ignored'){res.writeHead(200,{'Content-Length':'12'});res.end('new-content!');return;}
        res.writeHead(206,{'Content-Range':mode==='range'?'bytes 3-10/11':'bytes 4-11/12','Content-Length':'8','ETag':mode==='entity'?'"v2"':'"v1"'});res.end('456789ab');return;}
      assert.equal(req.headers.range,undefined);assert.equal(req.headers['if-range'],undefined);res.writeHead(200,{'Content-Length':'12','ETag':'"v2"'});res.end('new-content!');
    });
    try{f.seed('old!');assert.equal(await f.download(f.url,'song.audio',undefined,{offset:4,validator:'"v1"'}),12);assert.equal(f.bytes(),'new-content!');assert.equal(requests,2,mode);}finally{await f.close();}
  }
});

test('unversioned, weak or mismatched partials restart without sending Range',async()=>{
  for(const validator of [undefined,'W/"v1"','invalid\r\nvalue']){
    const f=await fixture((req,res)=>{assert.equal(req.headers.range,undefined);assert.equal(req.headers['if-range'],undefined);res.writeHead(200,{'Content-Length':'4'});res.end('full');});
    try{f.seed('old!');await f.download(f.url,'song.audio',{'rAnGe':'bytes=2-','IF-RANGE':'override'},{offset:4,validator});assert.equal(f.bytes(),'full');}finally{await f.close();}
  }
  assert.equal(safeDownloadValidator('Fri, 16 Oct 2026 10:00:00 GMT'),'Fri, 16 Oct 2026 10:00:00 GMT');
});

test('truncated streams and partial 206 without a request never publish a final file',async()=>{
  const f=await fixture((_req,res)=>{res.writeHead(200,{'Content-Length':'12','ETag':'"v1"'});res.write('short');res.socket?.destroy();});
  try{await assert.rejects(f.download(f.url,'song.audio'));assert.equal(f.finalExists(),false);}finally{await f.close();}
  const partial=await fixture((_req,res)=>{res.writeHead(206,{'Content-Range':'bytes 0-3/12','Content-Length':'4'});res.end('part');});
  try{await assert.rejects(partial.download(partial.url,'song.audio'));assert.equal(partial.finalExists(),false);}finally{await partial.close();}
});

