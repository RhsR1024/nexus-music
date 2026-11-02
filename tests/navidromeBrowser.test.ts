import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NavidromeBrowser} from '../src/app/navidromeBrowser.ts';
import {NavidromeClient} from '../src/providers/navidrome.ts';
function fixture(){
  const requests:{account:string;method:string;offset:number;query:string;signal:AbortSignal}[]=[];
  let fail=false,hold:((value:unknown)=>void)|undefined,holdDetail=false;
  const browser=new NavidromeBrowser(async account=>new NavidromeClient({id:account,url:'https://private.invalid',username:account},{username:account,password:'SECRET'},{md5:async()=> 'TOKEN',salt:()=> 'fixture-salt',http:async(url,request,signal)=>{
    const method=url.split('/').at(-1)!.replace('.view',''),params=new URLSearchParams(request.body);
    const offset=Number(params.get('songOffset')??params.get('offset')??0);
    requests.push({account,method,offset,query:params.get('query')??'',signal:signal!});
    if(fail){fail=false;throw new Error('PRIVATE_EXCEPTION_URL_TOKEN');}
    if(holdDetail&&method==='getArtist')return new Promise(resolve=>{hold=resolve;});
    const album=(id:number)=>({id:`album-${id}`,name:`Album ${id}`,artist:'Artist',coverArt:'cover-id'});
    const songs=Array.from({length:120},(_,i)=>({id:`song-${i}`,title:`Song ${i}`,artist:'Artist',duration:120}));
    const body=method==='getArtists'?{artists:{index:[{artist:Array.from({length:120},(_,i)=>({id:`artist-${i}`,name:`Artist ${i}`}))}]}}:
      method==='getArtist'?{artist:{id:params.get('id'),name:'Selected artist',album:Array.from({length:65},(_,i)=>album(i))}}:
      method==='getAlbum'?{album:{id:params.get('id'),name:'Selected album',song:songs}}:
      method==='getAlbumList2'?{albumList2:{album:Array.from({length:75},(_,i)=>album(i)).slice(offset,offset+50)}}:
      method==='search3'?{searchResult3:{song:songs.slice(offset,offset+50)}}:
      method==='getPlaylists'?{playlists:{playlist:Array.from({length:120},(_,i)=>({id:`list-${i}`,name:`List ${i}`,owner:'Owner'}))}}:
      {playlist:{id:params.get('id'),name:'Selected playlist',entry:songs}};
    return {'subsonic-response':{status:'ok',...body}};
  }}));
  return {browser,requests,fail:()=>{fail=true;},hold:()=>{holdDetail=true;},release:()=>hold?.({'subsonic-response':{status:'ok',artist:{id:'late',name:'WRONG OLD ACCOUNT',album:[]}}})};
}
async function settled(browser:NavidromeBrowser){for(let i=0;i<30;i++){await new Promise(resolve=>setImmediate(resolve));if(!browser.getSnapshot().loading)return;}throw Error('browser did not settle');}
test('artist → paged albums → paged songs restores both loaded parent pages without rereading',async()=>{
 const {browser:b,requests}=fixture();b.setAccount('one');await settled(b);b.selectRoot('artists');await settled(b);b.page(1);
 const artists=b.getSnapshot().frame;assert.equal(artists.items.length,100);assert.equal(artists.more,true);
 b.open({kind:'artist',id:'artist-60'});await settled(b);b.page(1);const albums=b.getSnapshot().frame;
 assert.equal(albums.items.length,65);b.open({kind:'album',id:'album-60'});await settled(b);b.page(1);assert.equal(b.getSnapshot().frame.items.length,120);
 const count=requests.length;b.back();assert.equal(b.getSnapshot().frame,albums);b.back();assert.equal(b.getSnapshot().frame,artists);assert.equal(requests.length,count);
 await b.load(true);assert.equal(b.getSnapshot().frame.items.length,120);assert.equal(b.getSnapshot().frame.visiblePage,2);assert.equal(b.getSnapshot().frame.more,false);
 b.open({kind:'artist',id:'artist-119'});await settled(b);b.back();assert.equal(b.getSnapshot().frame.visiblePage,2);assert.equal(b.getSnapshot().frame.offset,120);
 assert.ok(!/SECRET|TOKEN|https:|PRIVATE/.test(JSON.stringify(b.getSnapshot())));
});
test('root sections restore submitted song search, draft text, loaded pages, and playlist context',async()=>{
 const {browser:b,requests}=fixture();b.setAccount('one');await settled(b);b.selectRoot('songs');await settled(b);b.setQuery('Some artist');b.search();await settled(b);await b.load(true);b.setQuery('Draft query');b.page(1);
 const songs=b.getSnapshot().frame;b.selectRoot('playlists');await settled(b);b.page(1);b.setName('Draft list');const lists=b.getSnapshot().frame;
 b.open({kind:'playlist',id:'list-60'});await settled(b);b.back();assert.equal(b.getSnapshot().frame,lists);
 const count=requests.length;b.selectRoot('songs');assert.equal(b.getSnapshot().frame,songs);assert.equal(b.getSnapshot().frame.query,'Draft query');assert.equal(songs.view.kind==='songs'?songs.view.query:undefined,'Some artist');assert.equal(requests.length,count);
 await b.load(true);assert.equal(requests.at(-1)!.query,'Some artist');assert.equal(requests.at(-1)!.offset,100);
});
test('pagination and refresh failure retain loaded content and retry the correct offset',async()=>{
 const {browser:b,fail,requests}=fixture();b.setAccount('one');await settled(b);const items=b.getSnapshot().frame.items;
 fail();await b.load(true);assert.equal(b.getSnapshot().frame.items,items);assert.equal(b.getSnapshot().frame.retryAppend,true);assert.ok(!b.getSnapshot().frame.error.includes('PRIVATE'));
 await b.load(b.getSnapshot().frame.retryAppend);assert.deepEqual(requests.slice(-2).map(r=>r.offset),[50,50]);assert.equal(b.getSnapshot().frame.items.length,75);b.page(1);
 const loaded=b.getSnapshot().frame;fail();await b.load();assert.equal(b.getSnapshot().frame.items,loaded.items);assert.equal(b.getSnapshot().frame.visiblePage,1);assert.equal(b.getSnapshot().frame.offset,75);
 await b.load();assert.equal(b.getSnapshot().frame.items.length,50);assert.equal(b.getSnapshot().frame.visiblePage,0);
});
test('back, account switch/removal, and disposal abort old requests and ignore late results',async()=>{
 const f=fixture(),b=f.browser;b.setAccount('one');await settled(b);b.selectRoot('artists');await settled(b);const parent=b.getSnapshot().frame;
 f.hold();b.open({kind:'artist',id:'artist-60'});await new Promise(resolve=>setImmediate(resolve));const oldSignal=f.requests.at(-1)!.signal;
 b.back();assert.equal(oldSignal.aborted,true);f.release();await settled(b);assert.equal(b.getSnapshot().frame,parent);
 b.open({kind:'artist',id:'artist-60'});await new Promise(resolve=>setImmediate(resolve));b.setAccount('two');f.release();await settled(b);assert.equal(b.getSnapshot().accountId,'two');assert.equal(b.getSnapshot().parents.length,0);assert.equal(b.getSnapshot().frame.view.kind,'albums');assert.equal(b.getSnapshot().frame.items.length,50);
 b.setAccount('');assert.equal(b.getSnapshot().frame.items.length,0);assert.equal(b.getSnapshot().parents.length,0);b.cancel();
});
test('a cancelled account-client acquisition never starts network requests',async()=>{
 let requested=0;let resolve!:(value:NavidromeClient)=>void;
 const b=new NavidromeBrowser(()=>new Promise(done=>{resolve=done;}));b.setAccount('removed');b.setAccount('');
 const client=new NavidromeClient({id:'removed',url:'https://private.invalid',username:'u'},{username:'u',password:'p'},{md5:async()=>'',salt:()=> 'fixture-salt',http:async()=>{requested++;throw Error('must not be called');}});
 resolve(client);await settled(b);assert.equal(b.getSnapshot().accountId,'');assert.equal(b.getSnapshot().loading,false);assert.equal(requested,0);
});

