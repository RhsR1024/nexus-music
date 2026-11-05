import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customSleepSeconds,sleepCountdown,SleepStore,sleepState} from '../src/playback/sleep.ts';
test('sleep state rejects malformed native values and ignores a late pre-expiry response',()=>{
  assert.deepEqual(sleepState({mode:'duration',deadline:NaN}),{mode:'off'});assert.deepEqual(sleepState({mode:'track',entryId:''}),{mode:'off'});
  const store=new SleepStore();let updates=0;store.subscribe(()=>updates++);
  store.update({mode:'duration',deadline:123,revision:1});assert.equal(store.getSnapshot().mode,'duration');
  store.update({mode:'off',revision:2});store.update({mode:'duration',deadline:123,revision:1});assert.equal(store.getSnapshot().mode,'off');assert.equal(updates,2);
});
test('sleep countdown is second-accurate, bounded and avoids negative time',()=>{
  assert.equal(sleepCountdown(90_000,0),'1:30');assert.equal(sleepCountdown(5_400_000,0),'1:30:00');
  assert.equal(sleepCountdown(1,0),'0:01');assert.equal(sleepCountdown(0,0),'即将停止');assert.equal(sleepCountdown(-1_000,0),'即将停止');
});
test('custom wheel seconds reject zero and malformed rows without canceling through start',()=>{
  assert.equal(customSleepSeconds(0,0),undefined);
  assert.equal(customSleepSeconds(0,1),60);
  assert.equal(customSleepSeconds(1,0),3600);
  assert.equal(customSleepSeconds(24,0),86400);
  for(const invalid of [[0,-1],[0,60],[1.5,0],[25,0],[Number.NaN,1]])assert.equal(customSleepSeconds(invalid[0]!,invalid[1]!),undefined);
});
