import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreloadCache,startPreloadCoordinator} from '../src/playback/preloadCache.ts';
import {PlaybackController,type ResolvedMedia} from '../src/playback/controller.ts';
import {makeQueue} from '../src/domain/queue.ts';
import type {Track} from '../src/domain/track.ts';
import {MultiSourceResolver} from '../src/providers/multiSourceResolver.ts';
import {SourceRegistry} from '../src/providers/sourceRegistry.ts';
import {defaults,PreferenceStore,validatePreferences} from '../src/app/preferences.ts';
import {cleanBackupSettings} from '../src/storage/backupSettings.ts';
import {SearchHistoryStore} from '../src/storage/searchHistory.ts';
import type {Repository} from '../src/storage/repository.ts';
import {decodePlaylistJSON,encodePlaylistJSON} from '../src/storage/playlistJSON.ts';
import {normalizeLyricStyle} from '../src/lyrics/settings.ts';

function sampleTrack(id:string,platform:'wy'|'tx'='wy'):Track {
  return {
    origin:{kind:'online',platform,id},
    title:`Song ${id}`,
    artist:`Artist ${id}`,
    album:`Album ${id}`,
    durationMs:210000,
    metadata:{songId:id},
    qualities:[{id:'flac'},{id:'320k'},{id:'128k'}],
  };
}

test('PreloadCache supports TTL expiry, LRU eviction and revision isolation',()=>{
  let now=1000;
  const cache=new PreloadCache({maxEntries:2,ttlMs:5000,now:()=>now});
  const t1=sampleTrack('1'),t2=sampleTrack('2'),t3=sampleTrack('3');
  const m1:ResolvedMedia={url:'https://example.com/1.flac',quality:'flac'};
  const m2:ResolvedMedia={url:'https://example.com/2.flac',quality:'flac'};
  const m3:ResolvedMedia={url:'https://example.com/3.flac',quality:'flac'};
  cache.set(t1,'flac','rev1',m1);
  cache.set(t2,'flac','rev1',m2);
  assert.equal(cache.get(t1,'flac','rev1')?.url,m1.url);
  assert.equal(cache.get(t1,'flac','rev2'),undefined,'different revision must miss');
  // t1 was recently read so t2 should be evicted when t3 arrives
  cache.set(t3,'flac','rev1',m3);
  assert.equal(cache.size,2);
  assert.equal(cache.get(t2,'flac','rev1'),undefined);
  assert.equal(cache.get(t1,'flac','rev1')?.url,m1.url);
  now=7000;
  assert.equal(cache.get(t1,'flac','rev1'),undefined,'expired entry must miss');
});

test('startPreloadCoordinator preloads upcoming online tracks on ready+playing and skips local tracks',async()=>{
  const cache=new PreloadCache({maxEntries:8,ttlMs:60000});
  const t1=sampleTrack('a'),localTrack:Track={origin:{kind:'local',id:'loc-1'},title:'Local',artist:'A',album:'',metadata:{},qualities:[]},t2=sampleTrack('b'),t3=sampleTrack('c');
  const resolved:string[]=[];
  const backend={
    stop(){},
    load(_media:ResolvedMedia,token:{entryId:string;generation:number}){
      setTimeout(()=>controller.onReady(token,{duration:180}),5);
    },
    play(){},
    pause(){},
  };
  const controller=new PlaybackController({
    async resolve(track){return {url:`https://example.com/${track.title}.mp3`,quality:'320k'};},
  },backend,makeQueue([
    {id:'e1',track:t1},
    {id:'e-local',track:localTrack},
    {id:'e2',track:t2},
    {id:'e3',track:t3},
  ],'e1'));
  let enabled=true;
  const coordinator=startPreloadCoordinator({
    cache,
    controller,
    enabled:()=>enabled,
    count:()=>2,
    intervalMs:()=>10,
    repeat:()=>'off',
    qualityFor:()=>'flac',
    sourceRevision:()=>'r1',
    async resolve(track){
      resolved.push(track.title);
      return {url:`https://example.com/preloaded-${track.title}.flac`,quality:'flac'};
    },
  });
  try {
    await controller.play();
    await new Promise(r=>setTimeout(r,160));
    // First 2 lookahead steps cover e-local (skipped) and e2 (preloaded).
    assert.deepEqual(resolved,['Song b']);
    assert.equal(cache.get(t2,'flac','r1')?.url,'https://example.com/preloaded-Song b.flac');
    coordinator.invalidate();
    assert.equal(cache.size,0);
    enabled=false;
  } finally {
    coordinator.dispose();
  }
});

