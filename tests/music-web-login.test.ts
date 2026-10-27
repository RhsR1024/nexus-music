import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicAuthError,MusicAuthFlow} from '../src/providers/musicAuth.ts';
import {MusicAccounts} from '../src/providers/musicAccounts.ts';
import {NeteaseAccountProfileClient} from '../src/providers/neteaseAccountProfile.ts';
import {MusicWebLoginCoordinator,musicCookieHeader,parseNeteaseCookiePayload} from '../src/providers/musicWebLogin.ts';
import {QQAccountProfileClient} from '../src/providers/qqAccountProfile.ts';

const hash=async(value:string)=>Buffer.from(value).toString('hex').padEnd(64,'0').slice(0,64);

function accountsFixture(){
  const records=new Map<string,unknown>(),secrets=new Map<string,string>();
  const accounts=new MusicAccounts(
    {get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{records.set(key,value);}},
    {get:async key=>secrets.get(key)??null,set:async(key,value)=>{secrets.set(key,value);},remove:async key=>{secrets.delete(key);}},
    hash,
  );
  return{accounts,records,secrets};
}

test('NetEase login keeps only bounded authentication cookies',()=>{
  const cookies=parseNeteaseCookiePayload(JSON.stringify({MUSIC_U:'synthetic-auth',__csrf:'synthetic-csrf',NMTID:'tracking',unexpected:'drop'}));
  assert.deepEqual(cookies,{MUSIC_U:'synthetic-auth',__csrf:'synthetic-csrf',NMTID:'tracking'});
  assert.equal(musicCookieHeader(cookies),'MUSIC_U=synthetic-auth; __csrf=synthetic-csrf; NMTID=tracking');
});

test('NetEase login rejects missing or header-injecting authentication cookies',()=>{
  assert.throws(()=>parseNeteaseCookiePayload('{}'),(error)=>error instanceof MusicAuthError&&error.kind==='failed');
  assert.throws(()=>parseNeteaseCookiePayload(JSON.stringify({MUSIC_U:'bad\r\nCookie: secret'})),(error)=>error instanceof MusicAuthError);
});

test('login coordinator stores account metadata separately from secret cookies',async()=>{
  const f=accountsFixture(),flow=new MusicAuthFlow<Record<string,unknown>>();
  const calls:string[]=[];
  const profile=new NeteaseAccountProfileClient({http:async()=>({code:200,profile:{userId:42,nickname:'Fixture listener'}}),endpoint:'https://fixture.test/account'});
  const native={
    open:async(id:string,provider:string,url:string)=>{calls.push(`${id}:${provider}:${url}`);return JSON.stringify({MUSIC_U:'synthetic-auth',__csrf:'synthetic-csrf'});},
    cancel:async()=>{},
  };
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,profile,hash,uuid:()=> 'launch-id'});
  const result=await login.login();
  assert.equal(calls[0],'launch-id:wy:https://music.163.com/m/login');
  assert.equal(result.account.platform,'wy');
  assert.equal(result.account.username,'netease:42');
  assert.equal(result.account.displayName,'Fixture listener');
  assert.deepEqual(result.account.capabilities,['daily','fm']);
  assert.doesNotMatch(JSON.stringify(f.records.get('music.accounts.v1')),/synthetic-auth|synthetic-csrf/);
  assert.match([...f.secrets.values()][0]!,/synthetic-auth/);
  assert.equal(result.session.accountId,result.account.id);
  assert.equal(login.getSnapshot().status,'succeeded');
});

test('native cancellation and expiry map to bounded authorization states',async()=>{
  const f=accountsFixture();
  for(const [code,status] of [['AUTH_CANCELLED','cancelled'],['AUTH_EXPIRED','expired']] as const){
    const flow=new MusicAuthFlow<Record<string,unknown>>();
    const native={open:async()=>Promise.reject(Object.assign(new Error('private native detail'),{code})),cancel:async()=>{}};
    const profile=new NeteaseAccountProfileClient({http:async()=>({code:200,profile:{userId:42,nickname:'Fixture listener'}}),endpoint:'https://fixture.test/account'});
    const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,profile,hash,uuid:()=>`${code}-id`});
    await assert.rejects(login.login(),(error)=>error instanceof MusicAuthError&&error.kind===status);
    assert.equal(login.getSnapshot().status,status);
    assert.doesNotMatch(JSON.stringify(login.getSnapshot()),/private native detail/);
  }
});

