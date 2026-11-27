import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DiscoveryProvider} from '../src/providers/discovery.ts';
const sha=async()=> '0'.repeat(40);
const song=(id:string)=>({id,name:'Synthetic fixture',ar:[{name:'Fixture'}],al:{name:'Fixture'},dt:1000});
test('playlist import fills missing metadata and preserves duplicate IDs and ordering',async()=>{
  const p=new DiscoveryProvider(sha,async url=>url.includes('song/detail')?{songs:[song('2')]}:{code:200,playlist:{name:'Fixture',trackIds:[{id:'1'},{id:'2'},{id:'1'}],tracks:[song('1')]}});
  const result=await p.complete('wy','123',new AbortController().signal);assert.deepEqual(result.tracks.map(track=>track.origin.id),['1','2','1']);assert.equal(result.title,'Fixture');
});
test('incomplete playlist metadata is rejected rather than silently omitting tracks',async()=>{
  const p=new DiscoveryProvider(sha,async url=>url.includes('song/detail')?{songs:[]}:{code:200,playlist:{trackIds:[{id:'1'}],tracks:[]}});
  await assert.rejects(p.complete('wy','123',new AbortController().signal),/部分歌曲/);
});
test('unadvanced server pagination cannot produce an endlessly duplicated import',async()=>{
  const p=new DiscoveryProvider(sha,async()=>({title:'Fixture',total:10000,musiclist:[{id:'1',name:'Synthetic',artist:'Fixture'}]}));
  await assert.rejects(p.complete('kw','123',new AbortController().signal),/分页/);
});
test('nested Kugou plaza and Migu template categories use actual wire fields',async()=>{
  const p=new DiscoveryProvider(sha,async url=>url.includes('kugou')?{plist:{list:{total:1,info:[{specialid:123,specialname:'Fixture',songcount:2}]}}}:{code:'000000',data:[{content:[{texts:['Fixture tag','123','unused']}]}]});
  const page=await p.playlists('kg',1,undefined,new AbortController().signal);assert.equal(page.items[0]?.id,'123');assert.equal(page.hasMore,false);
  assert.deepEqual(await p.categories('mg',new AbortController().signal),[{id:'123',title:'Fixture tag'}]);
});
test('Kuwo category digest chooses zone versus tag and excludes unsupported album entries',async()=>{
  const signal=new AbortController().signal;
  const p=new DiscoveryProvider(sha,async url=>{
    if(url.includes('getTagList'))return{data:[{data:[{id:'211',name:'Synthetic zone',digest:'43'},{id:'12',name:'Synthetic tag',digest:'10000'}]}]};
    if(url.includes('get_pc_qz_data'))return[{list:[{type:'album',digest:'13',id:'9',name:'album'},{type:'songlist',digest:'8',id:'1',name:'playlist'}]}];
    assert.equal(new URL(url).searchParams.get('id'),'12');return{data:{data:[{id:'2',name:'Tag playlist'}],total:1}};
  });
  assert.deepEqual((await p.categories('kw',signal)).map(c=>c.id),['211-43','12-10000']);
  assert.deepEqual((await p.playlists('kw',1,'211-43',signal)).items.map(v=>v.id),['1']);
  assert.equal((await p.playlists('kw',1,'12-10000',signal)).items[0]?.id,'2');
});
test('Migu category template retains playlist identity, art and explicit next page',async()=>{
  const p=new DiscoveryProvider(sha,async()=>({code:'000000',data:{nextPageUrl:'http://app.c.nf.migu.cn/path?pageNumber=2',contentItemList:[{itemList:[{title:'Fixture',imageUrl:'https://example.test/cover',logEvent:{contentType:'2021',contentId:'123'}}]}]}}));
  const page=await p.playlists('mg',1,'1',new AbortController().signal);assert.equal(page.items[0]?.id,'123');assert.equal(page.hasMore,true);assert.equal(page.items[0]?.artwork,'https://example.test/cover');
});

