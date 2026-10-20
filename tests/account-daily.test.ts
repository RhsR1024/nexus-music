import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountDailyClient,AccountDailyError,localDaily,parseNeteaseDaily} from '../src/providers/accountDaily.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';
import type {Track} from '../src/domain/track.ts';

const account=(overrides:Partial<MusicAccount>={}):MusicAccount=>({id:'a'.repeat(64),platform:'wy',label:'网易云',username:'u',capabilities:['daily'],updatedAt:1,...overrides});
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
  const a=account(),pending=client.fetch(a,{accountId:a.id},new AbortController().signal);a.updatedAt=2;
  release(response([song('1')]));await assert.rejects(pending,(error)=>error instanceof AccountDailyError&&error.kind==='account_changed');
  let releaseCancelled:(value:unknown)=>void=()=>{};const cancelledClient=new AccountDailyClient({http:()=>new Promise(resolve=>{releaseCancelled=resolve;}),endpoint:'https://fixture.test/daily',now:()=>1,day:()=> '2026-10-21'});
  const controller=new AbortController(),cancelled=cancelledClient.fetch(a,{accountId:a.id},controller.signal);controller.abort();releaseCancelled(response([song('1')]));
  await assert.rejects(cancelled,(error)=>error instanceof AccountDailyError&&error.kind==='cancelled');
});

test('daily login/error/empty responses are not represented as successful lists',async()=>{
  for(const result of [{code:401},{code:200,data:{dailySongs:[]}}]){
    const client=new AccountDailyClient({http:async()=>result,endpoint:'https://fixture.test/daily',now:()=>1,day:()=> '2026-10-21'});
    await assert.rejects(client.fetch(account(),{},new AbortController().signal));
  }
});

test('a client without an authenticated endpoint cannot issue an unauthenticated daily request',async()=>{
  const client=new AccountDailyClient({now:()=>1,day:()=> '2026-10-21'});
  await assert.rejects(client.fetch(account(),{},new AbortController().signal),(error)=>error instanceof AccountDailyError&&error.kind==='unavailable');
});

test('local daily fallback remains explicitly tagged local',()=>{
  const track={origin:{kind:'local',id:'one'},title:'Local',artist:'',album:'',metadata:{},qualities:[]} as Track;
  assert.deepEqual(localDaily(account(),[track],'login_required'),{accountId:'a'.repeat(64),platform:'wy',kind:'local',reason:'login_required',tracks:[track]});
});
