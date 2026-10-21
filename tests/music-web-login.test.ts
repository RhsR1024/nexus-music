import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicAuthError,MusicAuthFlow} from '../src/providers/musicAuth.ts';
import {MusicAccounts} from '../src/providers/musicAccounts.ts';
import {MusicWebLoginCoordinator,musicCookieHeader,parseNeteaseCookiePayload} from '../src/providers/musicWebLogin.ts';

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
  const native={
    open:async(id:string,provider:string,url:string)=>{calls.push(`${id}:${provider}:${url}`);return JSON.stringify({MUSIC_U:'synthetic-auth',__csrf:'synthetic-csrf'});},
    cancel:async()=>{},
  };
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,hash,uuid:()=> 'launch-id'});
  const result=await login.login();
  assert.equal(calls[0],'launch-id:wy:https://music.163.com/m/login');
  assert.equal(result.account.platform,'wy');
  assert.deepEqual(result.account.capabilities,[]);
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
    const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,hash,uuid:()=>`${code}-id`});
    await assert.rejects(login.login(),(error)=>error instanceof MusicAuthError&&error.kind===status);
    assert.equal(login.getSnapshot().status,status);
    assert.doesNotMatch(JSON.stringify(login.getSnapshot()),/private native detail/);
  }
});

test('closing a login tears down the exact native attempt',async()=>{
  const f=accountsFixture(),flow=new MusicAuthFlow<Record<string,unknown>>(),cancelled:string[]=[];
  let finish:(value:string)=>void=()=>{};
  const native={open:()=>new Promise<string>(resolve=>{finish=resolve;}),cancel:async(id:string)=>{cancelled.push(id);}};
  const login=new MusicWebLoginCoordinator({native,flow,accounts:f.accounts,hash,uuid:()=> 'cancel-id'});
  const pending=login.login();await new Promise(resolve=>setImmediate(resolve));login.cancel();finish(JSON.stringify({MUSIC_U:'late'}));
  await assert.rejects(pending,(error)=>error instanceof MusicAuthError&&error.kind==='cancelled');
  assert.deepEqual(cancelled,['cancel-id']);assert.equal(login.getSnapshot().status,'cancelled');
});