test('MultiSourceResolver honors SmartSwitchPolicy per-platform quality, direct128k degrade and crossScript=false',async()=>{
  const calls:Array<{source:string;quality:string}>=[];
  const registry=new SourceRegistry({
    async initialize(){
      return [
        {name:'网易云',platform:'wy',actions:['musicUrl'],qualities:['flac','320k','128k']},
        {name:'QQ音乐',platform:'tx',actions:['musicUrl'],qualities:['flac','320k','128k']},
      ];
    },
    destroy(){},
  });
  registry.register({id:'s1',name:'S1',script:'/* s1 */'});
  registry.register({id:'s2',name:'S2',script:'/* s2 */'});
  await registry.setEnabled('s1',true);
  await registry.setEnabled('s2',true);
  const transport={
    async request(source:{id:string},payload:{info:{type:string}}){
      const q=payload.info.type;
      calls.push({source:source.id,quality:q});
      if(q==='128k')return 'https://cdn.example.com/ok-128k.mp3';
      throw new Error('fail high quality');
    },
  };
  const resolver=new MultiSourceResolver(registry,transport,()=>'flac',3000,{
    qualityForPlatform:platform=>platform==='tx'?'320k':'flac',
    degradeMode:()=>'direct128k',
    crossScript:()=>false,
  });
  const media=await resolver.resolve(sampleTrack('99','tx'),new AbortController().signal);
  assert.equal(media.quality,'128k');
  assert.equal(media.requestedQuality,'320k');
  // With crossScript=false and direct128k, tries s1 at 320k then jumps straight to s1 at 128k (never tries s2 at 320k or flac).
  assert.deepEqual(calls,[{source:'s1',quality:'320k'},{source:'s1',quality:'128k'}]);
});

test('Preferences, LyricStyle and BackupSettings validate and preserve new Sollin fields',async()=>{
  const records=new Map<string,unknown>();
  const repository={
    get:async<T>(k:string)=>structuredClone(records.get(k)) as T|undefined,
    put:async(k:string,v:unknown)=>{records.set(k,structuredClone(v));},
  };
  const store=new PreferenceStore(repository);
  await store.restore();
  await store.update({
    autoPlaySource:'favorites',
    preloadCount:3,
    playbackFadeEnabled:true,
    playbackFadeDurationMs:800,
    systemLyricsEnabled:true,
    systemLyricsPosition:'title',
    playbackQualities:{wy:'flac',tx:'320k'},
    smartDegradeMode:'direct128k',
    smartCrossScript:false,
    smartSkipOnFailure:false,
    homePlatform:'tx',
  });
  await store.updateLyricStyle({showTranslation:false,showRomanization:true,secondaryScale:1.2});
  const reloaded=new PreferenceStore(repository);
  await reloaded.restore();
  const snap=reloaded.getSnapshot();
  assert.equal(snap.autoPlaySource,'favorites');
  assert.equal(snap.preloadCount,3);
  assert.equal(snap.playbackFadeEnabled,true);
  assert.equal(snap.playbackFadeDurationMs,800);
  assert.equal(snap.systemLyricsEnabled,true);
  assert.equal(snap.systemLyricsPosition,'title');
  assert.deepEqual(snap.playbackQualities,{wy:'flac',tx:'320k'});
  assert.equal(snap.smartDegradeMode,'direct128k');
  assert.equal(snap.smartCrossScript,false);
  assert.equal(snap.smartSkipOnFailure,false);
  assert.equal(snap.homePlatform,'tx');
  assert.equal(snap.lyricStyle.showTranslation,false);
  assert.equal(snap.lyricStyle.showRomanization,true);
  assert.equal(snap.lyricStyle.secondaryScale,1.2);

  const backup=cleanBackupSettings({version:1,preferences:snap});
  assert.equal(backup.preferences.preloadCount,3);
  assert.equal(backup.preferences.playbackFadeDurationMs,800);
  assert.equal(backup.preferences.systemLyricsPosition,'title');
  assert.equal(backup.preferences.lyricStyle.showTranslation,false);
  assert.equal(backup.preferences.lyricStyle.secondaryScale,1.2);

  assert.throws(()=>validatePreferences({...defaults,preloadCount:5}));
  assert.throws(()=>validatePreferences({...defaults,playbackFadeDurationMs:50}));
  assert.throws(()=>normalizeLyricStyle({...defaults.lyricStyle,secondaryScale:2.5}));
});

test('SearchHistoryStore supports single-item remove and persists deletion',async()=>{
  const records=new Map<string,unknown>();
  const repository={
    get:async<T>(k:string)=>structuredClone(records.get(k)) as T|undefined,
    put:async(k:string,v:unknown)=>{records.set(k,structuredClone(v));},
  } as unknown as Repository;
  const store=new SearchHistoryStore(repository);
  await store.restore();
  await store.record('周杰伦');
  await store.record('陈奕迅');
  await store.record('林俊杰');
  await store.remove('陈奕迅');
  assert.deepEqual(store.getSnapshot(),['林俊杰','周杰伦']);
  const reloaded=new SearchHistoryStore(repository);
  await reloaded.restore();
  assert.deepEqual(reloaded.getSnapshot(),['林俊杰','周杰伦']);
});

test('encodePlaylistJSON produces valid LX playList_v2 JSON that round-trips with decodePlaylistJSON',()=>{
  const tracks=[sampleTrack('1001','wy'),sampleTrack('2002','tx')];
  const json=encodePlaylistJSON([{title:'测试歌单',tracks}]);
  const decoded=decodePlaylistJSON(json);
  assert.equal(decoded.collections.length,1);
  assert.equal(decoded.collections[0]?.title,'测试歌单');
  assert.equal(decoded.collections[0]?.tracks.length,2);
  assert.equal(decoded.collections[0]?.tracks[0]?.title,'Song 1001');
  assert.equal(decoded.collections[0]?.tracks[1]?.origin.kind,'online');
});
