import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeWayfarer} from '../src/storage/wayfarer.ts';
import {LibraryStore} from '../src/storage/library.ts';
import {OnlineProvider} from '../src/providers/online.ts';
const song=(platform='wy',id='123')=>({id:`lx:${platform}:${id}`,providerId:`lx:${platform}`,title:'Synthetic',artist:'Fixture',durationMs:1000,artworkUri:'http://example.test/cover?token=private',sourceUri:'https://example.test/media?password=private',sourceUserAgent:'private',lyricUri:'file:///android/private'});
const backup=()=>({version:1,createdAtMs:1,sources:[{password:'private',script:'private'}],settings:{password:'private'},favorites:{ids:['lx:tx:MID'],tracks:[song('tx','MID')]},playlists:[{id:'private-playlist',title:'Fixture',tracks:[song(),song('wy','12345678901234567890'),song(),song('unsupported','1')]}]});
test('Wayfarer v1 retains long IDs, ordering and duplicates while dropping private settings and URLs',()=>{
  const value=decodeWayfarer(JSON.stringify(backup()));
  assert.deepEqual(value.collections[0]?.tracks.map(t=>t.origin.id),['123','12345678901234567890','123']);assert.equal(value.unsupported,1);assert.equal(value.total,5);
  assert.equal(value.favorites[0]?.metadata.songId,'MID');assert.equal(value.favorites[0]?.metadata.needsMetadata,true);assert.equal(value.ignoredSources,1);
  assert.doesNotMatch(JSON.stringify(value),/private|sourceUri|lyricUri|password|token|script/);
});
test('Wayfarer malformed version, mismatched identities and incomplete favorites fail before a write',()=>{
  const wrong=backup();wrong.version=2;assert.throws(()=>decodeWayfarer(JSON.stringify(wrong)),/版本/);
  const mismatch=backup();mismatch.playlists[0]!.tracks[0]!.id='lx:tx:MID';assert.throws(()=>decodeWayfarer(JSON.stringify(mismatch)),/不匹配/);
  const missing=backup();missing.favorites.tracks=[];assert.throws(()=>decodeWayfarer(JSON.stringify(missing)),/缺少/);
});
test('Wayfarer preview appends all playlists and favorites atomically, retaining old library on failure',async()=>{
  let uuid=0,fail=false,writes=0;
  const library=new LibraryStore({get:async()=>undefined,put:async()=>{writes++;if(fail)throw Error('disk');}},()=>String(++uuid));
  await library.createPlaylist('Old');const before=library.getSnapshot();const value=decodeWayfarer(JSON.stringify(backup()));
  fail=true;await assert.rejects(library.importCollections(value.collections,value.favorites));assert.equal(library.getSnapshot(),before);
  fail=false;await library.importCollections(value.collections,value.favorites);assert.equal(writes,3);assert.equal(library.getSnapshot().playlists.length,2);
  assert.equal(library.getSnapshot().playlists[1]?.entries.length,3);assert.equal(library.getSnapshot().favorites.length,1);
});
test('imported QQ metadata is enriched by exact MID without replacing the imported song identity',async()=>{
  let mismatched=false;
  const provider=new OnlineProvider({md5:async()=>'',sha1:async()=> '0'.repeat(40),deviceId:()=>'',http:async(_url,request)=>{
    assert.equal(JSON.parse(request.body!).req.param.song_mid,'MID');
    return{code:0,req:{code:0,data:{track_info:{mid:mismatched?'OTHER':'MID',id:'123',name:'Server title',singer:[],file:{media_mid:'MEDIA',size_320mp3:100}}}}};
  }});
  const track=decodeWayfarer(JSON.stringify(backup())).favorites[0]!;
  const enriched=await provider.enrich(track,new AbortController().signal);assert.equal(enriched.origin.id,'MID');assert.equal(enriched.title,'Synthetic');assert.equal(enriched.metadata.id,'123');assert.equal(enriched.metadata.strMediaMid,'MEDIA');
  mismatched=true;await assert.rejects(provider.enrich(track,new AbortController().signal),/不匹配/);
});
test('Wayfarer Qishui songs now retain an independent original identity instead of being skipped',()=>{
  const value=backup();value.playlists[0]!.tracks=[song('qishui','12345678901234567890'),song('qishui','video_ID')];
  const parsed=decodeWayfarer(JSON.stringify(value));assert.equal(parsed.unsupported,0);assert.equal(parsed.collections[0]?.tracks[0]?.origin.kind,'imported');assert.equal(parsed.collections[0]?.tracks[1]?.origin.id,'video_ID');
});
