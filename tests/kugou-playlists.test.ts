import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AccountPlaylists,AccountPlaylistError} from '../src/providers/accountPlaylists.ts';
import {KugouPlaylists} from '../src/providers/kugouPlaylists.ts';
import {HTTPResponseError,type HTTPClient} from '../src/providers/http.ts';
import {LibraryStore} from '../src/storage/library.ts';
import type {Repository} from '../src/storage/repository.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';
const account:MusicAccount={id:'c'.repeat(64),platform:'kg',username:'123',label:'协议测试',updatedAt:1,capabilities:[]};
const h=(n:number)=>n.toString(16).padStart(32,'0').toUpperCase();
const md5=async(v:string)=>createHash('md5').update(v).digest('hex');
const entry=(id='10')=>({listid:id,name:'公开曲目协议样本',count:3,list_create_userid:'123',pic:'http://imge.kugou.com/{size}/public.jpg'});
const detail=(n:number)=>({songname:n===1?'Shape of You':'Perfect',author_name:'Ed Sheeran',album_info:{album_id:'1',album_name:'÷'},audio_info:{audio_id:String(n),hash:h(n),hash_320:h(n+10000),filesize:3740360,timelength:233744}});
const sig=()=>new AbortController().signal;
const reject=(p:Promise<unknown>,kind:AccountPlaylistError['kind'])=>assert.rejects(p,e=>e instanceof AccountPlaylistError&&e.kind===kind&&!e.message.includes('unit-only'));
function setup(){
 let current:readonly MusicAccount[]=[account],serial=0,stored:unknown,session:Record<string,unknown>={version:1,platform:'kg',userId:'123',mid:'d'.repeat(32),token:'unit-only'};
 const calls:{path:string;body:Record<string,any>}[]=[];let signing=md5;
 let serve:(path:string,body:Record<string,any>)=>Promise<any>=async path=>path==='/v7/get_all_list'?{status:1,error_code:0,data:{total:2,info:[entry(),{...entry('11'),is_collect:1}]}}:path==='/v4/get_list_all_file_v3'?{status:1,data:{count:3,info:[{hash:h(2)},{hash:h(1)},{hash:h(2)}]}}:{error_code:0,data:[[detail(1)],[detail(2)]]};
 let write:((v:unknown)=>Promise<void>)|undefined;
 const repo:Pick<Repository,'get'|'put'>={get:async<T>()=>stored as T,put:async(_,v)=>{if(write)await write(v);stored=structuredClone(v);}};
 const library=new LibraryStore(repo,()=>String(++serial));
 const http:HTTPClient=async(url,request)=>{
  const u=new URL(url),body=JSON.parse(request.body!);assert.equal(u.origin,'https://gateway.kugou.com');assert.equal(request.credentials,'omit');assert.equal(request.method,'POST');
  if(u.pathname!=='/v2/album_audio/audio'){
   const query=Object.fromEntries(u.searchParams),signature=query.signature;delete query.signature;const salt='OIlwieks28dk2k092lksi2UIkp';
   assert.equal(signature,await md5(salt+Object.keys(query).sort().map(k=>`${k}=${query[k]}`).join('')+request.body+salt));assert.equal(query.token,'unit-only');assert.equal(request.headers?.['x-router'],'cloudlist.service.kugou.com');
  }else{assert.ok(!url.includes('unit-only'));assert.ok(!JSON.stringify(request).includes('unit-only'));assert.equal(request.headers?.['x-router'],'kmr.service.kugou.com');}
  calls.push({path:u.pathname,body});return serve(u.pathname,body);
 };
 const client=new AccountPlaylists({http,accounts:{getSnapshot:()=>current,session:async()=>session},profile:{fetch:async()=>{throw new Error('WY must not run');}},kugou:new KugouPlaylists({http,md5:v=>signing(v),now:()=>1700000000000}),library});
 return{client,library,repo,calls,serve:(v:typeof serve)=>{serve=v;},accounts:(v:typeof current)=>{current=v;},session:(v:typeof session)=>{session=v;},signing:(v:typeof signing)=>{signing=v;},write:(v:typeof write)=>{write=v;}};
}
test('Kugou signed catalog and complete copy preserve ordered repeated entries without credentials',async()=>{
 const s=setup(),lists=await s.client.list(account,sig());assert.deepEqual(lists.map(x=>x.kind),['created','favorite']);assert.equal(lists[0]!.coverUrl,'https://imge.kugou.com/240/public.jpg');
 const p=await s.client.preview(account,lists[0]!,sig());assert.deepEqual(p.tracks.map(t=>t.title),['Perfect','Shape of You','Perfect']);
 await s.client.importPreview(account,p,sig());const restored=new LibraryStore(s.repo,()=> 'unused');await restored.restore();const list=restored.getSnapshot().playlists[0]!;
 assert.equal(list.entries.length,3);assert.equal(new Set(list.entries.map(e=>e.id)).size,3);assert.ok(!JSON.stringify(list).includes('unit-only'));
 await reject(s.client.importPreview(account,p,sig()),'account_changed');
});
test('Kugou known catalog total permits short intermediate pages and stays stable',async()=>{
 const s=setup();s.serve(async(_path,b)=>({status:1,data:{total:2,info:[entry(b.page===1?'10':'11')]}}));assert.equal((await s.client.list(account,sig())).length,2);assert.deepEqual(s.calls.map(x=>x.body.page),[1,2]);
});
test('Kugou catalog rejects repeat pages, missing or changed totals, invalid IDs and excess counts',async()=>{
 for(const second of [{total:2,info:[entry()]},{info:[entry('11')]},{total:3,info:[entry('11')]},{total:2,info:[]}]){
  const s=setup();let n=0;s.serve(async()=>({status:1,data:++n===1?{total:2,info:[entry()]}:second}));await reject(s.client.list(account,sig()),'incomplete');
 }
 for(const bad of [{...entry(),listid:9007199254740992},{...entry(),count:10001}]){const s=setup();s.serve(async()=>({status:1,data:{total:1,info:[bad]}}));await reject(s.client.list(account,sig()),'incomplete');}
});
test('Kugou empty catalog and empty playlist have explicit successful envelopes',async()=>{
 const s=setup();s.serve(async()=>({status:1,data:{total:0,info:[]}}));assert.deepEqual(await s.client.list(account,sig()),[]);
 s.serve(async path=>({status:1,data:path==='/v7/get_all_list'?{total:1,info:[{...entry(),count:0}]}:{count:0,info:[]}}));const lists=await s.client.list(account,sig()),p=await s.client.preview(account,lists[0]!,sig());assert.equal(p.tracks.length,0);await s.client.importPreview(account,p,sig());assert.equal(s.library.getSnapshot().playlists[0]!.entries.length,0);assert.ok(!s.calls.some(c=>c.path==='/v2/album_audio/audio'));
});
test('Kugou file pages reject repeated blocks, changing or forgotten totals and overshoot',async()=>{
 for(const next of [{count:3,info:[{hash:h(1)}]},{count:4,info:[{hash:h(2)}]},{info:[{hash:h(2)}]},{count:3,info:[]},{count:3,info:[{hash:h(2)},{hash:h(3)},{hash:h(4)}]}]){
  const s=setup(),lists=await s.client.list(account,sig());let n=0;s.serve(async()=>({status:1,data:++n===1?{count:3,info:[{hash:h(1)}]}:next}));await reject(s.client.preview(account,lists[0]!,sig()),'incomplete');assert.ok(!s.calls.some(c=>c.path==='/v2/album_audio/audio'));
 }
});
test('Kugou detail resolution batches 100 and short hash pages continue until the known count',async()=>{
 const s=setup(),lists=await s.client.list(account,sig()),ids=Array.from({length:101},(_,i)=>i+1);
 s.serve(async(path,b)=>path==='/v4/get_list_all_file_v3'?{status:1,data:{count:101,info:(b.page===1?ids.slice(0,1):ids.slice(1)).map(n=>({filehash:h(n)}))}}:{error_code:0,data:b.data.slice().reverse().map((v:{hash:string})=>[detail(parseInt(v.hash,16))])});
 const p=await s.client.preview(account,lists[0]!,sig());assert.equal(p.tracks.length,101);assert.deepEqual(p.tracks.map(t=>t.metadata.songmid),ids.map(String));assert.deepEqual(s.calls.filter(c=>c.path==='/v2/album_audio/audio').map(c=>c.body.data.length),[100,1]);
});
test('Kugou quality aliases retain requested entries and missing details retry only once',async()=>{
 const s=setup(),lists=await s.client.list(account,sig());let n=0;s.serve(async path=>path==='/v4/get_list_all_file_v3'?{status:1,data:{count:2,info:[{hash:h(10001)},{hash:h(1)}]}}:{error_code:0,data:++n===1?[]:[[detail(1)]]});
 const p=await s.client.preview(account,lists[0]!,sig());assert.equal(p.tracks.length,2);assert.equal(p.tracks[0]!.origin.id,p.tracks[1]!.origin.id);assert.equal(n,2);
 s.serve(async path=>path==='/v4/get_list_all_file_v3'?{status:1,data:{count:1,info:[{hash:h(3)}]}}:{error_code:0,data:[]});await reject(s.client.preview(account,lists[0]!,sig()),'incomplete');
});
test('Kugou invalid and foreign sessions fail before signing or requests',async()=>{
 for(const bad of [{platform:'wy'},{userId:'124'},{accountId:'foreign'},{version:2},{token:'bad secret'},{mid:'invalid'}]){
  const s=setup();s.session({version:1,platform:'kg',userId:'123',mid:'d'.repeat(32),token:'unit-only',...bad});s.signing(async()=>{assert.fail('unexpected signing');});await reject(s.client.list(account,sig()),'login_required');assert.equal(s.calls.length,0);
 }
});
test('Kugou signing cancellation and late logout cannot publish catalogs',async()=>{
 const s=setup(),controller=new AbortController();let release!:(v:string)=>void;s.signing(()=>new Promise(r=>{release=r;}));const p=s.client.list(account,controller.signal);while(!release)await new Promise(r=>setImmediate(r));controller.abort();release(h(1));await reject(p,'cancelled');assert.equal(s.calls.length,0);
 const late=setup();let respond!:(v:any)=>void;late.serve(()=>new Promise(r=>{respond=r;}));const reading=late.client.list(account,sig());while(!respond)await new Promise(r=>setImmediate(r));late.accounts([]);respond({status:1,data:{total:0,info:[]}});await reject(reading,'account_changed');
});
test('Kugou local write cancellation rolls back before publishing',async()=>{
 const s=setup(),lists=await s.client.list(account,sig()),p=await s.client.preview(account,lists[0]!,sig()),controller=new AbortController();let enter!:()=>void,release!:()=>void;const started=new Promise<void>(r=>{enter=r;});let n=0;
 s.write(async()=>{if(++n===1){enter();await new Promise<void>(r=>{release=r;});}});const pending=s.client.importPreview(account,p,controller.signal);await started;controller.abort();release();await reject(pending,'cancelled');assert.equal(s.library.getSnapshot().playlists.length,0);
});
test('Kugou errors hide credential URLs and cover token URLs are dropped',async()=>{
 const s=setup();s.serve(async()=>{throw new Error('https://gateway.kugou.com/?token=unit-only');});await reject(s.client.list(account,sig()),'unavailable');s.serve(async()=>{throw new HTTPResponseError(401);});await reject(s.client.list(account,sig()),'login_required');
 s.serve(async()=>({status:1,data:{total:1,info:[{...entry(),pic:'https://imge.kugou.com/x?token=unit-only'}]}}));assert.equal((await s.client.list(account,sig()))[0]!.coverUrl,'');
});
