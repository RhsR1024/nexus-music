import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountRecommendedPlaylists,AccountRecommendedPlaylistsError} from '../src/providers/accountRecommendedPlaylists.ts';
import {HTTPResponseError,type HTTPClient} from '../src/providers/http.ts';
import type {MusicAccount,MusicSession} from '../src/providers/musicAccounts.ts';

const wyAccount:MusicAccount={id:'a'.repeat(64),platform:'wy',label:'网易云',username:'netease:9000000000000000001',capabilities:[],updatedAt:1};
const wySession:MusicSession={version:1,platform:'wy',accountId:wyAccount.id,userId:'9000000000000000001',cookies:{MUSIC_U:'synthetic-recommend',__csrf:'synthetic-csrf'}};
const txAccount:MusicAccount={id:'b'.repeat(64),platform:'tx',label:'QQ',username:'qq:2:9000000000000000002',capabilities:[],updatedAt:1};
const txSession:MusicSession={version:1,platform:'tx',accountId:txAccount.id,userId:'9000000000000000002',cookies:{login_type:'1',qqmusic_uin:'9000000000000000002',qqmusic_key:'synthetic-qq-recommend'}};
const signal=()=>new AbortController().signal;
const failure=(pending:Promise<unknown>,kind:AccountRecommendedPlaylistsError['kind'])=>assert.rejects(pending,error=>error instanceof AccountRecommendedPlaylistsError&&error.kind===kind&&!/synthetic|cookie/i.test(error.message));
const neteaseRow=(id:number,title=`Synthetic playlist ${id}`)=>({id,name:title,picUrl:`https://fixture.test/cover-${id}.jpg`,trackCount:id+1,intro:`Description ${id}`,creator:{nickname:'Fixture creator'}});
const neteaseResponse=(rows:unknown[])=>({code:200,recommend:rows});
const qqResponse=(rows:unknown[])=>({code:0,req:{code:0,data:{FeedRsp:{List:rows}}}});
const qqRow=(id:number,title=`Synthetic QQ playlist ${id}`)=>({Playlist:{basic:{tid:String(9000+id),title,cover:{medium_url:`https://fixture.test/qq-${id}.jpg`},creator:{nick:'QQ creator'},song_cnt:id+2,desc:`QQ description ${id}`}}});

test('NetEase recommended playlists preserve bounded order, deduplicate and send an authenticated request',async()=>{
  let seen:{url:string;request:Parameters<HTTPClient>[1]}|undefined;
  const client=new AccountRecommendedPlaylists({http:async(url,request)=>{seen={url,request};return neteaseResponse([neteaseRow(2),neteaseRow(1),neteaseRow(2),{id:'bad',name:''}]);}});
  const result=await client.list(wyAccount,wySession,signal());
  assert.deepEqual(result.map(item=>item.id),['2','1']);
  assert.equal(result[0]!.platform,'wy');assert.equal(result[0]!.title,'Synthetic playlist 2');
  assert.equal(result[0]!.count,3);assert.equal(result[0]!.author,'Fixture creator');
  assert.equal(seen?.url,'https://music.163.com/weapi/v1/discovery/recommend/resource');
  assert.equal(seen?.request.method,'POST');
  assert.match(seen?.request.headers?.Cookie??'',/MUSIC_U=synthetic-recommend/);
  assert.match(seen?.request.body??'',/^params=[^&]+&encSecKey=[a-f0-9]{256}$/);
  assert.doesNotMatch(seen?.request.body??'',/Synthetic playlist|synthetic-recommend/);
});

test('QQ recommended playlists use the account-bound GetRecommendFeed boundary',async()=>{
  let seen:{url:string;request:Parameters<HTTPClient>[1]}|undefined;
  const client=new AccountRecommendedPlaylists({http:async(url,request)=>{seen={url,request};return qqResponse([qqRow(2),qqRow(1),qqRow(2),{Playlist:{basic:{tid:'bad',title:''}}}]);}});
  const result=await client.list(txAccount,txSession,signal());
  assert.deepEqual(result.map(item=>item.id),['9002','9001']);
  assert.equal(result[0]!.platform,'tx');assert.equal(result[0]!.count,4);
  assert.equal(result[0]!.author,'QQ creator');assert.equal(result[0]!.description,'QQ description 2');
  assert.equal(seen?.url,'https://u.y.qq.com/cgi-bin/musicu.fcg');
  assert.match(seen?.request.headers?.Cookie??'',/qqmusic_key=synthetic-qq-recommend/);
  const body=JSON.parse(seen?.request.body??'{}');
  assert.deepEqual(body.req,{module:'music.playlist.PlaylistSquare',method:'GetRecommendFeed',param:{From:0,Size:30}});
  assert.equal(body.comm.uin,'9000000000000000002');assert.equal(body.comm.tmeLoginType,2);assert.equal(body.comm.ct,24);
  assert.doesNotMatch(seen?.url??'',/synthetic-qq-recommend/);
});

