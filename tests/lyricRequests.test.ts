import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SharedRequests} from '../src/lyrics/sharedRequests.ts';
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('concurrent lyric readers share work until the last reader exits',async()=>{
  const requests=new SharedRequests<string>();let calls=0,signal:AbortSignal|undefined;
  const load=(next:AbortSignal)=>{calls++;signal=next;return new Promise<string>(()=>{});};
  const hero=requests.acquire('same-track',load),chrome=requests.acquire('same-track',load);
  await tick();assert.equal(calls,1);assert.equal(hero.promise,chrome.promise);
  hero.release();hero.release();assert.equal(signal!.aborted,false);
  chrome.release();assert.equal(signal!.aborted,true);
});

test('late canceled lyric work cannot remove its replacement request',async()=>{
  const requests=new SharedRequests<string>();let finishOld!:(value:string)=>void,calls=0;
  const old=requests.acquire('same',()=>new Promise<string>(resolve=>{finishOld=resolve;}));
  await tick();old.release();
  const current=requests.acquire('same',()=>{calls++;return new Promise<string>(()=>{});});
  await tick();finishOld('stale');await old.promise;await tick();
  const secondReader=requests.acquire('same',()=>{throw new Error('must share current request');});
  assert.equal(calls,1);assert.equal(current.promise,secondReader.promise);
  current.release();secondReader.release();
});

test('completed or failed lyrics are reloaded through the authoritative service cache',async()=>{
  const requests=new SharedRequests<string>();let calls=0;
  const first=requests.acquire('same',async()=>{calls++;return 'before clear';});
  assert.equal(await first.promise,'before clear');first.release();
  const afterClear=requests.acquire('same',async()=>{calls++;return 'after clear';});
  assert.equal(await afterClear.promise,'after clear');afterClear.release();assert.equal(calls,2);
  const failed=requests.acquire('same',async()=>{throw new Error('retryable');});
  await assert.rejects(failed.promise,/retryable/);failed.release();
  const retried=requests.acquire('same',async()=>'retry');assert.equal(await retried.promise,'retry');retried.release();
});
