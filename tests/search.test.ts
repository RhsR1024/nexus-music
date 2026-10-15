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
