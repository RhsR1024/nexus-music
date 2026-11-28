import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaults, PreferenceStore, validatePreferences } from '../src/app/preferences.ts';
import {
  applyPlatformSourceRouting,
  clearPlatformSourceRule,
  countPlatformRoutingCustomizations,
  moveSourcePriorityForPlatform,
  normalizePlaybackQualities,
  normalizePlatformSourceRouting,
  pinSourceTopForPlatform,
  setSourceExcludedForPlatform,
} from '../src/domain/platformRouting.ts';
import { scoreCandidate } from '../src/domain/matching.ts';
import { allMusicPlatforms, trackPlatform, type MusicPlatform, type OnlinePlatform, type Track } from '../src/domain/track.ts';
import { AccountPlaybackResolver } from '../src/providers/accountPlaybackResolver.ts';
import { createDownloadResolver } from '../src/providers/downloadResolver.ts';
import { MatchedResolver } from '../src/providers/matchedResolver.ts';
import { MultiSourceResolver, type LXTransport } from '../src/providers/multiSourceResolver.ts';
import {
  formatNetworkSummary,
  mergeRecommendedRouting,
  NETWORK_CHECK_PLATFORMS,
  NetworkDiagnosticsCoordinator,
  recommendPlatformSourceRouting,
  type NetworkCheckRow,
  type PhaseDetail,
  type SourceCheckGroup,
} from '../src/providers/networkDiagnostics.ts';
import { SourceRegistry } from '../src/providers/sourceRegistry.ts';
import { cleanBackupSettings } from '../src/storage/backupSettings.ts';

function onlineTrack(platform: OnlinePlatform, id: string, title = '晴天', artist = '周杰伦'): Track {
  return {
    origin: { kind: 'online', platform, id },
    title,
    artist,
    durationMs: 269_000,
    metadata: { songmid: id, hash: id },
    qualities: [{ id: 'flac' }, { id: '320k' }, { id: '128k' }],
  };
}

function importedTrack(platform: 'qishui' | 'bodian', id: string, title = '晴天', artist = '周杰伦'): Track {
  return {
    origin: { kind: 'imported', platform, id },
    title,
    artist,
    durationMs: 269_000,
    metadata: { originalPlatform: platform, originalId: id },
    qualities: [],
  };
}

async function makeMultiRegistry() {
  const registry = new SourceRegistry({
    initialize: async source => {
      if (source.id === 's-wy-only') {
        return [{ platform: 'wy', name: '网易专用', actions: ['musicUrl'], qualities: ['flac', '320k', '128k'] }];
      }
      if (source.id === 's-tx-only') {
        return [{ platform: 'tx', name: 'QQ专用', actions: ['musicUrl'], qualities: ['flac', '320k', '128k'] }];
      }
      return (['wy', 'tx', 'kw', 'kg', 'mg'] as const).map(platform => ({
        platform,
        name: platform,
        actions: ['musicUrl'],
        qualities: ['flac', '320k', '128k'],
      }));
    },
    destroy() {},
  });
  registry.registerMany([
    { id: 's-all-1', name: '通用源 A', script: 'a', fingerprint: 'fp-a' },
    { id: 's-all-2', name: '通用源 B', script: 'b', fingerprint: 'fp-b' },
    { id: 's-wy-only', name: '网易专用源', script: 'c', fingerprint: 'fp-c' },
    { id: 's-tx-only', name: 'QQ 专用源', script: 'd', fingerprint: 'fp-d' },
  ]);
  await registry.setManyEnabled(['s-all-1', 's-all-2', 's-wy-only', 's-tx-only'], true);
  return registry;
}

