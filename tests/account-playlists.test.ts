import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountPlaylists,AccountPlaylistError} from '../src/providers/accountPlaylists.ts';
import {LibraryStore} from '../src/storage/library.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';
import type {Repository} from '../src/storage/repository.ts';

const owner:MusicAccount={id:'a'.repeat(64),platform:'wy',username:'netease:123',label:'协议测试',updatedAt:1,capabilities:[]};
const song=(id='451703096',name='Shape of You')=>({id,name,ar:[{id:'1',name:'Ed Sheeran'}],al:{id:'1',name:'÷',picUrl:'https://p1.music.126.net/public.jpg'},dt:233744,h:{size:3740360,token:'unit-only-hidden'}});
const catalog=(id='10')=>({id,name:'公开曲目协议样本',trackCount:2,creator:{userId:'123'},coverImgUrl:'https://p1.music.126.net/public.jpg'});
const signal=()=>new AbortController().signal;
const reject=(promise:Promise<unknown>,kind:AccountPlaylistError['kind'])=>assert.rejects(promise,error=>error instanceof AccountPlaylistError&&error.kind===kind);
function setup(){
  let current:readonly MusicAccount[]=[owner],serial=0,profileId='123',stored:unknown,session:Record<string,unknown>={platform:'wy',accountId:owner.id,userId:'123',cookies:{MUSIC_U:'unit-only'}};
  const calls:string[]=[];
  let serve:(path:string)=>Promise<unknown>=async path=>path.endsWith('user/playlist')?{code:200,playlist:[catalog()],more:false}:path.endsWith('v6/playlist/detail')?{code:200,playlist:{id:'10',trackIds:[{id:'451703096'},{id:'461347998'}],trackCount:2}}:{code:200,songs:[song('461347998','Perfect'),song()],privileges:[{id:'451703096'},{id:'461347998'}]};
  let write:((value:unknown)=>Promise<void>)|undefined;
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>stored as T,put:async(_,value)=>{if(write)await write(value);stored=structuredClone(value);}};
  const library=new LibraryStore(repository,()=>String(++serial));
  const client=new AccountPlaylists({accounts:{getSnapshot:()=>current,session:async()=>session},profile:{fetch:async()=>({userId:profileId,nickname:'协议测试'})},library,http:async(url,request)=>{
    calls.push(url);assert.match(url,/^https:\/\/music\.163\.com\/weapi\//);assert.equal(request.method,'POST');assert.equal(request.credentials,'omit');assert.equal(request.headers?.Cookie,'MUSIC_U=unit-only');assert.ok(typeof request.body==='string');assert.ok(request.body.startsWith('params='));assert.ok(!request.body.includes('unit-only'));return serve(url);
  }});
  return {client,library,repository,calls,serve:(next:typeof serve)=>{serve=next;},accounts:(next:readonly MusicAccount[])=>{current=next;},profile:(id:string)=>{profileId=id;},session:(value:Record<string,unknown>)=>{session=value;},write:(next:typeof write)=>{write=next;}};
}

