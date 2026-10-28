import test from 'node:test';
import assert from 'node:assert/strict';
import {QQDailyClient,validQQDailySession,validQQDailyKey} from '../src/providers/qqDaily.ts';
import {AccountDailyClient,AccountDailyError} from '../src/providers/accountDaily.ts';
import {HTTPResponseError,type HTTPClient} from '../src/providers/http.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';

const a:MusicAccount={id:'b'.repeat(64),platform:'tx',label:'QQ',username:'qq:2:123',capabilities:[],updatedAt:1};
const session={version:1,platform:'tx',accountId:a.id,userId:'123',cookies:{login_type:'1',uin:'o000123',qqmusic_key:'synthetic-cookie'}};
const key='qmk-synthetic_key_1234';
const signal=()=>new AbortController().signal;
const song=(id:string)=>({mid:id,title:`Sample ${id}`,singer:[{name:'Artist'}],album:{mid:'album123',name:'Album'},file:{media_mid:id,size_128mp3:1000},interval:230});
const response=(calls:Record<string,any>):Record<string,any>=>({code:0,...Object.fromEntries(Object.keys(calls).filter(k=>k!=='comm').map(k=>[k,{code:0,data:calls[k].method==='GetRadarSong'?{VecSongs:[]}:{track_info:song(calls[k].param.song_mid)}}]))});
const failKind=(pending:Promise<unknown>,kind:AccountDailyError['kind'])=>assert.rejects(pending,error=>error instanceof AccountDailyError&&error.kind===kind&&!/synthetic-cookie|qmk-/.test(error.message));
function service(radar:(page:number)=>unknown[]){
  const calls:{url:string;request:Parameters<HTTPClient>[1]}[]=[];
  const http:HTTPClient=async(url,request)=>{
    calls.push({url,request});const body=JSON.parse(request.body!);
    if(body.radio)return{code:0,radio:{code:0,data:{VecSongs:radar(body.radio.param.Page)}}};
    return response(body);
  };return{http,calls};
}

test('QQ radar preserves page order, deduplicates, caps 30 and resolves authenticated detail batches',async()=>{
  const svc=service(page=>Array.from({length:20},(_,i)=>({Track:{mid:`m${(page-1)*15+i}`}})));
  const result=await new QQDailyClient({http:svc.http}).fetch(a,session,signal());
  assert.equal(result.kind,'tx_radar');assert.equal(result.reason,'');assert.equal(result.tracks.length,30);
  assert.deepEqual(result.tracks.slice(0,3).map(x=>x.origin.id),['m0','m1','m2']);assert.equal(result.tracks[29]!.origin.id,'m29');
  assert.equal(result.tracks[0]!.durationMs,230000);assert.equal(result.tracks[0]!.metadata.strMediaMid,'m0');
  assert.equal(svc.calls.length,5);
  for(const call of svc.calls){assert.equal(call.url,'https://u.y.qq.com/cgi-bin/musicu.fcg');assert.equal(call.request.credentials,'omit');assert.match(call.request.headers!.Cookie!,/qqmusic_key=synthetic-cookie/);const comm=JSON.parse(call.request.body!).comm;assert.equal(comm.uin,'123');assert.equal(comm.tmeLoginType,2);assert.equal(comm.ct,19);}
});

test('QQ radar reads four bounded pages, supports known row envelopes and treats empty as empty',async()=>{
  const svc=service(page=>[{track_info:{songmid:`m${page}`}}]);const result=await new QQDailyClient({http:svc.http}).fetch(a,session,signal());
  assert.deepEqual(result.tracks.map(x=>x.origin.id),['m1','m2','m3','m4']);assert.equal(svc.calls.filter(c=>JSON.parse(c.request.body!).radio).length,4);
  const empty=await new QQDailyClient({http:service(()=>[]).http}).fetch(a,session,signal());assert.deepEqual(empty.tracks,[]);assert.equal(empty.kind,'tx_radar');
});

test('QQ official key uses a separate origin and Bearer header; successful official daily never calls radar',async()=>{
  const seen:{url:string;request:Parameters<HTTPClient>[1]}[]=[];
  const client=new QQDailyClient({http:async(url,request)=>{seen.push({url,request});if(url.includes('daily-mix'))return{ret:0,sub_ret:0,songlist:[{songMid:'m2'},{songMid:'m1'},{songMid:'m2'}]};return response(JSON.parse(request.body!));}});
  const result=await client.fetch(a,{...session,qqDailyKey:key},signal());assert.equal(result.kind,'tx_official_daily');assert.deepEqual(result.tracks.map(x=>x.origin.id),['m2','m1']);
  assert.equal(seen[0]!.url,'https://a.y.qq.com/discover/daily-mix');assert.equal(seen[0]!.request.headers!.Authorization,`Bearer ${key}`);
  assert.ok(!seen[0]!.url.includes(key));assert.ok(!JSON.stringify(seen[1]).includes(key));assert.equal(seen.length,2);
});