test('playbackQualities accepts all 7 music platforms and persists through preferences & backups', async () => {
  assert.deepEqual([...allMusicPlatforms], ['wy', 'tx', 'kw', 'kg', 'mg', 'qishui', 'bodian']);
  assert.equal(trackPlatform(onlineTrack('wy', '1')), 'wy');
  assert.equal(trackPlatform(importedTrack('qishui', '123456')), 'qishui');
  assert.equal(trackPlatform(importedTrack('bodian', '654321')), 'bodian');

  const normalized = normalizePlaybackQualities({
    wy: 'hires',
    tx: 'flac',
    kw: '320k',
    kg: 'flac24bit',
    mg: '192k',
    qishui: '320k',
    bodian: 'flac',
  });
  assert.equal(normalized.qishui, '320k');
  assert.equal(normalized.bodian, 'flac');
  assert.throws(() => normalizePlaybackQualities({ unknown: '320k' }));
  assert.throws(() => normalizePlaybackQualities({ qishui: 'invalid' }));

  const records = new Map<string, unknown>();
  const repository = {
    get: async <T>(k: string) => structuredClone(records.get(k)) as T | undefined,
    put: async (k: string, v: unknown) => {
      records.set(k, structuredClone(v));
    },
  };
  const store = new PreferenceStore(repository);
  await store.restore();
  await store.update({
    playbackQualities: { wy: 'master', qishui: '320k', bodian: 'flac' },
  });
  const reloaded = new PreferenceStore(repository);
  await reloaded.restore();
  assert.deepEqual(reloaded.getSnapshot().playbackQualities, {
    wy: 'master',
    qishui: '320k',
    bodian: 'flac',
  });

  const backup = cleanBackupSettings({ version: 1, preferences: reloaded.getSnapshot() });
  assert.deepEqual(backup.preferences.playbackQualities, {
    wy: 'master',
    qishui: '320k',
    bodian: 'flac',
  });
});

test('AccountPlaybackResolver honors per-platform playbackQualities for qishui and bodian', async () => {
  const seenQualities: Array<{ platform: string; quality: string }> = [];
  const resolver = new AccountPlaybackResolver({
    enabled: () => true,
    quality: () => 'flac',
    qualityForPlatform: platform =>
      platform === 'qishui' ? '128k' : platform === 'bodian' ? '320k' : 'flac',
    musicAccounts: { getSnapshot: () => [], session: async () => null } as never,
    bodian: {
      directPlayback: async (_track, quality) => {
        seenQualities.push({ platform: 'bodian', quality });
        return { url: 'https://audio.example/bodian.mp3', quality, format: 'mp3' };
      },
    },
    bodianAccount: {
      getSnapshot: () => ({ loggedIn: false, nickname: '', deviceId: 'dev1' }),
      session: async () => null,
    },
    qishui: {
      directPlayback: async (_track, _cookie, _signal, quality = 'flac') => {
        seenQualities.push({ platform: 'qishui', quality });
        return { url: 'https://v11-luna.douyinvod.com/qishui.m4a', quality };
      },
    },
    qishuiAccount: {
      getSnapshot: () => ({ loggedIn: false, nickname: '', activeModeId: 'daily', playlists: [], liked: [], recent: [] }),
      sessionCookieHeader: async () => undefined,
    },
    md5: async v => v,
    hash: async v => v,
  });

  const qMedia = await resolver.resolve(importedTrack('qishui', '6777691046773000193'), new AbortController().signal);
  const bMedia = await resolver.resolve(importedTrack('bodian', '99887766'), new AbortController().signal);
  assert.equal(qMedia?.quality, '128k');
  assert.equal(bMedia?.quality, '320k');
  assert.deepEqual(seenQualities, [
    { platform: 'qishui', quality: '128k' },
    { platform: 'bodian', quality: '320k' },
  ]);
});

