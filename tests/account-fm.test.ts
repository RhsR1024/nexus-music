import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountFmClient,AccountFmError,parseNeteaseFm} from '../src/providers/accountFm.ts';
import {MusicAccounts,type MusicAccount} from '../src/providers/musicAccounts.ts';

const account=(overrides:Partial<MusicAccount>={}):MusicAccount=>({id:'a'.repeat(64),platform:'wy',label:'网易云',username:'u',capabilities:['fm'],updatedAt:1,...overrides});
const session=(a:MusicAccount)=>({accountId:a.id,platform:a.platform,cookies:{MUSIC_U:'synthetic'}});
const song=(id:string)=>({id,name:`Synthetic FM ${id}`,artists:[{name:'Fixture'}],album:{name:'Fixture album',picUrl:'https://fixture.test/cover.jpg'},duration:1000});
const response=(rows:unknown[])=>({code:200,data:rows});
const rejectsKind=(pending:Promise<unknown>,kind:AccountFmError['kind'])=>assert.rejects(pending,error=>error instanceof AccountFmError&&error.kind===kind);
function deferred(){let resolve!:(value:unknown)=>void,reject!:(error:unknown)=>void;const promise=new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

test('FM parser keeps valid rows, drops duplicates and malformed rows, and caps at 30',()=>{
  const rows:unknown[]=Array.from({length:35},(_,index)=>song(String(index+1)));rows.push(song('1'),{bad:true});
  const tracks=parseNeteaseFm(response(rows));
  assert.equal(tracks.length,30);assert.deepEqual(tracks.slice(0,3).map(track=>track.origin.id),['1','2','3']);
});

test('FM preloads one bounded batch, serves successive tracks, and force replaces it',async()=>{
  let calls=0;const client=new AccountFmClient({http:async()=>{calls++;return response([song('1'),song('2'),song('3')]);},endpoint:'https://fixture.test/fm',trashEndpoint:'https://fixture.test/trash',now:()=>1_000_000});
  const a=account();
  assert.equal(await client.preload(a,session(a),new AbortController().signal),3);
  assert.equal((await client.next(a,session(a),new AbortController().signal))?.origin.id,'1');
  assert.equal((await client.next(a,session(a),new AbortController().signal))?.origin.id,'2');
  assert.equal(calls,1);
  const list=await client.load(a,session(a),new AbortController().signal);
  assert.deepEqual(list.map(track=>track.origin.id),['3']);
  const refreshed=await client.load(a,session(a),new AbortController().signal,true);
  assert.deepEqual(refreshed.map(track=>track.origin.id),['1','2','3']);assert.equal(calls,2);
});

test('FM discard posts the reference trash payload and removes the track without refetching',async()=>{
  const seen:string[]=[];const client=new AccountFmClient({http:async(url,request)=>{seen.push(url);assert.match(request.headers?.Cookie??'',/MUSIC_U=synthetic/);return url.endsWith('/trash')?{code:200}:response([song('1'),song('2')]);},endpoint:'https://fixture.test/fm',trashEndpoint:'https://fixture.test/trash'});
  const a=account();
  await client.load(a,session(a),new AbortController().signal);
  await client.discard(a,session(a),'1',new AbortController().signal);
  assert.deepEqual(seen,['https://fixture.test/fm','https://fixture.test/trash']);
  assert.equal((await client.next(a,session(a),new AbortController().signal))?.origin.id,'2');
  assert.equal(seen.length,2);
});

test('FM cancellation and account replacement cannot publish an in-flight batch',async()=>{
  const a=account(),pending=deferred();
  const client=new AccountFmClient({http:()=>pending.promise,endpoint:'https://fixture.test/fm',trashEndpoint:'https://fixture.test/trash'});
  const request=client.load(a,session(a),new AbortController().signal);a.updatedAt=2;
  pending.resolve(response([song('1')]));
  await rejectsKind(request,'account_changed');
  const controller=new AbortController(),cancelled=deferred();
  const second=new AccountFmClient({http:()=>cancelled.promise,endpoint:'https://fixture.test/fm',trashEndpoint:'https://fixture.test/trash'});
  const request2=second.load(account(),session(account()),controller.signal);controller.abort();cancelled.resolve(response([song('1')]));
  await rejectsKind(request2,'cancelled');
});

test('FM empty batches are successful and cached; errors and missing sessions are not tracks',async()=>{
  let calls=0;const empty=new AccountFmClient({http:async()=>{calls++;return response([]);},endpoint:'https://fixture.test/fm'});
  const a=account();
  assert.deepEqual(await empty.load(a,session(a),new AbortController().signal),[]);
  assert.deepEqual(await empty.load(a,session(a),new AbortController().signal),[]);
  assert.equal(calls,1);assert.equal(await empty.next(a,session(a),new AbortController().signal),null);
  let guarded=0;const noCookies=new AccountFmClient({http:async()=>{guarded++;return response([song('1')]);},endpoint:'https://fixture.test/fm'});
  await rejectsKind(noCookies.load(a,{accountId:a.id,platform:'wy'},new AbortController().signal),'login_required');
  assert.equal(guarded,0);
  for(const result of [{code:401},{code:200,data:{}},{code:200,data:[{bad:true}]},{code:500,data:[song('1')]}]){
    const client=new AccountFmClient({http:async()=>result,endpoint:'https://fixture.test/fm'});
    await rejectsKind(client.load(a,session(a),new AbortController().signal),[301,401,403].includes(Number(result.code))?'login_required':'unavailable');
  }
});

test('FM cache follows the authoritative account object and a replacement invalidates it',async()=>{
  const records=new Map<string,unknown>(),secrets=new Map<string,string>();
  const accounts=new MusicAccounts({get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{records.set(key,value);}},
    {get:async key=>secrets.get(key)??null,set:async(key,value)=>{secrets.set(key,value);},remove:async key=>{secrets.delete(key);}},async()=> 'a'.repeat(64));
  const a=await accounts.save({platform:'wy',label:'网易云',username:'fixture',capabilities:['fm']},{platform:'wy',accountId:'a'.repeat(64),cookies:{MUSIC_U:'synthetic'}});
  let calls=0;const client=new AccountFmClient({accounts,http:async()=>response([song(String(++calls))]),endpoint:'https://fixture.test/fm'});
  await client.load(a,await accounts.session(a.id),new AbortController().signal);
  await accounts.save({platform:'wy',label:'网易云',username:'fixture',capabilities:['fm']},{platform:'wy',accountId:'a'.repeat(64),cookies:{MUSIC_U:'synthetic'}});
  await rejectsKind(client.load(a,await accounts.session(a.id),new AbortController().signal),'account_changed');
  client.clear(a.id);
  const fresh=accounts.getSnapshot()[0]!;
  assert.equal((await client.load(fresh,await accounts.session(fresh.id),new AbortController().signal))[0]?.origin.id,'2');
});

test('legacy accounts saved without capabilities still load FM while other platforms stay unavailable',async()=>{
  const legacy=account({capabilities:[]});let calls=0;
  const client=new AccountFmClient({http:async()=>{calls++;return response([song('1')]);},endpoint:'https://fixture.test/fm'});
  assert.equal((await client.load(legacy,session(legacy),new AbortController().signal))[0]?.origin.id,'1');
  const other=account({platform:'tx',capabilities:[]});
  await rejectsKind(client.load(other,session(other),new AbortController().signal),'unavailable');
  assert.equal(calls,1);
});

test('FM clear is account-scoped and keeps other stations cached',async()=>{
  const a=account(),b=account({id:'b'.repeat(64)});let calls=0;
  const client=new AccountFmClient({accounts:{getSnapshot:()=>[a,b]},http:async()=>response([song(String(++calls))]),endpoint:'https://fixture.test/fm'});
  assert.equal((await client.load(a,session(a),new AbortController().signal))[0]?.origin.id,'1');
  assert.equal((await client.load(b,session(b),new AbortController().signal))[0]?.origin.id,'2');
  client.clear(a.id);
  assert.equal((await client.load(b,session(b),new AbortController().signal))[0]?.origin.id,'2');
  assert.equal(calls,2);
  assert.equal((await client.load(a,session(a),new AbortController().signal))[0]?.origin.id,'3');
});