test('acknowledged server stars update cached occurrences without losing loaded pages or search context',async()=>{
 const {browser:b}=fixture();b.setAccount('one');await settled(b);b.selectRoot('songs');await settled(b);b.setQuery('Artist');b.search();await settled(b);await b.load(true);b.page(1);
 b.selectRoot('albums');b.open({kind:'album',id:'album-0'});await settled(b);b.page(1);b.setStarred('song-50',true);
 assert.equal(b.getSnapshot().frame.visiblePage,1);let song=b.getSnapshot().frame.items[50];assert.ok(song?.kind==='track');assert.equal(song.track.metadata.starred,true);
 b.back();b.selectRoot('songs');const saved=b.getSnapshot().frame;assert.equal(saved.query,'Artist');assert.equal(saved.visiblePage,1);assert.equal(saved.items.length,100);assert.equal(saved.offset,100);
 song=saved.items[50];assert.ok(song?.kind==='track');assert.equal(song.track.metadata.starred,true);b.setStarred('song-50',false);song=b.getSnapshot().frame.items[50];assert.ok(song?.kind==='track');assert.equal(song.track.metadata.starred,false);
 b.setAccount('two');await settled(b);assert.equal(b.getSnapshot().parents.length,0);assert.equal(b.getSnapshot().frame.view.kind,'albums');
});
