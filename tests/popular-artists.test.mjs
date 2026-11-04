import test from 'node:test';
import assert from 'node:assert/strict';
import {ArtistProvider} from '../src/providers/artists.ts';
import {classifyDiscoveryFailure} from '../src/providers/discoveryFailure.ts';

const signal=()=>new AbortController().signal;
const artist=(id)=>({id,name:`Artist ${id}`,picUrl:'https://example.com/cover.jpg',musicSize:50,albumSize:4,accountId:'not-for-storage',followed:true});
const provider=(http)=>new ArtistProvider({http,md5:async()=>'',sha1:async()=>'',deviceId:()=>{throw Error('Public catalog must not use device identity');}});

test('popular catalog pages use public offsets, omit credentials and retain only artist metadata',async()=>{
  const calls=[];
  const p=provider(async(url,request)=>{calls.push({url,request});return{code:200,more:calls.length===1,artists:calls.length===1?[artist('1'),artist('2')]:[artist('3')]};});
  const first=await p.popularNetease(1,signal(),2),second=await p.popularNetease(2,signal(),2);
  assert.equal(new URL(calls[0].url).searchParams.get('offset'),'0');
  assert.equal(new URL(calls[1].url).searchParams.get('offset'),'2');
  assert.equal(new URL(calls[1].url).searchParams.get('limit'),'2');
  assert.equal(new URL(calls[0].url).origin,'https://music.163.com');
  assert.equal(calls[0].request.credentials,'omit');
  assert.equal(calls[0].request.headers.Cookie,undefined);
  assert.deepEqual(first.items[0],{id:'1',title:'Artist 1',artwork:'https://example.com/cover.jpg',songCount:50,albumCount:4});
  assert.equal(first.total,undefined);assert.equal(first.hasMore,true);
  assert.equal(second.page,2);assert.equal(second.hasMore,false);
});

test('popular catalog honors an explicit terminal flag even for a full last page',async()=>{
  const p=provider(async()=>({code:200,more:false,artists:[artist('1')]}));
  assert.equal((await p.popularNetease(1,signal(),1)).hasMore,false);
  const empty=provider(async()=>({code:200,more:false,artists:[]}));
  assert.deepEqual((await empty.popularNetease(1,signal())).items,[]);
});

test('popular catalog rejects malformed, oversized, duplicate and non-progressing pages',async()=>{
  for(const raw of [{code:500,more:false,artists:[]},{code:200,artists:[]},{code:200,more:'false',artists:[]},{code:200,more:true,artists:[]},{code:200,more:false,artists:[artist('1'),artist('2')]},{code:200,more:false,artists:[artist('1'),artist('1')]}]){
    await assert.rejects(provider(async()=>raw).popularNetease(1,signal(),raw.artists?.[0]?.id==='1'&&raw.artists?.[1]?.id==='1'?2:1));
  }
});

test('popular catalog rejects invalid numeric artist identities and unsafe count values',async()=>{
  for(const value of [artist('foreign/id'),artist('singer'),{...artist('1'),musicSize:-1},{...artist('1'),albumSize:Infinity},{...artist('1'),name:''}]){
    await assert.rejects(provider(async()=>({code:200,more:false,artists:[value]})).popularNetease(1,signal()));
  }
});

test('popular catalog validates bounds and pre-cancellation before issuing HTTP',async()=>{
  let calls=0;const p=provider(async()=>{calls++;return{};});
  for(const [page,limit] of [[0,30],[1.5,30],[10001,30],[1,0],[1,101]])await assert.rejects(p.popularNetease(page,signal(),limit));
  const abort=new AbortController();abort.abort();await assert.rejects(p.popularNetease(1,abort.signal));
  assert.equal(calls,0);
});

test('popular catalog ignores a successful HTTP response arriving after cancellation',async()=>{
  const abort=new AbortController();let release;
  const p=provider(()=>new Promise(resolve=>{release=resolve;}));
  const pending=p.popularNetease(1,abort.signal);
  abort.abort();release({code:200,more:false,artists:[artist('1')]});
  await assert.rejects(pending,/取消/);
});

test('popular catalog failures retain the actionable refresh hint without exposing arbitrary server text',()=>{
  const message='热门歌手目录发生变化，请刷新后重试';
  assert.deepEqual(classifyDiscoveryFailure(Error(message)),{kind:'invalid',message,retryable:true});
  assert.equal(classifyDiscoveryFailure(Error(`${message} https://private.invalid/token`)).kind,'unknown');
});
