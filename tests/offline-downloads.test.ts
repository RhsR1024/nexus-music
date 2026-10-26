import test from 'node:test';
import assert from 'node:assert/strict';
import {OfflineDownloadInUse,OfflineDownloadInterrupted,OfflineDownloadStore,type OfflineDownloadFiles} from '../src/storage/offlineDownloads.ts';
import type {Repository} from '../src/storage/repository.ts';
import type {Track} from '../src/domain/track.ts';
import {assertDownloadedLength,inspectDownloadResponse} from '../src/storage/offlineTransfer.ts';

const track=(id='song'):Track=>({origin:{kind:'online',platform:'wy',id},title:'Song',artist:'Artist',metadata:{},qualities:[]});
function rig(saved:unknown=undefined){
  let value=saved;const files=new Map<string,{bytes:number;exists:boolean}>();let sequence=0;let fail=false;
  const adapter:OfflineDownloadFiles={
    async download(_url,name){if(fail)throw Error('network');files.set(name,{bytes:12,exists:true});return 12;},
    async remove(name){if(name)files.delete(name);},exists:name=>files.get(name)?.exists===true,size:name=>files.get(name)?.bytes??0,partialSize:()=>0,digest:name=>files.get(name)?.exists?'a'.repeat(32):undefined,uri:name=>`file:///offline/${name}`,
  };
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>value as T|undefined,put:async(_,next)=>{value=structuredClone(next);}};
  const store=new OfflineDownloadStore(repository,{resolve:async()=>({url:'https://audio.example/song.mp3',quality:'320k'}),files:adapter,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,now:()=>1000+sequence});
  return{store,files:adapter,setFail:(value:boolean)=>{fail=value;},saved:()=>value};
}

test('offline downloads deduplicate by source identity and resolve only complete files',async()=>{
  const r=rig(),first=await r.store.enqueue(track()),second=await r.store.enqueue(track());assert.equal(first.id,second.id);assert.equal(first.status,'queued');
  await r.store.start(first.id);assert.equal(r.store.getSnapshot()[0]!.status,'completed');assert.deepEqual(await r.store.resolve(track()),{url:`file:///offline/${first.fileName}`,quality:'320k'});
  const saved=JSON.stringify(r.saved());assert(!saved.includes('https://audio.example'),'signed or remote URLs must not be persisted');
});

test('failed downloads keep a retryable record and never resolve a partial file',async()=>{
  const r=rig();r.setFail(true);const item=await r.store.enqueue(track('bad'));await r.store.start(item.id);assert.equal(r.store.getSnapshot()[0]!.status,'failed');assert.equal(await r.store.resolve(track('bad')),undefined);
  r.setFail(false);await r.store.retry(item.id);assert.equal(r.store.getSnapshot()[0]!.status,'completed');
});

test('restore downgrades missing completed files and interrupted work to queued',async()=>{
  const saved={version:1,items:[
    {id:'a',track:track('a'),fileName:'00000000.audio',status:'completed',bytes:10,updatedAt:1},
    {id:'b',track:track('b'),fileName:'00000001.audio',status:'downloading',bytes:0,updatedAt:1},
  ]};const r=rig(saved);await r.store.restore();assert.deepEqual(r.store.getSnapshot().map(item=>item.status),['failed','queued']);
});

test('resumeQueued restarts interrupted work after process recovery and leaves paused or failed work alone',async()=>{
  const saved={version:1,items:[
    {id:'interrupted',track:track('interrupted'),fileName:'00000000.audio',status:'downloading',bytes:0,updatedAt:1},
    {id:'paused',track:track('paused'),fileName:'00000001.audio',status:'paused',bytes:0,updatedAt:1},
    {id:'failed',track:track('failed'),fileName:'00000002.audio',status:'failed',bytes:0,error:'网络',updatedAt:1},
  ]};
  const r=rig(saved);await r.store.restore();await r.store.resumeQueued();
  assert.deepEqual(r.store.getSnapshot().map(item=>item.status),['completed','paused','failed']);
  assert.equal(r.store.getSnapshot()[0]!.bytes,12);
});