test('empty recommendations are successful; malformed non-empty responses are failures',async()=>{
  assert.deepEqual(await new AccountRecommendedPlaylists({http:async()=>neteaseResponse([])}).list(wyAccount,wySession,signal()),[]);
  assert.deepEqual(await new AccountRecommendedPlaylists({http:async()=>qqResponse([])}).list(txAccount,txSession,signal()),[]);
  await failure(new AccountRecommendedPlaylists({http:async()=>neteaseResponse([{id:'bad',name:''}])}).list(wyAccount,wySession,signal()),'unavailable');
  await failure(new AccountRecommendedPlaylists({http:async()=>qqResponse([{Playlist:{basic:{tid:'bad',title:''}}}])}).list(txAccount,txSession,signal()),'unavailable');
  for(const response of [{code:200},{code:500,recommend:[neteaseRow(1)]}]){
    await failure(new AccountRecommendedPlaylists({http:async()=>response}).list(wyAccount,wySession,signal()),response.code===200?'unavailable':'unavailable');
  }
  for(const response of [{code:0,req:{code:0,data:{}}},{code:0,req:{code:500,data:{FeedRsp:{List:[]}}}}]){
    await failure(new AccountRecommendedPlaylists({http:async()=>response}).list(txAccount,txSession,signal()),'unavailable');
  }
});

test('expired sessions and foreign accounts are rejected before network',async()=>{
  let calls=0;const client=new AccountRecommendedPlaylists({http:async()=>{calls++;return neteaseResponse([]);}});
  for(const invalid of [
    {...wySession,accountId:'c'.repeat(64)},
    {...wySession,platform:'tx'},
    {...wySession,userId:'9000000000000000009'},
    {...wySession,cookies:{__csrf:'missing-music-u'}},
  ])await failure(client.list(wyAccount,invalid as MusicSession,signal()),'login_required');
  for(const invalid of [
    {...txSession,version:2},
    {...txSession,userId:'9000000000000000009'},
    {...txSession,cookies:{...(txSession.cookies as Record<string,string>),login_type:'2'}},
    {...txSession,cookies:{...(txSession.cookies as Record<string,string>),qqmusic_key:'bad;cookie'}},
  ])await failure(client.list(txAccount,invalid as MusicSession,signal()),'login_required');
  await failure(client.list({...wyAccount,platform:'kg'} as MusicAccount,{...wySession,platform:'kg'} as MusicSession,signal()),'unavailable');
  assert.equal(calls,0);
});

test('HTTP auth failures map to login_required without exposing transport details',async()=>{
  for(const error of [new HTTPResponseError(401),new HTTPResponseError(403),new Error('synthetic-cookie leaked by transport')]){
    await failure(new AccountRecommendedPlaylists({http:async()=>{throw error;}}).list(wyAccount,wySession,signal()),error instanceof HTTPResponseError?'login_required':'unavailable');
  }
  await failure(new AccountRecommendedPlaylists({http:async()=>({code:401})}).list(wyAccount,wySession,signal()),'login_required');
  await failure(new AccountRecommendedPlaylists({http:async()=>({code:0,req:{code:104401,data:{}}})}).list(txAccount,txSession,signal()),'login_required');
});

test('recommended playlists are cached per account revision; account replacement and clear reject late data',async()=>{
  let current:readonly MusicAccount[]=[wyAccount],calls=0,release!:(value:unknown)=>void;
  const client=new AccountRecommendedPlaylists({accounts:{getSnapshot:()=>current},now:()=>1000,http:async()=>{calls++;return neteaseResponse([neteaseRow(1)]);}});
  const first=await client.list(wyAccount,wySession,signal());assert.equal(await client.list(wyAccount,wySession,signal()),first);assert.equal(calls,1);
  const changed={...wyAccount,updatedAt:2};current=[changed];
  await client.list(changed,wySession,signal());assert.equal(calls,2);
  current=[wyAccount];
  const pendingClient=new AccountRecommendedPlaylists({accounts:{getSnapshot:()=>current},http:()=>new Promise(resolve=>{release=resolve;})});
  const pending=pendingClient.list(wyAccount,wySession,signal());
  current=[];release(neteaseResponse([neteaseRow(1)]));await failure(pending,'account_changed');
  current=[wyAccount];const late=pendingClient.list(wyAccount,wySession,signal());
  pendingClient.clear(wyAccount.id);release(neteaseResponse([neteaseRow(2)]));await failure(late,'account_changed');
});

test('cancellation cannot publish or cache a late recommendation response',async()=>{
  let release!:(value:unknown)=>void;const controller=new AbortController(),client=new AccountRecommendedPlaylists({http:()=>new Promise(resolve=>{release=resolve;})});
  const pending=client.list(wyAccount,wySession,controller.signal);
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  controller.abort();release(neteaseResponse([neteaseRow(1)]));await failure(pending,'cancelled');
  await failure(new AccountRecommendedPlaylists({http:async()=>{throw new Error('offline');}}).list(wyAccount,wySession,signal()),'unavailable');
});
