import test from 'node:test';import assert from 'node:assert/strict';
import {ArtistProvider} from '../src/providers/artists.ts';
import {AlbumProvider} from '../src/providers/albums.ts';
import {cleanCatalogTarget} from '../src/storage/catalogFavorites.ts';
import {emptyLibrary} from '../src/storage/library.ts';
import {buildSyncState,libraryFromSync,encodeSync,decodeSync} from '../src/storage/multiDeviceSync.ts';
const signal=()=>new AbortController().signal;
const deps=http=>({http,md5:async()=>'',sha1:async()=>'',deviceId:()=>''});
const artist={id:'123',title:'Synthetic Artist'};
function listing(page,total=24){const start=(page-1)*10,length=Math.max(0,Math.min(10,total-start));return{code:'000000',data:{header:{title:'专辑列表页',...(start+length<total?{nextPageUrl:`http://app.c.nf.migu.cn/MIGUM3.0/bmw/singer/album/v1.0?singerId=123&pageNo=${page+1}`}:{})},contents:Array.from({length},(_,i)=>{const id=String(start+i+1),digital=i%2===0;return{view:'ZJ-Album-Item',resType:digital?'1':'0',resId:id,action:`mgmusic://${digital?'digital-album-info':'album-info'}?id=${id}`,txt:`Synthetic Album ${id}`,txt2:'Synthetic Artist',txt3:'2026-11-03',img:'/data/cover.webp'};})}};}
const normalInfo=(total=3)=>({code:'000000',data:{resourceType:'2003',albumId:'42',title:'Synthetic Normal',singer:'Synthetic Artist',totalCount:total,publishDate:'2026-11-03'}});
const song=(id,extra={})=>({songId:String(id),copyrightId:`COPY${id}`,songName:`Synthetic ${id}`,albumId:'42',album:'Synthetic Normal',singerList:[{id:'123',name:'Synthetic Artist'}],duration:180,...extra});
function digital(){return{code:'000000',resource:[{resourceType:'5',contentId:'42',materialId:'999',title:'Synthetic Digital',totalCount:'2',singer:'Synthetic Artist',publishDate:'2026-11-03',songItems:[song(1,{dalbumId:'42',albumId:'999',duration:undefined,length:'00:03:18',newRateFormats:[{formatType:'SQ',size:'10000'}],albumImgs:[{img:'https://images.example/cover.jpg'}]}),song(2,{dalbumId:'42',albumId:'999',length:'00:03:00'})]}]};}
test('Migu artist albums re-page fixed ten-entry upstream pages and retain digital resource identity',async()=>{
 const calls=[],p=new ArtistProvider(deps(async(url,request)=>{const u=new URL(url);assert.equal(u.origin,'https://app.u.nf.migu.cn');assert.equal(u.searchParams.get('singerId'),'123');assert.equal(request.credentials,'omit');const page=Number(u.searchParams.get('pageNo'));calls.push(page);return listing(page);}));
 const a=await p.albums('mg',artist,1,signal(),13),b=await p.albums('mg',artist,2,signal(),13);assert.equal(a.items.length,13);assert.equal(b.items.length,11);assert.equal(a.hasMore,true);assert.equal(b.hasMore,false);assert.equal(b.total,24);assert.equal(new Set([...a.items,...b.items].map(v=>v.id)).size,24);assert.deepEqual(calls,[1,2,2,3]);assert.equal(a.items[0].id,'migu-digital-1');assert.equal(a.items[1].id,'2');assert.equal(a.items[0].description,'数字专辑');assert.equal(a.items[0].artwork,'https://d.musicapp.migu.cn/data/cover.webp');
});
test('Migu artist album continuations and resource actions cannot change artist, page or resource kind',async()=>{
 for(const alter of [r=>{r.data.header.nextPageUrl='https://private.invalid/';},r=>{r.data.header.nextPageUrl=r.data.header.nextPageUrl.replace('123','456');},r=>{r.data.contents[0].action='mgmusic://album-info?id=1';},r=>{r.data.contents[0].resType='unknown';},r=>{r.data.contents.pop();},r=>{r.data.contents[0].resId=9007199254740992;}]){
  let calls=0;const p=new ArtistProvider(deps(async()=>{calls++;const r=listing(1);alter(r);return r;}));await assert.rejects(p.albums('mg',artist,1,signal()),/咪咕专辑响应/);assert.equal(calls,1);
 }
});
test('normal album snapshot checks metadata and all pages before exposing tracks, preserving duplicates',async()=>{
 const requests=[],p=new AlbumProvider(deps(async(url,request)=>{const u=new URL(url);requests.push(u);assert.equal(request.credentials,'omit');assert.equal(u.searchParams.get('albumId'),'42');if(u.pathname==='/resource/album/v2.0')return normalInfo();return{code:'000000',data:{songList:u.searchParams.get('pageNo')==='1'?[song(1),song(2)]:[song(1)],totalCount:3,hasNext:u.searchParams.get('pageNo')==='1'}};}));
 const result=await p.complete('mg',{id:'42',title:'Old title'},signal());assert.equal(result.title,'Synthetic Normal');assert.equal(result.scope,undefined);assert.deepEqual(result.tracks.map(t=>t.origin.id),['1','2','1']);assert.equal(requests.length,3);
 const page=await p.detail('mg',{id:'42',title:'Old title'},2,signal(),2);assert.equal(page.items.length,1);assert.equal(page.hasMore,false);assert.equal(page.info.released,'2026-11-03');assert.equal(page.total,3);
});
test('digital album goes to its own resource namespace and maps public timing, copyright and quality metadata',async()=>{
 let url;const p=new AlbumProvider(deps(async u=>{url=new URL(u);return digital();})),r=await p.detail('mg',{id:'migu-digital-42',title:'Old title'},1,signal(),1);assert.equal(url.pathname,'/v1.0/content/resourceinfo.do');assert.equal(url.searchParams.get('resourceType'),'5');assert.equal(url.searchParams.get('resourceId'),'42');assert.equal(r.title,'Synthetic Digital');assert.equal(r.scope,'public');assert.equal((await p.complete('mg',{id:'migu-digital-42',title:'Old title'},signal())).scope,'public');assert.equal(r.items[0].metadata.albumId,'999');assert.equal(r.items[0].metadata.copyrightId,'COPY1');assert.equal(r.items[0].durationMs,198000);assert.deepEqual(r.items[0].qualities,[{id:'flac',sizeBytes:10000}]);assert.equal(r.items[0].artwork,'https://images.example/cover.jpg');assert.equal(r.total,2);assert.equal(r.hasMore,true);
});
test('incomplete, foreign, count-drifting or malformed normal/digital albums never masquerade as empty or complete',async()=>{
 for(const alter of [r=>{r.resource[0].contentId='43';},r=>{r.resource[0].songItems.pop();},r=>{r.resource[0].songItems[0].dalbumId='43';},r=>{r.resource[0].songItems[0].length='00:99:00';},r=>{r.resource.push({...r.resource[0]});}]){
  const p=new AlbumProvider(deps(async()=>{const r=digital();alter(r);return r;}));await assert.rejects(p.complete('mg',{id:'migu-digital-42',title:'Synthetic'},signal()));
 }
 for(const data of [{songList:[song(1)],totalCount:3,hasNext:false},{songList:[song(1,{albumId:'43'})],totalCount:3,hasNext:true},{songList:[song(1)],totalCount:2,hasNext:true},{songList:[],totalCount:3,hasNext:true}]){
  const p=new AlbumProvider(deps(async url=>new URL(url).pathname==='/resource/album/v2.0'?normalInfo():{code:'000000',data}));await assert.rejects(p.complete('mg',{id:'42',title:'Synthetic'},signal()));
 }
});
test('digital catalog identity survives sanitization and sync serialization separately from an ordinary album',()=>{
 const targets=['42','migu-digital-42'].map(id=>cleanCatalogTarget({kind:'album',platform:'mg',id,title:'Synthetic'})),library={...emptyLibrary,catalogFavorites:targets.map((t,i)=>({...t,savedId:`saved-${i}`,savedAt:1}))};
 const state=decodeSync(encodeSync(buildSyncState(library,'a'.repeat(32),'b'.repeat(64),'sync/'))),restored=libraryFromSync(state,emptyLibrary);assert.deepEqual(restored.catalogFavorites.map(v=>v.id),['42','migu-digital-42']);assert.equal(state.records.length,2);
});
test('Migu album search preserves explicit resource types while legacy saved IDs resolve only through verified digital identity',async()=>{
 const p=new AlbumProvider(deps(async url=>{const u=new URL(url);if(u.hostname==='jadeite.migu.cn')return{code:'000000',albumResultData:{result:[{id:'42',resourceType:'5',name:'Synthetic Digital'},{id:'42',resourceType:'2003',name:'Synthetic Normal'}],totalCount:2}};if(u.pathname==='/resource/album/v2.0')return{code:'000000',info:'success'};return digital();}));
 const search=await p.search('mg','Synthetic',1,signal());assert.deepEqual(search.items.map(v=>v.id),['migu-digital-42','42']);
 const legacy=await p.complete('mg',{id:'42',title:'Old saved digital'},signal());assert.equal(legacy.scope,'public');assert.equal(legacy.tracks.length,2);
 let calls=0;const foreign=new AlbumProvider(deps(async()=>{calls++;return{...normalInfo(),data:{...normalInfo().data,albumId:'43'}};}));await assert.rejects(foreign.complete('mg',{id:'42',title:'Synthetic'},signal()));assert.equal(calls,1,'A foreign identity must not trigger a digital fallback');
});
test('cancellation while reading a normal album discards the partial snapshot and avoids another page',async()=>{
 const controller=new AbortController();let calls=0;const p=new AlbumProvider(deps(async url=>{calls++;if(new URL(url).pathname==='/resource/album/v2.0')return normalInfo();controller.abort();return{code:'000000',data:{songList:[song(1)],totalCount:3,hasNext:true}};}));await assert.rejects(p.complete('mg',{id:'42',title:'Synthetic'},controller.signal),/取消/);assert.equal(calls,2);
});
