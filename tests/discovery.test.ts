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
