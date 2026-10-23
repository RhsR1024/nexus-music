import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LX_INITIALIZE_MAX_BYTES, LX_DECLARATION_MAX_ITEMS, LX_DECLARATION_MAX_LENGTH, LX_NAME_MAX_LENGTH, makeLXActionRequest, makeLXRequest, readLXCapabilities, readLXInitialize } from '../src/providers/lx.ts';
import { createNativeLX, createNativeDiagnosticLX } from '../src/providers/nativeLXAdapter.ts';
import { SourceRegistry } from '../src/providers/sourceRegistry.ts';
import type { SourceDefinition } from '../src/providers/sourceRegistry.ts';
import { track } from './fixtures.ts';

test('capabilities only expose first-release platforms/actions, preserving real qualities', () => {
  const sources = readLXCapabilities({ sources: {
    tx: { name: 'QQ', actions: ['musicUrl', 'lyric', 'unknown'], qualitys: ['128k', 'flac', 'flac'] },
    qs: { actions: ['musicUrl'], qualitys: ['128k'] },
  } });
  assert.deepEqual(sources, [{ platform: 'tx', name: 'QQ', actions: ['musicUrl', 'lyric'], qualities: ['128k', 'flac'] }]);
  assert.throws(() => readLXCapabilities({ sources: { tx: { actions: [], qualitys: [128] } } }));
});

test('LX request preserves platform, long ID, optional metadata and unknown duration', () => {
  const source = readLXCapabilities({ sources: { wy: { actions: ['musicUrl'], qualitys: ['128k'] } } })[0]!;
  const request = makeLXRequest(track, '128k', source);
  assert.equal(request.source, 'wy');
  assert.equal(request.info.musicInfo.meta.songId, '90071992547409931234');
  assert.equal(request.info.musicInfo.meta.albumId, '42');
  assert.equal(request.info.musicInfo.interval, null);
  assert.equal(request.info.type, '128k');
  assert.throws(() => makeLXRequest(track, 'flac', source));
  assert.throws(() => makeLXRequest(track, '128k', { ...source, platform: 'tx' }));
});

test('declaration budgets bound raw arrays before dedupe without rewriting identifiers', () => {
  const base = { actions: ['lyric', 'pic'], qualitys: [] as string[] };
  assert.deepEqual(readLXCapabilities({ sources: { wy: base } }), [{ platform: 'wy', name: 'wy', actions: ['lyric', 'pic'], qualities: [] }]);
  const duplicate = readLXCapabilities({ sources: { wy: { ...base, qualitys: Array(LX_DECLARATION_MAX_ITEMS).fill('128k') } } })[0]!;
  assert.deepEqual(duplicate.qualities, ['128k']);
  assert.throws(() => readLXCapabilities({ sources: { wy: { ...base, qualitys: Array(LX_DECLARATION_MAX_ITEMS + 1).fill('128k') } } }));
  assert.throws(() => readLXCapabilities({ sources: { wy: { ...base, actions: Array(LX_DECLARATION_MAX_ITEMS + 1).fill('lyric') } } }));
  assert.throws(() => readLXCapabilities({ sources: { wy: { ...base, qualitys: ['x'.repeat(LX_DECLARATION_MAX_LENGTH + 1)] } } }));
  assert.doesNotThrow(() => readLXCapabilities({ sources: { wy: { ...base, qualitys: ['x'.repeat(LX_DECLARATION_MAX_LENGTH)] } } }));
  assert.throws(() => readLXCapabilities({ sources: { wy: { ...base, actions: [128] } } }));
  assert.throws(() => readLXCapabilities({ sources: { wy: { ...base, qualitys: [''] } } }));
  const unknown = readLXCapabilities({ sources: { wy: { actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['384k', 'future-lossless', '384k'] } } })[0]!;
  assert.deepEqual(unknown.qualities, ['384k', 'future-lossless']);
  assert.equal(makeLXRequest(track, 'future-lossless', unknown).info.type, 'future-lossless');
  assert.throws(() => makeLXRequest(track, '128k', unknown));
  assert.equal(makeLXActionRequest(track, 'pic', unknown).action, 'pic');
  assert.throws(() => makeLXActionRequest(track, 'unknown' as never, unknown));
  assert.throws(() => readLXCapabilities({ sources: {
    wy: { actions: [], qualitys: [] },
    tx: { actions: null, qualitys: [] },
  } }));
});

test('source name falls back only when missing or empty and rejects explicit bad types', () => {
  const actions = ['lyric'], qualitys: string[] = [];
  assert.equal(readLXCapabilities({ sources: { wy: { actions, qualitys } } })[0]!.name, 'wy');
  assert.equal(readLXCapabilities({ sources: { wy: { name: '', actions, qualitys } } })[0]!.name, 'wy');
  assert.equal(readLXCapabilities({ sources: { wy: { name: 'x'.repeat(LX_NAME_MAX_LENGTH), actions, qualitys } } })[0]!.name, 'x'.repeat(LX_NAME_MAX_LENGTH));
  assert.throws(() => readLXCapabilities({ sources: { wy: { name: 42, actions, qualitys } } }));
  assert.throws(() => readLXCapabilities({ sources: { wy: { name: 'x'.repeat(LX_NAME_MAX_LENGTH + 1), actions, qualitys } } }));
});

