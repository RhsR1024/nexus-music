import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NavidromeClient, NavidromeError, navidromeTrack, normalizeServerURL } from '../src/providers/navidrome.ts';
import { NavidromeAccounts, type SecretStore } from '../src/providers/navidromeAccounts.ts';
import type { Repository } from '../src/storage/repository.ts';

const md5=async(value:string)=>createHash('md5').update(value).digest('hex');
const account={id:'account-one',url:'http://example.test/navidrome',username:'user'};
function client(response:(method:string,params:URLSearchParams)=>unknown) {
  let salt=0;
  return new NavidromeClient(account,{username:'user',password:'fixture-password'},{md5,salt:()=>`salt-${++salt}`,
    http:async(url,request)=>{
      assert.equal(request.method,'POST');assert.ok(!url.includes('fixture-password'));assert.ok(!url.includes('?'));
      const params=new URLSearchParams(request.body);assert.equal(params.get('t'),await md5('fixture-password'+params.get('s')));
      assert.equal(params.has('p'),false);
      return response(url.split('/').at(-1)!.replace('.view',''),params);
    }});
}
const ok=(body:Record<string,unknown>={})=>({'subsonic-response':{status:'ok',version:'1.16.1',...body}});

test('Navidrome uses per-request salt/token and keeps reverse proxy base path',async()=>{
  const salts:string[]=[];
  const api=client((method,params)=>{salts.push(params.get('s')!);return method==='ping'?ok({type:'navidrome',serverVersion:'0.64.0'}):ok({openSubsonicExtensions:[{name:'songLyrics',versions:[1]}]});});
  const result=await api.connect();assert.equal(result.serverVersion,'0.64.0');assert.notEqual(salts[0],salts[1]);
  assert.equal(normalizeServerURL('https://example.test/navidrome/rest/'),'https://example.test/navidrome');
  assert.throws(()=>normalizeServerURL('https://user:secret@example.test'));
});
test('unsupported extensions do not prevent an otherwise successful connection',async()=>{
  const api=client(method=>method==='ping'?ok():{'subsonic-response':{status:'failed',error:{code:70,message:'missing'}}});
  assert.deepEqual((await api.connect()).extensions,[]);
});
test('server messages cannot leak through authentication or permission errors',async()=>{
  const denied=client(()=>({'subsonic-response':{status:'failed',error:{code:40,message:'PRIVATE_PASSWORD_OR_URL'}}}));
  await assert.rejects(denied.connect(),error=>error instanceof NavidromeError&&error.kind==='authentication'&&!error.message.includes('PRIVATE'));
  const forbidden=client(()=>({'subsonic-response':{status:'failed',error:{code:50}}}));
  await assert.rejects(forbidden.star('song',true),error=>error instanceof NavidromeError&&error.kind==='permission');
});
test('pagination and raw stream keep identity without persisting authenticated artwork URLs',async()=>{
  const api=client((method,params)=>{
    assert.equal(method,'search3');assert.equal(params.get('songOffset'),'100');
    return ok({searchResult3:{song:[{id:'90071992547409931234',title:'Fixture',artist:'Artist',coverArt:'cover-id',suffix:'flac',duration:12}]}});
  });
  const page=await api.songs('',100);assert.equal(page.items[0]!.origin.id,'90071992547409931234');assert.equal(page.items[0]!.artwork,undefined);
  assert.equal(page.items[0]!.metadata.coverArtId,'cover-id');assert.ok(!JSON.stringify(page.items).includes('fixture-password'));
  const media=await api.resolve(page.items[0]!,new AbortController().signal);const url=new URL(media.url);
  assert.equal(url.pathname,'/navidrome/rest/stream.view');assert.equal(url.searchParams.get('format'),'raw');assert.equal(url.searchParams.has('p'),false);
});
test('playlist edits preserve duplicate order and repeated parameter names',async()=>{
  const calls:Array<{method:string;params:URLSearchParams}>=[];
  const api=client((method,params)=>{calls.push({method,params});return ok({playlist:{id:'list',name:'Fixture',owner:'user'}});});
  await api.savePlaylist('Fixture',['one','one','two'],'list');
  assert.deepEqual(calls[0]!.params.getAll('songId'),['one','one','two']);
  await api.changePlaylist('list',['three','four'],[3,1]);
  assert.deepEqual(calls[1]!.params.getAll('songIndexToRemove'),['3','1']);assert.deepEqual(calls[1]!.params.getAll('songIdToAdd'),['three','four']);
  await api.renamePlaylist('list','New');assert.equal(calls[2]!.method,'updatePlaylist');
  await api.deletePlaylist('list');assert.equal(calls[3]!.method,'deletePlaylist');
});
test('missing original-media attributes remain unknown',()=>{
  const track=navidromeTrack('account',{id:'one',title:'Fixture',duration:null});
  assert.equal(track.durationMs,undefined);assert.equal(track.metadata.bitDepth,undefined);
});

