import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {QQDailyAuthorization} from '../src/providers/qqDailyAuthorization.ts';
import {MusicAccounts} from '../src/providers/musicAccounts.ts';
import {MusicAuthError} from '../src/providers/musicAuth.ts';
import {AccountDailyError} from '../src/providers/accountDaily.ts';
import {accountRecommendationFailure} from '../src/ui/accountRecommendationFailure.ts';

const key='qmk-synthetic_only_key_1234',cookies={login_type:'1',uin:'123',qqmusic_key:'synthetic-cookie'};
const payload=()=>JSON.stringify({key,cookies});
const hash=async(value:string)=>createHash('sha256').update(value).digest('hex');
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(yes=>resolve=yes);return{promise,resolve};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
  const records=new Map<string,unknown>(),secrets=new Map<string,string>();
  let beforeSecret:(()=>Promise<void>)|undefined,failMetadata=false;
  const accounts=new MusicAccounts({get:async<T>(k:string)=>records.get(k) as T|undefined,put:async(k,v)=>{if(failMetadata)throw Error('synthetic secret should not appear');records.set(k,v);}},
    {get:async k=>secrets.get(k)??null,set:async(k,v)=>{await beforeSecret?.();secrets.set(k,v);},remove:async k=>{secrets.delete(k);}},hash);
  const config={native:{openQQDaily:async()=>payload(),cancel:async()=>{}},accounts,profile:{fetch:async()=>({userId:'123',nickname:'Test account'})},daily:{validateKey:async()=>{}},hash,uuid:()=> 'attempt-1'};
  const coordinator=new QQDailyAuthorization(config);
  return{accounts,records,secrets,config,coordinator,setSecretGate:(gate?:()=>Promise<void>)=>{beforeSecret=gate;},failMetadata:()=>{failMetadata=true;}};
}
const failed=(p:Promise<unknown>)=>assert.rejects(p,e=>e instanceof MusicAuthError&&e.kind==='failed'&&!e.message.includes(key));

test('daily authorization verifies identity, commits a bound key and clears it without logging out',async()=>{
  const t=setup();let validated=false;
  t.config.daily.validateKey=async()=>{validated=true;assert.equal(t.secrets.size,0);};
  await t.coordinator.authorize();assert.equal(validated,true);assert.equal(t.coordinator.getSnapshot().status,'succeeded');
  const account=t.accounts.getSnapshot()[0]!;const stored=await t.accounts.session(account.id);
  assert.equal(stored.qqDailyKey,key);assert.equal(stored.qqDailyKeyOwner,account.id);assert.ok(account.capabilities.includes('daily'));assert.ok(!JSON.stringify([...t.records.values()]).includes(key));
  await t.coordinator.clear(account,new AbortController().signal);const next=t.accounts.getSnapshot()[0]!;
  assert.equal((await t.accounts.session(next.id)).qqDailyKey,undefined);assert.deepEqual((await t.accounts.session(next.id)).cookies,cookies);assert.ok(!next.capabilities.includes('daily'));
});

test('daily authorization rejects mismatched target, profile or mixed QQ identities before persistence',async()=>{
  for(const mode of ['target','profile','mixed','malformed'] as const){
    const t=setup();let target;
    if(mode==='target')target=await t.accounts.save({platform:'tx',username:'qq:2:456',label:'QQ',capabilities:[]},{platform:'tx'});
    if(mode==='profile')t.config.profile.fetch=async()=>({userId:'456',nickname:'Other'});
    if(mode==='mixed')t.config.native.openQQDaily=async()=>JSON.stringify({key,cookies:{...cookies,musicid:'456'}});
    if(mode==='malformed')t.config.native.openQQDaily=async()=>JSON.stringify({key:'not-a-key',cookies});
    const before=JSON.stringify([...t.secrets]);await failed(t.coordinator.authorize(target));assert.equal(JSON.stringify([...t.secrets]),before);
  }
});

