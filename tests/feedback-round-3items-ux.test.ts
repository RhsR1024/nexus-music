import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLATFORM_LOGO_URIS, type MusicPlatformId } from '../src/ui/platformLogoAssets.ts';
import { resolveTrackRowPlayState } from '../src/domain/trackRowPlayback.ts';

test('Item 1: Qishui 2046 secondary verification bundles offline MIT React 17 UMD, clears 404 body, and gates reveal on verifyReady', () => {
  assert.ok(existsSync(resolve('modules/nexus-native/common/react-17.0.2.min.js')));
  assert.ok(existsSync(resolve('modules/nexus-native/common/react-dom-17.0.2.min.js')));
  const podspec = readFileSync(resolve('modules/nexus-native/NexusNative.podspec'), 'utf8');
  assert.match(podspec, /common\/react-17\.0\.2\.min\.js/);
  assert.match(podspec, /common\/react-dom-17\.0\.2\.min\.js/);

  const swift = readFileSync(resolve('modules/nexus-native/ios/NexusMusicAuthModule.swift'), 'utf8');
  assert.match(swift, /loadBundledReactScripts/);
  assert.match(swift, /fetchReactScriptsFromCDN/);
  assert.match(swift, /s3\.pstatp\.com/);
  assert.doesNotMatch(swift, /lf3-cdn-tos\.bytecdntp\.com/);
  assert.match(swift, /decisionJson/);
  assert.match(swift, /verifyReady/);
  assert.match(swift, /document\.body\.innerHTML/);
});

test('Item 2: all 7 music platforms have crisp embedded PNG brand logos used in Discovery', () => {
  const expected: MusicPlatformId[] = ['wy', 'tx', 'kw', 'kg', 'mg', 'qishui', 'bodian'];
  for (const id of expected) {
    const uri = PLATFORM_LOGO_URIS[id];
    assert.ok(uri && uri.startsWith('data:image/png;base64,'), `missing PNG logo for ${id}`);
    assert.ok(uri.length > 800, `logo for ${id} unexpectedly small`);
  }
  const discovery = readFileSync(resolve('src/ui/Discovery.tsx'), 'utf8');
  assert.match(discovery, /<PlatformLogo platform=\{activeMeta\.id\}/);
  assert.match(discovery, /<PlatformLogo platform=\{opt\.id\}/);
});

test('Item 3: track row playback state transitions cleanly through loading, playing, paused, and idle, and playlist sheets mount MiniPlayer', () => {
  assert.equal(
    resolveTrackRowPlayState({
      rowKey: 'online:wy:1',
      activeTrackKey: undefined,
      pendingTrackKey: 'online:wy:1',
      phase: 'idle',
      intent: 'stopped',
      buffering: false,
    }),
    'loading',
  );
  assert.equal(
    resolveTrackRowPlayState({
      rowKey: 'online:wy:1',
      activeTrackKey: 'online:wy:1',
      phase: 'resolving',
      intent: 'playing',
      buffering: false,
    }),
    'loading',
  );
  assert.equal(
    resolveTrackRowPlayState({
      rowKey: 'online:wy:1',
      activeTrackKey: 'online:wy:1',
      phase: 'playing',
      intent: 'playing',
      buffering: true,
    }),
    'loading',
  );
  assert.equal(
    resolveTrackRowPlayState({
      rowKey: 'online:wy:1',
      activeTrackKey: 'online:wy:1',
      phase: 'playing',
      intent: 'playing',
      buffering: false,
    }),
    'playing',
  );
  assert.equal(
    resolveTrackRowPlayState({
      rowKey: 'online:wy:1',
      activeTrackKey: 'online:wy:1',
      phase: 'ready',
      intent: 'paused',
      buffering: false,
    }),
    'paused',
  );
  assert.equal(
    resolveTrackRowPlayState({
      rowKey: 'online:wy:2',
      activeTrackKey: 'online:wy:1',
      phase: 'playing',
      intent: 'playing',
      buffering: false,
    }),
    'idle',
  );

  const accountSheet = readFileSync(resolve('src/ui/AccountFeatureSheet.tsx'), 'utf8');
  assert.match(accountSheet, /<Player services=\{services\}/);
  assert.match(accountSheet, /<TrackPlaybackIndicator /);
  const bodianSheet = readFileSync(resolve('src/ui/BodianDiscoverSection.tsx'), 'utf8');
  assert.match(bodianSheet, /<Player services=\{services\}/);
  assert.match(bodianSheet, /<TrackPlaybackIndicator /);
});