function accountStore() {
  const records=new Map<string,string>(),secrets=new Map<string,string>();let failWrite=false;
  const repository:Pick<Repository,'get'|'put'>={
    get:async<T>(key:string)=>records.has(key)?JSON.parse(records.get(key)!) as T:undefined,
    put:async(key,value)=>{if(failWrite)throw new Error('fixture');records.set(key,JSON.stringify(value));},
  };
  const keychain:SecretStore={get:async key=>secrets.get(key)??null,set:async(key,value)=>{secrets.set(key,value);},remove:async key=>{secrets.delete(key);}};
  const create=(profile:typeof account,credentials:{username:string;password:string})=>new NavidromeClient(profile,credentials,{md5,salt:()=> 'fixture-salt',http:async()=>ok()});
  const store=new NavidromeAccounts(repository,keychain,async value=>createHash('sha256').update(value).digest('hex'),create);
  return {store,records,secrets,fail:()=>{failWrite=true;}};
}
test('account persistence separates Keychain material and restores sessions',async()=>{
  const {store,records,secrets}=accountStore();await store.restore();
  const result=await store.connect(account.url,'user','fixture-password');
  assert.ok(![...records.values()].join('').includes('fixture-password'));assert.ok([...secrets.values()].join('').includes('fixture-password'));
  assert.ok(await store.client(result.account.id));
  await store.remove(result.account.id);assert.equal(secrets.size,0);await assert.rejects(store.client(result.account.id));
});
test('failed profile commit rolls back the new Keychain material',async()=>{
  const {store,secrets,fail}=accountStore();await store.restore();fail();
  await assert.rejects(store.connect(account.url,'user','fixture-password'));
  assert.equal(secrets.size,0);assert.deepEqual(store.getSnapshot(),[]);
});

test('Navidrome requests enhanced structured lyrics and retains legacy fallback without swallowing auth errors',async()=>{
  const structured={structuredLyrics:[{synced:true,line:[{start:0,value:'Synthetic'}]}]},calls:string[]=[];
  const enhanced=client((method,params)=>{calls.push(method);assert.equal(params.get('enhanced'),'true');assert.equal(params.get('id'),'song');return ok({lyricsList:structured});});
  assert.deepEqual(await enhanced.lyrics('song','Fixture','Synthetic'),structured);assert.deepEqual(calls,['getLyricsBySongId']);
  const old=client((method,params)=>method==='getLyricsBySongId'?{'subsonic-response':{status:'failed',error:{code:70}}}:ok({lyrics:{value:'Legacy'}}));
  assert.deepEqual(await old.lyrics('song','Fixture','Synthetic'),{value:'Legacy'});
  const denied=client(()=>({'subsonic-response':{status:'failed',error:{code:40}}}));
  await assert.rejects(denied.lyrics('song','Fixture','Synthetic'),error=>error instanceof NavidromeError&&error.kind==='authentication');
});