test('closing a login tears down the exact native attempt',async()=>{
  const f=accountsFixture(),flow=new MusicAuthFlow<Record<string,unknown>>(),cancelled:string[]=[];
  let finish:(value:string)=>void=()=>{};
  const native={open:()=>new Promise<string>(resolve=>{finish=resolve;}),cancel:async(id:string)=>{cancelled.push(id);}};
  const profile=new NeteaseAccountProfileClient({http:async()=>({code:200,profile:{userId:42,nickname:'Fixture listener'}}),endpoint:'https://fixture.test/account'});
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,profile,hash,uuid:()=> 'cancel-id'});
  const pending=login.login();await new Promise(resolve=>setImmediate(resolve));login.cancel();finish(JSON.stringify({MUSIC_U:'late'}));
  await assert.rejects(pending,(error)=>error instanceof MusicAuthError&&error.kind==='cancelled');
  assert.deepEqual(cancelled,['cancel-id']);assert.equal(login.getSnapshot().status,'cancelled');
});

test('an unverified web session is never saved as an account',async()=>{
  const f=accountsFixture(),flow=new MusicAuthFlow<Record<string,unknown>>();
  const native={open:async()=>JSON.stringify({MUSIC_U:'synthetic-auth'}),cancel:async()=>{}};
  const profile=new NeteaseAccountProfileClient({http:async()=>({code:200,profile:null}),endpoint:'https://fixture.test/account'});
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,profile,hash,uuid:()=> 'unverified-id'});
  await assert.rejects(login.login(),(error)=>error instanceof MusicAuthError&&error.kind==='failed');
  assert.equal(f.records.has('music.accounts.v1'),false);
  assert.equal(f.secrets.size,0);
});

test('QQ login saves a distinct QQ principal with no daily or FM capability and keeps cookies out of metadata',async()=>{
  const f=accountsFixture(),flow=new MusicAuthFlow<Record<string,unknown>>();let calls=0;
  const qqProfile=new QQAccountProfileClient({http:async()=>++calls===1?{code:0,data:{creator:{nick:'Fixture QQ listener'}}}:{code:0,status:{code:0,data:{}}}});
  const native={open:async(_id:string,provider:string,url:string)=>{
    assert.equal(provider,'tx');assert.equal(new URL(url).hostname,'graph.qq.com');
    assert.equal(new URL(url).searchParams.get('state'),'qq-login-id');
    assert.equal(new URL(url).searchParams.has('display'),false);
    return JSON.stringify({qqmusic_key:'synthetic-qq-key',qqmusic_uin:'o000042',login_type:'1'});
  },cancel:async()=>{}};
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,profile:new NeteaseAccountProfileClient(),qqProfile,hash,uuid:()=> 'qq-login-id'});
  const result=await login.login('tx');
  assert.equal(result.account.platform,'tx');assert.equal(result.account.username,'qq:2:42');
  assert.equal(result.session.accountId,result.account.id);assert.deepEqual(result.account.capabilities,[]);
  assert.doesNotMatch(JSON.stringify([...f.records.values()]),/synthetic-qq-key/);
  assert.match([...f.secrets.values()][0]!,/synthetic-qq-key/);
});

test('QQ authorization response arriving after cancellation cannot save an account',async()=>{
  const f=accountsFixture(),flow=new MusicAuthFlow<Record<string,unknown>>();let finish:(value:unknown)=>void=()=>{};
  let calls=0;
  const qqProfile=new QQAccountProfileClient({http:async()=>++calls===1?{code:0,data:{creator:{nick:'Fixture QQ listener'}}}:await new Promise(resolve=>{finish=resolve;})});
  const native={open:async()=>JSON.stringify({qqmusic_key:'synthetic-qq-key',qqmusic_uin:'42'}),cancel:async()=>{}};
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,profile:new NeteaseAccountProfileClient(),qqProfile,hash,uuid:()=> 'qq-cancel-id'});
  const pending=login.login('tx');const rejected=assert.rejects(pending,error=>error instanceof MusicAuthError&&error.kind==='cancelled');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);login.cancel();
  finish({code:0,status:{code:0,data:{}}});await rejected;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.secrets.size,0);assert.equal(f.records.size,0);
});

test('cancelling during account identity hashing cannot persist a late verified QQ session',async()=>{
  const f=accountsFixture(),flow=new MusicAuthFlow<Record<string,unknown>>();let finish:(value:string)=>void=()=>{};
  let calls=0;
  const qqProfile=new QQAccountProfileClient({http:async()=>++calls===1?{code:0,data:{creator:{nick:'Fixture QQ listener'}}}:{code:0,status:{code:0,data:{}}}});
  const native={open:async()=>JSON.stringify({qqmusic_key:'synthetic-qq-key',qqmusic_uin:'42'}),cancel:async()=>{}};
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,profile:new NeteaseAccountProfileClient(),qqProfile,hash:async()=>await new Promise<string>(resolve=>{finish=resolve;}),uuid:()=> 'qq-hash-id'});
  const pending=login.login('tx'),rejected=assert.rejects(pending,error=>error instanceof MusicAuthError&&error.kind==='cancelled');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);login.cancel();finish('a'.repeat(64));await rejected;
  assert.equal(f.secrets.size,0);assert.equal(f.records.size,0);
});