test('initialization rejects responses beyond the native UTF-8 event limit before parsing', () => {
  const prefix = '{"sources":{},"pad":"', suffix = '"}';
  const padding = LX_INITIALIZE_MAX_BYTES - prefix.length - suffix.length;
  const exact = prefix + 'a'.repeat(padding) + suffix;
  assert.equal(Buffer.byteLength(exact), LX_INITIALIZE_MAX_BYTES);
  assert.deepEqual(readLXInitialize(exact), []);
  assert.throws(() => readLXInitialize(exact + 'a'), /超出上限/);
  // UTF-16 length alone would fit; UTF-8 byte length must reject.
  const multibyte = prefix + '音'.repeat(400000) + suffix;
  assert.ok(multibyte.length < LX_INITIALIZE_MAX_BYTES && Buffer.byteLength(multibyte) > LX_INITIALIZE_MAX_BYTES);
  assert.throws(() => readLXInitialize(multibyte), /超出上限/);
  assert.throws(() => readLXInitialize('{"sources":'), /格式无效/);
});

test('native adapter parses capability JSON through the bounded reader', async () => {
  const source: SourceDefinition = { id: 'fixture', name: 'fixture', script: 'fixture' };
  const initialized: string[] = [];
  const adapter = createNativeLX({
    initializeSource: async (_id, _revision, _name, script) => {
      initialized.push(script);
      return JSON.stringify({ sources: { wy: { name: 'Fixture', actions: ['musicUrl', 'lyric'], qualitys: ['128k', 'future'] } } });
    },
    requestSource: async () => '{}',
    cancelRequest: async () => {},
    destroySource: async () => {},
  });
  const capabilities = await adapter.initialize(source, 1, new AbortController().signal);
  assert.deepEqual(initialized, ['fixture']);
  assert.deepEqual(capabilities, [{ platform: 'wy', name: 'Fixture', actions: ['musicUrl', 'lyric'], qualities: ['128k', 'future'] }]);

  const oversized = createNativeLX({
    initializeSource: async () => JSON.stringify({ sources: {}, pad: 'a'.repeat(LX_INITIALIZE_MAX_BYTES) }),
    requestSource: async () => '{}', cancelRequest: async () => {}, destroySource: async () => {},
  });
  await assert.rejects(oversized.initialize(source, 2, new AbortController().signal), /超出上限/);
});

test('registry isolates a source that fails declaration budgets and keeps the other requestable', async () => {
  const payloads: string[] = [];
  const destroyed: string[] = [];
  const adapter = createNativeLX({
    initializeSource: async (id) => id === 'bad'
      ? JSON.stringify({ sources: { wy: { actions: Array(LX_DECLARATION_MAX_ITEMS + 1).fill('lyric'), qualitys: [] } } })
      : JSON.stringify({ sources: { wy: { name: 'Good', actions: ['musicUrl'], qualitys: ['128k'] } } }),
    requestSource: async (id, _revision, _requestID, payload) => {
      payloads.push(`${id}:${payload}`);
      return JSON.stringify({ url: `https://example.test/${id}.mp3` });
    },
    cancelRequest: async () => {},
    destroySource: async (id, revision) => { destroyed.push(`${id}@${revision}`); },
  });
  const registry = new SourceRegistry(adapter, 5000);
  registry.register({ id: 'good', name: 'Good', script: 'good.js' });
  registry.register({ id: 'bad', name: 'Bad', script: 'bad.js' });
  assert.deepEqual(await registry.setManyEnabled(['bad', 'good'], true), { succeeded: ['good'], failed: ['bad'] });
  const bad = registry.getSnapshot().find(state => state.id === 'bad')!;
  const good = registry.getSnapshot().find(state => state.id === 'good')!;
  assert.equal(bad.status, 'failed');
  assert.deepEqual(bad.capabilities, []);
  assert.ok(destroyed.includes('bad@2'));
  assert.equal(registry.isCurrent(bad), false);
  assert.equal(good.status, 'ready');
  assert.deepEqual(good.capabilities, [{ platform: 'wy', name: 'Good', actions: ['musicUrl'], qualities: ['128k'] }]);
  const value = await adapter.request(good, makeLXRequest(track, '128k', good.capabilities[0]!), new AbortController().signal);
  assert.deepEqual(value, { url: 'https://example.test/good.mp3' });
  assert.equal(payloads.length, 1);
  assert.match(payloads[0]!, /^good:.*"source":"wy"/);
});

test('diagnostic adapter cannot bypass the initialization byte budget', async () => {
  const diagnostic = createNativeDiagnosticLX({
    initializeHealthSource: async () => JSON.stringify({ sources: {}, pad: 'a'.repeat(LX_INITIALIZE_MAX_BYTES) }),
    requestHealthSource: async () => '{}', cancelHealthRequest: async () => {}, destroyHealthSource: async () => {},
  });
  await assert.rejects(
    diagnostic.initialize({ id: 'health', name: 'health', script: 'health.js' }, 1, new AbortController().signal),
    /超出上限/,
  );
});