test('account playlist copy preserves complete ID order and keeps credentials out of local snapshots',async()=>{
  const s=setup(),lists=await s.client.list(owner,signal());assert.equal(lists[0]?.kind,'created');
  const preview=await s.client.preview(owner,lists[0]!,signal());assert.deepEqual(preview.tracks.map(t=>t.origin.id),['451703096','461347998']);
  assert.ok(!JSON.stringify(preview).includes('unit-only-hidden'));
  await s.client.importPreview(owner,preview,signal());const restored=new LibraryStore(s.repository,()=> 'unused');await restored.restore();
  assert.deepEqual(restored.getSnapshot().playlists[0]?.entries.map(e=>e.track.title),['Shape of You','Perfect']);
  assert.equal(s.calls.length,3);assert.ok(!JSON.stringify(restored.getSnapshot()).includes('MUSIC_U'));await reject(s.client.importPreview(owner,preview,signal()),'account_changed');
});
test('catalog pagination has no partial success when a more page repeats or is empty',async()=>{
  for(const second of [[],[catalog()]]){
    const s=setup();let page=0;s.serve(async()=>({code:200,playlist:page++===0?[catalog()]:second,more:true}));
    await reject(s.client.list(owner,signal()),'incomplete');assert.equal(s.calls.length,2);
  }
});
test('catalog separates created and collected lists and accepts an explicit successful empty catalog',async()=>{
  const s=setup();let page=0;s.serve(async()=>page++===0?{code:200,playlist:[catalog()],more:true}:{code:200,playlist:[{...catalog('11'),creator:{userId:'456'}}],more:false});
  assert.deepEqual((await s.client.list(owner,signal())).map(v=>v.kind),['created','favorite']);
  s.serve(async()=>({code:200,playlist:[],more:false}));assert.deepEqual(await s.client.list(owner,signal()),[]);
});
test('identity conflicts and malformed sessions fail before playlist requests',async()=>{
  const s=setup();s.profile('456');await reject(s.client.list(owner,signal()),'login_required');assert.equal(s.calls.length,0);
  s.session({cookies:{MUSIC_U:'unit-only'}});await reject(s.client.list(owner,signal()),'login_required');assert.equal(s.calls.length,0);
});
test('missing songs, privileges, duplicate IDs and mismatched totals never produce an import preview',async()=>{
  for(const detail of [
    {id:'10',trackIds:[{id:'451703096'}],trackCount:2},
    {id:'10',trackIds:[{id:'451703096'},{id:'451703096'}],trackCount:2},
    {id:'11',trackIds:[],trackCount:0},
  ]){
    const s=setup(),lists=await s.client.list(owner,signal());s.serve(async()=>({code:200,playlist:detail}));await reject(s.client.preview(owner,lists[0]!,signal()),'incomplete');
  }
  for(const response of [{songs:[song()],privileges:[{id:'451703096'},{id:'461347998'}]},{songs:[song(),song('461347998','Perfect')],privileges:[{id:'451703096'}]}]){
    const s=setup(),lists=await s.client.list(owner,signal());s.serve(async url=>url.endsWith('v6/playlist/detail')?{code:200,playlist:{id:'10',trackIds:[{id:'451703096'},{id:'461347998'}],trackCount:2}}:{code:200,...response});await reject(s.client.preview(owner,lists[0]!,signal()),'incomplete');
  }
});
test('a late catalog cannot survive cancellation or same-timestamp account replacement',async()=>{
  for(const cancel of [true,false]){
    const s=setup(),controller=new AbortController();let release!:(value:unknown)=>void;
    s.serve(()=>new Promise(resolve=>{release=resolve;}));const pending=s.client.list(owner,controller.signal);
    while(!release)await new Promise(resolve=>setImmediate(resolve));
    if(cancel)controller.abort();else s.accounts([{...owner}]);
    release({code:200,playlist:[catalog()],more:false});await reject(pending,cancel?'cancelled':'account_changed');
  }
});
test('refresh invalidates old previews and malformed server errors stay redacted',async()=>{
  const s=setup(),lists=await s.client.list(owner,signal()),preview=await s.client.preview(owner,lists[0]!,signal());
  await s.client.list(owner,signal());await reject(s.client.importPreview(owner,preview,signal()),'account_changed');assert.equal(s.library.getSnapshot().playlists.length,0);
  s.serve(async()=>{throw new Error('unit-only-hidden credential body');});
  await assert.rejects(s.client.list(owner,signal()),error=>error instanceof AccountPlaylistError&&!error.message.includes('unit-only-hidden'));
});
test('cancellation or removal during a local write rolls back before publishing and does not poison later library writes',async()=>{
  for(const cancel of [true,false]){
    const s=setup(),lists=await s.client.list(owner,signal()),preview=await s.client.preview(owner,lists[0]!,signal()),controller=new AbortController();
    let release!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});let writes=0,published=0;
    s.library.subscribe(()=>published++);s.write(async()=>{if(++writes===1){entered();await new Promise<void>(r=>{release=r;});}});
    const pending=s.client.importPreview(owner,preview,controller.signal);await started;
    const later=s.library.createPlaylist('后续设备歌单');if(cancel)controller.abort();else s.accounts([]);release();
    await reject(pending,cancel?'cancelled':'account_changed');await later;assert.equal(published,1);
    assert.deepEqual(s.library.getSnapshot().playlists.map(p=>p.title),['后续设备歌单']);
    const restored=new LibraryStore(s.repository,()=> 'unused');await restored.restore();assert.deepEqual(restored.getSnapshot().playlists.map(p=>p.title),['后续设备歌单']);
  }
});

