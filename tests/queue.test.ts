import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackKey } from '../src/domain/track.ts';
import { makeQueue, enqueueNext, enqueueNextMany, advance, remove, move, append, emptyQueue } from '../src/domain/queue.ts';
import { entry, track } from './fixtures.ts';

test('long IDs remain strings; accounts and platforms never share identity', () => {
  assert.ok(trackKey(track.origin).includes('90071992547409931234'));
  assert.notEqual(trackKey({ kind: 'navidrome', accountId: 'a', id: '1' }),
    trackKey({ kind: 'navidrome', accountId: 'b', id: '1' }));
  assert.notEqual(trackKey({ kind: 'online', platform: 'wy', id: '1' }),
    trackKey({ kind: 'online', platform: 'tx', id: '1' }));
});

test('duplicate songs keep separate entry identity and original order', () => {
  const q = makeQueue([entry('a'), entry('b')]);
  assert.deepEqual(q.entries.map(e => e.id), ['a', 'b']);
  assert.equal(q.entries[0]?.track, q.entries[1]?.track);
  assert.throws(() => makeQueue([entry('a'), entry('a')]));
});

test('play-next insertion is FIFO and does not mutate the old queue', () => {
  const original = makeQueue([entry('a'), entry('b')]);
  const q = enqueueNext(enqueueNext(original, entry('x')), entry('y'));
  assert.deepEqual(q.entries.map(e => e.id), ['a', 'x', 'y', 'b']);
  assert.deepEqual(original.entries.map(e => e.id), ['a', 'b']);
  const next = enqueueNext(advance(q), entry('z'));
  assert.deepEqual(next.entries.map(e => e.id), ['a', 'x', 'y', 'z', 'b']);
});

test('removing an inserted or current song maintains valid succession', () => {
  const q = enqueueNext(enqueueNext(makeQueue([entry('a'), entry('b')]), entry('x')), entry('y'));
  assert.deepEqual(enqueueNext(remove(q, 'y'), entry('z')).entries.map(e => e.id), ['a', 'x', 'z', 'b']);
  assert.equal(remove(q, 'a').currentId, 'x');
  assert.equal(remove(makeQueue([entry('a')]), 'a').currentId, null);
});

test('natural queue end stops; explicit repeat wraps; empty queue stays empty', () => {
  const q = makeQueue([entry('a')]);
  assert.equal(advance(q).currentId, null);
  assert.equal(advance(q, 'all').currentId, 'a');
  assert.equal(advance(q, 'one').currentId, 'a');
  assert.equal(advance(emptyQueue), emptyQueue);
});

test('manual reorder keeps current identity and resets priority', () => {
  const q = move(enqueueNext(makeQueue([entry('a'), entry('b')]), entry('x')), 'b', 0);
  assert.equal(q.currentId, 'a');
  assert.deepEqual(q.entries.map(e => e.id), ['b', 'a', 'x']);
  assert.deepEqual(q.priorityIds, []);
  assert.throws(() => move(q, 'a', -1));
  assert.throws(() => append(q, entry('a')));
});

test('batch play-next keeps the list order and follows earlier priority blocks', () => {
  const base = makeQueue([entry('a'), entry('b'), entry('c')]);
  const batch = enqueueNextMany(base, [entry('x'), entry('y'), entry('z')]);
  assert.deepEqual(batch.entries.map(e => e.id), ['a', 'x', 'y', 'z', 'b', 'c']);
  assert.deepEqual(batch.priorityIds, ['x', 'y', 'z']);
  assert.equal(batch.currentId, 'a');
  // A later single insert lands after the whole earlier block, not before it.
  assert.deepEqual(enqueueNext(batch, entry('q')).entries.map(e => e.id), ['a', 'x', 'y', 'z', 'q', 'b', 'c']);
  // An empty batch is a no-op and duplicate entry IDs are rejected before any insert.
  assert.equal(enqueueNextMany(base, []), base);
  assert.throws(() => enqueueNextMany(base, [entry('x'), entry('x')]));
  assert.deepEqual(base.entries.map(e => e.id), ['a', 'b', 'c']);
});
