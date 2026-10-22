import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicAccounts} from '../src/providers/musicAccounts.ts';

function fixture(){
  const records=new Map<string,unknown>(),secrets=new Map<string,string>();let fail=false;
  const repository={get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{if(fail)throw new Error('database unavailable');records.set(key,value);}};
  const keychain={get:async(key:string)=>secrets.get(key)??null,set:async(key:string,value:string)=>{secrets.set(key,value);},remove:async(key:string)=>{secrets.delete(key);}};
  const accounts=new MusicAccounts(repository,keychain,async value=>'a'.repeat(64));
  return{accounts,records,secrets,setFail:(value:boolean)=>{fail=value;}};
}

test('music account metadata and session material are stored separately',async()=>{
  const f=fixture(),account=await f.accounts.save({platform:'tx',label:'QQ Music',username:'u',displayName:'Fixture listener',capabilities:['playlist','daily']},{token:'secret',cookies:{sid:'private'}});
  assert.equal(f.records.get('music.accounts.v1') instanceof Array,true);
  assert.equal(account.displayName,'Fixture listener');
  assert.doesNotMatch(JSON.stringify(f.records.get('music.accounts.v1')),/secret|private/);
  assert.deepEqual(await f.accounts.session(account.id),{token:'secret',cookies:{sid:'private'}});
});

test('replacing an account atomically rolls back its previous session on repository failure',async()=>{
  const f=fixture(),first=await f.accounts.save({platform:'wy',label:'网易云',username:'u',capabilities:['favorite']},{token:'old'});
  f.setFail(true);await assert.rejects(f.accounts.save({platform:'wy',label:'网易云新',username:'u',capabilities:['daily']},{token:'new'}));
  assert.equal((await f.accounts.session(first.id)).token,'old');assert.equal(f.accounts.getSnapshot()[0]!.label,'网易云');
});

test('removing an account clears its keychain session and published metadata',async()=>{
  const f=fixture(),account=await f.accounts.save({platform:'kg',label:'酷狗',username:'u',capabilities:['fm']},{token:'old'});
  await f.accounts.remove(account.id);assert.deepEqual(f.accounts.getSnapshot(),[]);await assert.rejects(f.accounts.session(account.id),/不存在/);assert.equal(f.secrets.size,0);
});

test('unexpected runtime fields and caller mutations cannot leak sessions into account metadata',async()=>{
  const f=fixture(),input={platform:'wy' as const,label:'网易云',username:'u',capabilities:['daily' as const],token:'synthetic-private'};
  await f.accounts.save(input,{cookie:'synthetic-cookie'});input.capabilities.length=0;
  assert.doesNotMatch(JSON.stringify(f.records.get('music.accounts.v1')),/token|synthetic-private|cookie/);
  assert.deepEqual(f.accounts.getSnapshot()[0]!.capabilities,['daily']);
  const saved=f.records.get('music.accounts.v1') as Record<string,unknown>[];
  saved[0]!.unexpectedSecret='synthetic-secret';await f.accounts.restore();
  assert.doesNotMatch(JSON.stringify(f.accounts.getSnapshot()),/unexpectedSecret|synthetic-secret/);
});

test('account restore rejects duplicate identities instead of selecting an arbitrary session',async()=>{
  const f=fixture();await f.accounts.save({platform:'tx',label:'QQ',username:'u',capabilities:[]},{token:'fixture'});
  const saved=f.records.get('music.accounts.v1') as unknown[];f.records.set('music.accounts.v1',[...saved,...saved]);
  await assert.rejects(f.accounts.restore(),/本地记录格式无效/);
});

test('a late keychain read cannot return a removed account session',async()=>{
  const records=new Map<string,unknown>(),secrets=new Map<string,string>();let release:(value:string|null)=>void=()=>{};let held=false;
  const accounts=new MusicAccounts({get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{records.set(key,value);}},
    {get:async key=>held?new Promise<string|null>(resolve=>{held=false;release=resolve;}):secrets.get(key)??null,set:async(key,value)=>{secrets.set(key,value);},remove:async key=>{secrets.delete(key);}},async()=> 'a'.repeat(64));
  const account=await accounts.save({platform:'kg',label:'酷狗',username:'u',capabilities:[]},{token:'fixture'});
  held=true;const read=accounts.session(account.id);await accounts.remove(account.id);release('{"token":"fixture"}');
  await assert.rejects(read,/账号已更改/);
});
