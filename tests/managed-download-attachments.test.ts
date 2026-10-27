import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OfflineDownloadStore,type OfflineDownloadFiles} from '../src/storage/offlineDownloads.ts';
import {ManagedDownloadAttachments,type ManagedAttachmentFiles} from '../src/storage/managedDownloadAttachments.ts';
import {captureAttachmentPolicy,validateAttachmentPolicy} from '../src/domain/downloadAttachmentPolicy.ts';
import type {Track} from '../src/domain/track.ts';
const track:Track={origin:{kind:'online',platform:'wy',id:'contract'},title:'Contract',artist:'Test',qualities:[],metadata:{}};
const policy=()=>validateAttachmentPolicy({downloadAttachLyrics:true,downloadAttachCover:true,downloadAttachMetadata:true,coverSize:1000});
function rig(){
 const db=new Map<string,unknown>(),audio=new Map<string,number>(),bundles=new Map<string,Map<string,string>>();let serial=0,requests=0,stagesRemoved=0,validations=0,maximum=1e8,fail=false,wait:Promise<void>|undefined,configuration=policy();
 const repository={get:async<T>(key:string)=>structuredClone(db.get(key)) as T|undefined,put:async(key:string,value:unknown)=>{db.set(key,structuredClone(value));}};
 const disk:OfflineDownloadFiles={async download(_url,name){audio.set(name,100);return 100;},remove:async name=>{audio.delete(name);},exists:name=>audio.has(name),size:name=>audio.get(name)??0,partialSize:()=>0,digest:()=> 'a'.repeat(32),uri:name=>'file:///'+name};
 const store=new OfflineDownloadStore(repository,{resolve:async()=>({url:'https://example.invalid/real-port'}),files:disk,uuid:()=>String(++serial).padStart(8,'0'),now:()=>serial,captureAttachments:()=>configuration,reservedBytes:()=>bundles.size*10,maxTotalBytes:()=>maximum});
 const files:ManagedAttachmentFiles={valid:name=>{validations++;return bundles.has(name);},remove:name=>{bundles.delete(name);},prune:keep=>{for(const name of bundles.keys())if(!keep.has(name))bundles.delete(name);},usedBytes:()=>bundles.size*10,lyric:name=>bundles.get(name)!.get('lyrics.lrc')!,cover:name=>'file:///bundles/'+name+'/cover.jpg',stage:()=>{const pending=new Map<string,string>();return{header:new Uint8Array([73,68,51]),text:(name,body)=>{pending.set(name,body);},cover:async(_uri,size)=>{pending.set('cover.jpg',String(size));},bytes:()=>10,commit:name=>{bundles.set(name,pending);},remove:()=>{stagesRemoved++;}};}};
 const options={downloads:store,files,maximumBytes:()=>maximum,lyrics:async(_track:Track,signal:AbortSignal)=>{requests++;if(wait)await wait;if(signal.aborted)throw Error('abort');if(fail)throw Error('private diagnostic must stay out of journal');return{synced:true,plain:[],lines:[{startMs:1000,text:'contract lyric'}]};},cover:async()=> 'file:///actual-port-cover.jpg'};
 const managed=new ManagedDownloadAttachments(repository,options);
 return{store,managed,options,repository,db,bundles,files,requests:()=>requests,validations:()=>validations,stagesRemoved:()=>stagesRemoved,setFail:(v:boolean)=>{fail=v;},setWait:(v:Promise<void>|undefined)=>{wait=v;},setMaximum:(v:number)=>{maximum=v;},changePolicy:()=>{configuration={...policy(),downloadAttachLyrics:false,coverSize:256};}};
}
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function completed(r:ReturnType<typeof rig>){const row=await r.store.enqueue(track);await r.store.start(row.id);await r.managed.whenIdle();return row;}
test('policy is immutable, public platform size captured, empty selection omitted and old records not retroactively fetched',async()=>{
 const p=captureAttachmentPolicy(track,{...policy(),downloadCoverSizes:{wy:1200}})!;assert.equal(p.coverSize,1200);assert(Object.isFrozen(p));assert.equal(captureAttachmentPolicy(track,{downloadAttachLyrics:false,downloadAttachCover:false,downloadAttachMetadata:false,downloadCoverSizes:{}}),undefined);assert.throws(()=>validateAttachmentPolicy({...policy(),coverSize:999}));
 const r=rig();const row=await r.store.enqueue(track);r.changePolicy();assert.equal(row.attachmentPolicy!.coverSize,1000);assert.equal(row.attachmentPolicy!.downloadAttachLyrics,true);
 const snapshot=structuredClone(r.db.get('offlineDownloads.v1')) as {items:Record<string,unknown>[]};delete snapshot.items[0]!.attachmentPolicy;r.db.set('offlineDownloads.v1',snapshot);await r.store.restore();await r.store.start(row.id);await r.managed.restore();await r.managed.whenIdle();assert.equal(r.requests(),0);assert.equal(r.managed.getSnapshot().length,0);r.managed.dispose();
});
test('completion prepares all selected companions, preserves audio, reuses after restart and removes only its bundle on audio deletion',async()=>{
 const r=rig();await r.managed.restore();const row=await completed(r);assert.equal(r.managed.getSnapshot()[0]!.state,'ready');assert.equal(r.bundles.get(row.fileName)!.size,3);assert.equal(r.bundles.get(row.fileName)!.get('cover.jpg'),'1000');assert(r.files.valid(row.fileName,policy(),'a'.repeat(32)));assert.equal(r.store.getSnapshot()[0]!.status,'completed');assert.equal(r.requests(),1);assert.equal(r.stagesRemoved(),1);assert((await r.managed.prepared(row.fileName,1000))?.cover);assert.equal((await r.managed.prepared(row.fileName,256))?.cover,undefined);
 r.managed.dispose();const restarted=new ManagedDownloadAttachments(r.repository,r.options);await restarted.restore();await restarted.whenIdle();assert.equal(r.requests(),1);assert.equal(restarted.getSnapshot()[0]!.state,'ready');await r.store.remove(row.id);await restarted.whenIdle();assert.equal(r.bundles.size,0);assert.equal(restarted.getSnapshot().length,0);restarted.dispose();
});
test('attachment failure leaves completed audio, retry does not redownload audio or persist provider diagnostics',async()=>{
 const r=rig();r.setFail(true);await r.managed.restore();const row=await completed(r);assert.equal(r.managed.getSnapshot()[0]!.state,'failed');assert.equal(r.store.getSnapshot()[0]!.status,'completed');assert.equal(r.bundles.size,0);assert(!JSON.stringify(r.db.get('managedDownloadAttachments.v1')).includes('private diagnostic'));
 r.setFail(false);await r.managed.retry(row.fileName);await r.managed.whenIdle();assert.equal(r.managed.getSnapshot()[0]!.state,'ready');assert.equal(r.store.getSnapshot()[0]!.bytes,100);r.managed.dispose();
});
test('cancel and deletion during actual asynchronous preparation cannot resurrect a companion bundle or alter saved audio',async()=>{
 for(const action of ['cancel','delete'] as const){const r=rig();let release!:()=>void;r.setWait(new Promise<void>(resolve=>{release=resolve;}));await r.managed.restore();const row=await r.store.enqueue(track);await r.store.start(row.id);while(!r.requests())await turn();if(action==='cancel')await r.managed.cancel(row.fileName);else await r.store.remove(row.id);release();await r.managed.whenIdle();assert.equal(r.bundles.size,0);assert.equal(r.stagesRemoved(),1);if(action==='cancel'){assert.equal(r.managed.getSnapshot()[0]!.state,'cancelled');assert.equal(r.store.getSnapshot()[0]!.status,'completed');}else assert.equal(r.managed.getSnapshot().length,0);r.managed.dispose();}
});
test('quota failure affects companions only, and missing committed bundle becomes retryable after restart',async()=>{
 const r=rig();r.setMaximum(105);await r.managed.restore();const row=await completed(r);assert.equal(r.managed.getSnapshot()[0]!.state,'failed');assert.equal(r.store.getSnapshot()[0]!.status,'completed');assert.equal(r.bundles.size,0);r.setMaximum(1000);await r.managed.retry(row.fileName);await r.managed.whenIdle();r.managed.dispose();r.bundles.clear();const restored=new ManagedDownloadAttachments(r.repository,r.options);await restored.restore();await restored.whenIdle();assert.equal(restored.getSnapshot()[0]!.state,'failed');restored.dispose();
});

