import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,PreferenceStore,type Preferences} from '../src/app/preferences.ts';
import {cleanBackupSettings} from '../src/storage/backupSettings.ts';
import {encodeBackup,decodeBackup} from '../src/storage/backup.ts';
import {createBackupRestore} from '../src/storage/restoreLibraryBackup.ts';
import {emptyLibrary,LibraryStore} from '../src/storage/library.ts';
import {emptyPlaybackStats,PlaybackStatsStore} from '../src/storage/playbackStats.ts';
import {MutationQueue} from '../src/storage/mutations.ts';
import {trackKey} from '../src/domain/track.ts';
import type {Repository} from '../src/storage/repository.ts';
import {track} from './fixtures.ts';
const settings=(patch:Partial<Preferences>={})=>cleanBackupSettings({version:1,preferences:{...defaults,...patch}});
function rig(){
  const records=new Map<string,unknown>(),writes:string[][]=[];let fail=false;
  const repository={get:async<T>(key:string)=>structuredClone(records.get(key)) as T|undefined,put:async(key:string,value:unknown)=>repository.putMany([[key,value]]),putMany:async(rows:readonly(readonly[string,unknown])[])=>{if(fail)throw Error('transaction failed');writes.push(rows.map(([key])=>key));for(const [key,value] of rows)records.set(key,structuredClone(value));}} as unknown as Repository;
  const mutations=new MutationQueue(),preferences=new PreferenceStore(repository,mutations),library=new LibraryStore(repository,()=> 'public-playlist',()=>123,mutations),statistics=new PlaybackStatsStore(repository,()=>123,mutations);
  const restore=createBackupRestore({repository,mutations,preferences,library,statistics});
  return {records,writes,preferences,library,statistics,restore,repository,fail:()=>{fail=true;}};
}
test('backup preserves playlist metadata and explicit portable settings while stripping unknown secrets and file references',()=>{
  const key=trackKey(track.origin),preferences={...defaults,rate:1.25,coverColor:false,lyricOffsets:{[key]:200,'file:///private/account?token=secret':300},lyricStyle:{...defaults.lyricStyle,password:'private-test-secret'},eqPresets:[{name:'Public',gains:Array(10).fill(2),preampDB:-2,password:'private-test-secret'}],password:'private-test-secret',fontURI:'file:///private/font.ttf'};
  const library={...emptyLibrary,playlists:[{id:'one',title:'Public list',description:'Public description',coverUrl:'https://example.com/public.jpg',createdAt:1,updatedAt:2,entries:[]}]};
  const body=encodeBackup(library,new Date(0),emptyPlaybackStats,preferences);assert.doesNotMatch(body,/private-test-secret|file:\/\/\/|fontURI|password/);
  const copy=decodeBackup(body);assert.equal(copy.settings?.preferences.rate,1.25);assert.equal(copy.settings?.preferences.coverColor,false);assert.deepEqual(copy.settings?.preferences.lyricOffsets,{[key]:200});assert.equal(copy.library.playlists[0]?.description,'Public description');assert.equal(copy.library.playlists[0]?.coverUrl,'https://example.com/public.jpg');
  for(const coverUrl of ['file:///private/cover.jpg','https://user:pass@example.com/a','https://example.com/a?token=secret'])assert.equal(decodeBackup(encodeBackup({...library,playlists:[{...library.playlists[0]!,coverUrl}]})).library.playlists[0]?.coverUrl,undefined);
});
test('settings backup rejects unsupported, incomplete and malformed values without accepting truthy shuffle',()=>{
  const valid=settings();for(const value of [{...valid,version:2},{version:1,preferences:{}},{version:1,preferences:{...defaults,shuffle:1}},{version:1,preferences:{...defaults,gains:Array(10).fill(20)}},{version:1,preferences:{...defaults,lyricStyle:{...defaults.lyricStyle,spacing:100}}}])assert.throws(()=>cleanBackupSettings(value));
  const backup=JSON.parse(encodeBackup(emptyLibrary));backup.settings={version:2,preferences:defaults};assert.throws(()=>decodeBackup(JSON.stringify(backup)));
});
test('restore commits library, statistics and settings together and notifies native/UI preference subscribers',async()=>{
  const r=rig();await r.preferences.update({rate:1.5,coverColor:true});let notified=0;r.preferences.subscribe(()=>notified++);
  const saved=settings({rate:1.25,coverColor:false,eqEnabled:true,gains:Array(10).fill(2)});await r.restore(emptyLibrary,emptyPlaybackStats,saved);
  assert.deepEqual(r.writes.at(-1),['library.v1','playbackStats.v1','preferences.v1']);assert.equal(r.preferences.getSnapshot().rate,1.25);assert.equal(notified,1);assert.equal(r.preferences.getSnapshot().coverColor,false);
  const restarted=new PreferenceStore(r.repository);await restarted.restore();assert.equal(restarted.getSnapshot().coverColor,false,'restored explicit off must not be treated as a pre-migration default');assert.equal(restarted.getSnapshot().eqEnabled,true);
});
test('old backups preserve current preferences and transaction failure cannot publish partial restored state',async()=>{
  const r=rig();await r.preferences.update({rate:1.5});await r.library.favorite(track);await r.restore(emptyLibrary,emptyPlaybackStats);assert.equal(r.preferences.getSnapshot().rate,1.5);assert.deepEqual(r.writes.at(-1),['library.v1','playbackStats.v1']);
  await r.library.favorite(track);const records=structuredClone(r.records),before=r.library.getSnapshot(),prefs=r.preferences.getSnapshot();r.fail();await assert.rejects(r.restore(emptyLibrary,emptyPlaybackStats,settings({rate:1.25})));assert.equal(r.library.getSnapshot(),before);assert.equal(r.preferences.getSnapshot(),prefs);assert.deepEqual(r.records,records);
});
test('queued preference changes serialize with restore and later changes preserve restored fields',async()=>{
  const r=rig();await Promise.all([r.preferences.update({volume:.25}),r.restore(emptyLibrary,emptyPlaybackStats,settings({volume:.7,rate:1.25})),r.preferences.update({rate:1.5})]);assert.equal(r.preferences.getSnapshot().volume,.7);assert.equal(r.preferences.getSnapshot().rate,1.5);assert.equal((r.records.get('preferences.v1') as Preferences).volume,.7);
});
test('backup settings and nested arrays are detached from mutable source snapshots',()=>{
  const gains=Array(10).fill(2),actions=[...defaults.miniActions],presets=[{name:'Public',gains:Array(10).fill(1),preampDB:0}],offsets={[trackKey(track.origin)]:250};const copy=settings({gains,miniActions:actions,eqPresets:presets,lyricOffsets:offsets});gains[0]=12;actions.reverse();presets[0]!.gains[0]=12;offsets[trackKey(track.origin)]=500;assert.equal(copy.preferences.gains[0],2);assert.equal(copy.preferences.eqPresets[0]?.gains[0],1);assert.equal(copy.preferences.lyricOffsets[trackKey(track.origin)],250);
});

test('backup size limits apply to UTF-8 bytes on both export and import',()=>{
  const title='曲'.repeat(12*1024*1024);assert.throws(()=>encodeBackup({...emptyLibrary,playlists:[{id:'public',title,entries:[],createdAt:0,updatedAt:0}]}),/32MiB/);assert.throws(()=>decodeBackup(JSON.stringify({format:'nexus-music',version:1,exportedAt:'public',library:emptyLibrary,padding:title})),/32MiB/);
});

test('canonical offset identities preserve opaque Unicode and path-like server IDs without exporting raw URI keys',()=>{
  const key=JSON.stringify(['navidrome','a'.repeat(64),'曲库/歌曲.mp3']),unsafe=JSON.stringify(['local','files','file:///private/audio.mp3']);assert.deepEqual(settings({lyricOffsets:{[key]:100,[unsafe]:200,'private-non-identity':300}}).preferences.lyricOffsets,{[key]:100});
});
