import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountDailyClient,AccountDailyError,localDaily,parseNeteaseDaily} from '../src/providers/accountDaily.ts';
import {MusicAccounts,type MusicAccount} from '../src/providers/musicAccounts.ts';
import type {Track} from '../src/domain/track.ts';

const account=(overrides:Partial<MusicAccount>={}):MusicAccount=>({id:'a'.repeat(64),platform:'wy',label:'网易云',username:'u',capabilities:['daily'],updatedAt:1,...overrides});
const session=(a:MusicAccount)=>({accountId:a.id,platform:a.platform});
const song=(id:string)=>({id,name:`Synthetic daily ${id}`,ar:[{name:'Fixture'}],al:{name:'Fixture album'},dt:1000});
const response=(rows:unknown[])=>({code:200,data:{dailySongs:rows}});

test('daily parser keeps valid account tracks, drops duplicate/malformed rows and caps at 30',()=>{
  const rows:unknown[]=Array.from({length:35},(_,index)=>song(String(index+1)));rows.push(song('1'),{bad:true});
  const tracks=parseNeteaseDaily(response(rows));
  assert.equal(tracks.length,30);assert.deepEqual(tracks.map(track=>track.origin.id).slice(0,3),['1','2','3']);
});

test('daily result is account-scoped and cached only for the same account revision',async()=>{
  let calls=0;const client=new AccountDailyClient({http:async()=>{calls++;return response([song('1')]);},endpoint:'https://fixture.test/daily',now:()=>1_000_000,day:()=> '2026-10-21'});
  const a=account(),first=await client.fetch(a,{accountId:a.id,platform:'wy'},new AbortController().signal);
  const second=await client.fetch(a,{accountId:a.id,platform:'wy'},new AbortController().signal);
  assert.equal(calls,1);assert.equal(second,first);assert.equal(first.kind,'netease_daily');
  const changed=account({updatedAt:2});await client.fetch(changed,{accountId:changed.id,platform:'wy'},new AbortController().signal);
  assert.equal(calls,2);
});

test('in-flight account replacement and cancellation cannot publish daily tracks',async()=>{
  let release:(value:unknown)=>void=()=>{};const client=new AccountDailyClient({http:()=>new Promise(resolve=>{release=resolve;}),endpoint:'https://fixture.test/daily',now:()=>1,day:()=> '2026-10-21'});
  const a=account(),pending=client.fetch(a,session(a),new AbortController().signal);a.updatedAt=2;
  release(response([song('1')]));await assert.rejects(pending,(error)=>error instanceof AccountDailyError&&error.kind==='account_changed');
  let releaseCancelled:(value:unknown)=>void=()=>{};const cancelledClient=new AccountDailyClient({http:()=>new Promise(resolve=>{releaseCancelled=resolve;}),endpoint:'https://fixture.test/daily',now:()=>1,day:()=> '2026-10-21'});
  const controller=new AbortController(),cancelled=cancelledClient.fetch(a,session(a),controller.signal);controller.abort();releaseCancelled(response([song('1')]));
  await assert.rejects(cancelled,(error)=>error instanceof AccountDailyError&&error.kind==='cancelled');
});

test('daily login/error and malformed responses are not represented as successful lists',async()=>{
  for(const result of [{code:401},{code:200,data:{}},{code:200,data:{dailySongs:[{bad:true}]}}]){
    const client=new AccountDailyClient({http:async()=>result,endpoint:'https://fixture.test/daily',now:()=>1,day:()=> '2026-10-21'});
    await assert.rejects(client.fetch(account(),session(account()),new AbortController().signal));
  }
});

test('a client without an authenticated endpoint cannot issue an unauthenticated daily request',async()=>{
  const client=new AccountDailyClient({now:()=>1,day:()=> '2026-10-21'});
  await assert.rejects(client.fetch(account(),session(account()),new AbortController().signal),(error)=>error instanceof AccountDailyError&&error.kind==='unavailable');
});

test('local daily fallback remains explicitly tagged local',()=>{
  const track={origin:{kind:'local',id:'one'},title:'Local',artist:'',album:'',metadata:{},qualities:[]} as Track;
  assert.deepEqual(localDaily(account(),[track],'login_required'),{accountId:'a'.repeat(64),platform:'wy',kind:'local',reason:'login_required',tracks:[track]});
});

