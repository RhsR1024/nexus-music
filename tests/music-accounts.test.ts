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
  const f=fixture(),account=await f.accounts.save({platform:'tx',label:'QQ Music',username:'u',capabilities:['playlist','daily']},{token:'secret',cookies:{sid:'private'}});
  assert.equal(f.records.get('music.accounts.v1') instanceof Array,true);
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
