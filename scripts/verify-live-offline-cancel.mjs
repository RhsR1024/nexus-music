import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {existsSync,mkdirSync,readFileSync,writeFileSync,statSync,unlinkSync,openSync,closeSync,writeSync,renameSync} from 'node:fs';
import {basename,resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {OfflineDownloadStore} from '../src/storage/offlineDownloads.ts';
import {createStreamingDownload} from '../src/storage/offlineTransfer.ts';

// Explicit real-input integration, separate from the synthetic unit suite.
// Local HTTP holds unchanged source bytes mid-transfer to exercise aborts.
const options={audio:[],expect:[]};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i]?.slice(2),value=process.argv[i+1];assert(value&&['output','audio','expect'].includes(key),'Use --output NEW_DIR --audio FILE --expect SHA256 twice');if(key==='output')options.output=value;else options[key].push(value);}
assert(options.output&&options.audio.length===2&&options.expect.length===2);
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const root=fileURLToPath(new URL('../',import.meta.url));
const sourceSnapshot=()=>Object.fromEntries(['scripts/verify-live-offline-cancel.mjs','src/storage/offlineDownloads.ts','src/storage/offlineTransfer.ts','src/domain/track.ts'].map(name=>[name,hash(readFileSync(join(root,name)))]));
const sourceBefore=sourceSnapshot();
const inputs=options.audio.map((name,index)=>{
  const path=resolve(name),bytes=readFileSync(path),sha256=hash(bytes);
  assert(bytes.length>=100000&&bytes.length<=30000000&&/\.mp3$/i.test(path),'Complete MP3 input required');
  assert(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224),'MP3 header required');
  assert.equal(sha256,options.expect[index],'Input must match the approved source receipt');
  return {path,bytes,sha256};
});
assert.notEqual(inputs[0].sha256,inputs[1].sha256);
const output=resolve(options.output);assert(!existsSync(output),'Output directory must be new');mkdirSync(output);
class DiskFile {
  constructor(name){assert(/^[a-f0-9-]+\.audio(?:\.part)?$/.test(name));this.path=join(output,name);}
  get exists(){return existsSync(this.path);}
  get size(){return this.exists?statSync(this.path).size:0;}
  create(){writeFileSync(this.path,'');}
  delete(){unlinkSync(this.path);}
  open(){const fd=openSync(this.path,'r+');let offset=0;return {get offset(){return offset;},set offset(v){offset=v??0;},writeBytes(bytes){offset+=writeSync(fd,bytes,0,bytes.length,offset);},close(){closeSync(fd);}};}
  move(target){renameSync(this.path,target.path);}
}
const waitFor=async check=>{const end=Date.now()+5000;while(!check()){assert(Date.now()<end,'Timed out waiting for actual in-flight bytes');await new Promise(r=>setTimeout(r,10));}};
let held=true,aborted=0;const requests=[];
const server=createServer((req,res)=>{
  const index=Number(req.url?.match(/^\/(\d)\.mp3$/)?.[1]);const input=inputs[index];
  if(!input){res.writeHead(404);res.end();return;}
  requests.push({index,range:req.headers.range??null});
  res.on('close',()=>{if(!res.writableFinished)aborted++;});
  res.writeHead(200,{'Content-Length':input.bytes.length,'Content-Type':'audio/mpeg','ETag':`"${input.sha256}"`});
  if(held)res.write(input.bytes.subarray(0,65536));else res.end(input.bytes);
});
const receipt={node:process.version,sourceBefore,inputs:inputs.map(x=>({file:basename(x.path),bytes:x.bytes.length,sha256:x.sha256})),steps:[]};
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert(address&&typeof address==='object');
  const journal=join(output,'records.json');
  const repository={get:async()=>existsSync(journal)?JSON.parse(readFileSync(journal,'utf8')):undefined,put:async(_key,value)=>{writeFileSync(journal+'.new',JSON.stringify(value));renameSync(journal+'.new',journal);}};
  const file=name=>new DiskFile(name);
  const files={download:createStreamingDownload(file,fetch),remove:async name=>{for(const suffix of ['', '.part']){const f=file(name+suffix);if(f.exists)f.delete();}},exists:name=>file(name).exists,size:name=>file(name).size,partialSize:name=>file(name+'.part').size,digest:name=>file(name).exists?hash(readFileSync(file(name).path),'md5'):undefined,uri:name=>pathToFileURL(file(name).path).href};
  const tracks=inputs.map(x=>({origin:{kind:'local',id:x.sha256},title:basename(x.path,'.mp3'),artist:'',metadata:{localFormat:'mp3'},qualities:[]}));
  const storeOptions={files,uuid:randomUUID,now:Date.now,resolve:async track=>{const index=inputs.findIndex(x=>x.sha256===track.origin.id);assert(index>=0);return {url:`http://127.0.0.1:${address.port}/${index}.mp3`};}};
  const store=new OfflineDownloadStore(repository,storeOptions),first=await store.enqueue(tracks[0]);
  const firstRun=store.start(first.id);await waitFor(()=>files.partialSize(first.fileName)>0);
  await store.cancel(first.id);await firstRun;await waitFor(()=>aborted===1);
  assert.equal(store.find(tracks[0]).status,'cancelled');assert.equal(store.getStatistics().pending,0);assert.equal(await store.resolve(tracks[0]),undefined);assert(!files.exists(first.fileName));
  receipt.steps.push({action:'cancel-in-flight',status:'cancelled',partialBytes:files.partialSize(first.fileName),aborted});
  const restored=new OfflineDownloadStore(repository,storeOptions);await restored.restore();await restored.resumeQueued();assert.equal(requests.length,1);assert.equal(restored.find(tracks[0]).status,'cancelled');
  held=false;await restored.retry(first.id);assert.equal(restored.find(tracks[0]).status,'completed');assert.equal(hash(readFileSync(file(first.fileName).path)),inputs[0].sha256);
  receipt.steps.push({action:'restore-and-retry',status:'completed',sha256:inputs[0].sha256});
  const second=await restored.enqueue(tracks[1]);held=true;
  const secondRun=restored.start(second.id);await waitFor(()=>files.partialSize(second.fileName)>0);
  await restored.cancelAll();await secondRun;await waitFor(()=>aborted===2);
  assert.deepEqual(restored.getSnapshot().map(x=>x.status),['completed','cancelled']);assert.equal(restored.getStatistics().pending,0);assert(await restored.resolve(tracks[0]));assert(!files.exists(second.fileName));
  receipt.steps.push({action:'cancel-all-in-flight',statuses:['completed','cancelled'],aborted});
  held=false;await restored.retry(second.id);assert.equal(restored.find(tracks[1]).status,'completed');assert.equal(hash(readFileSync(file(second.fileName).path)),inputs[1].sha256);
  assert(requests.every(x=>x.range===null),'Retry after cancellation must not splice stale partial bytes');
  assert(!readFileSync(journal,'utf8').includes('127.0.0.1'),'Transfer URLs must not enter the task journal');
  assert(inputs.every(x=>hash(readFileSync(x.path))===x.sha256),'Real source inputs changed');
  receipt.sourceAfter=sourceSnapshot();assert.deepEqual(receipt.sourceAfter,sourceBefore);receipt.sourceUnchanged=true;
  receipt.steps.push({action:'retry-all-complete',statuses:restored.getSnapshot().map(x=>x.status),bytes:restored.getStatistics().bytes});receipt.passed=true;
}catch(error){receipt.passed=false;receipt.error=error.message;process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(r=>server.close(()=>r()));receipt.requests=requests;writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,steps:receipt.steps,error:receipt.error}));}