test('platformSourceRouting normalizes, mutates, and applies per-platform priority & exclusion rules', () => {
  const routing = normalizePlatformSourceRouting({
    wy: { priority: ['s-wy-only', 's-all-2', 's-all-1'], excluded: ['s-all-1'] },
    qishui: { priority: ['s-all-2'], excluded: ['s-wy-only'] },
    mg: { priority: [], excluded: [] },
  });
  // Excluded ID is stripped from priority; empty mg rule is omitted
  assert.deepEqual(routing.wy, { priority: ['s-wy-only', 's-all-2'], excluded: ['s-all-1'] });
  assert.equal(routing.mg, undefined);

  const list = [{ id: 's-all-1' }, { id: 's-all-2' }, { id: 's-wy-only' }, { id: 's-tx-only' }];
  assert.deepEqual(
    applyPlatformSourceRouting(list, 'wy', routing).map(s => s.id),
    ['s-wy-only', 's-all-2', 's-tx-only'],
  );
  // Qishui track falling back to wy: qishui priority leads, both wy & qishui exclusions apply
  assert.deepEqual(
    applyPlatformSourceRouting(list, 'wy', routing, 'qishui').map(s => s.id),
    ['s-all-2', 's-tx-only'],
  );

  let state = normalizePlatformSourceRouting({});
  state = setSourceExcludedForPlatform(state, 'tx', 's-all-1', true);
  assert.deepEqual(state.tx, { priority: [], excluded: ['s-all-1'] });
  state = pinSourceTopForPlatform(state, 'tx', 's-tx-only', ['s-all-2', 's-tx-only']);
  assert.deepEqual(state.tx, { priority: ['s-tx-only', 's-all-2'], excluded: ['s-all-1'] });
  state = moveSourcePriorityForPlatform(state, 'tx', 's-tx-only', ['s-tx-only', 's-all-2'], 1);
  assert.deepEqual(state.tx, { priority: ['s-all-2', 's-tx-only'], excluded: ['s-all-1'] });
  assert.deepEqual(countPlatformRoutingCustomizations(state.tx), {
    priorityCount: 2,
    excludedCount: 1,
    hasCustom: true,
  });
  state = clearPlatformSourceRule(state, 'tx');
  assert.equal(state.tx, undefined);

  // Validation & backup round-trip
  const valid = validatePreferences({ ...defaults, platformSourceRouting: routing });
  assert.deepEqual(valid.platformSourceRouting.wy, routing.wy);
  const backup = cleanBackupSettings({ version: 1, preferences: valid });
  assert.deepEqual(backup.preferences.platformSourceRouting?.qishui, routing.qishui);
  // Legacy backup without platformSourceRouting still validates
  const legacy = { ...backup.preferences };
  delete legacy.platformSourceRouting;
  assert.deepEqual(cleanBackupSettings({ version: 1, preferences: legacy }).preferences.platformSourceRouting, undefined);
});

