import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {PlaybackStatsStore,cleanPlaybackStats,type PlaybackStatsState} from '../src/storage/playbackStats.ts';
import {addActivity,boundActivity,listeningPeriod,maximumListeningBuckets,maximumTotalListeningBuckets,validateActivity} from '../src/domain/listeningActivity.ts';
import {listeningCalendar,listeningStatistics} from '../src/domain/listeningStatistics.ts';
import {encodeBackup,decodeBackup} from '../src/storage/backup.ts';
import {emptyLibrary} from '../src/storage/library.ts';
import type {Track} from '../src/domain/track.ts';
const song=(id:string,artist='',album=''):Track=>({origin:{kind:'online',platform:'wy',id},title:id,artist,album,metadata:{},qualities:[]});
const at=(day:number,hour:number)=>new Date(2026,9,day,hour).getTime();
test('hour changes partition new cumulative samples without moving old listening or recounting the session',async()=>{
  let now=at(25,23),saved:unknown;
  const stats=new PlaybackStatsStore({get:async<T>()=>saved as T,put:async(_,value)=>{saved=structuredClone(value);}},()=>now);
  await stats.record({track:song('one'),session:'a',listenedMs:1000});now=at(26,0);await stats.record({track:song('one'),session:'a',listenedMs:2500});
  const item=stats.getSnapshot().items[0]!;assert.equal(item.listenedMs,2500);assert.equal(item.playCount,1);
  assert.deepEqual(item.activity,[{day:'2026-10-26',hour:0,listenedMs:1500,playCount:0},{day:'2026-10-25',hour:23,listenedMs:1000,playCount:1}]);
  const restored=new PlaybackStatsStore({get:async<T>()=>saved as T,put:async()=>{}});await restored.restore();assert.deepEqual(restored.getSnapshot(),stats.getSnapshot());
});
test('legacy totals stay undated and backup preserves only validated new activity fields',()=>{
  const state:PlaybackStatsState={version:1,items:[{track:song('old'),playCount:3,listenedMs:6000,firstPlayedAt:at(1,0),lastPlayedAt:at(26,1)}]};
  const summary=listeningStatistics(state,'songs','duration');assert.equal(summary.undatedMs,6000);assert.equal(summary.days.length,0);assert.equal(summary.hours.reduce((n,x)=>n+x.listenedMs,0),0);
  assert.equal(listeningStatistics(state,'songs','plays','2026-10-26').rows.length,0,'lastPlayedAt must not fabricate the entire history on this date');
  const rich={...state,items:[{...state.items[0]!,activity:[{day:'2026-10-26',hour:1,listenedMs:1000,playCount:1,password:'private'}]}]};
  const text=encodeBackup(emptyLibrary,new Date(0),rich);assert(!text.includes('private'));assert.deepEqual(decodeBackup(text).statistics,cleanPlaybackStats(rich));
  assert.equal(listeningStatistics(rich,'songs','duration').undatedMs,5000);
});
test('groups preserve track identities, album artists, missing metadata and metric ordering',()=>{
  const state:PlaybackStatsState={version:1,items:[['a','same','album',1,9000],['b','same','album',3,1000],['c','other','album',2,2000],['d','','',1,500]].map(([id,artist,album,playCount,listenedMs])=>({track:song(id as string,artist as string,album as string),playCount:playCount as number,listenedMs:listenedMs as number,firstPlayedAt:0,lastPlayedAt:0}))};
  const artists=listeningStatistics(state,'artists','duration');assert.equal(artists.rows[0]!.title,'same');assert.equal(artists.rows[0]!.tracks.length,2);assert.equal(artists.rows[0]!.playCount,4);
  assert.equal(listeningStatistics(state,'albums','duration').rows.length,3,'same album title by different artists stays distinct');
  assert.equal(artists.songCount,4);assert.equal(artists.artistCount,2);assert.equal(artists.albumCount,2,'missing metadata must not manufacture known artists or albums');
  assert.equal(listeningStatistics(state,'songs','plays').rows[0]!.title,'b');assert(artists.rows.some(x=>x.title==='未知艺术家'));
});
test('calendar retains exactly 90 civil dates, includes leap days and leaves missing detail unknown',()=>{
  const values=listeningCalendar([{date:'2024-02-29',listenedMs:1000,playCount:1}],new Date(2024,2,1,12).getTime());
  assert.equal(values.length,90);assert.equal(values.at(-1)!.date,'2024-03-01');
  assert.equal(values.at(-2)!.date,'2024-02-29');assert.equal(values.at(-2)!.listenedMs,1000);assert.equal(values.at(-1)!.listenedMs,null);
});
test('native missing-tag display fallbacks are unknown groups rather than known metadata',()=>{
  const state:PlaybackStatsState={version:1,items:[{track:song('public-import','未知艺术家','未知专辑'),playCount:1,listenedMs:8000,firstPlayedAt:0,lastPlayedAt:0}]};
  const artists=listeningStatistics(state,'artists','duration');assert.equal(artists.artistCount,0);assert.equal(artists.albumCount,0);assert.equal(artists.rows[0]!.title,'未知艺术家');
});
test('malformed dates, duplicate bins and counters beyond the total are rejected',()=>{
  const valid={day:'2026-10-26',hour:2,listenedMs:100,playCount:1};
  for(const value of [[{...valid,day:'2026-02-30'}],[{...valid,hour:24}],[valid,valid],[{...valid,listenedMs:1000}],[{...valid,playCount:3}]])assert.throws(()=>validateActivity(value,200,2));
  assert.throws(()=>cleanPlaybackStats({version:1,items:[{track:song('huge'),playCount:1,listenedMs:1e308,firstPlayedAt:0,lastPlayedAt:0}]}),'Imported totals must never overflow chart aggregation');
});
test('bounded detail rolls out old bins while aggregate totals remain outside the pruning operation',()=>{
  let activity=Array.from({length:maximumListeningBuckets},(_,i)=>({day:`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,hour:0,listenedMs:100,playCount:1}));
  const next=addActivity(activity,at(26,1),500,1);assert.equal(next.length,maximumListeningBuckets);
  const values=Array.from({length:5},(_,i)=>({total:999999,activity:activity.map(x=>({...x,hour:i}))}));
  const bounded=boundActivity(values);assert.equal(bounded.reduce((n,x)=>n+x.activity.length,0),maximumTotalListeningBuckets);assert(bounded.every(x=>x.total===999999));
});
test('failed saves retry one delta and clearing keeps native watermarks without old detail reappearing',async()=>{
  let fail=false;const stats=new PlaybackStatsStore({get:async()=>undefined,put:async()=>{if(fail)throw Error('disk');}},()=>at(26,2));
  await stats.record({track:song('one'),session:'a',listenedMs:1000});fail=true;await assert.rejects(stats.record({track:song('one'),session:'a',listenedMs:2000}));fail=false;
  await stats.record({track:song('one'),session:'a',listenedMs:2000});assert.equal(stats.getSnapshot().items[0]!.activity![0]!.listenedMs,2000);
  await stats.clear();await stats.record({track:song('one'),session:'a',listenedMs:2500});assert.equal(stats.getSnapshot().items[0]!.activity![0]!.listenedMs,500);
  assert.deepEqual(listeningPeriod(at(26,2)),{day:'2026-10-26',hour:2});
});
test('repeated daylight-saving hours merge by the actual local calendar without inventing a second date',()=>{
  const url=new URL('../src/domain/listeningActivity.ts',import.meta.url).href;
  const code=`import {addActivity} from ${JSON.stringify(url)};let a=addActivity([],Date.parse('2026-11-01T05:30:00Z'),1000,1);a=addActivity(a,Date.parse('2026-11-01T06:30:00Z'),2000,1);console.log(JSON.stringify(a));`;
  const output=execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),[{day:'2026-11-01',hour:1,listenedMs:3000,playCount:2}]);
});
