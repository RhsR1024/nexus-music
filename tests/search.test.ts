import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SearchCoordinator } from '../src/providers/searchCoordinator.ts';
import { deferred, track } from './fixtures.ts';
import type { SearchPage } from '../src/providers/online.ts';

test('late search results cannot overwrite a new query even if transport ignores cancellation', async () => {
  const first = deferred<SearchPage>(), second = deferred<SearchPage>(); let calls = 0;
  const coordinator = new SearchCoordinator({ search: async () => ++calls === 1 ? first.promise : second.promise });
  const old = coordinator.search('old','wy'), latest = coordinator.search('new','wy');
  second.resolve({items:[{...track,title:'new'}],page:1,hasMore:false}); await latest;
  first.resolve({items:[{...track,title:'old'}],page:1,hasMore:false}); await old;
  assert.equal(coordinator.getSnapshot().groups[0]!.items[0]!.title,'new');
});
test('aggregation keeps platform errors independent and never merges different origins by title', async () => {
  const coordinator = new SearchCoordinator({search:async platform => {
    if(platform==='kg') throw new Error('private failure');
    return {items:[{...track,origin:{kind:'online',platform,id:'1'}}],page:1,hasMore:false};
  }});
  await coordinator.search('fixture','all');
  assert.equal(coordinator.getSnapshot().groups.filter(group => group.items.length).length,4);
  assert.ok(coordinator.getSnapshot().groups.find(group => group.platform==='kg')!.error);
});
test('clearing the query aborts in-flight work and removes every group', async () => {
  const pending = deferred<SearchPage>(); let signal: AbortSignal | undefined; let calls = 0;
  const coordinator = new SearchCoordinator({ search: async (_platform, _query, _page, value) => { calls++; signal = value; return pending.promise; } });
  const running = coordinator.search('old','wy');
  assert.equal(coordinator.getSnapshot().groups.length,1);
  await coordinator.search('','wy');
  assert.equal(signal?.aborted,true);
  assert.deepEqual(coordinator.getSnapshot(),{query:'',groups:[]});
  pending.resolve({items:[track],page:1,hasMore:false}); await running;
  assert.equal(calls,1);
  assert.deepEqual(coordinator.getSnapshot(),{query:'',groups:[]});
});
test('initial failure offers retry and the retry replaces the error with loaded rows', async () => {
  let fail = true; const calls: number[] = [];
  const coordinator = new SearchCoordinator({ search: async (_,__,page) => {
    calls.push(page);
    if (fail) { fail = false; throw new Error('fixture offline'); }
    return {items:[track],page,hasMore:false};
  }});
  await coordinator.search('fixture','wy');
  const failed = coordinator.getSnapshot().groups[0]!;
  assert.deepEqual(failed.items,[]); assert.equal(failed.loading,false); assert.match(failed.error ?? '',/搜索失败/);
  await coordinator.retry('wy');
  const loaded = coordinator.getSnapshot().groups[0]!;
  assert.equal(loaded.error,null); assert.equal(loaded.items.length,1); assert.equal(loaded.hasMore,false);
  assert.deepEqual(calls,[1,1]);
});
test('end state stops load-more and an empty page cannot advertise another page', async () => {
  const calls: number[] = [];
  const coordinator = new SearchCoordinator({ search: async (_,__,page) => {
    calls.push(page);
    return page===1 ? {items:[track],page,hasMore:true} : {items:[],page,hasMore:true};
  }});
  await coordinator.search('fixture','wy'); await coordinator.more('wy');
  const end = coordinator.getSnapshot().groups[0]!;
  assert.deepEqual(calls,[1,2]); assert.equal(end.loading,false); assert.equal(end.hasMore,false);
  await coordinator.more('wy');
  assert.deepEqual(calls,[1,2]);
});
test('failed page retains existing results and retries the missing page without duplicates', async () => {
  let failure = true; const pages: number[] = [];
  const coordinator = new SearchCoordinator({search:async (_,__,page) => {
    pages.push(page);
    if(page===2&&failure) {failure=false;throw new Error('fixture');}
    return {items:page===1?[track]:[track,{...track,origin:{kind:'online',platform:'wy',id:'second'}}],page,hasMore:page===1,total:2};
  }});
  await coordinator.search('fixture','wy'); await coordinator.more('wy');
  assert.equal(coordinator.getSnapshot().groups[0]!.items.length,1);
  await coordinator.retry('wy');
  assert.deepEqual(pages,[1,2,2]); assert.equal(coordinator.getSnapshot().groups[0]!.items.length,2);
});
