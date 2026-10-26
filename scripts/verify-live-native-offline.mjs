import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Opt-in, real MP3 integration. Never substitutes generated audio or screenshots.
const options={audio:[],expect:[]};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i]?.slice(2),value=process.argv[i+1];assert(value&&['output','audio','expect'].includes(key));if(key==='output')options.output=value;else options[key].push(value);}
assert(options.output&&options.audio.length===2&&options.expect.length===2,'--output NEW_DIR --audio FILE --expect SHA256 twice');
const root=fileURLToPath(new URL('../',import.meta.url)),output=resolve(options.output);
assert(!existsSync(output),'Use a new output directory');mkdirSync(output,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=['modules/nexus-native/ios/OfflineBackgroundTransfers.swift','tests/native/OfflineTransfersCLI.swift','scripts/verify-live-native-offline.mjs'];
const snapshot=()=>Object.fromEntries(sources.map(name=>[name,sha(readFileSync(join(root,name)))])),sourceBefore=snapshot();
const inputs=options.audio.map((name,index)=>{
  const path=resolve(name),bytes=readFileSync(path);assert(bytes.length>100000&&bytes.length<30000000&&/\.mp3$/i.test(path));
  assert.equal(sha(bytes),options.expect[index],'Approved source hash mismatch');
  assert(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224),'Complete MP3 required');return {path,bytes,sha256:sha(bytes)};
});
const run=(command,args)=>new Promise((resolveRun,reject)=>{
  const child=spawn(command,args,{cwd:root,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.on('error',reject);
  child.on('exit',code=>code===0?resolveRun({stdout,stderr}):reject(new Error(`Native probe exited ${code}: ${stderr.slice(-3000)}`)));
});
const binary=join(output,'native-offline-probe');
await run('xcrun',['swiftc','-swift-version','5',...sources.slice(0,2),'-framework','AVFoundation','-o',binary]);
const requests=[];
const server=createServer((request,response)=>{
  const index=request.url==='/a'?0:request.url==='/b'?1:-1;if(index<0){response.writeHead(404).end();return;}
  const input=inputs[index],range=request.headers.range,match=range?.match(/^bytes=(\d+)-$/),start=match?Number(match[1]):0;
  requests.push({input:index,range:range??null});
  if(start>=input.bytes.length){response.writeHead(416).end();return;}
  response.writeHead(start?206:200,{'Content-Type':'audio/mpeg','Content-Length':input.bytes.length-start,'Accept-Ranges':'bytes','ETag':`"${input.sha256}"`,...(start?{'Content-Range':`bytes ${start}-${input.bytes.length-1}/${input.bytes.length}`}:{})});
  let offset=start,timer;const send=()=>{
    if(response.destroyed)return;
    const end=Math.min(offset+65536,input.bytes.length),chunk=input.bytes.subarray(offset,end);offset=end;
    response.write(chunk);if(offset===input.bytes.length){response.end();return;}timer=setTimeout(send,30);
  };
  response.on('close',()=>clearTimeout(timer));send();
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
try{
  const result=await run(binary,[`http://127.0.0.1:${server.address().port}`,output,...inputs.map(x=>x.sha256)]);
  const receipt={...JSON.parse(result.stdout.trim()),node:process.version,sourceBefore,sourceAfter:snapshot(),binarySha256:sha(readFileSync(binary)),inputs:inputs.map(x=>({file:basename(x.path),bytes:x.bytes.length,sha256:x.sha256})),requests};
  assert.deepEqual(receipt.sourceAfter,sourceBefore);assert(inputs.every(x=>sha(readFileSync(x.path))===x.sha256));
  const journal=readFileSync(join(output,'metadata/journal.json'),'utf8');assert(!journal.includes('http')&&!journal.includes('127.0.0.1'),'Journal must not persist transport URLs');
  writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({receipt:join(output,'receipt.json'),...JSON.parse(result.stdout.trim())}));
}finally{await new Promise(resolveClose=>server.close(resolveClose));}
