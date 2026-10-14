import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SourceRegistry, type SourceLifecycle } from '../src/providers/sourceRegistry.ts';
import { MultiSourceResolver, RoutingError, type LXTransport } from '../src/providers/multiSourceResolver.ts';
import { fallbackQualities, normalizeQuality } from '../src/domain/quality.ts';
import type { LXSource } from '../src/providers/lx.ts';
import { track } from './fixtures.ts';

const capabilities: readonly LXSource[] = [{ platform: 'wy', name: 'test', actions: ['musicUrl'], qualities: ['flac', '320k', '128k'] }];
const idleSignal = () => new AbortController().signal;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function setup(initialize: SourceLifecycle['initialize'] = async () => capabilities) {
  const destroyed: string[] = [];
  const registry = new SourceRegistry({ initialize, destroy: (id, revision) => { destroyed.push(`${id}:${revision}`); } }, 25);
  for (const id of ['a', 'b']) registry.register({ id, name: id, script: '// fixture' });
  await registry.setManyEnabled(['a', 'b'], true);
  return { registry, destroyed };
}

test('quality fallback never upgrades and raw aliases remain explicit', () => {
  assert.deepEqual(fallbackQualities('320k'), ['320k', '192k', '128k']);
  assert.equal(normalizeQuality('Hi-Res'), 'hires');
  assert.equal(normalizeQuality('lossless'), 'flac');
  assert.equal(normalizeQuality('unknown'), undefined);
});

test('all sources at preferred quality precede any lower quality', async () => {
  const { registry } = await setup();
  const calls: string[] = [];
  const resolver = new MultiSourceResolver(registry, { request: async (source, payload) => {
    calls.push(`${source.id}:${payload.info.type}`);
    if (source.id === 'a') throw new Error('private remote error');
    return 'https://example.test/audio';
  } }, () => 'flac');
  const media = await resolver.resolve(track, idleSignal());
  assert.deepEqual(calls, ['a:flac', 'b:flac']);
  assert.equal(media.sourceId, 'b');
  assert.equal(media.requestedQuality, 'flac');
  assert.equal(media.quality, 'flac');
});

test('downgrade occurs only after all eligible same-quality sources fail', async () => {
  const { registry } = await setup();
  const calls: string[] = [];
  const resolver = new MultiSourceResolver(registry, { request: async (source, payload) => {
    calls.push(`${source.id}:${payload.info.type}`);
    if (payload.info.type === 'flac') throw new Error('unavailable');
    return { url: 'https://example.test/audio' };
  } }, () => 'flac');
  const media = await resolver.resolve(track, idleSignal());
  assert.deepEqual(calls, ['a:flac', 'b:flac', 'a:320k']);
  assert.equal(media.requestedQuality, 'flac');
  assert.equal(media.quality, '320k');
});

test('alias normalization does not change script request argument', async () => {
  const { registry } = await setup(async () => [{ ...capabilities[0]!, qualities: ['lossless'] }]);
  let type = '';
  const resolver = new MultiSourceResolver(registry, { request: async (_, payload) => {
    type = payload.info.type; return 'https://example.test/audio';
  } }, () => 'flac');
  const media = await resolver.resolve(track, idleSignal());
  assert.equal(type, 'lossless');
  assert.equal(media.scriptQuality, 'lossless');
});

test('timeout proceeds to another source even if transport ignores cancellation', async () => {
  const { registry } = await setup();
  let expiredSignal: AbortSignal | undefined;
  const resolver = new MultiSourceResolver(registry, { request: async (source, _, signal) => {
    if (source.id === 'a') { expiredSignal = signal; return new Promise(() => {}); }
    return 'https://example.test/audio';
  } }, () => 'flac', 10);
  assert.equal((await resolver.resolve(track, idleSignal())).sourceId, 'b');
  assert.equal(expiredSignal?.aborted, true);
});

