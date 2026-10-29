import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountAlbums,AccountAlbumError,parseAccountAlbumPage} from '../src/providers/accountAlbums.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';
const owner:MusicAccount={id:'a'.repeat(64),platform:'wy',username:'netease:123',label:'Protocol-only account',updatedAt:1,capabilities:[]};
const album=(id='10')=>({id,name:'Public catalog contract',artists:[{name:'Public artist'}],size:16,picUrl:'https://images.example/public.jpg',token:'unit-only',songs:[{id:'1'}]});
const page=(data:unknown[]= [album()],count=data.length,hasMore=false)=>({code:200,data,count,hasMore});
const signal=()=>new AbortController().signal;
const rejected=(value:Promise<unknown>,kind:AccountAlbumError['kind'])=>assert.rejects(value,error=>error instanceof AccountAlbumError&&error.kind===kind);
function setup(){
 let accounts:readonly MusicAccount[]=[owner],profileId='123',session:Record<string,unknown>={platform:'wy',accountId:owner.id,userId:'123',cookies:{MUSIC_U:'unit-only'}};
 let serve:()=>Promise<unknown>=async()=>page();let calls=0;
 const client=new AccountAlbums({accounts:{getSnapshot:()=>accounts,session:async()=>session},profile:{fetch:async()=>({userId:profileId,nickname:'Protocol-only account'})},http:async(url,request)=>{calls++;assert.equal(url,'https://music.163.com/weapi/album/sublist');assert.equal(request.method,'POST');assert.equal(request.credentials,'omit');assert.equal(request.headers?.Cookie,'MUSIC_U=unit-only');assert.ok(typeof request.body==='string'&&request.body.startsWith('params='));assert.ok(!String(request.body).includes('unit-only'));return serve();}});
 return{client,calls:()=>calls,serve:(v:typeof serve)=>serve=v,accounts:(v:readonly MusicAccount[])=>accounts=v,profile:(v:string)=>profileId=v,session:(v:Record<string,unknown>)=>session=v};
}
test('account album parser keeps only safe public descriptors and separates actual empty from malformed',()=>{
 const value=parseAccountAlbumPage(page()).items[0]!;assert.deepEqual(value,{kind:'album',platform:'wy',id:'10',title:'Public catalog contract',artwork:'https://images.example/public.jpg',author:'Public artist',count:16});assert.ok(Object.isFrozen(value));assert.deepEqual(parseAccountAlbumPage(page([])),{items:[],count:0,more:false});
 for(const value of[{code:200},{...page(),count:-1},{...page(),hasMore:'false'},page([album(),album()]),page([{...album(),id:9007199254740992}]),page([{...album(),name:''}]),page([{...album(),size:NaN}])])assert.throws(()=>parseAccountAlbumPage(value),AccountAlbumError);
});
test('account albums load a complete stable paged catalog and bind item objects',async()=>{
 const f=setup();let turn=0;f.serve(async()=>++turn===1?page([album('10')],2,true):page([album('11')],2));const items=await f.client.list(owner,signal());assert.equal(f.calls(),2);assert.deepEqual(items.map(v=>v.id),['10','11']);assert.ok(Object.isFrozen(items));f.client.assertMember(owner,items[0]!);assert.throws(()=>f.client.assertMember(owner,{...items[0]!}),AccountAlbumError);
});
test('account album reader does not publish partial, looping or changing catalogs',async()=>{
 for(const responses of[[page([album()],2)],[page([album()],2,true),page([album()],2)],[page([album()],2,true),page([album('11')],3)],[page([],1,true)]]){
  const f=setup();let turn=0;f.serve(async()=>responses[turn++]!);await rejected(f.client.list(owner,signal()),'incomplete');assert.throws(()=>f.client.assertMember(owner,parseAccountAlbumPage(page()).items[0]!),AccountAlbumError);
 }
});
test('account albums require exact current owner, session and freshly verified profile before catalog request',async()=>{
 const variants=[(f:ReturnType<typeof setup>)=>f.accounts([]),(f:ReturnType<typeof setup>)=>f.session({platform:'wy',accountId:owner.id,userId:'456',cookies:{MUSIC_U:'unit-only'}}),(f:ReturnType<typeof setup>)=>f.session({platform:'tx',accountId:owner.id,userId:'123',cookies:{MUSIC_U:'unit-only'}}),(f:ReturnType<typeof setup>)=>f.profile('456')];
 for(const [i,change]of variants.entries()){const f=setup();change(f);await rejected(f.client.list(owner,signal()),i===0?'account_changed':'login_required');assert.equal(f.calls(),0);}
});
test('same id account replacement discards an already pending response',async()=>{
 const f=setup();let release!:(v:unknown)=>void,entered!:()=>void;const barrier=new Promise<void>(r=>entered=r);f.serve(()=>{entered();return new Promise(r=>release=r);});const pending=f.client.list(owner,signal());await barrier;f.accounts([{...owner}]);release(page());await rejected(pending,'account_changed');
});
test('aborted account album response and late server errors cannot publish stale data',async()=>{
 const f=setup(),controller=new AbortController();let release!:(v:unknown)=>void,entered!:()=>void;const barrier=new Promise<void>(r=>entered=r);f.serve(()=>{entered();return new Promise(r=>release=r);});const pending=f.client.list(owner,controller.signal);await barrier;controller.abort();release(page());await rejected(pending,'cancelled');
});
test('new account album refresh supersedes old pending list without revoking newer members',async()=>{
 const f=setup();let release!:(v:unknown)=>void,entered!:()=>void;const barrier=new Promise<void>(r=>entered=r);f.serve(()=>{entered();return new Promise(r=>release=r);});const old=f.client.list(owner,signal());await barrier;f.serve(async()=>page([album('11')]));const current=await f.client.list(owner,signal());release(page());await rejected(old,'account_changed');f.client.assertMember(owner,current[0]!);
});
test('account catalog refresh invalidates previous entries even when refresh fails',async()=>{
 const f=setup(),previous=await f.client.list(owner,signal());f.serve(async()=>{throw Error('unit-only server diagnostic');});await rejected(f.client.list(owner,signal()),'unavailable');assert.throws(()=>f.client.assertMember(owner,previous[0]!),AccountAlbumError);
});
test('account albums map expired authorization without exposing server messages',async()=>{const f=setup();f.serve(async()=>({code:301,message:'unit-only server diagnostic'}));await rejected(f.client.list(owner,signal()),'login_required');assert.ok(!new AccountAlbumError('unavailable').message.includes('unit-only'));});
