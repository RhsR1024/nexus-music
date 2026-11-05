import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WebDAVSync,syncDirectory} from '../src/storage/webdavSync.ts';
import {SyncError,encodeSync,decodeSync,resolveSync,planSync,buildSyncState,type SyncChoices} from '../src/storage/multiDeviceSync.ts';
import {LibraryStore,emptyLibrary} from '../src/storage/library.ts';
import {MutationQueue} from '../src/storage/mutations.ts';
import {WebDAVError,type WebDAVAccount} from '../src/providers/webdav.ts';
import type {BackupTransport} from '../src/storage/webdavBackups.ts';
import {InvalidRecordError} from '../src/storage/recovery.ts';
const account:WebDAVAccount={id:'a'.repeat(64),url:'https://fixture.invalid/dav/',username:'fixture-user',label:'Synthetic'};
const song=(id:string)=>({title:id,artist:'Fixture',origin:{kind:'online' as const,platform:'wy' as const,id},metadata:{},qualities:[]});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};};
function server(){
  const files=new Map<string,{body:string;etag:string}>(),dirs=new Set<string>();let revision=0,put=0,get=0;
  const hooks={beforePut:async()=>{},beforeRead:async()=>{}};
  const transport:BackupTransport={backup:async(root,path,credentials,operation,body,etag,signal)=>{
    assert.equal(credentials.password,'fixture-secret');const key=root+path;
    if(operation==='MKCOL'){dirs.add(key);return{status:201,body:'',etag:'',bytes:0};}
    if(operation==='PUT'){
      put++;await hooks.beforePut();const previous=files.get(key);if(etag?etag!==previous?.etag:!!previous)return{status:412,body:'',etag:'',bytes:0};
      const file={body,etag:`"v${++revision}"`};files.set(key,file);return{status:previous?204:201,body:'',etag:file.etag,bytes:0};
    }
    get++;await hooks.beforeRead();const file=files.get(key);if(!file)return{status:404,body:'',etag:'',bytes:0};if(etag&&etag!==file.etag)return{status:412,body:'',etag:'',bytes:0};return{status:200,body:file.body,etag:file.etag,bytes:Buffer.byteLength(file.body)};
  }};
  return{files,dirs,hooks,transport,puts:()=>put,gets:()=>get};
}
function manualSchedule(){
  const jobs:{callback:()=>void;milliseconds:number;cancelled:boolean;started:boolean}[]=[];
  return{
    jobs,
    schedule:(callback:()=>void,milliseconds:number)=>{const job={callback,milliseconds,cancelled:false,started:false};jobs.push(job);return()=>{job.cancelled=true;};},
    active:()=>jobs.filter(job=>!job.cancelled&&!job.started),
    runNext:async()=>{const job=jobs.find(value=>!value.cancelled&&!value.started);assert.ok(job,'expected an active scheduled job');job.started=true;job.callback();},
  };
}
function client(shared=server(),device='b'.repeat(32)){
  const records=new Map<string,unknown>(),listeners=new Set<()=>void>();let accounts=[account],fail=false,id=0;
  const repository={get:async<T>(key:string)=>structuredClone(records.get(key)) as T|undefined,put:async(key:string,value:unknown)=>{if(fail)throw Error('fixture disk full');records.set(key,structuredClone(value));},putMany:async(entries:readonly(readonly[string,unknown])[])=>{if(fail)throw Error('fixture disk full');const next=new Map(records);for(const [key,value]of entries)next.set(key,structuredClone(value));records.clear();for(const [key,value]of next)records.set(key,value);}};
  const mutations=new MutationQueue(),library=new LibraryStore(repository,()=>`${device}-${++id}`,()=>100,mutations);
  const source={getSnapshot:()=>accounts,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},credentials:async()=>({username:'fixture-user',password:'fixture-secret'}),client:async()=>({stat:async(path:string)=>{const key=account.url+path;if(shared.dirs.has(key))return{path,name:path,directory:true};if(shared.files.has(key))return{path,name:path,directory:false};throw new WebDAVError('missing');}})};
  const timer=manualSchedule(),options={repository,accounts:source,transport:shared.transport,library,mutations,uuid:()=>device,schedule:timer.schedule,editDelay:750},sync=new WebDAVSync(options);
  return{sync,library,records,options,shared,timer,fail:(value:boolean)=>{fail=value;},configure:()=>sync.configure(account.id,''),changeAccount:(remove=false)=>{accounts=remove?[]:[{...account}];for(const listener of listeners)listener();}};
}
async function cycle(c:ReturnType<typeof client>,choices:SyncChoices={}){await c.sync.preview();await c.sync.commit(choices);}
const isError=(kind:SyncError['kind'])=>(error:unknown)=>error instanceof SyncError&&error.kind===kind;

