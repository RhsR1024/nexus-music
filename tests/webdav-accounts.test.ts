import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {WebDAVAccounts} from '../src/providers/webdavAccounts.ts';
import {WebDAVError} from '../src/providers/webdav.ts';
const hash=async(text:string)=>createHash('sha256').update(text).digest('hex');
const body='<multistatus xmlns="DAV:"><response><href>/dav/</href><propstat><prop><resourcetype><collection/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>';
function fixture(){
  const records=new Map<string,unknown>(),secrets=new Map<string,string>();let writeFails=false,keychainFails=false,status=207;
  const repository={get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{if(writeFails)throw new Error('disk full');records.set(key,structuredClone(value));}};
  const secure={get:async(key:string)=>secrets.get(key)??null,set:async(key:string,value:string)=>{if(keychainFails)throw new Error('Keychain unavailable');secrets.set(key,value);},remove:async(key:string)=>{secrets.delete(key);}};
  const accounts=new WebDAVAccounts(repository,secure,hash,{request:async()=>({status,body})});
  return{records,secrets,accounts,repository,secure,setWriteFails:(value:boolean)=>{writeFails=value;},setKeychainFails:(value:boolean)=>{keychainFails=value;},setStatus:(value:number)=>{status=value;}};
}
test('WebDAV multiple accounts are isolated by normalized root and username with secrets outside repository',async()=>{
  const f=fixture();await f.accounts.restore();const first=await f.accounts.connect('https://one.example/dav','user','fixture-secret','First');
  await f.accounts.connect('https://two.example/dav/','user','other-secret','Second');assert.equal(f.accounts.getSnapshot().length,2);
  assert.equal(JSON.stringify([...f.records]).includes('secret'),false);assert.equal(f.secrets.size,2);
  await f.accounts.connect('https://one.example:443/dav/','user','updated-secret');assert.equal(f.accounts.getSnapshot().length,2);assert.equal((await f.accounts.credentials(first.account.id)).password,'updated-secret');
  await f.accounts.remove(first.account.id);assert.equal(f.secrets.size,1);await assert.rejects(f.accounts.client(first.account.id));assert.equal(f.accounts.getSnapshot()[0]!.label,'Second');
});
test('WebDAV failed configuration validation or authentication never persists credentials',async()=>{
  const f=fixture();f.setStatus(401);await assert.rejects(f.accounts.connect('https://one.example/dav','user','fixture-secret'),error=>error instanceof WebDAVError&&error.kind==='authorization');
  await assert.rejects(f.accounts.connect('https://one.example/dav','bad:user','fixture-secret'));assert.equal(f.secrets.size,0);assert.equal(f.records.size,0);
  f.setStatus(207);f.setKeychainFails(true);await assert.rejects(f.accounts.connect('https://one.example/dav','user','fixture-secret'));assert.equal(f.accounts.getSnapshot().length,0);assert.equal(f.records.size,0);
});
test('WebDAV database failure restores old credentials on update and removal, preserving published state',async()=>{
  const f=fixture();const {account}=await f.accounts.connect('https://one.example/dav','user','old-secret');const snapshot=f.accounts.getSnapshot();
  f.setWriteFails(true);await assert.rejects(f.accounts.connect(account.url,'user','new-secret'));assert.equal((await f.accounts.credentials(account.id)).password,'old-secret');assert.equal(f.accounts.getSnapshot(),snapshot);
  await assert.rejects(f.accounts.remove(account.id));assert.equal((await f.accounts.credentials(account.id)).password,'old-secret');assert.equal(f.accounts.getSnapshot(),snapshot);
});
test('WebDAV corrupt records and credential mismatch are rejected before creating a usable client',async()=>{
  const f=fixture();f.records.set('webdav.accounts.v1',[{id:'broken',url:'file:///private',username:'user',label:'Fixture'}]);await assert.rejects(f.accounts.restore());
  const {account}=await f.accounts.connect('https://one.example/dav','user','fixture-secret');
  f.secrets.set(`nexus.webdav.${account.id}`,JSON.stringify({username:'other',password:'fixture-secret'}));await assert.rejects(f.accounts.credentials(account.id),error=>error instanceof WebDAVError&&error.kind==='authorization');
});
