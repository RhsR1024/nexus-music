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
