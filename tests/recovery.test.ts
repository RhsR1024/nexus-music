import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreRecord,FutureRecordError} from '../src/storage/recovery.ts';
test('corrupt records are preserved before subsequent writes and future versions stay untouched',async()=>{
  const quarantined:string[]=[];const repository={get:async<T>()=>({version:1} as T),quarantine:async(key:string,backup:string)=>{quarantined.push(key,backup);}};
  assert.equal(await restoreRecord(repository,'library.v1',async()=>{throw Error('bad record');},()=> 'fixture'),false);assert.deepEqual(quarantined,['library.v1','recovery.library.v1.fixture']);
  repository.get=async<T>()=>({version:2} as T);
  await assert.rejects(restoreRecord(repository,'library.v1',async()=>{},()=> 'fixture'),FutureRecordError);assert.equal(quarantined.length,2);
});
test('storage read failures are not mistaken for corrupted records',async()=>{
  let moved=false;const repository={get:async<T>():Promise<T|undefined>=>{throw Error('I/O unavailable');},quarantine:async()=>{moved=true;}};
  await assert.rejects(restoreRecord(repository,'library.v1',async()=>{},()=> 'fixture'));assert.equal(moved,false);
});
