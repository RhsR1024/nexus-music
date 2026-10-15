import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackController, type ResolvedMedia, type PlaybackBackend } from '../src/playback/controller.ts';
import { makeQueue, select } from '../src/domain/queue.ts';
import { deferred, entry } from './fixtures.ts';

function rig() {
  const requests: Array<ReturnType<typeof deferred<ResolvedMedia>> & { signal: AbortSignal }> = [];
  const calls: string[] = [];
  const backend: PlaybackBackend = {
    stop: () => { calls.push('stop'); }, pause: () => { calls.push('pause'); },
    load: media => { calls.push(`load:${media.url}`); }, play: () => { calls.push('play'); },
  };
  const queue = makeQueue([entry('a'), entry('b')]);
  const controller = new PlaybackController({ resolve: (_, signal) => {
    const request = { ...deferred<ResolvedMedia>(), signal }; requests.push(request); return request.promise;
  } }, backend, queue);
  return { controller, requests, calls, queue };
}

test('pause aborts resolution; late URL cannot load or start playback', async () => {
  const { controller, requests, calls } = rig();
  const pending = controller.play();
  controller.pause();
  assert.equal(requests[0]?.signal.aborted, true);
  requests[0]!.resolve({ url: 'https://example.test/late.mp3' });
  await pending;
  assert.deepEqual(calls, ['stop', 'pause']);
  assert.equal(controller.getSnapshot().intent, 'paused');
});

test('new selection wins even when old resolver ignores cancellation', async () => {
  const { controller, requests, calls, queue } = rig();
  const old = controller.play();
  const latest = controller.play(select(queue, 'b'));
  requests[1]!.resolve({ url: 'https://example.test/new.mp3' }); await latest;
  requests[0]!.resolve({ url: 'https://example.test/old.mp3' }); await old;
  assert.deepEqual(calls, ['stop', 'stop', 'load:https://example.test/new.mp3', 'play']);
  assert.equal(controller.getSnapshot().queue.currentId, 'b');
});

test('late rejection cannot overwrite successful selection or leak resolver secrets', async () => {
  const { controller, requests, queue } = rig();
  const old = controller.play(); const current = controller.play(select(queue, 'b'));
  requests[1]!.resolve({ url: 'https://example.test/new.mp3' }); await current;
  requests[0]!.reject(new Error('PRIVATE_TOKEN')); await old;
  assert.equal(controller.getSnapshot().phase, 'ready');
  assert.equal(controller.getSnapshot().error, null);
});

test('resolver failure pauses and shows a safe actionable error', async () => {
  const { controller, requests } = rig();
  const pending = controller.play(); requests[0]!.reject(new Error('PRIVATE_TOKEN')); await pending;
  assert.equal(controller.getSnapshot().intent, 'paused');
  assert.equal(controller.getSnapshot().phase, 'error');
  assert.ok(!controller.getSnapshot().error?.includes('PRIVATE_TOKEN'));
});

test('ended events advance once; stale callbacks do not skip the next song', async () => {
  const { controller, requests } = rig();
  const initial = controller.play(); requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await initial;
  const oldToken = controller.getSnapshot().token!;
  const next = controller.onEnded(oldToken);
  await controller.onEnded(oldToken);
  assert.equal(requests.length, 2);
  assert.equal(controller.getSnapshot().queue.currentId, 'b');
  requests[1]!.resolve({ url: 'https://example.test/b.mp3' }); await next;
});

test('paused or disposed controller ignores native end events and late results', async () => {
  const { controller, requests, calls } = rig();
  const pending = controller.play(); const token = controller.getSnapshot().token!;
  controller.dispose(); requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await pending;
  await controller.onEnded(token);
  assert.deepEqual(calls, ['stop', 'stop']);
  assert.equal(requests.length, 1);
});

test('replacing current entry aborts old work and waits for explicit play', async () => {
  const { controller, requests, queue, calls } = rig();
  const pending = controller.play(); controller.setQueue(select(queue, 'b'));
  requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await pending;
  assert.equal(controller.getSnapshot().intent, 'paused');
  assert.deepEqual(calls, ['stop', 'stop']);
});

test('ready media resumes in place after pause without resolving or resetting position', async () => {
  const { controller, requests, calls } = rig();
  const pending = controller.play(); requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await pending;
  const old = controller.getSnapshot().token!;
  controller.onReady(old); controller.onProgress(old, 32, 100, false);
  controller.pause(); await controller.play();
  assert.equal(requests.length, 1);
  assert.equal(controller.getSnapshot().position, 32);
  assert.ok(controller.getSnapshot().token!.generation > old.generation);
  assert.equal(calls.at(-1), 'play');
  await controller.onEnded(old); assert.equal(requests.length, 1);
});

test('native decode failure retries resolver with only the failed route excluded', async () => {
  const calls: ReadonlySet<string>[] = [];
  const controller = new PlaybackController({ resolve: async (_, __, excluded) => {
    calls.push(new Set(excluded)); return { url: 'https://example.test/audio', routeKey: calls.length === 1 ? 'a:flac' : 'b:flac' };
  } }, { load() {}, stop() {}, pause() {}, play() {} }, makeQueue([entry('a')]));
  await controller.play(); const old = controller.getSnapshot().token!;
  await controller.onError(old);
  assert.equal(calls.length, 2); assert.deepEqual([...calls[1]!], ['a:flac']);
  await controller.onError(old); assert.equal(calls.length, 2);
  controller.pause(); await controller.onError(controller.getSnapshot().token ?? old);
  assert.equal(calls.length, 2);
});