const signal=()=>new AbortController().signal;
const rejectsKind=(pending:Promise<unknown>,kind:AccountDailyError['kind'])=>assert.rejects(pending,error=>error instanceof AccountDailyError&&error.kind===kind);
function deferred(){let resolve!:(value:unknown)=>void,reject!:(error:unknown)=>void;const promise=new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function accountRepository(){
  const records=new Map<string,unknown>(),secrets=new Map<string,string>();
  const accounts=new MusicAccounts({get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{records.set(key,value);}},
    {get:async key=>secrets.get(key)??null,set:async(key,value)=>{secrets.set(key,value);},remove:async key=>{secrets.delete(key);}},async()=> 'a'.repeat(64));
  const save=()=>accounts.save({platform:'wy',label:'网易云',username:'fixture',capabilities:['daily']},{platform:'wy',accountId:'a'.repeat(64),cookies:{MUSIC_U:'synthetic'}});
  return{accounts,save};
}

test('real repository save replacement or removal invalidates in-flight daily even without a clear subscription',async()=>{
  for(const action of ['replace','remove'] as const){
    const repo=accountRepository(),a=await repo.save(),revision=a.updatedAt,pendingResponse=deferred();
    const client=new AccountDailyClient({accounts:repo.accounts,endpoint:'https://fixture.test/daily',http:()=>pendingResponse.promise});
    const pending=client.fetch(a,await repo.accounts.session(a.id),signal());
    if(action==='replace'){const next=await repo.save();assert.notEqual(next,a);}else await repo.accounts.remove(a.id);
    assert.equal(a.updatedAt,revision,'the old object is unchanged, matching production replacement semantics');
    pendingResponse.resolve(response([song('1')]));await rejectsKind(pending,'account_changed');
    await rejectsKind(client.fetch(a,session(a),signal()),'account_changed');
  }
});

test('cached lists validate session and authoritative account before returning',async()=>{
  const repo=accountRepository(),a=await repo.save();let calls=0;
  const client=new AccountDailyClient({accounts:repo.accounts,endpoint:'https://fixture.test/daily',http:async()=>{calls++;return response([song('1')]);}});
  await client.fetch(a,session(a),signal());
  await rejectsKind(client.fetch(a,{accountId:'b'.repeat(64),platform:'wy'},signal()),'account_changed');
  await rejectsKind(client.fetch(a,{accountId:a.id,platform:'tx'},signal()),'account_changed');
  await rejectsKind(client.fetch(a,{},signal()),'login_required');
  await repo.save();await rejectsKind(client.fetch(a,session(a),signal()),'account_changed');
  assert.equal(calls,1);
});

test('clear invalidates late success and error while preserving other account cache',async()=>{
  for(const clearAll of [false,true]){
    const a=account(),b=account({id:'b'.repeat(64)}),late=deferred();let calls=0;
    const client=new AccountDailyClient({endpoint:'https://fixture.test/daily',http:async()=>++calls===2?late.promise:response([song(String(calls))])});
    await client.fetch(b,session(b),signal());const pending=client.fetch(a,session(a),signal());
    client.clear(clearAll?undefined:a.id);late.resolve(response([song('late')]));await rejectsKind(pending,'account_changed');
    const bResult=await client.fetch(b,session(b),signal());assert.equal(bResult.tracks[0]!.origin.id,clearAll?'3':'1');
    const fresh=await client.fetch(a,session(a),signal());assert.notEqual(fresh.tracks[0]!.origin.id,'late');
  }
  const a=account(),late=deferred(),client=new AccountDailyClient({endpoint:'https://fixture.test/daily',http:()=>late.promise});
  const pending=client.fetch(a,session(a),signal());client.clear(a.id);late.reject({status:401});await rejectsKind(pending,'account_changed');
});

test('reverse-order forced refreshes cannot publish or cache an older response',async()=>{
  const a=account(),old=deferred(),fresh=deferred();let calls=0;
  const client=new AccountDailyClient({endpoint:'https://fixture.test/daily',http:()=>++calls===1?old.promise:fresh.promise});
  const first=client.fetch(a,session(a),signal(),true),second=client.fetch(a,session(a),signal(),true);
  fresh.resolve(response([song('2')]));const latest=await second;
  old.resolve(response([song('1')]));await rejectsKind(first,'cancelled');
  assert.equal(await client.fetch(a,session(a),signal()),latest);assert.equal(calls,2);
});

test('empty daily lists are successful and cached; malformed lists and error codes with data fail',async()=>{
  const a=account();let calls=0;const empty=new AccountDailyClient({endpoint:'https://fixture.test/daily',http:async()=>{calls++;return response([]);}});
  assert.deepEqual((await empty.fetch(a,session(a),signal())).tracks,[]);await empty.fetch(a,session(a),signal());assert.equal(calls,1);
  for(const code of [301,401,403,500,undefined]){
    const client=new AccountDailyClient({endpoint:'https://fixture.test/daily',http:async()=>({code,data:{dailySongs:[song('1')]}})});
    await rejectsKind(client.fetch(a,session(a),signal()),code!==undefined&&[301,401,403].includes(code)?'login_required':'unavailable');
  }
});

test('cache expiry and a changed day fetch fresh data; yesterday in-flight cannot publish',async()=>{
  let now=0,day='2026-10-23',calls=0;const a=account();
  const client=new AccountDailyClient({endpoint:'https://fixture.test/daily',now:()=>now,day:()=>day,http:async()=>response([song(String(++calls))])});
  const first=await client.fetch(a,session(a),signal());now=599999;assert.equal(await client.fetch(a,session(a),signal()),first);
  now=600000;assert.equal((await client.fetch(a,session(a),signal())).tracks[0]!.origin.id,'2');
  day='2026-10-24';assert.equal((await client.fetch(a,session(a),signal())).tracks[0]!.origin.id,'3');
  const late=deferred(),rollover=new AccountDailyClient({endpoint:'https://fixture.test/daily',day:()=>day,http:()=>late.promise});
  const pending=rollover.fetch(a,session(a),signal());day='2026-10-25';late.resolve(response([song('4')]));await rejectsKind(pending,'cancelled');
});