test('cancelled native page and expired page keep distinct terminal states',async()=>{
  for(const [code,status] of [['AUTH_CANCELLED','cancelled'],['AUTH_EXPIRED','expired']] as const){const t=setup();t.config.native.openQQDaily=async()=>{throw{code};};await assert.rejects(t.coordinator.authorize());assert.equal(t.coordinator.getSnapshot().status,status);assert.equal(t.secrets.size,0);}
});

test('cancel during native or verification ignores late completion without saving',async()=>{
  for(const phase of ['native','verification'] as const){const t=setup(),gate=deferred<void>();let entered=false;
    if(phase==='native')t.config.native.openQQDaily=async()=>{entered=true;await gate.promise;return payload();};else t.config.daily.validateKey=async()=>{entered=true;await gate.promise;};
    const pending=t.coordinator.authorize(),rejection=assert.rejects(pending,e=>e instanceof MusicAuthError&&e.kind==='cancelled');while(!entered)await turn();t.coordinator.cancel();gate.resolve();await rejection;await turn();assert.equal(t.secrets.size,0);assert.equal(t.accounts.getSnapshot().length,0);
  }
});

test('cancel during account secret write rolls back the pending grant',async()=>{
  const t=setup(),gate=deferred<void>();let entered=false;t.setSecretGate(async()=>{entered=true;await gate.promise;});
  const pending=t.coordinator.authorize(),rejection=assert.rejects(pending);while(!entered)await turn();t.coordinator.cancel();gate.resolve();await rejection;await turn();await turn();assert.equal(t.accounts.getSnapshot().length,0);assert.equal(t.secrets.size,0);
});

test('failed metadata commit does not leave a key or successful authorization state',async()=>{
  const t=setup();t.failMetadata();await failed(t.coordinator.authorize());assert.equal(t.coordinator.getSnapshot().status,'failed');assert.equal(t.secrets.size,0);
});

test('account replacement during validation cannot be overwritten by the old grant',async()=>{
  const t=setup();await t.coordinator.authorize();const old=t.accounts.getSnapshot()[0]!,gate=deferred<void>();let entered=false;
  t.config.daily.validateKey=async()=>{entered=true;await gate.promise;};const pending=t.coordinator.authorize(old),rejected=failed(pending);while(!entered)await turn();
  const newer=await t.accounts.save({platform:'tx',username:old.username,label:'QQ',capabilities:[]},{platform:'tx',marker:'newer'});gate.resolve();await rejected;assert.equal(t.accounts.getSnapshot()[0],newer);assert.equal((await t.accounts.session(newer.id)).marker,'newer');
});

test('expected-account store guard rejects a queued stale update and a competing create',async()=>{
  const t=setup();const account={platform:'tx' as const,username:'qq:2:123',label:'QQ',capabilities:[]};const old=await t.accounts.save(account,{marker:'old'});
  const first=t.accounts.save(account,{marker:'new'}),stale=t.accounts.save(account,{marker:'stale'},undefined,old);await first;await assert.rejects(stale);await assert.rejects(t.accounts.save(account,{marker:'create'},undefined,null));assert.equal((await t.accounts.session(old.id)).marker,'new');
});

test('global authorization cannot resurrect a matching account removed while its page was open',async()=>{
  const t=setup();await t.coordinator.authorize();const old=t.accounts.getSnapshot()[0]!,gate=deferred<string>();let opened=false;
  t.config.native.openQQDaily=async()=>{opened=true;return gate.promise;};
  const pending=t.coordinator.authorize(),rejected=failed(pending);while(!opened)await turn();await t.accounts.remove(old.id);gate.resolve(payload());await rejected;
  assert.equal(t.accounts.getSnapshot().length,0);assert.equal(t.secrets.size,0);
});

test('current date-rollover cancellation produces a retryable terminal message instead of an endless spinner',()=>{
  assert.equal(accountRecommendationFailure(new AccountDailyError('cancelled'),'fallback'),'读取已取消，请重试');
  assert.equal(accountRecommendationFailure(new AccountDailyError('login_required'),'fallback'),'登录已失效，请重新登录');
  assert.equal(accountRecommendationFailure(new Error('qmk-private-diagnostic'),'fallback'),'fallback');
});