test('MultiSourceResolver, MatchedResolver, and DownloadResolver enforce per-platform priority & exclusion', async () => {
  const registry = await makeMultiRegistry();
  const calls: Array<{ sourceId: string; platform: string }> = [];
  const transport: LXTransport = {
    async request(source, payload) {
      calls.push({ sourceId: source.id, platform: payload.source });
      return `https://audio.example/${source.id}/${payload.source}.flac`;
    },
  };
  const routing = normalizePlatformSourceRouting({
    wy: { priority: ['s-wy-only'], excluded: ['s-all-1'] },
    tx: { priority: ['s-tx-only'], excluded: ['s-all-1', 's-all-2'] },
    qishui: { priority: ['s-all-2'], excluded: ['s-wy-only', 's-all-1'] },
  });

  const multi = new MultiSourceResolver(registry, transport, () => 'flac', 3000, {
    sourceRouting: () => routing,
  });

  const wyMedia = await multi.resolve(onlineTrack('wy', '101'), new AbortController().signal);
  assert.equal(wyMedia.sourceId, 's-wy-only');
  const txMedia = await multi.resolve(onlineTrack('tx', '202'), new AbortController().signal);
  assert.equal(txMedia.sourceId, 's-tx-only');

  // Qishui imported track falling back to MatchedResolver uses qishui priority & exclusions
  const wyCandidate = onlineTrack('wy', '303', '晴天', '周杰伦');
  const matched = new MatchedResolver({
    matcher: {
      candidates: async () => ({
        items: [{ track: wyCandidate, ...scoreCandidate(importedTrack('qishui', '9001'), wyCandidate) }],
        failedPlatforms: [],
      }),
    },
    library: { matchFor: () => undefined, setMatch: async () => {} },
    router: multi,
    available: originPlatform => {
      const ready = registry.getSnapshot().filter(s => registry.isCurrent(s));
      return (['wy', 'tx', 'kw', 'kg', 'mg'] as const).filter(platform =>
        applyPlatformSourceRouting(ready, platform, routing, originPlatform).some(s =>
          s.capabilities.some(c => c.platform === platform && c.actions.includes('musicUrl')),
        ),
      );
    },
    quality: () => 'flac',
    hash: async v => v,
  });
  const qishuiMedia = await matched.resolve(importedTrack('qishui', '9001'), new AbortController().signal);
  assert.equal(qishuiMedia.sourceId, 's-all-2');
  // Excluded source s-all-1 was never called once
  assert.equal(calls.some(c => c.sourceId === 's-all-1'), false);

  // DownloadResolver also respects platformSourceRouting
  const downloadCalls: string[] = [];
  const downloader = createDownloadResolver({
    registry,
    transport: {
      request: async source => {
        downloadCalls.push(source.id);
        return `https://audio.example/dl/${source.id}.flac`;
      },
    },
    matcher: { candidates: async () => ({ items: [], failedPlatforms: [] }) },
    library: { matchFor: () => undefined, setMatch: async () => {} },
    preferences: () => ({
      quality: 'flac',
      autoMatch: false,
      downloadQualities: {},
      platformSourceRouting: routing,
    }),
    enrich: async t => t,
    other: { resolve: async () => { throw new Error('unused'); } },
    hash: async v => v,
  });
  await downloader.resolve(onlineTrack('tx', '777'), new AbortController().signal);
  assert.deepEqual(downloadCalls, ['s-tx-only']);
});