test('two independent clients exchange collections, reconnect with persisted baselines and propagate deletion',async()=>{
  const one=client(),two=client(one.shared,'c'.repeat(32));await one.configure();await two.configure();const id=await one.library.createPlaylist('One',[song('long'),song('long')]);await cycle(one);await cycle(two);
  assert.equal(two.library.getSnapshot().playlists[0]!.entries.length,2);assert.equal(two.library.getSnapshot().playlists[0]!.id,id);
  await one.library.renamePlaylist(id,'Changed');await two.library.favorite(song('new'));await cycle(one);await cycle(two);await cycle(one);assert.equal(one.library.getSnapshot().favorites[0]!.origin.id,'new');assert.equal(two.library.getSnapshot().playlists[0]!.title,'Changed');
  const restart=new WebDAVSync(two.options);await restart.restore();assert.equal(restart.getSnapshot().config!.directory,syncDirectory);await one.library.deletePlaylist(id);await cycle(one);await restart.preview();await restart.commit();assert.equal(two.library.getSnapshot().playlists.length,0);
  assert.doesNotMatch(JSON.stringify([...two.records]),/fixture-secret|password|Authorization/);
});

test('playlist description and safe cover survive WebDAV commits and two clients',async()=>{
  const one=client(),two=client(one.shared,'c'.repeat(32));await one.configure();await two.configure();
  const id=await one.library.createPlaylist('Scope');
  one.library.getSnapshot;const before=structuredClone(one.library.getSnapshot());
  await one.library.updatePlaylistMeta(id,{description:'Public scope note',coverUrl:'https://images.example.com/public-cover.jpg'});
  await cycle(one);await cycle(two);await cycle(one);
  for(const client of [one,two])assert.deepEqual(client.library.getSnapshot().playlists[0]!.description,'Public scope note');
  for(const client of [one,two])assert.equal(client.library.getSnapshot().playlists[0]!.coverUrl,'https://images.example.com/public-cover.jpg');
  assert.notEqual(one.library.getSnapshot(),before);
});
test('manual conflict choice is mandatory; cancelled preview changes neither endpoint',async()=>{
  const one=client(),two=client(one.shared,'c'.repeat(32));await one.configure();await two.configure();const id=await one.library.createPlaylist('Original');await cycle(one);await cycle(two);await one.library.renamePlaylist(id,'Left');await two.library.renamePlaylist(id,'Right');await cycle(one);await two.sync.preview();assert.equal(two.sync.getSnapshot().preview!.plan.conflicts.length,1);
  const puts=one.shared.puts();assert.throws(()=>two.sync.commit(),isError('choices'));two.sync.cancel();assert.equal(one.shared.puts(),puts);assert.equal(two.library.getSnapshot().playlists[0]!.title,'Right');
  await two.sync.preview();const conflict=two.sync.getSnapshot().preview!.plan.conflicts[0]!;await two.sync.commit({[conflict.id]:'remote'});assert.equal(two.library.getSnapshot().playlists[0]!.title,'Left');
});
test('edits after preview are rejected before PUT and preserved',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('Old');await c.sync.preview();await c.library.favorite(song('new'));await assert.rejects(c.sync.commit(),isError('localChanged'));assert.equal(c.shared.puts(),0);assert.equal(c.library.getSnapshot().favorites.length,1);
});
test('confirmation of a replaced preview rejects old conflict choices before PUT',async()=>{
  const one=client(),two=client(one.shared,'c'.repeat(32));await one.configure();await two.configure();
  const id=await one.library.createPlaylist('Original');await cycle(one);await cycle(two);
  await one.library.renamePlaylist(id,'Remote A');await cycle(one);await two.library.renamePlaylist(id,'Local choice');await two.sync.preview();
  const confirmedPreview=two.sync.getSnapshot().preview!,conflictId=confirmedPreview.plan.conflicts[0]!.id,choices:SyncChoices={[conflictId]:'local'};
  await one.library.renamePlaylist(id,'Remote B');await cycle(one);assert.equal(await two.sync.previewIfConfigured(),true);
  const currentPreview=two.sync.getSnapshot().preview!,before=two.library.getSnapshot(),puts=one.shared.puts(),saved=structuredClone(two.records.get('webdav.sync.v1'));
  assert.notEqual(currentPreview,confirmedPreview);assert.equal(currentPreview.plan.conflicts[0]!.id,conflictId);
  await assert.rejects(two.sync.commit(choices,confirmedPreview),error=>error instanceof SyncError&&/预览已改变/.test(error.message));
  assert.equal(one.shared.puts(),puts);assert.equal(two.library.getSnapshot(),before);assert.deepEqual(two.records.get('webdav.sync.v1'),saved);assert.equal(two.sync.getSnapshot().preview,currentPreview);
  await two.sync.commit({[conflictId]:'remote'},currentPreview);assert.equal(two.library.getSnapshot().playlists[0]!.title,'Remote B');
});
test('cancelled preview confirmation cannot apply after a fresh read even with identical content',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('Kept');await c.sync.preview();
  const confirmedPreview=c.sync.getSnapshot().preview!;c.sync.cancel();await c.sync.preview();
  const current=c.sync.getSnapshot().preview!,before=c.library.getSnapshot();
  await assert.rejects(c.sync.commit({},confirmedPreview),error=>error instanceof SyncError&&/预览已改变/.test(error.message));
  assert.equal(c.shared.puts(),0);assert.equal(c.library.getSnapshot(),before);assert.equal(c.sync.getSnapshot().preview,current);
  await c.sync.commit({},current);assert.equal(c.shared.puts(),1);
});
test('edits queued during network commit apply after the atomic restore instead of being overwritten',async()=>{
  const c=client();await c.configure();const id=await c.library.createPlaylist('Old');await c.sync.preview();const entered=deferred(),wait=deferred();c.shared.hooks.beforePut=async()=>{entered.resolve();await wait.promise;};const commit=c.sync.commit();await entered.promise;
  const queued=c.library.renamePlaylist(id,'Queued');assert.equal(c.sync.cancel(),false);await assert.rejects(c.sync.preview(),isError('busy'));wait.resolve();await commit;await queued;assert.equal(c.library.getSnapshot().playlists[0]!.title,'Queued');assert.match(c.sync.getSnapshot().message,/完成/);
});
test('CAS race rejects stale choices, keeps local library and requires another preview',async()=>{
  const one=client(),two=client(one.shared,'c'.repeat(32));await one.configure();await two.configure();await one.library.createPlaylist('One');await cycle(one);await cycle(two);await two.sync.preview();await one.library.favorite(song('race'));await cycle(one);const before=two.library.getSnapshot();await assert.rejects(two.sync.commit(),isError('conflict'));assert.equal(two.library.getSnapshot(),before);assert.equal(two.sync.getSnapshot().preview,undefined);await cycle(two);assert.equal(two.library.getSnapshot().favorites[0]!.origin.id,'race');
});
test('accepted remote PUT and failed local transaction retain the old durable baseline and recover on next preview',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('Old');await cycle(c);const old=structuredClone(c.records.get('webdav.sync.v1'));await c.library.favorite(song('new'));await c.sync.preview();c.fail(true);await assert.rejects(c.sync.commit());assert.deepEqual(c.records.get('webdav.sync.v1'),old);assert.equal(c.library.getSnapshot().favorites.length,1);c.fail(false);await cycle(c);assert.match(c.sync.getSnapshot().message,/完成/);
});
test('connection replacement, removal and canceled reads discard late network results',async()=>{
  for(const action of ['cancel','replace','remove']){
    const c=client();await c.configure();const entered=deferred(),wait=deferred();c.shared.hooks.beforeRead=async()=>{entered.resolve();await wait.promise;};const pending=c.sync.preview();await entered.promise;if(action==='cancel')c.sync.cancel();else c.changeAccount(action==='remove');wait.resolve();await assert.rejects(pending);assert.equal(c.sync.getSnapshot().preview,undefined);assert.equal(c.shared.puts(),0);
  }
});
test('account removal during an accepted PUT prevents cross-account local application',async()=>{
  const c=client();await c.configure();await c.library.favorite(song('before'));await c.sync.preview();const old=c.library.getSnapshot(),entered=deferred(),wait=deferred();c.shared.hooks.beforePut=async()=>{entered.resolve();await wait.promise;};const commit=c.sync.commit();await entered.promise;c.changeAccount(true);wait.resolve();await assert.rejects(commit);assert.equal(c.library.getSnapshot(),old);
});
test('unknown versions, bad payloads, weak ETags and cross-account files fail before local mutation',async()=>{
  const c=client();await c.configure();await c.library.favorite(song('local'));const old=c.library.getSnapshot(),remote=resolveSync(planSync(buildSyncState(emptyLibrary,'d'.repeat(32),account.id,syncDirectory)));
  for(const file of [{body:'{invalid',etag:'"v"'},{body:JSON.stringify({...remote,version:2}),etag:'"v"'},{body:encodeSync(remote),etag:'W/"v"'},{body:encodeSync({...remote,accountId:'d'.repeat(64)}),etag:'"v"'},{body:JSON.stringify({...remote,records:[{id:'playlist:wrong',kind:'playlist',deleted:false,payload:{}}]}),etag:'"v"'}]){c.shared.files.set(account.url+syncDirectory+'library-v1.json',file);await assert.rejects(c.sync.preview());assert.equal(c.library.getSnapshot(),old);assert.equal(c.sync.getSnapshot().preview,undefined);assert.equal(c.shared.puts(),0);}
});
test('directory conflicts and write/readback failures do not change local library',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('One');await c.sync.preview();c.shared.files.set(account.url+syncDirectory,{body:'file',etag:'"v"'});await assert.rejects(c.sync.commit());assert.equal(c.shared.puts(),0);c.shared.files.delete(account.url+syncDirectory);
  const original=c.shared.transport.backup;for(const scenario of ['bad-body','weak-etag','unauthorized']){
    await c.sync.preview();c.shared.transport.backup=async(...args)=>{const result=await original(...args);if(args[3]==='PUT'&&scenario==='weak-etag')return{...result,etag:'W/"v"'};if(args[3]==='GET'&&args[5]&&scenario==='bad-body')return{...result,body:'{}'};if(args[3]==='PUT'&&scenario==='unauthorized')return{...result,status:403};return result;};await assert.rejects(c.sync.commit());assert.equal(c.library.getSnapshot().playlists[0]!.title,'One');c.shared.transport.backup=original;
  }
});
test('history, statistics and settings remain device-local and do not invalidate a collection preview',async()=>{
  const c=client();await c.configure();c.records.set('playbackStats.v1',{fixture:'keep'});c.records.set('preferences.v1',{fixture:'keep'});await c.library.favorite(song('one'));await c.sync.preview();await c.library.played(song('hist'));await c.sync.commit();assert.equal(c.library.getSnapshot().history[0]!.track.origin.id,'hist');assert.deepEqual(c.records.get('playbackStats.v1'),{fixture:'keep'});assert.deepEqual(c.records.get('preferences.v1'),{fixture:'keep'});const remote=decodeSync([...c.shared.files.values()][0]!.body);assert.ok(remote.records.every(value=>value.kind!=='history' as string));
});
test('configuration failure retains old settings; corrupt saved baseline is rejected instead of used',async()=>{
  const c=client();await c.configure();const config=c.sync.getSnapshot().config;c.fail(true);await assert.rejects(c.sync.configure(account.id,'other'));assert.equal(c.sync.getSnapshot().config,config);c.fail(false);c.records.set('webdav.sync.v1',{version:99});await assert.rejects(new WebDAVSync(c.options).restore(),error=>error instanceof InvalidRecordError);
});
test('foreground refresh only previews configured sync and never commits automatically',async()=>{
  const c=client();assert.equal(await c.sync.previewIfConfigured(),false);await c.configure();await c.library.createPlaylist('Foreground');
  assert.equal(await c.sync.previewIfConfigured(),true);assert.ok(c.sync.getSnapshot().preview);assert.equal(c.shared.puts(),0);
  assert.equal(c.sync.getSnapshot().message.includes('确认'),true);
});
test('foreground events during a pending read coalesce into one fresh preview without PUT',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('Before');
  const entered=deferred(),wait=deferred();let reads=0;
  c.shared.hooks.beforeRead=async()=>{reads++;if(reads===1){entered.resolve();await wait.promise;}};
  const initial=c.sync.preview();await entered.promise;
  const refresh=c.sync.previewIfConfigured(),again=c.sync.previewIfConfigured();
  await c.library.createPlaylist('After');wait.resolve();await initial;
  assert.equal(await refresh,true);assert.equal(await again,true);assert.equal(reads,2);assert.equal(c.shared.puts(),0);
  const records=c.sync.getSnapshot().preview!.plan.local.records.filter(value=>value.kind==='playlist'&&!value.deleted);
  assert.equal(records.length,2);
});
test('cancel and connection changes discard queued foreground reads and late responses',async()=>{
  for(const action of ['cancel','replace','remove']){
    const c=client();await c.configure();const entered=deferred(),wait=deferred();let reads=0;
    c.shared.hooks.beforeRead=async()=>{reads++;entered.resolve();await wait.promise;};
    const initial=c.sync.preview();await entered.promise;const refresh=c.sync.previewIfConfigured();
    if(action==='cancel')c.sync.cancel();else c.changeAccount(action==='remove');
    assert.equal(await refresh,false);wait.resolve();await assert.rejects(initial);
    assert.equal(reads,1);assert.equal(c.sync.getSnapshot().preview,undefined);assert.equal(c.shared.puts(),0);
  }
});
test('queued foreground retry after a failed read is bounded and reports its own result',async()=>{
  const c=client();await c.configure();const entered=deferred(),wait=deferred();let reads=0;
  c.shared.hooks.beforeRead=async()=>{reads++;if(reads===1){entered.resolve();await wait.promise;}throw Error('fixture offline');};
  const initial=c.sync.preview();await entered.promise;const refresh=c.sync.previewIfConfigured();
  wait.resolve();await assert.rejects(initial);assert.equal(await refresh,false);
  assert.equal(reads,2);assert.equal(c.shared.puts(),0);assert.equal(c.sync.getSnapshot().preview,undefined);
});
test('late canceled reads cannot consume a new directory foreground request',async()=>{
  for(const failOld of [false,true]){
    const c=client();await c.configure();const oldEntered=deferred(),oldWait=deferred(),newEntered=deferred(),newWait=deferred();let reads=0;
    c.shared.hooks.beforeRead=async()=>{
      const read=++reads;
      if(read===1){oldEntered.resolve();await oldWait.promise;if(failOld)throw Error('old read failed');}
      if(read===2){newEntered.resolve();await newWait.promise;}
    };
    const old=c.sync.preview(),oldRejected=assert.rejects(old);await oldEntered.promise;
    const oldRefresh=c.sync.previewIfConfigured();c.sync.cancel();await c.sync.configure(account.id,'new/');
    assert.equal(await oldRefresh,false);
    const current=c.sync.preview();await newEntered.promise;const newRefresh=c.sync.previewIfConfigured();
    oldWait.resolve();await oldRejected;
    assert.equal(reads,2);assert.equal(c.sync.getSnapshot().busy,'preview');assert.equal(c.sync.getSnapshot().config!.directory,'new/');
    newWait.resolve();await current;assert.equal(await newRefresh,true);
    assert.equal(reads,3);assert.ok(c.sync.getSnapshot().preview);assert.equal(c.shared.puts(),0);
  }
});
test('local collection edits coalesce into one automatic preview without PUT',async()=>{
  const c=client();await c.configure();c.sync.start();
  await c.library.createPlaylist('First');await c.library.favorite(song('one'));await c.library.favorite(song('two'));
  const active=c.timer.active();assert.equal(active.length,1);assert.equal(active[0]!.milliseconds,750);
  await c.timer.runNext();await c.sync.settled();
  assert.equal(c.shared.gets(),1);assert.equal(c.shared.puts(),0);
  const records=c.sync.getSnapshot().preview!.plan.local.records.filter(value=>!value.deleted);
  assert.equal(records.filter(value=>value.kind==='playlist').length,1);
  assert.equal(records.filter(value=>value.kind==='favorite').length,2);
  c.sync.dispose();
});
test('device-local history does not schedule a sync preview',async()=>{
  const c=client();await c.configure();c.sync.start();
  await c.library.played(song('history-only'));
  assert.equal(c.timer.active().length,0);assert.equal(c.shared.gets(),0);assert.equal(c.shared.puts(),0);
  c.sync.dispose();
});
test('background edits wait for the foreground preview instead of issuing hidden reads',async()=>{
  const c=client();await c.configure();c.sync.start();c.sync.setForeground(false);
  await c.library.favorite(song('background'));
  assert.equal(c.timer.active().length,0);assert.equal(c.shared.gets(),0);
  c.sync.setForeground(true);assert.equal(await c.sync.previewIfConfigured(),true);
  assert.equal(c.shared.gets(),1);assert.equal(c.shared.puts(),0);
  assert.equal(c.sync.getSnapshot().preview!.plan.local.records.some(value=>value.kind==='favorite'&&!value.deleted),true);
  c.sync.dispose();
});
test('an edit during preview schedules one fresh follow-up and cannot be confirmed from stale data',async()=>{
  const c=client();await c.configure();c.sync.start();
  const entered=deferred(),wait=deferred();let reads=0;
  c.shared.hooks.beforeRead=async()=>{reads++;if(reads===1){entered.resolve();await wait.promise;}};
  const initial=c.sync.preview();await entered.promise;
  await c.library.createPlaylist('During preview');
  assert.equal(c.timer.active().length,0);
  wait.resolve();await initial;
  const stale=c.sync.getSnapshot().preview!;
  assert.equal(stale.plan.local.records.some(value=>value.kind==='playlist'&&!value.deleted),false);
  assert.equal(c.timer.active().length,1);
  await c.timer.runNext();await c.sync.settled();
  assert.equal(reads,2);assert.equal(c.shared.puts(),0);
  const fresh=c.sync.getSnapshot().preview!;
  assert.notEqual(fresh,stale);
  assert.equal(fresh.plan.local.records.some(value=>value.kind==='playlist'&&!value.deleted),true);
  await assert.rejects(c.sync.commit({},stale),error=>error instanceof SyncError&&/预览已改变/.test(error.message));
  c.sync.dispose();
});
test('foreground refresh requested during commit coalesces into one post-commit preview without concurrent reads',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('One');await c.sync.preview();
  const entered=deferred(),wait=deferred();c.shared.hooks.beforePut=async()=>{entered.resolve();await wait.promise;};
  const puts=c.shared.puts(),gets=c.shared.gets();
  const commit=c.sync.commit();await entered.promise;
  let result:boolean|undefined;const refresh=c.sync.previewIfConfigured();void refresh.then(value=>{result=value;});
  const again=c.sync.previewIfConfigured();await Promise.resolve();
  assert.equal(result,undefined);assert.equal(c.shared.gets(),gets);
  wait.resolve();await commit;assert.equal(await refresh,true);assert.equal(await again,true);
  assert.equal(c.shared.puts(),puts+1);assert.equal(c.shared.gets(),gets+2);
  assert.ok(c.sync.getSnapshot().preview);assert.equal(c.sync.getSnapshot().busy,null);
});
test('a commit finishing in the background discards a queued foreground refresh and performs no hidden read',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('One');await c.sync.preview();
  const entered=deferred(),wait=deferred();c.shared.hooks.beforePut=async()=>{entered.resolve();await wait.promise;};
  const puts=c.shared.puts(),gets=c.shared.gets();
  const commit=c.sync.commit();await entered.promise;
  let result:boolean|undefined;const refresh=c.sync.previewIfConfigured();void refresh.then(value=>{result=value;});
  await Promise.resolve();assert.equal(result,undefined);
  c.sync.setForeground(false);
  assert.equal(await refresh,false);
  wait.resolve();await commit;
  assert.equal(c.shared.puts(),puts+1);assert.equal(c.shared.gets(),gets+1);
  assert.equal(c.sync.getSnapshot().preview,undefined);assert.equal(c.sync.getSnapshot().busy,null);
  c.sync.setForeground(true);assert.equal(await c.sync.previewIfConfigured(),true);
  assert.equal(c.shared.gets(),gets+2);assert.ok(c.sync.getSnapshot().preview);
});
test('background transition during a busy preview cancels a queued refresh instead of reading later',async()=>{
  const c=client();await c.configure();await c.library.createPlaylist('One');c.sync.start();
  const entered=deferred(),wait=deferred();let reads=0;
  c.shared.hooks.beforeRead=async()=>{reads++;entered.resolve();await wait.promise;};
  const initial=c.sync.preview();await entered.promise;const refresh=c.sync.previewIfConfigured();
  c.sync.setForeground(false);assert.equal(await refresh,false);
  wait.resolve();await initial;assert.equal(reads,1);assert.equal(c.shared.puts(),0);
  await c.library.favorite(song('later'));assert.equal(c.timer.active().length,0);
  c.sync.setForeground(true);assert.equal(await c.sync.previewIfConfigured(),true);
  assert.equal(reads,2);assert.equal(c.shared.puts(),0);
  assert.equal(c.sync.getSnapshot().preview!.plan.local.records.some(value=>value.kind==='favorite'&&!value.deleted),true);
  c.sync.dispose();
});
test('connection changes discard a foreground refresh queued during commit before any follow-up read',async()=>{
  for(const action of ['replace','remove']){
    const c=client();await c.configure();await c.library.createPlaylist('One');await c.sync.preview();
    const entered=deferred(),wait=deferred();c.shared.hooks.beforePut=async()=>{entered.resolve();await wait.promise;};
    const puts=c.shared.puts(),gets=c.shared.gets();
    const commit=c.sync.commit();await entered.promise;
    let result:boolean|undefined;const refresh=c.sync.previewIfConfigured();void refresh.then(value=>{result=value;});
    await Promise.resolve();assert.equal(result,undefined);
    c.changeAccount(action==='remove');assert.equal(await refresh,false);
    wait.resolve();await assert.rejects(commit);
    assert.equal(c.shared.puts(),puts+1);assert.equal(c.shared.gets(),gets);
    assert.equal(c.sync.getSnapshot().busy,null);assert.equal(c.sync.getSnapshot().preview,undefined);
  }
});