test('detail batches preserve all IDs including long integers and allow an explicit empty snapshot',async()=>{
  for(const ids of [[],['90071992547409931234',...Array.from({length:200},(_,i)=>String(i+1))]]){
    const s=setup(),lists=await s.client.list(owner,signal());let batch=0;
    s.serve(async path=>{
      if(path.endsWith('v6/playlist/detail'))return{code:200,playlist:{id:'10',trackCount:ids.length,trackIds:ids.map(id=>({id}))}};
      const group=ids.slice(batch++*200,batch*200);return{code:200,songs:group.slice().reverse().map(id=>song(id)),privileges:group.map(id=>({id}))};
    });
    const preview=await s.client.preview(owner,lists[0]!,signal());assert.deepEqual(preview.tracks.map(t=>t.origin.id),ids);assert.equal(batch,Math.ceil(ids.length/200));
    await s.client.importPreview(owner,preview,signal());assert.equal(s.library.getSnapshot().playlists[0]?.entries.length,ids.length);
  }
});
test('a duplicate copy cannot queue two local playlists from the same preview',async()=>{
  const s=setup(),lists=await s.client.list(owner,signal()),preview=await s.client.preview(owner,lists[0]!,signal());
  let release!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});
  s.write(async()=>{entered();await new Promise<void>(r=>{release=r;});});
  const first=s.client.importPreview(owner,preview,signal());await started;await reject(s.client.importPreview(owner,preview,signal()),'unavailable');release();await first;
  assert.equal(s.library.getSnapshot().playlists.length,1);
});
test('a committed copy is successful even if the account is removed by a commit subscriber',async()=>{
  const s=setup(),lists=await s.client.list(owner,signal()),preview=await s.client.preview(owner,lists[0]!,signal());
  s.library.subscribe(()=>s.accounts([]));assert.ok(await s.client.importPreview(owner,preview,signal()));assert.equal(s.library.getSnapshot().playlists.length,1);
});
test('failed local persistence stays redacted and can retry without fetching a personal playlist again',async()=>{
  const s=setup(),lists=await s.client.list(owner,signal()),preview=await s.client.preview(owner,lists[0]!,signal());
  s.write(async()=>{throw new Error('unit-only-hidden');});await reject(s.client.importPreview(owner,preview,signal()),'unavailable');assert.equal(s.library.getSnapshot().playlists.length,0);
  s.write(undefined);await s.client.importPreview(owner,preview,signal());assert.equal(s.calls.length,3);assert.equal(s.library.getSnapshot().playlists.length,1);
});
test('invalid pagination and counts fail, while credential-bearing cover links are never stored',async()=>{
  for(const value of [{code:200,playlist:[]},{code:200,playlist:[{...catalog(),trackCount:10001}],more:false}]){
    const s=setup();s.serve(async()=>value);await reject(s.client.list(owner,signal()),'incomplete');
  }
  const s=setup();s.serve(async()=>({code:200,playlist:[{...catalog(),coverImgUrl:'https://p1.music.126.net/cover.jpg?token=unit-only-hidden'}],more:false}));assert.equal((await s.client.list(owner,signal()))[0]?.coverUrl,'');
});