test('NetworkDiagnosticsCoordinator runs all 7 platforms 4-stage check, source matrix, cancellation & redaction', async () => {
  const registry = await makeMultiRegistry();
  let clock = 1_000;
  const searchCount = new Map<string, number>();
  let openCount = 0;
  let disposeCount = 0;

  const coordinator = new NetworkDiagnosticsCoordinator({
    registry,
    displayNameForSource: s => `${s.name}（别名）`,
    openDiagnostic: async source => {
      openCount++;
      return {
        capabilities: source.capabilities,
        request: async payload => `https://cdn.example/${source.id}/${payload.source}?token=SECRET_TOKEN`,
        dispose() {
          disposeCount++;
        },
      };
    },
    discover: async platform => {
      clock += 20;
      if (platform === 'mg') return 0; // empty content -> uncertain on discover, can still continue
      return 12;
    },
    searchSample: async (platform, keyword) => {
      clock += 30;
      searchCount.set(platform, (searchCount.get(platform) ?? 0) + 1);
      if (platform === 'kw') return undefined; // no sample -> skips resolve & audio
      if (platform === 'qishui' || platform === 'bodian') {
        return importedTrack(platform, '123456', `${keyword} https://leak.example/secret`, '周杰伦');
      }
      return onlineTrack(platform, '100', `${keyword} 样本`, '周杰伦');
    },
    resolveSample: async track => {
      clock += 40;
      if (track.origin.kind === 'online' && track.origin.platform === 'kg') {
        throw new Error('RAW_PRIVATE_SCRIPT_ERROR_TOKEN=xyz');
      }
      return {
        url: 'https://secret.cdn.example/stream.flac?auth=12345',
        sourceName: track.origin.kind === 'imported' ? `${track.origin.platform}账号直连` : '网易云官方免费直连',
        quality: 'flac',
      };
    },
    probe: async () => {
      clock += 25;
      return { state: 'header', bytes: 4096, status: 206, format: 'flac' };
    },
    readNetworkStatus: async () => ({
      connected: true,
      validated: true,
      transport: 'wifi',
      isExpensive: false,
      hasVpn: true,
      dnsCount: 2,
    }),
    now: () => clock,
  });

  await coordinator.startPlatformCheck('晴天');
  const snap1 = coordinator.getSnapshot();
  assert.equal(snap1.running, false);
  assert.equal(snap1.finishReason, '检测完成');
  assert.equal(snap1.platformRows.length, NETWORK_CHECK_PLATFORMS.length);
  assert.equal(snap1.platformRows.length, 7);
  assert.equal(formatNetworkSummary(snap1.network), 'Wi-Fi / VPN · 系统已验证联网');

  const byPlat = new Map(snap1.platformRows.map(r => [r.platform, r]));
  assert.equal(byPlat.get('wy')?.kind, 'ok');
  assert.equal(byPlat.get('wy')?.badge, '正常');
  assert.equal(byPlat.get('qishui')?.kind, 'ok');
  assert.equal(byPlat.get('bodian')?.kind, 'ok');
  assert.equal(byPlat.get('mg')?.kind, 'ok'); // empty discover is uncertain, but audio header succeeded
  assert.equal(byPlat.get('kw')?.kind, 'uncertain'); // no search sample -> skipped resolve/audio
  assert.equal(byPlat.get('kg')?.kind, 'failed');
  assert.equal(byPlat.get('kg')?.badge, '解析失败');

  // Local report redacts URLs and never leaks tokens or raw errors
  const report = coordinator.formatLocalReport();
  assert.doesNotMatch(report, /secret\.cdn\.example/i);
  assert.doesNotMatch(report, /leak\.example/i);
  assert.doesNotMatch(report, /RAW_PRIVATE_SCRIPT_ERROR/i);
  assert.match(report, /\[地址隐藏\]/);

  // Test all enabled custom LX sources check
  searchCount.clear();
  await coordinator.startAllSourcesCheck('晴天');
  const snap2 = coordinator.getSnapshot();
  assert.equal(snap2.running, false);
  assert.equal(snap2.sourceFinishReason, '检测完成');
  assert.equal(snap2.sourceGroups.length, 4);
  assert.equal(openCount, 4);
  assert.equal(disposeCount, 4);
  // Single-platform sources mark non-declared platforms as 'unsupported' (not failed)
  const wyOnly = snap2.sourceGroups.find(g => g.sourceId === 's-wy-only')!;
  assert.equal(wyOnly.rows.find(r => r.platform === 'wy')?.kind, 'ok');
  assert.equal(wyOnly.rows.find(r => r.platform === 'tx')?.kind, 'unsupported');
  assert.equal(wyOnly.rows.find(r => r.platform === 'tx')?.badge, '未声明');
  // Search cache prevents duplicate platform search calls across the 4 sources
  assert.equal(searchCount.get('wy'), 1);
  assert.equal(searchCount.get('tx'), 1);

  const report2 = coordinator.formatLocalReport();
  assert.doesNotMatch(report2, /SECRET_TOKEN/);
  assert.match(report2, /网易专用源（别名）/);

  // Cancellation stops a hung run cleanly and ignores late completions
  let releaseDiscover!: (value: number) => void;
  const hung = new NetworkDiagnosticsCoordinator({
    registry,
    openDiagnostic: async () => {
      throw new Error('unused');
    },
    discover: (_platform: MusicPlatform, signal: AbortSignal) =>
      new Promise<number>((resolve, reject) => {
        releaseDiscover = resolve;
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    searchSample: async () => undefined,
    resolveSample: async () => ({ url: '' }),
    probe: async () => ({ state: 'cancelled', bytes: 0 }),
    totalDeadlineMs: 5_000,
  });
  const pendingRun = hung.startPlatformCheck('晴天');
  await new Promise(r => setTimeout(r, 15));
  assert.equal(hung.getSnapshot().running, true);
  hung.stop('用户停止');
  await pendingRun;
  const afterStop = hung.getSnapshot();
  assert.equal(afterStop.running, false);
  assert.equal(afterStop.finishReason, '用户停止');
  releaseDiscover?.(99);
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(hung.getSnapshot(), afterStop);
  hung.dispose();
  coordinator.dispose();
});

test('recommendPlatformSourceRouting ranks by quality/latency, safely excludes broken sources, and respects selective merge', () => {
  const okPhase = (ms: number): PhaseDetail => ({ state: 'ok', shortText: `${ms} ms`, detail: `完成 · ${ms} ms`, elapsedMs: ms });
  const failPhase = (detail: string, shortText = '失败'): PhaseDetail => ({ state: 'failed', shortText, detail });
  const skipPhase = (): PhaseDetail => ({ state: 'skipped', shortText: '跳过', detail: '跳过' });

  const makeRow = (
    sourceId: string,
    sourceName: string,
    platform: OnlinePlatform,
    kind: NetworkCheckRow['kind'],
    phases: readonly [PhaseDetail, PhaseDetail, PhaseDetail, PhaseDetail],
    extra: Partial<Pick<NetworkCheckRow, 'resolvedQuality' | 'audioFormat' | 'httpStatus'>> = {},
  ): NetworkCheckRow => ({
    id: `source:${sourceId}:${platform}`,
    mode: 'source',
    platform,
    platformLabel: platform,
    platformShort: platform,
    sourceId,
    sourceName,
    kind,
    badge: kind === 'ok' ? '正常' : kind === 'unsupported' ? '未声明' : '失败',
    phases,
    ...extra,
  });

  const groups: SourceCheckGroup[] = [
    {
      sourceId: 'src-fast-flac',
      sourceName: '高速无损源',
      rows: [
        makeRow('src-fast-flac', '高速无损源', 'wy', 'ok', [okPhase(50), okPhase(80), okPhase(120), okPhase(90)], { resolvedQuality: 'flac', audioFormat: 'flac' }),
        makeRow('src-fast-flac', '高速无损源', 'tx', 'ok', [okPhase(50), okPhase(80), okPhase(150), okPhase(100)], { resolvedQuality: '320k', audioFormat: 'mpeg' }),
        makeRow('src-fast-flac', '高速无损源', 'kw', 'failed', [okPhase(50), okPhase(80), failPhase('未通过 · 音源解析失败'), skipPhase()]),
        makeRow('src-fast-flac', '高速无损源', 'kg', 'failed', [okPhase(50), failPhase('未通过 · 搜索接口失败'), skipPhase(), skipPhase()]),
        makeRow('src-fast-flac', '高速无损源', 'mg', 'unsupported', [skipPhase(), skipPhase(), skipPhase(), skipPhase()]),
      ],
    },
    {
      sourceId: 'src-slow-flac',
      sourceName: '慢速无损源',
      rows: [
        makeRow('src-slow-flac', '慢速无损源', 'wy', 'ok', [okPhase(50), okPhase(80), okPhase(500), okPhase(400)], { resolvedQuality: 'flac', audioFormat: 'flac' }),
        makeRow('src-slow-flac', '慢速无损源', 'tx', 'ok', [okPhase(50), okPhase(80), okPhase(400), okPhase(300)], { resolvedQuality: 'flac', audioFormat: 'flac' }),
        makeRow('src-slow-flac', '慢速无损源', 'kw', 'failed', [okPhase(50), okPhase(80), okPhase(200), failPhase('未通过 · HTTP 403')], { httpStatus: 403 }),
        makeRow('src-slow-flac', '慢速无损源', 'kg', 'ok', [okPhase(50), okPhase(80), okPhase(220), okPhase(110)], { resolvedQuality: '320k', audioFormat: 'mpeg' }),
        makeRow('src-slow-flac', '慢速无损源', 'mg', 'ok', [okPhase(50), okPhase(80), okPhase(180), okPhase(100)], { resolvedQuality: '320k', audioFormat: 'mpeg' }),
      ],
    },
    {
      sourceId: 'src-broken',
      sourceName: '失效音源',
      rows: [
        makeRow('src-broken', '失效音源', 'wy', 'failed', [okPhase(50), okPhase(80), failPhase('未通过 · 音源解析超时', '超时'), skipPhase()]),
        makeRow('src-broken', '失效音源', 'tx', 'failed', [okPhase(50), okPhase(80), okPhase(100), failPhase('未通过 · HTTP 403')], { httpStatus: 403 }),
        makeRow('src-broken', '失效音源', 'kw', 'unsupported', [skipPhase(), skipPhase(), skipPhase(), skipPhase()]),
        makeRow('src-broken', '失效音源', 'kg', 'unsupported', [skipPhase(), skipPhase(), skipPhase(), skipPhase()]),
        makeRow('src-broken', '失效音源', 'mg', 'unsupported', [skipPhase(), skipPhase(), skipPhase(), skipPhase()]),
      ],
    },
  ];

  const existing = normalizePlatformSourceRouting({
    kw: { priority: ['custom-keep'], excluded: [] },
  });
  const plan = recommendPlatformSourceRouting(groups, existing);
  assert.equal(plan.hasRecommendations, true);
  assert.equal(plan.testedSources, 3);

  const byPlat = new Map(plan.platforms.map(p => [p.platform, p]));
  // wy: both flac -> faster src-fast-flac (210ms) beats src-slow-flac (900ms); src-broken excluded
  assert.deepEqual(byPlat.get('wy')?.priority.map(c => c.sourceId), ['src-fast-flac', 'src-slow-flac']);
  assert.deepEqual(byPlat.get('wy')?.excluded.map(c => c.sourceId), ['src-broken']);
  // tx: flac (src-slow-flac) beats 320k (src-fast-flac); src-broken excluded with HTTP 403 reason
  assert.deepEqual(byPlat.get('tx')?.priority.map(c => c.sourceId), ['src-slow-flac', 'src-fast-flac']);
  assert.equal(byPlat.get('tx')?.excluded[0]?.sourceId, 'src-broken');
  assert.match(byPlat.get('tx')?.excluded[0]?.reason ?? '', /403/);
  // kw: ALL declared sources failed -> safety guard emits ZERO exclusions and keeps existing kw rule untouched
  assert.deepEqual(byPlat.get('kw')?.priority, []);
  assert.deepEqual(byPlat.get('kw')?.excluded, []);
  assert.match(byPlat.get('kw')?.note ?? '', /暂不自动排除/);
  assert.deepEqual(plan.routing.kw, existing.kw);
  // kg: src-fast-flac failed at SEARCH (platform-side), NOT resolve/audio -> must NOT be excluded!
  assert.deepEqual(byPlat.get('kg')?.priority.map(c => c.sourceId), ['src-slow-flac']);
  assert.deepEqual(byPlat.get('kg')?.excluded, []);
  // mg: src-fast-flac & src-broken are undeclared ('unsupported') -> must NOT pollute excluded!
  assert.deepEqual(byPlat.get('mg')?.priority.map(c => c.sourceId), ['src-slow-flac']);
  assert.deepEqual(byPlat.get('mg')?.excluded, []);
  // qishui & bodian: ranked by okCount desc (src-slow-flac passed 4 vs src-fast-flac passed 2); src-broken passed 0 -> excluded
  assert.deepEqual(byPlat.get('qishui')?.priority.map(c => c.sourceId), ['src-slow-flac', 'src-fast-flac']);
  assert.deepEqual(byPlat.get('qishui')?.excluded.map(c => c.sourceId), ['src-broken']);
  assert.deepEqual(byPlat.get('bodian')?.priority.map(c => c.sourceId), ['src-slow-flac', 'src-fast-flac']);

  // Selective platform merge: only apply wy, keep tx untouched
  const partial = mergeRecommendedRouting(existing, plan.platforms, new Set(['wy']));
  assert.deepEqual(partial.wy, { priority: ['src-fast-flac', 'src-slow-flac'], excluded: ['src-broken'] });
  assert.equal(partial.tx, undefined);
  assert.deepEqual(partial.kw, existing.kw);
});
