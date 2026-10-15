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
