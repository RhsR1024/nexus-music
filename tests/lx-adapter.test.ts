import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLXRequest, readLXCapabilities } from '../src/providers/lx.ts';
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
