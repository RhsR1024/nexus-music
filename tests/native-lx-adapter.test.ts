import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeLX } from '../src/providers/nativeLXAdapter.ts';
import { makeLXRequest } from '../src/providers/lx.ts';
import type { SourceState } from '../src/providers/sourceRegistry.ts';
import { track } from './fixtures.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const source: SourceState = { id: 'one', name: 'one', revision: 3, enabled: true, status: 'ready',
  capabilities: [{ platform: 'wy', name: 'Fixture', actions: ['musicUrl'], qualities: ['128k'] }] };
const payload = makeLXRequest(track, '128k', source.capabilities[0]!);

test('native adapter parses capabilities and request results without losing long IDs', async () => {
  const calls: unknown[][] = [];
  const adapter = createNativeLX({
    initializeSource: async () => JSON.stringify({ sources: { wy: { actions: ['musicUrl'], qualitys: ['128k'] } } }),
    destroySource: async () => {}, cancelRequest: async () => {},
    requestSource: async (...args) => { calls.push(args); return JSON.stringify('https://example.test/audio'); },
  });
  const caps = await adapter.initialize({ id: 'one', name: 'one', script: '// fixture' }, 3, new AbortController().signal);
  assert.equal(caps[0]!.platform, 'wy');
  assert.equal(await adapter.request(source, payload, new AbortController().signal), 'https://example.test/audio');
  assert.equal(JSON.parse(calls[0]![3] as string).info.musicInfo.meta.songId, '90071992547409931234');
});

test('native cancellation rejects immediately and targets the matching source revision/request', async () => {
  const pending = deferred<string>();
  const cancelled: unknown[][] = [];
  const adapter = createNativeLX({
    initializeSource: async () => '{}', destroySource: async () => {},
    cancelRequest: async (...args) => { cancelled.push(args); }, requestSource: async () => pending.promise,
  });
  const controller = new AbortController();
  const result = adapter.request(source, payload, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.deepEqual(cancelled, [['one', 3, '3:1']]);
  pending.resolve(JSON.stringify('https://example.test/late'));
});

test('initialization cancellation destroys that revision and rejects late capabilities', async () => {
  const pending = deferred<string>();
  const destroyed: unknown[][] = [];
  const adapter = createNativeLX({
    initializeSource: async () => pending.promise,
    destroySource: async (...args) => { destroyed.push(args); },
    cancelRequest: async () => {}, requestSource: async () => 'null',
  });
  const controller = new AbortController();
  const result = adapter.initialize({ id: 'one', name: 'one', script: '// fixture' }, 3, controller.signal);
  controller.abort();
  pending.resolve(JSON.stringify({ sources: {} }));
  await assert.rejects(result, { name: 'AbortError' });
  assert.deepEqual(destroyed, [['one', 3]]);
});
