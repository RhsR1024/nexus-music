import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountHeartbeat,AccountHeartbeatError,NETEASE_HEARTBEAT_COUNT,NETEASE_HEARTBEAT_DETAIL_BATCH} from '../src/providers/accountHeartbeat.ts';
import {HTTPResponseError,type HTTPClient} from '../src/providers/http.ts';
import type {MusicAccount,MusicSession} from '../src/providers/musicAccounts.ts';
import {onlineTrack} from '../src/providers/online.ts';

const account:MusicAccount={id:'a'.repeat(64),platform:'wy',label:'网易云',username:'netease:9000000000000000001',capabilities:['daily','fm'],updatedAt:1};
const session:MusicSession={version:1,platform:'wy',accountId:account.id,userId:'9000000000000000001',cookies:{MUSIC_U:'synthetic-heartbeat',__csrf:'synthetic-csrf'}};
const signal=()=>new AbortController().signal;
const failure=(pending:Promise<unknown>,kind:AccountHeartbeatError['kind'])=>assert.rejects(pending,error=>error instanceof AccountHeartbeatError&&error.kind===kind&&!/synthetic|cookie|MUSIC_U|csrf/i.test(error.message));
const song=(id:string|number,title=`Synthetic heartbeat ${id}`)=>({id:String(id),name:title,ar:[{id:'fixture-artist',name:'Heartbeat artist'}],al:{id:'fixture-album',name:'Heartbeat album',picUrl:`https://fixture.test/${id}.jpg`},dt:120000,l:{size:1000},h:{size:2000}});
const track=(id:string|number)=>onlineTrack('wy',song(id));
const detail=(ids:readonly (string|number)[])=>({code:200,songs:ids.map(id=>song(id))});
const rows=(ids:readonly (string|number)[],asInfo=(index:number)=>index%2===0)=>({code:200,data:{list:ids.map((id,index)=>asInfo(index)?{songInfo:{id:String(id)}}:{song:{id:String(id)}})}});
const favoritePlaylist={id:'7001',name:'我喜欢的音乐',specialType:10,creator:{userId:'9000000000000000001'}};
const userPlaylists=(playlist:unknown[]=[favoritePlaylist])=>({code:200,playlist});
const path=(url:string)=>new URL(url).pathname.replace(/^\/weapi\//,'');

test('current liked song seeds an ordered, deduplicated heartbeat queue through playlist detail',async()=>{
  const calls:{url:string;request:Parameters<HTTPClient>[1]}[]=[];
  const client=new AccountHeartbeat({accounts:{getSnapshot:()=>[account]},http:async(url,request)=>{
    calls.push({url,request});
    if(path(url)==='user/playlist')return userPlaylists([
      {id:'7000',name:'Other private list',specialType:10,creator:{userId:'9000000000000000009'}},
      {...favoritePlaylist,specialType:'10'},
    ]);
    if(path(url)==='v3/playlist/detail')return{code:200,playlist:{trackIds:[{id:'9902'},{id:'9901'},{id:'9902'}]}};
    if(path(url)==='v3/song/detail')return detail([9901,9902,1101,1102,1103]);
    if(path(url)==='playmode/intelligence/list')return rows([1101,1102,9902,1101,1103]);
    throw new Error(`unexpected ${url}`);
  }});
  const result=await client.start(account,session,track(9902),signal());
  assert.equal(NETEASE_HEARTBEAT_COUNT,300);
  assert.equal(NETEASE_HEARTBEAT_DETAIL_BATCH,500);
  assert.equal(result.source,'current');
  assert.deepEqual(result.tracks.map(item=>item.origin.id),['9902','1101','1102','1103']);
  assert.deepEqual(result.seed.origin,{kind:'online',platform:'wy',id:'9902'});
  assert.deepEqual(calls.map(call=>path(call.url)),['user/playlist','v3/playlist/detail','v3/song/detail','playmode/intelligence/list','v3/song/detail']);
  assert.equal(calls.some(call=>path(call.url)==='song/like/get'),false);
  const intelligence=calls.find(call=>path(call.url)==='playmode/intelligence/list')!;
  assert.equal(intelligence.request.method,'POST');
  assert.match(intelligence.request.headers?.Cookie??'',/MUSIC_U=synthetic-heartbeat/);
  assert.match(intelligence.request.body??'',/^params=[^&]+&encSecKey=[a-f0-9]{256}$/);
  assert.doesNotMatch(intelligence.request.body??'',/synthetic-heartbeat|fixture-artist/);
  assert.doesNotMatch(calls.map(call=>call.url).join('\n'),/synthetic-heartbeat|csrf/i);
});

test('liked playlist order falls back to likelist and a non-liked current song selects a random liked seed',async()=>{
  const calls:string[]=[];
  const client=new AccountHeartbeat({random:()=>0.4,http:async(url)=>{
    calls.push(path(url));
    if(path(url)==='user/playlist')return userPlaylists();
    if(path(url)==='v3/playlist/detail')return{code:503};
    if(path(url)==='song/like/get')return{code:200,ids:[9903,9901,9903,9902]};
    if(path(url)==='v3/song/detail')return detail([9901,9902,9903,1104]);
    if(path(url)==='playmode/intelligence/list')return rows([1104]);
    throw new Error(`unexpected ${url}`);
  }});
  const result=await client.start(account,session,track(8888),signal());
  assert.equal(result.source,'liked');
  assert.equal(result.seed.origin.id,'9901');
  assert.deepEqual(result.tracks.map(item=>item.origin.id),['9901','1104']);
  assert.deepEqual(calls,['user/playlist','v3/playlist/detail','song/like/get','v3/song/detail','playmode/intelligence/list','v3/song/detail']);
});

test('favorite playlist, empty likes, missing details and recommendation emptiness have exact failure states',async()=>{
  await failure(new AccountHeartbeat({http:async url=>path(url)==='user/playlist'?userPlaylists([{id:'7000',name:'Not liked',specialType:10,creator:{userId:'9000000000000000009'}}]):{code:200}}).start(account,session,undefined,signal()),'favorite_playlist_missing');
  await failure(new AccountHeartbeat({http:async url=>{
    if(path(url)==='user/playlist')return userPlaylists();
    if(path(url)==='v3/playlist/detail')return{code:200,playlist:{trackIds:[]}};
    throw new Error('must not fetch recommendation for empty likes');
  }}).start(account,session,undefined,signal()),'liked_empty');
  await failure(new AccountHeartbeat({http:async url=>{
    if(path(url)==='user/playlist')return userPlaylists();
    if(path(url)==='v3/playlist/detail')return{code:200,playlist:{trackIds:[{id:'9901'}]}};
    if(path(url)==='v3/song/detail')return{code:200,songs:[]};
    throw new Error('must not fetch recommendation without a seed');
  }}).start(account,session,undefined,signal()),'seed_unavailable');
  for(const list of [[],[{songInfo:{id:'9901'}}]]){
    await failure(new AccountHeartbeat({http:async url=>{
      if(path(url)==='user/playlist')return userPlaylists();
      if(path(url)==='v3/playlist/detail')return{code:200,playlist:{trackIds:[{id:'9901'}]}};
      if(path(url)==='v3/song/detail')return detail([9901]);
      if(path(url)==='playmode/intelligence/list')return{code:200,data:{list}};
      throw new Error(`unexpected ${url}`);
    }}).start(account,session,undefined,signal()),'recommendations_empty');
  }
});

test('expired sessions and foreign identity are rejected before network',async()=>{
  let calls=0;const client=new AccountHeartbeat({http:async()=>{calls++;return userPlaylists();}});
  for(const invalid of [
    {...session,accountId:'c'.repeat(64)},
    {...session,platform:'tx'},
    {...session,userId:'9000000000000000009'},
    {...session,cookies:{__csrf:'missing-music-u'}},
    {...session,cookies:{MUSIC_U:''}},
  ])await failure(client.start(account,invalid as MusicSession,undefined,signal()),'login_required');
  await failure(client.start({...account,platform:'kg'} as MusicAccount,{...session,platform:'kg'} as MusicSession,undefined,signal()),'unavailable');
  assert.equal(calls,0);
});

test('authentication and transport failures map to stable terminal kinds without leaking details',async()=>{
  for(const error of [new HTTPResponseError(401),new HTTPResponseError(403)]){
    await failure(new AccountHeartbeat({http:async()=>{throw error;}}).start(account,session,undefined,signal()),'login_required');
  }
  await failure(new AccountHeartbeat({http:async()=>{throw new Error('synthetic-heartbeat leaked by transport')}}).start(account,session,undefined,signal()),'unavailable');
  for(const response of [{code:401},{code:503},{}]){
    await failure(new AccountHeartbeat({http:async()=>response}).start(account,session,undefined,signal()),response.code===401?'login_required':'unavailable');
  }
});

test('liked detail errors propagate and malformed recommendation rows fail explicitly',async()=>{
  await failure(new AccountHeartbeat({http:async url=>{
    if(path(url)==='user/playlist')return userPlaylists();
    if(path(url)==='v3/playlist/detail')return{code:200,playlist:{trackIds:[{id:'9901'},{id:'9902'}]}};
    if(path(url)==='v3/song/detail')return{code:503};
    throw new Error('intelligence must not start after liked detail failure');
  }}).start(account,session,undefined,signal()),'unavailable');
  await failure(new AccountHeartbeat({http:async url=>{
    if(path(url)==='user/playlist')return userPlaylists();
    if(path(url)==='v3/playlist/detail')return{code:200,playlist:{trackIds:[{id:'9901'}]}};
    if(path(url)==='v3/song/detail')return detail([9901]);
    if(path(url)==='playmode/intelligence/list')return{code:200,data:{list:[{songInfo:{}},{song:{}}]}};
    throw new Error(`unexpected ${url}`);
  }}).start(account,session,undefined,signal()),'unavailable');
});

test('recommendation detail batching keeps successful batches after one 500-row batch fails',async()=>{
  const likedIds=Array.from({length:501},(_,index)=>String(2000+index));
  const recommendedIds=Array.from({length:501},(_,index)=>String(3000+index));
  let details=0;
  const result=await new AccountHeartbeat({random:()=>0,http:async url=>{
    if(path(url)==='user/playlist')return userPlaylists();
    if(path(url)==='v3/playlist/detail')return{code:200,playlist:{trackIds:likedIds.map(id=>({id}))}};
    if(path(url)==='playmode/intelligence/list')return rows(recommendedIds);
    if(path(url)==='v3/song/detail'){
      details++;
      if(details<=2)return detail(likedIds);
      if(details===3)return{code:503};
      return detail(recommendedIds);
    }
    throw new Error(`unexpected ${url}`);
  }}).start(account,session,undefined,signal());
  assert.equal(details,4);
  assert.deepEqual(result.tracks.map(item=>item.origin.id),['2000','3500']);
});

test('cancellation, account replacement, clear and superseding operations reject late responses',async()=>{
  for(const action of ['abort','account','clear'] as const){
    let release!:(value:unknown)=>void,current:readonly MusicAccount[]=[account];
    const controller=new AbortController(),client=new AccountHeartbeat({accounts:{getSnapshot:()=>current},http:()=>new Promise(resolve=>{release=resolve;})});
    const pending=client.start(account,session,undefined,controller.signal);
    while(!release)await new Promise(resolve=>setImmediate(resolve));
    if(action==='abort')controller.abort();
    else if(action==='account')current=[{...account,updatedAt:2}];
    else client.clear(account.id);
    release(userPlaylists());
    await failure(pending,action==='abort'?'cancelled':'account_changed');
  }

  let releases:((value:unknown)=>void)[]=[],calls=0;
  const client=new AccountHeartbeat({http:()=>new Promise(resolve=>{releases[calls++]=resolve;})});
  const first=client.start(account,session,undefined,signal());
  while(releases.length<1)await new Promise(resolve=>setImmediate(resolve));
  const second=client.start(account,session,undefined,signal());
  while(releases.length<2)await new Promise(resolve=>setImmediate(resolve));
  releases[0]!(userPlaylists());
  await failure(first,'account_changed');
  releases[1]!({code:503});
  await failure(second,'unavailable');
});