test('disk commit before journal completion is adopted after restart without provider requests',async()=>{
 const r=rig();await r.managed.restore();await completed(r);r.managed.dispose();const snapshot=structuredClone(r.db.get('managedDownloadAttachments.v1')) as {items:{state:string}[]};snapshot.items[0]!.state='preparing';r.db.set('managedDownloadAttachments.v1',snapshot);const restored=new ManagedDownloadAttachments(r.repository,r.options);await restored.restore();await restored.whenIdle();assert.equal(restored.getSnapshot()[0]!.state,'ready');assert.equal(r.requests(),1);restored.dispose();
});

test('immediate retry after cancellation wins over late completion of the cancelled generation',async()=>{
 const r=rig();let release!:()=>void;r.setWait(new Promise<void>(resolve=>{release=resolve;}));await r.managed.restore();const row=await r.store.enqueue(track);await r.store.start(row.id);while(!r.requests())await turn();const cancelled=r.managed.cancel(row.fileName),retried=r.managed.retry(row.fileName);r.setWait(undefined);release();await Promise.all([cancelled,retried]);await r.managed.whenIdle();assert.equal(r.managed.getSnapshot()[0]!.state,'ready');assert.equal(r.bundles.size,1);assert.equal(r.store.getSnapshot()[0]!.status,'completed');r.managed.dispose();
});

test('unrelated audio status changes do not rehash all ready companions; export still detects missing or damaged bundles',async()=>{
 const r=rig();await r.managed.restore();const row=await completed(r),before=r.validations();const other=await r.store.enqueue({...track,origin:{kind:'online',platform:'wy',id:'second'}});await r.managed.whenIdle();await r.store.cancel(other.id);await r.managed.whenIdle();assert.equal(r.validations(),before);r.bundles.delete(row.fileName);assert.equal(await r.managed.prepared(row.fileName,1000),undefined);assert.equal(r.managed.getSnapshot()[0]!.state,'failed');r.managed.dispose();
});