test('offline quota rejects a completed file without deleting existing files',async()=>{
  const r=rig();const first=await r.store.enqueue(track('one'));await r.store.start(first.id);
  const limited=new OfflineDownloadStore({get:async()=>r.saved() as never,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/two.mp3'}),files:r.files,uuid:()=>`00000000-0000-4000-8000-000000000099`,now:()=>2000,maxTotalBytes:()=>12});
  await limited.restore();const second=await limited.enqueue(track('two'));await limited.start(second.id);assert.equal(limited.getSnapshot()[1]!.status,'failed');assert.match(limited.getSnapshot()[1]!.error??'',/容量/);assert.equal(limited.getStatistics().files,1);
});

test('pause preserves partial bytes and resume requests the saved offset',async()=>{
  let mode:'pause'|'resume'='pause';let partial=0;let startedResolve:()=>void=()=>{};const started=new Promise<void>(resolve=>{startedResolve=resolve});const files:OfflineDownloadFiles={
    async download(_url,name,_headers,options){if(mode==='pause'){startedResolve();return new Promise((_,reject)=>options?.signal?.addEventListener('abort',()=>{partial=4;reject(new OfflineDownloadInterrupted(4));},{once:true}));}assert.equal(options?.offset,4);partial=12;return 12;},
    async remove(){partial=0;},exists:()=>partial>0,size:()=>0,partialSize:()=>partial,digest:()=>partial>0?'b'.repeat(32):undefined,uri:name=>`file:///offline/${name}`,
  };
  const repository:Pick<Repository,'get'|'put'>={get:async()=>undefined,put:async()=>{}};
  const store=new OfflineDownloadStore(repository,{resolve:async()=>({url:'https://audio.example/song.mp3'}),files,uuid:()=>`00000000-0000-4000-8000-000000000010`,now:()=>1});
  const item=await store.enqueue(track('pause'));const running=store.start(item.id);await started;await store.pause(item.id);await running;assert.equal(store.getSnapshot()[0]!.status,'paused');assert.equal(store.getSnapshot()[0]!.partialBytes,4);
  mode='resume';await store.resume(item.id);assert.equal(store.getSnapshot()[0]!.status,'completed');assert.equal(store.getSnapshot()[0]!.bytes,12);
});

test('queued pause can resume without starting a second task',async()=>{
  let calls=0;const files:OfflineDownloadFiles={
    async download(){calls+=1;return 8;},async remove(){},exists:()=>true,size:()=>8,partialSize:()=>0,digest:()=>'c'.repeat(32),uri:name=>`file:///offline/${name}`,
  };
  const store=new OfflineDownloadStore({get:async()=>undefined,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/queued.mp3'}),files,uuid:()=>`00000000-0000-4000-8000-000000000020`,now:()=>1});
  const item=await store.enqueue(track('queued'));await store.pause(item.id);assert.equal(store.getSnapshot()[0]!.status,'paused');
  await store.resume(item.id);assert.equal(calls,1);assert.equal(store.getSnapshot()[0]!.status,'completed');
});

test('in-use completed files are protected from remove and bulk cleanup',async()=>{
  const r=rig(),first=await r.store.enqueue(track('playing')),second=await r.store.enqueue(track('other'));
  await r.store.start(first.id);await r.store.start(second.id);
  const guarded=new OfflineDownloadStore({get:async()=>r.saved() as never,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/song.mp3'}),files:r.files,uuid:()=>`00000000-0000-4000-8000-000000000030`,now:()=>3,isInUse:item=>item.origin.id==='playing'});
  await guarded.restore();await assert.rejects(guarded.remove(first.id),OfflineDownloadInUse);
  await guarded.clearCompleted();assert.deepEqual(guarded.getSnapshot().map(item=>item.track.origin.id),['playing']);
});

test('restore rejects a changed completed file by digest before playback',async()=>{
  const saved={version:1,items:[{id:'digest',track:track('digest'),fileName:'00000000.audio',status:'completed',bytes:8,digest:'a'.repeat(32),updatedAt:1}]};
  const files:OfflineDownloadFiles={async download(){return 8;},async remove(){},exists:()=>true,size:()=>8,partialSize:()=>0,digest:()=>'b'.repeat(32),uri:name=>`file:///offline/${name}`};
  const store=new OfflineDownloadStore({get:async()=>saved as never,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/digest.mp3'}),files,uuid:()=>`00000000-0000-4000-8000-000000000040`,now:()=>1});
  await store.restore();assert.equal(store.getSnapshot()[0]!.status,'failed');assert.match(store.getSnapshot()[0]!.error??'',/完整性/);assert.equal(await store.resolve(track('digest')),undefined);
});

test('wire transfer validation requires matching range and declared length',()=>{
  const headers=(values:Record<string,string>)=>({get:(name:string)=>values[name.toLowerCase()]??null});
  const inspection=inspectDownloadResponse(206,headers({'content-range':'bytes 4-11/12','content-length':'8','etag':'"v1"'}),4);
  assert.equal(inspection.append,true);assert.equal(inspection.validator,'"v1"');assert.doesNotThrow(()=>assertDownloadedLength(inspection,12,4));
  assert.throws(()=>inspectDownloadResponse(206,headers({'content-range':'bytes 0-7/12','content-length':'8'}),4),/断点续传/);
  assert.throws(()=>{const value=inspectDownloadResponse(200,headers({'content-length':'8'}),0);assertDownloadedLength(value,7,0);},/长度/);
});

test('removing a queued run prevents its network work and deletes its record',async()=>{
  let calls=0,sequence=0;const files:OfflineDownloadFiles={
    async download(){calls+=1;return 8;},async remove(){},exists:()=>true,size:()=>8,partialSize:()=>0,digest:()=>'d'.repeat(32),uri:name=>`file:///offline/${name}`,
  };
  const store=new OfflineDownloadStore({get:async()=>undefined,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/queued.mp3'}),files,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,now:()=>1});
  const first=await store.enqueue(track('first'));const second=await store.enqueue(track('second'));const running=store.start(first.id);const removing=store.start(second.id);await store.remove(second.id);await Promise.all([running,removing]);
  assert.equal(calls,1);assert.equal(store.find(track('second')),undefined);
});

// A foreground event can arrive while startup recovery is still transferring.
// The failed record must not be silently retried by the overlapping scheduler.
test('overlapping recovery keeps persisted order and performs each transfer once',async()=>{
  const seed=rig();await seed.store.enqueue(track('first'));await seed.store.enqueue(track('second'));await seed.store.enqueue(track('third'));
  let unblock!:()=>void,started!:()=>void;
  const blocked=new Promise<void>(resolve=>{unblock=resolve;}),entered=new Promise<void>(resolve=>{started=resolve;});
  const calls:string[]=[];
  const store=new OfflineDownloadStore({get:async()=>seed.saved() as never,put:async()=>{}},{
    resolve:async(item)=>{calls.push(item.origin.id);if(item.origin.id==='first'){started();await blocked;}if(item.origin.id==='second')throw new Error('network');return{url:'https://audio.example/recovery'};},
    files:seed.files,uuid:()=>'',now:()=>1,
  });
  await store.restore();const startup=store.resumeQueued();await entered;
  const foreground=store.resumeQueued();unblock();await Promise.all([startup,foreground]);
  assert.deepEqual(calls,['first','second','third']);
  assert.deepEqual(store.getSnapshot().map(item=>item.status),['completed','failed','completed']);
});

test('pausing a waiting record during recovery prevents its network request',async()=>{
  const seed=rig();await seed.store.enqueue(track('first'));const waiting=await seed.store.enqueue(track('waiting'));
  let unblock!:()=>void,started!:()=>void;const blocked=new Promise<void>(resolve=>{unblock=resolve;}),entered=new Promise<void>(resolve=>{started=resolve;});
  const calls:string[]=[];
  const store=new OfflineDownloadStore({get:async()=>seed.saved() as never,put:async()=>{}},{
    resolve:async(item)=>{calls.push(item.origin.id);started();await blocked;return{url:'https://audio.example/recovery'};},files:seed.files,uuid:()=>'',now:()=>1,
  });
  await store.restore();const recovery=store.resumeQueued();await entered;await store.pause(waiting.id);unblock();await recovery;
  assert.deepEqual(calls,['first']);assert.equal(store.find(track('waiting'))!.status,'paused');
});

test('process recovery retains the saved offset and validator for the transfer adapter',async()=>{
  const saved={version:1,items:[{id:'interrupted',track:track(),fileName:'00000000.audio',status:'downloading',bytes:0,partialBytes:4,validator:'"v1"',updatedAt:1}]};
  const seed=rig();let calls=0;
  const store=new OfflineDownloadStore({get:async()=>saved as never,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/fresh-url'}),files:{...seed.files,
    download:async(url,name,headers,options)=>{calls++;assert.equal(options?.offset,4);assert.equal(options?.validator,'"v1"');return seed.files.download(url,name,headers,options);},
  },uuid:()=>'',now:()=>1});
  await store.restore();await store.resumeQueued();await store.resumeQueued();assert.equal(calls,1);assert.equal(store.getSnapshot()[0]!.status,'completed');
});

test('pause immediately after scheduling recovery wins before network work starts',async()=>{
  const r=rig(),item=await r.store.enqueue(track('instant'));let calls=0;
  const original=r.files.download;r.files.download=async(...args)=>{calls++;return original(...args);};
  const recovery=r.store.resumeQueued();await r.store.pause(item.id);await recovery;
  assert.equal(calls,0);assert.equal(r.store.getSnapshot()[0]!.status,'paused');
  await r.store.resume(item.id);assert.equal(calls,1);assert.equal(r.store.getSnapshot()[0]!.status,'completed');
});

test('pause during the downloading state write aborts before resolving a URL',async()=>{
  let saved:unknown,release!:()=>void,entered!:()=>void,calls=0;
  const writing=new Promise<void>(resolve=>{entered=resolve;}),blocked=new Promise<void>(resolve=>{release=resolve;});
  const r=rig();
  const repository:Pick<Repository,'get'|'put'>={get:async()=>saved as never,put:async(_,next)=>{
    if((next as {items:Array<{status:string}>}).items[0]?.status==='downloading'){entered();await blocked;}
    saved=structuredClone(next);
  }};
  const store=new OfflineDownloadStore(repository,{resolve:async()=>{calls++;return{url:'https://audio.example/blocked'};},files:r.files,uuid:()=> '00000000-0000-4000-8000-000000000001',now:()=>1});
  const item=await store.enqueue(track('writing'));const recovery=store.resumeQueued();await writing;
  const pausing=store.pause(item.id);release();await Promise.all([recovery,pausing]);
  assert.equal(calls,0);assert.equal(store.getSnapshot()[0]!.status,'paused');
  await store.resume(item.id);assert.equal(calls,1);assert.equal(store.getSnapshot()[0]!.status,'completed');
});

test('bulk pause wins over recovery and resume excludes failed records',async()=>{
  const r=rig(),first=await r.store.enqueue(track('first')),second=await r.store.enqueue(track('second')),failed=await r.store.enqueue(track('failed'));
  r.setFail(true);await r.store.start(failed.id);r.setFail(false);
  let calls=0;const download=r.files.download;r.files.download=async(...args)=>{calls++;return download(...args);};
  const recovery=r.store.resumeQueued();await r.store.pauseAll();await recovery;
  assert.deepEqual(r.store.getSnapshot().map(item=>item.status),['paused','paused','failed']);assert.equal(calls,0);
  await r.store.resumeAll();assert.equal(calls,2);
  assert.equal(r.store.find(first.track)!.status,'completed');assert.equal(r.store.find(second.track)!.status,'completed');assert.equal(r.store.find(failed.track)!.status,'failed');
  await r.store.cancelPending();assert.deepEqual(r.store.getSnapshot().map(item=>item.id),[first.id,second.id]);
  assert.ok(await r.store.resolve(first.track));assert.ok(await r.store.resolve(second.track));
});

test('bulk pause aborts an active transfer before the next queued item starts',async()=>{
  const r=rig(),first=await r.store.enqueue(track('first'));await r.store.enqueue(track('second'));
  let entered!:()=>void,calls=0;const started=new Promise<void>(resolve=>{entered=resolve;});
  r.files.download=async(_url,_name,_headers,options)=>{calls++;entered();return new Promise((_resolve,reject)=>{options?.signal?.addEventListener('abort',()=>reject(new OfflineDownloadInterrupted(0)),{once:true});});};
  const recovery=r.store.resumeQueued();await started;await r.store.pauseAll();await recovery;
  assert.equal(calls,1);assert.deepEqual(r.store.getSnapshot().map(item=>item.status),['paused','paused']);
  assert.equal(await r.store.resolve(first.track),undefined);
});

test('cancelling keeps a retryable 下载已取消 record while unfinished work stops',async()=>{
  const r=rig();const item=await r.store.enqueue(track('c'));
  await r.store.cancel(item.id);assert.equal(r.store.getSnapshot()[0]!.status,'cancelled');
  assert.equal(await r.store.resolve(track('c')),undefined,'cancelled work must not resolve');
  await r.store.retry(item.id);assert.equal(r.store.getSnapshot()[0]!.status,'completed');
});

test('cancelling an in-flight transfer survives its abort settlement and stays cancelled after restore',async()=>{
  const r=rig();let enter!:()=>void;const entered=new Promise<void>(resolve=>{enter=resolve;});let calls=0;
  const download=r.files.download;
  r.files.download=async(_url,_name,_headers,options)=>new Promise((_,reject)=>{
    calls++;options!.signal!.addEventListener('abort',()=>reject(new OfflineDownloadInterrupted(4)),{once:true});enter();
  });
  const item=await r.store.enqueue(track('active')),run=r.store.start(item.id);await entered;
  await r.store.cancel(item.id);await run;
  assert.equal(r.store.getSnapshot()[0]!.status,'cancelled');assert.equal(r.store.getStatistics().pending,0);
  const restored=rig(r.saved());await restored.store.restore();await restored.store.resumeQueued();
  assert.equal(restored.store.getSnapshot()[0]!.status,'cancelled');assert.equal(calls,1);
  r.files.download=download;await r.store.retry(item.id);assert.equal(r.store.getSnapshot()[0]!.status,'completed');
});

test('cancelAll aborts an active transfer and prevents queued I/O while preserving completed files',async()=>{
  const r=rig(),done=await r.store.enqueue(track('done'));await r.store.start(done.id);
  let enter!:()=>void;const entered=new Promise<void>(resolve=>{enter=resolve;});let calls=0;
  r.files.download=async(_url,_name,_headers,options)=>new Promise((_,reject)=>{
    calls++;options!.signal!.addEventListener('abort',()=>reject(new OfflineDownloadInterrupted(4)),{once:true});enter();
  });
  const active=await r.store.enqueue(track('active')),queued=await r.store.enqueue(track('queued'));
  const running=r.store.start(active.id);await entered;const waiting=r.store.start(queued.id);
  await r.store.cancelAll();await Promise.all([running,waiting]);
  assert.deepEqual(r.store.getSnapshot().map(item=>item.status),['completed','cancelled','cancelled']);
  assert.equal(calls,1);assert.equal(r.store.getStatistics().pending,0);assert.ok(await r.store.resolve(track('done')));
});

test('a failed cancellation write can be retried after its transport has stopped',async()=>{
  const r=rig();let value:unknown,fail=true,enter!:()=>void;
  const entered=new Promise<void>(resolve=>{enter=resolve;});
  r.files.download=async(_url,_name,_headers,options)=>new Promise((_,reject)=>{
    options!.signal!.addEventListener('abort',()=>reject(new OfflineDownloadInterrupted(4)),{once:true});enter();
  });
  const store=new OfflineDownloadStore({get:async<T>()=>value as T|undefined,put:async(_key,next)=>{
    if(fail&&(next as {items:{status:string}[]}).items[0]?.status==='cancelled'){fail=false;throw new Error('disk full');}
    value=structuredClone(next);
  }},{files:r.files,resolve:async()=>({url:'https://audio.example/song.mp3'}),uuid:()=> '00000000-0000-4000-8000-000000000077',now:()=>1});
  const item=await store.enqueue(track('cancel-write')),run=store.start(item.id),settled=run.catch(error=>error);
  await entered;await assert.rejects(store.cancel(item.id),/disk full/);assert.match((await settled).message,/disk full/);
  assert.equal(store.getSnapshot()[0]!.status,'downloading','Failed persistence must keep the old published record');
  await store.cancel(item.id);assert.equal(store.getSnapshot()[0]!.status,'cancelled');assert.equal(store.getStatistics().pending,0);
});

test('configured admission queues work, cancels waiting runs promptly and increases/decreases without interrupting active transfers',async()=>{
  let limit=1,sequence=0,peak=0;const live=new Map<string,()=>void>(),saved=new Map<string,unknown>();const files:OfflineDownloadFiles={independentTransfers:true,download:async(_url,name)=>{await new Promise<void>(resolve=>{live.set(name,resolve);peak=Math.max(peak,live.size);});live.delete(name);return 12;},exists:()=>true,size:()=>12,partialSize:()=>0,digest:()=> 'a'.repeat(32),uri:name=>name,remove:async()=>{}};
  const store=new OfflineDownloadStore({get:async<T>(key:string)=>saved.get(key) as T|undefined,put:async(key,value)=>{saved.set(key,value);}},{files,resolve:async()=>({url:'https://audio.example/public.mp3'}),uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,now:()=>1,concurrency:()=>limit});
  const rows=await Promise.all(['a','b','c','d','e'].map(id=>store.enqueue(track(id))));const runs=rows.map(row=>store.start(row.id));const tick=()=>new Promise(resolve=>setImmediate(resolve));for(let i=0;i<6;i++)await tick();assert.equal(live.size,1);assert.equal(store.getSnapshot().filter(x=>x.status==='queued').length,4);
  await store.cancel(rows[2]!.id);await runs[2];assert.equal(store.getSnapshot()[2]!.status,'cancelled');assert.equal(live.size,1);
  await store.updateConcurrency(3,async()=>{limit=3;});for(let i=0;i<6;i++)await tick();assert.equal(live.size,3);assert.equal(peak,3);
  await store.updateConcurrency(1,async()=>{limit=1;});assert.equal(live.size,3);for(const row of [rows[0]!,rows[1]!]){live.get(row.fileName)!();for(let i=0;i<6;i++)await tick();assert.equal(store.getSnapshot()[4]!.status,'queued');}live.get(rows[3]!.fileName)!();for(let i=0;i<6;i++)await tick();assert.equal(live.size,1);assert.equal(store.getSnapshot()[4]!.status,'downloading');live.get(rows[4]!.fileName)!();await Promise.all(runs);assert.equal(live.size,0);
});

test('concurrency validation and native/persistence failures do not publish or drain a changed policy',async()=>{
  let limit=1,changes=0;const calls:number[]=[];const files:OfflineDownloadFiles={independentTransfers:true,setConcurrency:async value=>{calls.push(value);if(value===3)throw Error('native');},download:async()=>12,exists:()=>true,size:()=>12,partialSize:()=>0,digest:()=> 'a'.repeat(32),uri:()=>'',remove:async()=>{}};const store=new OfflineDownloadStore({get:async()=>undefined,put:async()=>{}},{files,resolve:async()=>({url:'https://audio.example/public.mp3'}),uuid:()=>'',now:()=>1,concurrency:()=>limit});
  for(const invalid of [0,4,1.5,NaN])await assert.rejects(store.updateConcurrency(invalid,async()=>{changes++;}));assert.deepEqual(calls,[]);
  await assert.rejects(store.updateConcurrency(3,async()=>{changes++;}));assert.equal(changes,0);await assert.rejects(store.updateConcurrency(2,async()=>{throw Error('disk');}));assert.deepEqual(calls,[3,2,1]);assert.equal(limit,1);
  const a=store.updateConcurrency(2,async()=>{limit=2;}),b=store.updateConcurrency(1,async()=>{assert.equal(limit,2);limit=1;});await Promise.all([a,b]);assert.equal(limit,1);
});

test('restore immediately adopts running native tasks before any new start without waiting for provider readiness',async()=>{
  let sequence=0,resolved=0;const live=new Map<string,()=>void>();const originals=['a','b','c'].map((id,index)=>({id:'existing-'+id,track:track(id),fileName:`00000000-0000-4000-8000-00000000000${index+1}.audio`,status:'downloading',bytes:0,updatedAt:1}));const files:OfflineDownloadFiles={independentTransfers:true,recoverState:async()=> 'downloading',recoverDownload:async name=>{if(!originals.some(row=>row.fileName===name))return;await new Promise<void>(resolve=>live.set(name,resolve));return 12;},download:async(_url,name)=>{await new Promise<void>(resolve=>live.set(name,resolve));return 12;},exists:()=>true,size:()=>12,partialSize:()=>0,digest:()=> 'a'.repeat(32),uri:()=>'',remove:async()=>{}};
  const store=new OfflineDownloadStore({get:async<T>()=>({version:1,items:originals}) as T,put:async()=>{}},{files,resolve:async()=>{resolved++;return{url:'https://audio.example/public.mp3'};},uuid:()=>`00000000-0000-4000-8000-${String(++sequence+100).padStart(12,'0')}`,now:()=>1,concurrency:()=>1});await store.restore();const next=await store.enqueue(track('next'));const running=store.start(next.id);const tick=()=>new Promise(resolve=>setImmediate(resolve));for(let i=0;i<6;i++)await tick();assert.equal(live.size,3);assert.equal(store.getSnapshot().find(x=>x.id===next.id)!.status,'queued');assert.equal(resolved,0);
  for(const row of originals){live.get(row.fileName)!();for(let i=0;i<6;i++)await tick();live.delete(row.fileName);}for(let i=0;i<6;i++)await tick();assert.equal(live.size,1);live.get(next.fileName)!();await running;assert.equal(store.getSnapshot().filter(x=>x.status==='completed').length,4);assert.equal(resolved,1);
});
