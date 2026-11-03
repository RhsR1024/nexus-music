import test from 'node:test';
import assert from 'node:assert/strict';
import {ArtistProvider} from '../src/providers/artists.ts';

const artist={id:'123',title:'Synthetic artist',songCount:999};
const signal=()=>new AbortController().signal;
function envelope(page,total=113){
 const start=(page-1)*50,length=Math.max(0,Math.min(50,total-start));
 return{code:'000000',data:{header:{title:'歌手歌曲Tab',...(start+length<total?{nextPageUrl:`http://app.c.nf.migu.cn/MIGUM3.0/bmw/singer/song/v1.0?singerId=123&pageNo=${page+1}&type=1`}:{})},contents:length?[{view:'ZJ-Singer-Song-Scroll',contents:Array.from({length},(_,i)=>({view:'ZJ-Singer-Song-Item',songItem:{songId:String(start+i),copyrightId:`COPY${start+i}`,songName:`Synthetic ${start+i}`,singerList:[{id:'123',name:'Synthetic artist'}],img3:'/data/cover.webp',audioFormats:[{formatType:'HQ',asize:1000}],duration:180}}))}]:[]}};
}
function provider(http){return new ArtistProvider({http,md5:async()=>'',sha1:async()=>'',deviceId:()=>''});}
test('Migu artist fixed upstream pages re-page without gaps and preserve exact song metadata',async()=>{
 const calls=[],p=provider(async(url,request)=>{const u=new URL(url);assert.equal(u.origin,'https://app.u.nf.migu.cn');assert.equal(u.pathname,'/pc/bmw/singer/song/v1.0');assert.equal(u.searchParams.get('singerId'),'123');assert.equal(request.credentials,'omit');calls.push(Number(u.searchParams.get('pageNo')));return envelope(calls.at(-1));});
 const pages=[];for(let page=1;page<=4;page++)pages.push(await p.songs('mg',artist,page,signal(),30));
 assert.deepEqual(pages.map(p=>p.items.length),[30,30,30,23]);
 assert.deepEqual(pages.flatMap(p=>p.items.map(t=>t.origin.id)),Array.from({length:113},(_,i)=>String(i)));
 assert.deepEqual(pages.map(p=>p.hasMore),[true,true,true,false]);assert.equal(pages[0].total,undefined,'search summary is not a verified catalog count');assert.equal(pages[3].total,113);
 assert.equal(pages[0].items[0].metadata.copyrightId,'COPY0');assert.equal(pages[0].items[0].durationMs,180000);assert.equal(pages[0].items[0].artwork,'https://d.musicapp.migu.cn/data/cover.webp');assert.deepEqual(pages[0].items[0].qualities,[{id:'320k',sizeBytes:1000}]);
 assert.deepEqual(calls,[1,1,2,2,2,3]);
 const terminal=await p.songs('mg',artist,4,signal(),50);assert.equal(terminal.items.length,0);assert.equal(terminal.hasMore,false);assert.equal(terminal.total,undefined);
});
test('Migu continuation is only a validated signal; foreign, repeated and malformed pages fail',async()=>{
 for(const alter of [
  r=>{r.data.header.nextPageUrl='https://private.invalid/library';},
  r=>{r.data.header.nextPageUrl=r.data.header.nextPageUrl.replace('pageNo=2','pageNo=1');},
  r=>{r.data.header.nextPageUrl=r.data.header.nextPageUrl.replace('singerId=123','singerId=456');},
  r=>{r.data.contents[0].contents[0].songItem.singerList=[{id:'456',name:'Synthetic artist'}];},
  r=>{r.data.contents[0].contents.pop();},
  r=>{r.data.contents=[{view:'unknown',contents:[]}];},
  r=>{delete r.data.header;},
 ]){let calls=0;const p=provider(async()=>{calls++;const r=envelope(1);alter(r);return r;});await assert.rejects(p.songs('mg',artist,1,signal()),/响应无效/);assert.equal(calls,1);}
 const p=provider(async()=>envelope(1));await assert.rejects(p.songs('mg',artist,1,signal(),100),/响应无效/);
});
test('Migu artist cancellation during re-paging discards partial data and stops further reads',async()=>{
 const controller=new AbortController();let calls=0;const p=provider(async()=>{calls++;controller.abort();return envelope(1);});await assert.rejects(p.songs('mg',artist,1,controller.signal,100),/取消/);assert.equal(calls,1);
});
test('Migu artist real empty catalog is distinct from an unsupported or malformed response',async()=>{
 const p=provider(async()=>envelope(1,0));assert.deepEqual((await p.songs('mg',artist,1,signal())).items,[]);
 for(const raw of [{code:'299996'},{code:'000000',data:{} }])await assert.rejects(provider(async()=>raw).songs('mg',artist,1,signal()));
});
