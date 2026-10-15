import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SleepStore,sleepState} from '../src/playback/sleep.ts';
test('sleep state rejects malformed native values and ignores a late pre-expiry response',()=>{
  assert.deepEqual(sleepState({mode:'duration',deadline:NaN}),{mode:'off'});assert.deepEqual(sleepState({mode:'track',entryId:''}),{mode:'off'});
  const store=new SleepStore();let updates=0;store.subscribe(()=>updates++);
  store.update({mode:'duration',deadline:123,revision:1});assert.equal(store.getSnapshot().mode,'duration');
  store.update({mode:'off',revision:2});store.update({mode:'duration',deadline:123,revision:1});assert.equal(store.getSnapshot().mode,'off');assert.equal(updates,2);
});
