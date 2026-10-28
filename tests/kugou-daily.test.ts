import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {KugouDailyClient,validKugouDailySession} from '../src/providers/kugouDaily.ts';
import {AccountDailyClient,AccountDailyError} from '../src/providers/accountDaily.ts';
import {HTTPResponseError,type HTTPClient} from '../src/providers/http.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';

const a:MusicAccount={id:'c'.repeat(64),platform:'kg',username:'123',label:'酷狗',capabilities:[],updatedAt:1};
const session={version:1,platform:'kg',userId:'123',mid:'d'.repeat(32),token:'synthetic-token'};
const h=(n:number)=>n.toString(16).padStart(32,'0').toUpperCase();
const md5=async(value:string)=>createHash('md5').update(value).digest('hex');
const sig=()=>new AbortController().signal;
const recommended=(ids:string[])=>({status:1,error_code:0,data:{song_list:ids.map(hash=>({hash}))}});
const detail=(n:number,extra={})=>({songname:`Song ${n}`,author_name:'Public artist',album_info:{album_id:7,album_name:'Album'},audio_info:{hash:h(n),audio_id:n,timelength:230000,filesize:1234,hash_320:h(n+100),filesize_320:4321,...extra}});
const details=(rows:unknown[])=>({error_code:0,data:rows.map(value=>[value])});
const rejectKind=(pending:Promise<unknown>,kind:AccountDailyError['kind'])=>assert.rejects(pending,error=>error instanceof AccountDailyError&&error.kind===kind&&!error.message.includes('synthetic-token'));

test('Kugou daily signs official HTTPS POST, resolves reordered aliases, keeps order and caps at 30',async()=>{
  const calls:{url:string;request:Parameters<HTTPClient>[1]}[]=[];
  const client=new KugouDailyClient({md5,now:()=>1700000000000,http:async(url,request)=>{
    calls.push({url,request});
    return calls.length===1?recommended([h(2),h(1),h(2),...Array.from({length:34},(_,i)=>h(i+3))]):details(Array.from({length:30},(_,i)=>detail(30-i)));
  }});
  const tracks=await client.fetch(a,session,sig());
  assert.equal(tracks.length,30);assert.deepEqual(tracks.slice(0,3).map(t=>t.title),['Song 2','Song 1','Song 3']);
  assert.equal(tracks[0]!.origin.id,`2_${h(2)}`);assert.equal(tracks[0]!.durationMs,230000);assert.equal(tracks[0]!.metadata.songmid,'2');
  assert.deepEqual(tracks[0]!.qualities.map(q=>q.id),['128k','320k']);
  const url=new URL(calls[0]!.url),query=Object.fromEntries(url.searchParams);const signature=query.signature;delete query.signature;
  const salt='OIlwieks28dk2k092lksi2UIkp';assert.equal(signature,await md5(salt+Object.keys(query).sort().map(key=>`${key}=${query[key]}`).join('')+calls[0]!.request.body+salt));
  assert.equal(url.origin,'https://gateway.kugou.com');assert.equal(url.pathname,'/everyday_song_recommend');assert.equal(calls[0]!.request.headers?.['x-router'],'everydayrec.service.kugou.com');
  assert.equal(calls[0]!.request.credentials,'omit');assert.equal(calls[1]!.request.credentials,'omit');assert.ok(!JSON.stringify(calls[1]).includes('synthetic-token'));
});

test('Kugou daily fills only missing details once and fails instead of returning a partial list',async()=>{
  for(const complete of [true,false]){
    let calls=0;const requested:unknown[]=[];
    const client=new KugouDailyClient({md5,http:async(_url,request)=>{
      if(++calls===1)return recommended([h(2),h(1)]);
      requested.push(JSON.parse(request.body!).data);
      return calls===2?details([detail(1)]):details(complete?[detail(2)]:[]);
    }});
    if(complete)assert.deepEqual((await client.fetch(a,session,sig())).map(t=>t.title),['Song 2','Song 1']);else await rejectKind(client.fetch(a,session,sig()),'unavailable');
    assert.equal(calls,3);assert.deepEqual(requested[1],[{hash:h(2)}]);
  }
});

test('Kugou daily matches quality aliases without losing requested order',async()=>{
  let calls=0;const client=new KugouDailyClient({md5,http:async()=>++calls===1?recommended([h(102),h(1)]):details([detail(1),detail(2)])});
  assert.deepEqual((await client.fetch(a,session,sig())).map(t=>t.title),['Song 2','Song 1']);assert.equal(calls,2);
});

test('Kugou multiple quality hashes for one recording yield one playable track',async()=>{
  let calls=0;const client=new KugouDailyClient({md5,http:async()=>++calls===1?recommended([h(101),h(1)]):details([detail(1)])});
  assert.equal((await client.fetch(a,session,sig())).length,1);assert.equal(calls,2);
});

