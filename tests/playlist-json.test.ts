import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodePlaylistJSON} from '../src/storage/playlistJSON.ts';
const song={id:'tx_MID',name:'Synthetic',singer:'Fixture',source:'tx',interval:'3:02',meta:{songId:'MID',id:'9007199254740993123',albumName:'Fixture',qualitys:[{type:'128k'}],picUrl:'https://images.invalid/fixture.jpg',password:'private-fixture',_qualitys:{'128k':{size:1234}}}};
test('LX v2 JSON preserves source metadata, ordering and duplicate tracks while excluding credentials',()=>{
  const result=decodePlaylistJSON(JSON.stringify({type:'playList_v2',data:[{name:'Fixture',list:[song,song]}]}));
  assert.equal(result.collections[0]!.tracks.length,2);const track=result.collections[0]!.tracks[0]!;
  assert.equal(track.origin.id,'MID');assert.equal(track.metadata.id,'9007199254740993123');assert.equal(track.durationMs,182000);assert.equal(track.metadata.password,undefined);assert.deepEqual(track.metadata._qualitys,{'128k':{size:1234}});
});
test('unsupported sources are counted and malformed supported songs abort the preview',()=>{
  const raw={type:'playListPart_v2',data:{name:'Fixture',list:[{source:'local',path:'/private/fixture'},song]}};
  assert.equal(decodePlaylistJSON(JSON.stringify(raw)).unsupported,1);
  assert.throws(()=>decodePlaylistJSON(JSON.stringify({...raw,data:{...raw.data,list:[{source:'wy'}]}})));
  assert.throws(()=>decodePlaylistJSON(JSON.stringify({type:'unknown',data:[]})));
});
test('kg tracks keep the LX composite songmid_hash identity and quality hashes',()=>{
  const kg={id:'2829_abcdef',name:'KG',singer:'Fixture',source:'kg',interval:'4:00',meta:{songId:'2829',hash:'abcdef',qualitys:[{type:'128k',size:'3.56M',hash:'h1'},{type:'320k',size:null,hash:'h2'}],_qualitys:{'128k':{size:'3.56M',hash:'h1'}}}};
  const list=[kg,{...kg,id:'kg_2829_abcdef'},{...kg,id:'2829'}];
  const tracks=decodePlaylistJSON(JSON.stringify({type:'playList_v2',data:[{name:'KG',list}]})).collections[0]!.tracks;
  assert.deepEqual(tracks.map(track=>track.origin.id),['2829_abcdef','2829_abcdef','2829_abcdef']);
  assert.equal(tracks[0]!.metadata.songId,'2829');assert.equal(tracks[0]!.metadata.hash,'abcdef');
  assert.deepEqual(tracks[0]!.qualities,[{id:'128k'},{id:'320k'}]);
  assert.equal((tracks[0]!.metadata.qualitys as {hash?:string}[])[0]!.hash,'h1');
});
test('unquoted long tx song ids survive JSON parsing without IEEE754 rounding',()=>{
  const input='{"type":"playList_v2","data":[{"name":"Raw","list":[{"id":"tx_MID","name":"Raw","singer":"Fixture","source":"tx","interval":"3:02","meta":{"songId":"MID","id":9007199254740993123,"strMediaMid":"MID_HI","qualitys":[{"type":"320k","size":"9.99M"}]}}]}]}';
  const track=decodePlaylistJSON(input).collections[0]!.tracks[0]!;
  assert.equal(track.origin.id,'MID');assert.equal(track.metadata.id,'9007199254740993123');assert.equal(track.metadata.strMediaMid,'MID_HI');
});
test('LX duration is finite and bounded to 24 hours',()=>{
  const base={name:'D',singer:'F',source:'wy',meta:{songId:'1'}};
  const list=[{...base,id:'wy_1',interval:'0:59'},{...base,id:'wy_2',interval:'1439:59'},{...base,id:'wy_3',interval:'1440:00'},
    {...base,id:'wy_4',interval:'1440:01'},{...base,id:'wy_5',interval:`${'9'.repeat(400)}:00`},{...base,id:'wy_6',interval:'3:75'}];
  const tracks=decodePlaylistJSON(JSON.stringify({type:'playList_v2',data:[{name:'D',list}]})).collections[0]!.tracks;
  assert.deepEqual(tracks.map(track=>track.durationMs),[59000,86399000,86400000,undefined,undefined,undefined]);
});
test('LX qualities are capped at 64, de-duplicated and length checked while raw metadata is preserved',()=>{
  const qualitys=[{type:''},{type:'x'.repeat(129)},{type:'128k'},{type:'128k'},...Array.from({length:100},(_,index)=>({type:`q${index}`}))];
  const track=decodePlaylistJSON(JSON.stringify({type:'playList_v2',data:[{name:'Q',list:[{id:'wy_9',name:'Q',singer:'F',source:'wy',interval:'1:00',meta:{songId:'9',qualitys}}]}]})).collections[0]!.tracks[0]!;
  assert.equal(track.qualities.length,64);
  assert.deepEqual(track.qualities.slice(0,3).map(item=>item.id),['128k','q0','q1']);
  assert.equal((track.metadata.qualitys as unknown[]).length,104);
});