test('complete import rejects a terminal provider page shorter or longer than its declared total',async()=>{
  for(const total of [0,1,3]){
    const p=new DiscoveryProvider(sha,async()=>({title:'Fixture',total,musiclist:[{id:'1',name:'One',artist:'Fixture'},{id:'2',name:'Two',artist:'Fixture'}]}));
    await assert.rejects(p.complete('kw','123',new AbortController().signal),/完整|数量/);
  }
});
test('complete import rejects fractional or unsafe declared totals',async()=>{
  for(const total of [1.5,Number.MAX_SAFE_INTEGER+1]){
    const p=new DiscoveryProvider(sha,async()=>({title:'Fixture',total,musiclist:[{id:'1',name:'One',artist:'Fixture'}]}));
    await assert.rejects(p.complete('kw','123',new AbortController().signal),/数量/);
  }
});
test('complete import rejects changing declared totals between pages',async()=>{
  const p=new DiscoveryProvider(sha,async url=>{
    const page=Number(new URL(url).searchParams.get('pn'));
    return{title:'Fixture',total:page===0?101:102,musiclist:Array.from({length:page===0?100:2},(_,i)=>({id:String(page*100+i+1),name:'Synthetic',artist:'Fixture'}))};
  });
  await assert.rejects(p.complete('kw','123',new AbortController().signal),/数量|变化/);
});
test('complete import retains a known total when a later page omits it and preserves duplicates',async()=>{
  const p=new DiscoveryProvider(sha,async url=>{
    const page=Number(new URL(url).searchParams.get('pn'));
    return{title:'Fixture',...(page===0?{total:101}:{}),musiclist:Array.from({length:page===0?100:1},(_,i)=>({id:String(page===0?i+1:1),name:'Synthetic',artist:'Fixture'}))};
  });
  const result=await p.complete('kw','123',new AbortController().signal);
  assert.equal(result.tracks.length,101);assert.equal(result.tracks[100]?.origin.id,'1');assert.equal(result.tracks[0]?.origin.id,'1');
});
test('complete import cannot drop an earlier total to accept a truncated terminal page',async()=>{
  const p=new DiscoveryProvider(sha,async url=>{
    const page=Number(new URL(url).searchParams.get('pn'));
    return{title:'Fixture',...(page===0?{total:102}:{}),musiclist:Array.from({length:page===0?100:1},(_,i)=>({id:String(page*100+i+1),name:'Synthetic',artist:'Fixture'}))};
  });
  await assert.rejects(p.complete('kw','123',new AbortController().signal),/完整|数量/);
});
test('complete import still supports unknown totals with a terminating short page',async()=>{
  const p=new DiscoveryProvider(sha,async url=>({title:'Fixture',musiclist:Array.from({length:new URL(url).searchParams.get('pn')==='0'?100:1},(_,i)=>({id:String(i+1),name:'Synthetic',artist:'Fixture'}))}));
  assert.equal((await p.complete('kw','123',new AbortController().signal)).tracks.length,101);
});
test('complete import rejects a late terminal response after cancellation even if transport ignores abort',async()=>{
  const controller=new AbortController();
  const p=new DiscoveryProvider(sha,async()=>{controller.abort();return{title:'Fixture',total:1,musiclist:[{id:'1',name:'One',artist:'Fixture'}]};});
  await assert.rejects(p.complete('kw','123',controller.signal),{name:'AbortError'});
});
test('style recommendation reads each selected public category and preserves successful groups on failure',async()=>{
  const signal=new AbortController().signal;
  const p=new DiscoveryProvider(sha,async url=>{
    const category=new URL(url).searchParams.get('cat');
    if(category==='电子')throw new TypeError('Network request failed');
    return{code:200,more:false,playlists:[
      {id:'shared',name:'Shared fixture',trackCount:2},
      {id:category==='说唱'?'rap-only':'mood-only',name:`${category} fixture`,trackCount:1},
    ]};
  });
  const result=await p.styleRecommendations('wy',[
    {id:'说唱',name:'说唱',dimension:'genre'},
    {id:'伤感',name:'伤感',dimension:'mood'},
    {id:'电子',name:'电子',dimension:'genre'},
  ],signal);
  assert.deepEqual(result.failedTags.map(value=>value.name),['电子']);
  assert.deepEqual(result.items.map(value=>value.playlist.id),['shared','rap-only','mood-only']);
  assert.deepEqual(result.items[0]?.matchedTags.map(value=>value.name),['说唱','伤感']);
});
test('style recommendation rejects duplicate-beyond-limit or pre-cancelled selections before transport',async()=>{
  let calls=0;
  const p=new DiscoveryProvider(sha,async()=>{calls++;return{code:200,more:false,playlists:[]};});
  await assert.rejects(p.styleRecommendations('wy',Array.from({length:6},(_,index)=>({id:String(index),name:String(index),dimension:'genre' as const})),new AbortController().signal),/最多选择/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(p.styleRecommendations('wy',[{id:'one',name:'one',dimension:'genre'}],controller.signal),{name:'AbortError'});
  assert.equal(calls,0);
});
test('NetEase banners parse Sollin /api/v2/banner/get response, classify orpheus/music.163 targets, hydrate missing songs, and ignore non-wy platforms',async()=>{
  const seenUrls:string[]=[];
  const p=new DiscoveryProvider(sha,async(url,req)=>{
    seenUrls.push(url);
    if(url.includes('/api/v2/banner/get')){
      assert.ok(url.includes('clientType=pc'));
      assert.equal(req?.credentials,'omit');
      return{code:200,banners:[
        {bannerId:'b1',pic:'http://p1.music.126.net/a.jpg',typeTitle:'新歌首发',titleColor:'red',targetType:1,targetId:12345,url:'orpheus://song/12345'},
        {bannerId:'b2',imageUrl:'https://p2.music.126.net/b.jpg',typeTitle:'活动',titleColor:'red',targetType:3000,targetId:0,url:'https://act.music.163.com/activity'},
        {bannerId:'b3',imageUrl:'https://p2.music.126.net/c.jpg',typeTitle:'精选歌单',titleColor:'blue',targetType:3000,targetId:0,url:'https://music.163.com/#/playlist?id=998877'},
        {bannerId:'bad',pic:'javascript:alert(1)',targetType:1,targetId:1},
      ]};
    }
    if(url.includes('/api/v3/song/detail')){
      assert.equal(req?.method,'POST');
      assert.equal(req?.credentials,'omit');
      return{code:200,songs:[{id:12345,name:'心动一半',ar:[{name:'Gareth.T'}],al:{name:'Single',picUrl:'http://p1.music.126.net/cover.jpg'},dt:200000}]};
    }
    throw new Error(`unexpected URL ${url}`);
  });
  assert.deepEqual(await p.banners('tx',new AbortController().signal),[]);
  const banners=await p.banners('wy',new AbortController().signal);
  assert.equal(banners.length,3);
  assert.equal(banners[0]?.imageUrl,'https://p1.music.126.net/a.jpg');
  assert.equal(banners[0]?.targetType,1);
  assert.equal(banners[0]?.url,undefined);
  assert.equal(banners[0]?.song?.title,'心动一半');
  assert.equal(banners[1]?.targetType,3000);
  assert.equal(banners[1]?.url,'https://act.music.163.com/activity');
  assert.equal(banners[2]?.targetType,1000);
  assert.equal(banners[2]?.targetId,'998877');
  assert.equal(banners[2]?.url,undefined);
  assert.equal(seenUrls.filter(u=>u.includes('/api/v3/song/detail')).length,1);
});
