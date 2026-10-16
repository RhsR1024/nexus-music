import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DAVNativeTransport,type DAVNativeModule} from '../src/providers/davNativeTransport.ts';
import {WebDAVAccounts} from '../src/providers/webdavAccounts.ts';
import {WebDAVMedia} from '../src/providers/webdavMedia.ts';
import {cleanTrack} from '../src/storage/cleanTrack.ts';
import {WebDAVError} from '../src/providers/webdav.ts';
const hash=async(text:string)=>createHash('sha256').update(text).digest('hex'),signal=()=>new AbortController().signal;
const folder='<resourcetype><collection/></resourcetype>';
const xml=(etag='"one"')=>`<multistatus xmlns="DAV:"><response><href>/dav/</href><propstat><prop>${folder}</prop><status>HTTP/1.1 200 OK</status></propstat></response><response><href>/dav/tone.mp3</href><propstat><prop><resourcetype/><getetag>${etag}</getetag><getcontentlength>1234</getcontentlength></prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`;
function fixture(){
  let uid=0,etag='"one"',network=false,inspected=0;
  const secrets=new Map<string,string>(),records=new Map<string,unknown>(),native:DAVNativeModule={
    propfind:async()=>{if(network)throw new Error('private server URL');return{status:207,body:xml(etag)};},
    prepare:async(root,path)=>({url:root+path,redirectRoot:root,headers:{Authorization:'Basic private-fixture'}}),
    inspect:async()=>{inspected++;return{title:'Actual fixture title',artist:'Fixture artist',album:'Fixture album',durationMs:1000,lyric:'[00:00]Embedded fixture',artwork:'file:///cache/fixture.jpg'};},cancel:async()=>{},
  };
  const transport=new DAVNativeTransport(native,()=>String(++uid)),accounts=new WebDAVAccounts({get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key,value)=>{records.set(key,value);}},{get:async key=>secrets.get(key)??null,set:async(key,value)=>{secrets.set(key,value);},remove:async key=>{secrets.delete(key);}},hash,transport);
  const media=new WebDAVMedia(accounts,transport,hash);
  return{native,transport,accounts,media,inspected:()=>inspected,setETag:(value:string)=>{etag=value;},setNetwork:(value:boolean)=>{network=value;}};
}
test('WebDAV remote media keeps account/path identity and exports tags without server URLs or credentials',async()=>{
  const f=fixture(),{account,entries}=await f.accounts.connect('https://fixture.example/dav','user','password'),track=f.media.track(account.id,entries[0]!);
  const result=await f.media.inspectTrack(track,signal());assert.equal(result.track.title,'Actual fixture title');assert.equal(result.track.origin.kind,'webdav');assert.equal(result.track.origin.id,'tone.mp3');
  assert.equal(await f.media.lyric(track,signal()),'[00:00]Embedded fixture');assert.equal(f.inspected(),1);
  const clean=JSON.stringify(cleanTrack(result.track));assert.equal(clean.includes('fixture.example'),false);assert.equal(clean.includes('Basic'),false);assert.equal(clean.includes('file:'),false);assert.equal(clean.includes('password'),false);
  const first=await f.media.resolve(track,signal());assert.ok(first.cacheKey);assert.equal(first.headers['If-Match'],'"one"');f.setETag('"two"');const second=await f.media.resolve(track,signal());assert.notEqual(first.cacheKey,second.cacheKey);assert.equal(second.resolvedTrack.title,'Actual fixture title');assert.notEqual(first.resolvedTrack.metadata.davVersion,second.resolvedTrack.metadata.davVersion);await f.media.inspectTrack(track,signal());assert.equal(f.inspected(),2);
});
test('WebDAV weak or invalid ETags never become If-Match or an unversioned persistent cache identity',async()=>{
  const f=fixture(),{account,entries}=await f.accounts.connect('https://fixture.example/dav','user','password'),track=f.media.track(account.id,entries[0]!);
  let previous='';for(const etag of ['W/"weak"','bad-header','"line\nfeed"']){f.setETag(etag);const media=await f.media.resolve(track,signal());assert.equal(media.cacheKey,undefined);assert.equal(media.headers['If-Match'],undefined);assert.notEqual(media.resolvedTrack.metadata.davVersion,previous);previous=String(media.resolvedTrack.metadata.davVersion);}
});
test('WebDAV offline fallback requires a known validated version and requests cache-only decoding',async()=>{
  const f=fixture(),{account,entries}=await f.accounts.connect('https://fixture.example/dav','user','password'),track=f.media.track(account.id,entries[0]!);
  const online=await f.media.resolve(track,signal());f.setNetwork(true);const cached=await f.media.resolve(track,signal());assert.equal(cached.cacheOnly,true);assert.equal(cached.cacheKey,online.cacheKey);
  f.setNetwork(false);await f.accounts.connect('https://other.example/dav','user','password');f.setNetwork(true);assert.equal((await f.media.resolve(track,signal())).cacheKey,online.cacheKey);
  await f.accounts.remove(account.id);await assert.rejects(f.media.resolve(track,signal()));
});
test('WebDAV account removal during metadata inspection cannot publish a late result',async()=>{
  const f=fixture(),{account,entries}=await f.accounts.connect('https://fixture.example/dav','user','password'),track=f.media.track(account.id,entries[0]!);let finish!:(value:{durationMs:number})=>void;
  f.native.inspect=()=>new Promise(resolve=>{finish=resolve;});const pending=f.media.inspectTrack(track,signal());while(!finish)await new Promise(resolve=>setImmediate(resolve));await f.accounts.remove(account.id);finish({durationMs:1000});await assert.rejects(pending,WebDAVError);
});
test('WebDAV native metadata queue bounds concurrency and cancels both active and waiting requests',async()=>{
  const f=fixture(),running:string[]=[],cancelled:string[]=[],finish=new Map<string,()=>void>();
  f.native.inspect=async token=>{running.push(token);return await new Promise(resolve=>{finish.set(token,()=>resolve({durationMs:1000}));});};
  f.native.cancel=async token=>{cancelled.push(token);finish.get(token)?.();};
  const a=new AbortController(),b=new AbortController(),c=new AbortController();
  const one=f.transport.inspect('https://fixture.example/dav/','tone.mp3',{username:'user',password:'password'},'a'.repeat(64),a.signal).catch(error=>error);
  const two=f.transport.inspect('https://fixture.example/dav/','tone.mp3',{username:'user',password:'password'},'a'.repeat(64),b.signal);
  const three=f.transport.inspect('https://fixture.example/dav/','tone.mp3',{username:'user',password:'password'},'a'.repeat(64),c.signal).catch(error=>error);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(running.length,2);c.abort();await three;assert.equal(running.length,2);
  a.abort();await one;assert.deepEqual(cancelled,[running[0]]);finish.get(running[1]!)!();await two;
  assert.equal((await f.transport.inspect('https://fixture.example/dav/','tone.mp3',{username:'user',password:'password'},'a'.repeat(64),AbortSignal.abort()).catch(()=>null)),null);
});
test('WebDAV lyric metadata cache evicts by memory budget and clear does not cache late inspection results',async()=>{
  const f=fixture(),{account,entries}=await f.accounts.connect('https://fixture.example/dav','user','password');let calls=0;
  f.native.propfind=async(_,__,path)=>({status:207,body:xml().replace('/dav/tone.mp3','/dav/'+path)});
  f.native.inspect=async()=>{calls++;return{durationMs:1000,lyric:'x'.repeat(2*1024*1024)};};
  const first=f.media.track(account.id,entries[0]!),second=f.media.track(account.id,{...entries[0]!,path:'second.mp3'});
  assert.equal((await f.media.inspectTrack(first,signal())).track.metadata.davTitleFromFile,true);await f.media.inspectTrack(second,signal());await f.media.inspectTrack(first,signal());assert.equal(calls,3);
  f.media.clearMetadata();let finish!:(value:{durationMs:number})=>void;
  f.native.inspect=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const pending=f.media.inspectTrack(first,signal());while(!finish)await new Promise(resolve=>setImmediate(resolve));f.media.clearMetadata();finish({durationMs:1000});await pending;
  f.native.inspect=async()=>{calls++;return{durationMs:1000};};await f.media.inspectTrack(first,signal());assert.equal(calls,5);
});
test('unversioned remote metadata uses distinct transient versions across media instances and never revives old lyric identity',async()=>{
 const f=fixture();f.setETag('W/"weak"');const {account,entries}=await f.accounts.connect('https://fixture.example/dav','user','password'),track=f.media.track(account.id,entries[0]!);
 const before=await f.media.inspectTrack(track,signal()),reopened=new WebDAVMedia(f.accounts,f.transport,hash),after=await reopened.inspectTrack(track,signal());
 assert.equal(before.track.title,after.track.title);assert.equal(before.track.durationMs,after.track.durationMs);assert.notEqual(before.track.metadata.davVersion,after.track.metadata.davVersion);assert.equal(f.inspected(),2);
});
