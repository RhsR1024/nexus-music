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