test('Kugou malformed alternate quality hashes are not offered for playback',async()=>{
  let calls=0;const client=new KugouDailyClient({md5,http:async()=>++calls===1?recommended([h(1)]):details([detail(1,{hash_high:'incomplete',filesize_high:12345})])});
  const [track]=await client.fetch(a,session,sig());assert.ok(!track!.qualities.some(q=>q.id==='flac24bit'));
});

test('Kugou daily rejects foreign/invalid sessions before hashing or network',async()=>{
  let calls=0;const client=new KugouDailyClient({md5:async()=>{calls++;return h(1);},http:async()=>{calls++;return{};}});
  for(const invalid of [{...session,userId:'124'},{...session,platform:'wy'},{...session,token:'bad\nsecret'},{...session,mid:'not-a-mid'},{...session,version:2}]){
    assert.equal(validKugouDailySession(a,invalid),false);await rejectKind(client.fetch(a,invalid,sig()),'login_required');
  }
  assert.equal(calls,0);
});

test('Kugou empty is successful; malformed/envelope/transport errors remain redacted errors',async()=>{
  const empty=new KugouDailyClient({md5,http:async()=>recommended([])});assert.deepEqual(await empty.fetch(a,session,sig()),[]);
  for(const response of [{status:0,data:{song_list:[]}},{status:1,error_code:99,data:{song_list:[]}},{status:1,data:{}},recommended(['invalid']),recommended([h(1)])]){
    const client=new KugouDailyClient({md5,http:async()=>response});await rejectKind(client.fetch(a,session,sig()),'unavailable');
  }
  for(const [error,kind] of [[new HTTPResponseError(401),'login_required'],[new Error('https://host?token=synthetic-token'),'unavailable']] as const){
    await rejectKind(new KugouDailyClient({md5,http:async()=>{throw error;}}).fetch(a,session,sig()),kind);
  }
});

test('Kugou cancellation during signature and details cannot return tracks',async()=>{
  let release!:(v:string)=>void;let calls=0;const controller=new AbortController();
  const signing=new KugouDailyClient({md5:()=>new Promise(resolve=>release=resolve),http:async()=>{calls++;return{};}});
  const pending=signing.fetch(a,session,controller.signal);while(!release)await new Promise(resolve=>setImmediate(resolve));controller.abort();release(h(1));await rejectKind(pending,'cancelled');assert.equal(calls,0);
  let releaseDetails!:(v:unknown)=>void;const second=new AbortController();
  const client=new KugouDailyClient({md5,http:async()=>++calls===1?recommended([h(1)]):new Promise(resolve=>releaseDetails=resolve)});
  const request=client.fetch(a,session,second.signal);while(!releaseDetails)await new Promise(resolve=>setImmediate(resolve));second.abort();releaseDetails(details([detail(1)]));await rejectKind(request,'cancelled');
});

test('shared daily cache validates Kugou session and current account before cached or late results',async()=>{
  let current:readonly MusicAccount[]=[a],calls=0;
  const kg=new KugouDailyClient({md5,http:async()=>++calls%2?recommended([h(1)]):details([detail(1)])});
  const client=new AccountDailyClient({accounts:{getSnapshot:()=>current},kugou:kg});
  const first=await client.fetch(a,session,sig());assert.equal(first.kind,'kugou_daily');assert.equal(await client.fetch(a,session,sig()),first);assert.equal(calls,2);
  await rejectKind(client.fetch(a,{...session,userId:'124'},sig()),'login_required');
  current=[{...a}];await rejectKind(client.fetch(a,session,sig()),'account_changed');
  let release!:(value:unknown)=>void;current=[a];
  const late=new AccountDailyClient({accounts:{getSnapshot:()=>current},kugou:new KugouDailyClient({md5,http:()=>new Promise(resolve=>release=resolve)})});
  const pending=late.fetch(a,session,sig());while(!release)await new Promise(resolve=>setImmediate(resolve));current=[];release(recommended([]));await rejectKind(pending,'account_changed');
});

test('Kugou refresh replacement and clear reject late results without caching them',async()=>{
  for(const clear of [false,true]){
    const releases:((value:readonly import('../src/domain/track.ts').Track[])=>void)[]=[];
    const client=new AccountDailyClient({kugou:{validate:()=>true,fetch:()=>new Promise(resolve=>releases.push(resolve))}});
    const old=client.fetch(a,session,sig(),true),oldCheck=rejectKind(old,clear?'account_changed':'cancelled');
    if(clear)client.clear(a.id);
    const next=client.fetch(a,session,sig(),true);releases[1]!([]);const fresh=await next;releases[0]!([]);await oldCheck;
    assert.equal(await client.fetch(a,session,sig()),fresh);assert.equal(releases.length,2);
  }
});