test('cancel aborts current attempt and never retries another source', async () => {
  const { registry } = await setup();
  const started = deferred<AbortSignal>();
  let count = 0;
  const transport: LXTransport = { request: async (_, __, signal) => {
    count++; started.resolve(signal); return new Promise(() => {});
  } };
  const controller = new AbortController();
  const result = new MultiSourceResolver(registry, transport, () => 'flac').resolve(track, controller.signal);
  const child = await started.promise;
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(child.aborted, true);
  assert.equal(count, 1);
});

test('disabled source result cannot win after in-flight resolution', async () => {
  const { registry } = await setup();
  const started = deferred<void>(), response = deferred<string>();
  const resolver = new MultiSourceResolver(registry, { request: async source => {
    if (source.id === 'a') { started.resolve(); return response.promise; }
    return 'https://example.test/b';
  } }, () => 'flac');
  const result = resolver.resolve(track, idleSignal());
  await started.promise;
  await registry.setEnabled('a', false);
  response.resolve('https://example.test/stale');
  assert.equal((await result).sourceId, 'b');
});

test('unsafe addresses fail without leaking script output into diagnostics', async () => {
  const { registry } = await setup();
  const resolver = new MultiSourceResolver(registry, { request: async () => 'file:///private/secret' }, () => '128k');
  await assert.rejects(resolver.resolve(track, idleSignal()), error => {
    assert.ok(error instanceof RoutingError);
    assert.deepEqual(error.attempts.map(item => item.reason), ['invalid-url', 'invalid-url']);
    assert.ok(!JSON.stringify(error).includes('secret'));
    return true;
  });
});

test('batch keeps successful sources enabled despite another initialization failure', async () => {
  const { registry } = await setup(async source => {
    if (source.id === 'a') throw new Error('unavailable');
    return capabilities;
  });
  const result = await registry.setManyEnabled(['a', 'b', 'a', 'missing'], true);
  assert.deepEqual(result, { succeeded: ['b'], failed: ['a', 'missing'] });
  assert.deepEqual(registry.getSnapshot().map(source => source.status), ['failed', 'ready']);
});

test('replacement preserves order and removal/reimport cannot reuse old generation', async () => {
  const { registry } = await setup();
  const old = registry.getSnapshot()[0]!;
  registry.register({ id: 'a', name: 'updated', script: '// newer' });
  assert.deepEqual(registry.getSnapshot().map(source => source.id), ['a', 'b']);
  assert.equal(registry.isCurrent(old), false);
  assert.deepEqual(registry.getSnapshot()[0]!.capabilities, []);
  registry.remove('a');
  registry.register({ id: 'a', name: 'reimport', script: '// reimport' });
  await registry.setEnabled('a', true);
  assert.ok(registry.getSnapshot().find(source => source.id === 'a')!.revision > old.revision);
  assert.equal(registry.isCurrent(old), false);
});

test('disable during initialization rejects late capabilities', async () => {
  const pending = deferred<readonly LXSource[]>(), started = deferred<void>();
  const registry = new SourceRegistry({ initialize: async () => { started.resolve(); return pending.promise; }, destroy: () => {} });
  registry.register({ id: 'a', name: 'a', script: '// fixture' });
  const enabling = registry.setEnabled('a', true);
  await started.promise;
  await registry.setEnabled('a', false);
  pending.resolve(capabilities);
  assert.equal(await enabling, false);
  assert.equal(registry.getSnapshot()[0]!.status, 'disabled');
  assert.deepEqual(registry.getSnapshot()[0]!.capabilities, []);
});

test('observer disabling a source during publication cannot leave an orphan runtime', async () => {
  let initialized = 0;
  const registry = new SourceRegistry({ initialize: async () => { initialized++; return capabilities; }, destroy: () => {} });
  registry.register({ id: 'a', name: 'a', script: '// fixture' });
  registry.subscribe(() => {
    if (registry.getSnapshot()[0]?.status === 'initializing') void registry.setEnabled('a', false);
  });
  assert.equal(await registry.setEnabled('a', true), false);
  assert.equal(initialized, 0);
  assert.equal(registry.getSnapshot()[0]!.status, 'disabled');
});