test('QQ invalid/empty/unavailable official daily falls back explicitly to radar',async()=>{
  for(const official of [{ret:401},{ret:0,songlist:[]},{ret:0,songlist:[{songMid:'invalid!'}]}]){
    const svc=service(page=>page===1?[{mid:'m1'}]:[]);
    const client=new QQDailyClient({http:async(url,request,s)=>url.includes('daily-mix')?official:svc.http(url,request,s)});
    const result=await client.fetch(a,{...session,qqDailyKey:key},signal());assert.equal(result.kind,'tx_radar');assert.equal(result.reason,'official_unavailable');assert.equal(result.tracks[0]!.origin.id,'m1');
  }
});

test('QQ official authorization validates nonempty IDs without persisting or returning keys',async()=>{
  assert.equal(validQQDailyKey(key),true);assert.equal(validQQDailyKey('qmk-short'),false);assert.equal(validQQDailyKey(key+'\n'),false);
  const good=new QQDailyClient({http:async()=>({ret:0,songlist:[{songMid:'m1'}]})});assert.equal(await good.validateKey(a,session,key,signal()),undefined);
  await failKind(new QQDailyClient({http:async()=>({ret:0,songlist:[]})}).validateKey(a,session,key,signal()),'unavailable');
});

test('QQ rejects foreign account, WX identity and malformed cookie before network',async()=>{
  let calls=0;const client=new QQDailyClient({http:async()=>{calls++;return{};}});
  for(const invalid of [{...session,accountId:'c'.repeat(64)},{...session,userId:'124'},{...session,platform:'wy'},{...session,cookies:{...session.cookies,login_type:'2'}},{...session,cookies:{...session.cookies,qqmusic_key:'bad;cookie'}}]){
    assert.equal(validQQDailySession(a,invalid),false);await failKind(client.fetch(a,invalid,signal()),'login_required');
  }
  assert.equal(calls,0);
});

test('QQ detail batch failure retries individually; missing or wrong recordings fail the entire list',async()=>{
  for(const wrong of [false,true]){
    let batch=0,individual=0;const svc=service(page=>page===1?[{mid:'m1'},{mid:'m2'}]:[]);
    const client=new QQDailyClient({http:async(url,request,s)=>{
      const calls=JSON.parse(request.body!);if(calls.radio)return svc.http(url,request,s);
      if(calls.detail_0){batch++;throw Error('batch unavailable');}
      individual++;const result=response(calls);if(wrong)result.detail.data.track_info.mid='wrong';return result;
    }});
    if(wrong)await failKind(client.fetch(a,session,signal()),'unavailable');else assert.deepEqual((await client.fetch(a,session,signal())).tracks.map(x=>x.origin.id),['m1','m2']);
    assert.equal(batch,1);assert.equal(individual,2);
  }
});

test('QQ malformed radar/envelopes and expired credentials are errors, not empty recommendations',async()=>{
  for(const [result,kind] of [[{code:0,radio:{code:0,data:{}}},'unavailable'],[{code:401},'login_required'],[{code:0,radio:{code:104401,data:{}}},'login_required']] as const){await failKind(new QQDailyClient({http:async()=>result}).fetch(a,session,signal()),kind);}
  for(const [error,kind] of [[new HTTPResponseError(403),'login_required'],[new Error('synthetic-cookie token leaked by transport'),'unavailable']] as const){await failKind(new QQDailyClient({http:async()=>{throw error;}}).fetch(a,session,signal()),kind);}
});

test('QQ cancellation cannot fall back or return a late radar response',async()=>{
  let release!:(value:unknown)=>void;const controller=new AbortController();
  const client=new QQDailyClient({http:()=>new Promise(resolve=>release=resolve)}),pending=client.fetch(a,{...session,qqDailyKey:key},controller.signal);
  while(!release)await new Promise(resolve=>setImmediate(resolve));controller.abort();release({ret:0,songlist:[]});await failKind(pending,'cancelled');
});

test('QQ shared cache checks current account/session; clear and replacement reject late lists',async()=>{
  let current:readonly MusicAccount[]=[a];const svc=service(()=>[]),qq=new QQDailyClient({http:svc.http});
  const client=new AccountDailyClient({accounts:{getSnapshot:()=>current},qq});const first=await client.fetch(a,session,signal());assert.equal(first.kind,'tx_radar');assert.equal(await client.fetch(a,session,signal()),first);
  await failKind(client.fetch(a,{...session,userId:'124'},signal()),'login_required');current=[{...a}];await failKind(client.fetch(a,session,signal()),'account_changed');
  for(const clear of [true,false]){
    current=[a];let release!:(value:{kind:'tx_radar';reason:'';tracks:[]})=>void;
    const late=new AccountDailyClient({accounts:{getSnapshot:()=>current},qq:{validate:()=>true,fetch:()=>new Promise(resolve=>release=resolve)}});
    const pending=late.fetch(a,session,signal());if(clear)late.clear(a.id);else current=[];release({kind:'tx_radar',reason:'',tracks:[]});await failKind(pending,'account_changed');
  }
});
