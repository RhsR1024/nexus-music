// Local-only layered network & audio-source diagnostics engine.
// Clean-room TypeScript implementation inspired by Wayferar-Music (commit 485a828)
// 4-phase layered check (发现 → 搜索 → 解析 → 音频), extended to all 7 NexusMusic
// platforms (wy / tx / kw / kg / mg / qishui / bodian) and all enabled LX sources.
// Strictly local: never uploads reports, never retains audio URLs/credentials,
// never alters playback queue or source ordering, bounded to 90s per run.

import {
  normalizePlatformSourceRouting,
  type PlatformSourceRouting,
  type PlatformSourceRule,
} from '../domain/platformRouting.ts';
import { normalizeQuality, qualityOrder, type Quality } from '../domain/quality.ts';
import type { MusicPlatform, OnlinePlatform, Track } from '../domain/track.ts';
import { bounded, DeadlineError, throwIfAborted } from './async.ts';
import type { AudioProbe, AudioProbeResult } from './audioProbe.ts';
import { makeLXRequest } from './lx.ts';
import type { DiagnosticSession, OpenDiagnostic } from './sourceDiagnostics.ts';
import type { SourceRegistry, SourceState } from './sourceRegistry.ts';

export const NETWORK_CHECK_PHASES = ['发现', '搜索', '解析', '音频'] as const;
export const NETWORK_CHECK_TOTAL_DEADLINE_MS = 90_000;
export const DEFAULT_NETWORK_CHECK_KEYWORD = '晴天';

export const NETWORK_CHECK_PLATFORMS: readonly {
  readonly id: MusicPlatform;
  readonly label: string;
  readonly short: string;
}[] = [
  { id: 'wy', label: '网易云音乐', short: '网易云' },
  { id: 'tx', label: 'QQ 音乐', short: 'QQ' },
  { id: 'kw', label: '酷我音乐', short: '酷我' },
  { id: 'kg', label: '酷狗音乐', short: '酷狗' },
  { id: 'mg', label: '咪咕音乐', short: '咪咕' },
  { id: 'qishui', label: '汽水音乐', short: '汽水' },
  { id: 'bodian', label: '波点音乐', short: '波点' },
];

export const SOURCE_CHECK_PLATFORMS: readonly {
  readonly id: OnlinePlatform;
  readonly label: string;
  readonly short: string;
}[] = [
  { id: 'wy', label: '网易云音乐', short: '网易云' },
  { id: 'tx', label: 'QQ 音乐', short: 'QQ' },
  { id: 'kw', label: '酷我音乐', short: '酷我' },
  { id: 'kg', label: '酷狗音乐', short: '酷狗' },
  { id: 'mg', label: '咪咕音乐', short: '咪咕' },
];

export type PhaseState = 'pending' | 'running' | 'ok' | 'uncertain' | 'failed' | 'skipped';
export type RowKind = 'pending' | 'running' | 'ok' | 'uncertain' | 'failed' | 'unsupported';

export interface PhaseDetail {
  readonly state: PhaseState;
  readonly shortText: string;
  readonly detail: string;
  readonly elapsedMs?: number;
}

export interface NetworkCheckRow {
  readonly id: string;
  readonly mode: 'platform' | 'source';
  readonly platform: MusicPlatform;
  readonly platformLabel: string;
  readonly platformShort: string;
  readonly sourceId?: string;
  readonly sourceName?: string;
  readonly kind: RowKind;
  readonly badge: string;
  readonly phases: readonly [PhaseDetail, PhaseDetail, PhaseDetail, PhaseDetail];
  readonly sampleTitle?: string;
  readonly resolvedLabel?: string;
  readonly resolvedQuality?: Quality;
  readonly audioFormat?: AudioProbeResult['format'];
  readonly httpStatus?: number;
  readonly bytes?: number;
}

export interface RecommendedPlatformCandidate {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly quality?: Quality;
  readonly format?: AudioProbeResult['format'];
  readonly latencyMs?: number;
  readonly okPlatforms?: number;
  readonly reason: string;
}

export interface RecommendedPlatformExclusion {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly reason: string;
}

export interface PlatformRoutingRecommendation {
  readonly platform: MusicPlatform;
  readonly platformLabel: string;
  readonly platformShort: string;
  readonly directLx: boolean;
  readonly priority: readonly RecommendedPlatformCandidate[];
  readonly excluded: readonly RecommendedPlatformExclusion[];
  readonly note?: string;
}

export interface RoutingRecommendationPlan {
  readonly hasRecommendations: boolean;
  readonly testedSources: number;
  readonly affectedPlatforms: number;
  readonly totalExcluded: number;
  readonly platforms: readonly PlatformRoutingRecommendation[];
  readonly routing: PlatformSourceRouting;
}

export interface SourceCheckGroup {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly rows: readonly NetworkCheckRow[];
}

export interface SystemNetworkInfo {
  readonly connected: boolean;
  readonly validated: boolean;
  readonly transport: 'wifi' | 'cellular' | 'ethernet' | 'other' | 'none' | 'unknown';
  readonly isExpensive: boolean;
  readonly isConstrained?: boolean;
  readonly hasVpn: boolean;
  readonly dnsCount?: number;
}

export interface NetworkCheckSnapshot {
  readonly activeMode: 'platform' | 'source';
  readonly running: boolean;
  readonly startedAt: number;
  readonly finishedAt?: number;
  readonly finishReason?: string;
  readonly sourceFinishReason?: string;
  readonly sampleKeyword: string;
  readonly network: SystemNetworkInfo;
  readonly platformRows: readonly NetworkCheckRow[];
  readonly sourceGroups: readonly SourceCheckGroup[];
}

export interface NetworkDiagnosticsDeps {
  readonly registry: Pick<SourceRegistry, 'getSnapshot' | 'isCurrent'>;
  readonly displayNameForSource?: (source: SourceState) => string;
  readonly openDiagnostic: OpenDiagnostic;
  readonly discover: (platform: MusicPlatform, signal: AbortSignal) => Promise<number>;
  readonly searchSample: (
    platform: MusicPlatform,
    keyword: string,
    signal: AbortSignal,
  ) => Promise<Track | undefined>;
  readonly resolveSample: (
    track: Track,
    signal: AbortSignal,
  ) => Promise<{ readonly url: string; readonly sourceName?: string; readonly quality?: string; readonly matchedTrack?: Track }>;
  readonly enrichOnlineTrack?: (track: Track, signal: AbortSignal) => Promise<Track>;
  readonly probe: AudioProbe;
  readonly readNetworkStatus?: () => Promise<Partial<SystemNetworkInfo> | null | undefined>;
  readonly now?: () => number;
  readonly totalDeadlineMs?: number;
  readonly stageTimeouts?: {
    readonly discoverMs?: number;
    readonly searchMs?: number;
    readonly resolveMs?: number;
    readonly audioMs?: number;
  };
}

const DEFAULT_NETWORK_INFO: SystemNetworkInfo = {
  connected: false,
  validated: false,
  transport: 'unknown',
  isExpensive: false,
  isConstrained: false,
  hasVpn: false,
  dnsCount: -1,
};

const safeLabel = (value: string): string =>
  value
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/https?:\/\/\S+/gi, '[地址隐藏]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

function pendingPhase(): PhaseDetail {
  return { state: 'pending', shortText: '等待', detail: '等待检测' };
}

function makeIdleRow(
  mode: 'platform' | 'source',
  platform: { readonly id: MusicPlatform; readonly label: string; readonly short: string },
  source?: { readonly id: string; readonly name: string },
): NetworkCheckRow {
  return {
    id: source ? `source:${source.id}:${platform.id}` : `platform:${platform.id}`,
    mode,
    platform: platform.id,
    platformLabel: platform.label,
    platformShort: platform.short,
    ...(source ? { sourceId: source.id, sourceName: safeLabel(source.name) } : {}),
    kind: 'pending',
    badge: '待检测',
    phases: [pendingPhase(), pendingPhase(), pendingPhase(), pendingPhase()],
  };
}

function makeUnsupportedRow(
  platform: { readonly id: OnlinePlatform; readonly label: string; readonly short: string },
  source: { readonly id: string; readonly name: string },
): NetworkCheckRow {
  const skipped: PhaseDetail = {
    state: 'skipped',
    shortText: '未声明',
    detail: '该脚本未声明支持此平台',
  };
  return {
    id: `source:${source.id}:${platform.id}`,
    mode: 'source',
    platform: platform.id,
    platformLabel: platform.label,
    platformShort: platform.short,
    sourceId: source.id,
    sourceName: safeLabel(source.name),
    kind: 'unsupported',
    badge: '未声明',
    phases: [skipped, skipped, skipped, skipped],
  };
}

export function classifyRow(
  phases: readonly [PhaseDetail, PhaseDetail, PhaseDetail, PhaseDetail],
  existingKind?: RowKind,
): { kind: RowKind; badge: string } {
  if (existingKind === 'unsupported') return { kind: 'unsupported', badge: '未声明' };
  if (phases.some(p => p.state === 'running')) return { kind: 'running', badge: '检测中' };
  if (phases.every(p => p.state === 'pending')) return { kind: 'pending', badge: '待检测' };
  if (phases[3].state === 'ok') return { kind: 'ok', badge: '正常' };
  if (phases.some(p => p.state === 'pending')) return { kind: 'running', badge: '检测中' };

  for (let i = 3; i >= 0; i--) {
    const phase = phases[i]!;
    if (phase.state === 'failed') {
      if (phase.detail.includes('超时') || phase.shortText === '超时') {
        return { kind: 'failed', badge: '超时' };
      }
      const labels = ['发现失败', '搜索失败', '解析失败', '音频失败'] as const;
      return { kind: 'failed', badge: labels[i]! };
    }
  }
  if (phases.some(p => p.state === 'uncertain' || p.state === 'skipped')) {
    return { kind: 'uncertain', badge: '未确认' };
  }
  return { kind: 'failed', badge: '异常' };
}

export function formatNetworkSummary(info: SystemNetworkInfo): string {
  const transportMap: Record<SystemNetworkInfo['transport'], string> = {
    wifi: 'Wi-Fi',
    cellular: '移动网络',
    ethernet: '以太网',
    other: '其他网络',
    none: '无活动网络',
    unknown: '网络状态待读取',
  };
  const link = `${transportMap[info.transport]}${info.hasVpn ? ' / VPN' : ''}`;
  if (info.transport === 'unknown') return '网络状态待读取 · 以实际链路结果为准';
  if (info.transport === 'none' || !info.connected) return `${link} · 当前未联网`;
  return `${link} · ${info.validated ? '系统已验证联网' : '系统未验证联网'}`;
}

function normalizeSystemNetwork(raw: Partial<SystemNetworkInfo> | null | undefined): SystemNetworkInfo {
  if (!raw || typeof raw !== 'object') return DEFAULT_NETWORK_INFO;
  const transport =
    raw.transport === 'wifi' ||
    raw.transport === 'cellular' ||
    raw.transport === 'ethernet' ||
    raw.transport === 'other' ||
    raw.transport === 'none'
      ? raw.transport
      : 'unknown';
  return {
    connected: Boolean(raw.connected),
    validated: Boolean(raw.validated),
    transport,
    isExpensive: Boolean(raw.isExpensive),
    isConstrained: Boolean(raw.isConstrained),
    hasVpn: Boolean(raw.hasVpn),
    dnsCount: typeof raw.dnsCount === 'number' && Number.isFinite(raw.dnsCount) ? raw.dnsCount : -1,
  };
}

function pickDiagnosticQuality(qualities: readonly string[]): { scriptQuality: string; quality: Quality } | undefined {
  const preferredOrder: readonly Quality[] = ['flac', '320k', '192k', '128k', 'flac24bit', 'hires', 'atmos', 'atmos_plus', 'master'];
  for (const target of preferredOrder) {
    const match = qualities.find(q => normalizeQuality(q) === target);
    if (match) return { scriptQuality: match, quality: target };
  }
  for (const q of qualities) {
    const normalized = normalizeQuality(q);
    if (normalized) return { scriptQuality: q, quality: normalized };
  }
  return undefined;
}

function validAudioURL(raw: unknown): string | undefined {
  const value =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object'
        ? (raw as { url?: unknown }).url
        : undefined;
  if (typeof value !== 'string' || value.length > 8192) return undefined;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function describeAudioProbe(result: AudioProbeResult, elapsedMs: number): PhaseDetail {
  if (result.state === 'header') {
    const fmt = result.format ? result.format.toUpperCase() : '音频';
    const http = result.status ? ` · HTTP ${result.status}` : '';
    return {
      state: 'ok',
      shortText: fmt,
      detail: `音频头可识别 · ${fmt}${http} · ${result.bytes} B · ${elapsedMs} ms`,
      elapsedMs,
    };
  }
  if (result.state === 'unrecognized') {
    const http = result.status ? ` · HTTP ${result.status}` : '';
    return {
      state: 'uncertain',
      shortText: '未确认',
      detail: `未确认 · 响应未识别为音频头${http} · ${result.bytes} B · ${elapsedMs} ms`,
      elapsedMs,
    };
  }
  if (result.state === 'timeout') {
    return { state: 'failed', shortText: '超时', detail: `未通过 · 音频响应超时（${elapsedMs} ms）`, elapsedMs };
  }
  if (result.state === 'http-error') {
    return {
      state: 'failed',
      shortText: result.status ? `HTTP ${result.status}` : '失败',
      detail: `未通过 · 服务器返回 HTTP ${result.status ?? '错误'}`,
      elapsedMs,
    };
  }
  if (result.state === 'redirect-error') {
    return { state: 'failed', shortText: '失败', detail: '未通过 · 重定向被安全策略拒绝', elapsedMs };
  }
  if (result.state === 'range-error') {
    return { state: 'failed', shortText: '失败', detail: '未通过 · 分段响应范围无效', elapsedMs };
  }
  if (result.state === 'invalid-url') {
    return { state: 'failed', shortText: '失败', detail: '未通过 · 音频地址格式无效', elapsedMs };
  }
  if (result.state === 'cancelled') {
    return { state: 'uncertain', shortText: '已取消', detail: '未完成（检测已取消）', elapsedMs };
  }
  return { state: 'failed', shortText: '失败', detail: '未通过 · 媒体响应获取失败', elapsedMs };
}

export class NetworkDiagnosticsCoordinator {
  private readonly deps: NetworkDiagnosticsDeps;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private abort?: AbortController;
  private deadlineTimer?: ReturnType<typeof setTimeout>;
  private activeSessions = new Set<DiagnosticSession>();
  private snapshot: NetworkCheckSnapshot = {
    activeMode: 'platform',
    running: false,
    startedAt: 0,
    sampleKeyword: DEFAULT_NETWORK_CHECK_KEYWORD,
    network: DEFAULT_NETWORK_INFO,
    platformRows: NETWORK_CHECK_PLATFORMS.map(p => makeIdleRow('platform', p)),
    sourceGroups: [],
  };

  constructor(deps: NetworkDiagnosticsDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: NetworkCheckSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  async refreshNetwork(): Promise<SystemNetworkInfo> {
    try {
      const raw = await this.deps.readNetworkStatus?.();
      const network = normalizeSystemNetwork(raw);
      this.publish({ ...this.snapshot, network });
      return network;
    } catch {
      this.publish({ ...this.snapshot, network: DEFAULT_NETWORK_INFO });
      return DEFAULT_NETWORK_INFO;
    }
  }

  stop(reason = '检测已取消') {
    this.generation++;
    if (this.deadlineTimer) {
      clearTimeout(this.deadlineTimer);
      this.deadlineTimer = undefined;
    }
    this.abort?.abort();
    this.abort = undefined;
    for (const session of this.activeSessions) {
      try {
        session.dispose();
      } catch {}
    }
    this.activeSessions.clear();
    if (this.snapshot.running) {
      this.finalizeInFlight(reason);
    }
  }

  dispose() {
    this.stop('页面已关闭');
    this.listeners.clear();
  }

  private finalizeRow(row: NetworkCheckRow, reason: string): NetworkCheckRow {
    if (row.kind === 'unsupported') return row;
    const nextPhases = row.phases.map(phase =>
      phase.state === 'pending' || phase.state === 'running'
        ? { state: 'uncertain' as const, shortText: '未完成', detail: `未完成（${reason}）` }
        : phase,
    ) as unknown as readonly [PhaseDetail, PhaseDetail, PhaseDetail, PhaseDetail];
    const classified = classifyRow(nextPhases, row.kind);
    return { ...row, phases: nextPhases, ...classified };
  }

  private finalizeInFlight(reason: string) {
    const mode = this.snapshot.activeMode;
    const platformRows =
      mode === 'platform'
        ? this.snapshot.platformRows.map(row => this.finalizeRow(row, reason))
        : this.snapshot.platformRows;
    const sourceGroups =
      mode === 'source'
        ? this.snapshot.sourceGroups.map(group => ({
            ...group,
            rows: group.rows.map(row => this.finalizeRow(row, reason)),
          }))
        : this.snapshot.sourceGroups;
    this.publish({
      ...this.snapshot,
      running: false,
      finishedAt: this.now(),
      ...(mode === 'platform' ? { finishReason: reason } : { sourceFinishReason: reason }),
      platformRows,
      sourceGroups,
    });
  }

  private updateRow(
    generation: number,
    rowId: string,
    updater: (row: NetworkCheckRow) => NetworkCheckRow,
  ) {
    if (generation !== this.generation) return;
    const mode = this.snapshot.activeMode;
    if (mode === 'platform') {
      const nextRows = this.snapshot.platformRows.map(row => (row.id === rowId ? updater(row) : row));
      this.publish({ ...this.snapshot, platformRows: nextRows });
    } else {
      const nextGroups = this.snapshot.sourceGroups.map(group => ({
        ...group,
        rows: group.rows.map(row => (row.id === rowId ? updater(row) : row)),
      }));
      this.publish({ ...this.snapshot, sourceGroups: nextGroups });
    }
  }

  private patchPhase(
    generation: number,
    rowId: string,
    phaseIndex: 0 | 1 | 2 | 3,
    phase: PhaseDetail,
    extra?: Partial<
      Pick<NetworkCheckRow, 'sampleTitle' | 'resolvedLabel' | 'resolvedQuality' | 'audioFormat' | 'httpStatus' | 'bytes'>
    >,
  ) {
    this.updateRow(generation, rowId, row => {
      const nextPhases = [...row.phases] as [PhaseDetail, PhaseDetail, PhaseDetail, PhaseDetail];
      nextPhases[phaseIndex] = phase;
      const classified = classifyRow(nextPhases, row.kind);
      return { ...row, ...extra, phases: nextPhases, ...classified };
    });
  }

  private armRun(mode: 'platform' | 'source', keyword: string) {
    this.stop();
    const generation = ++this.generation;
    const abort = new AbortController();
    this.abort = abort;
    const deadlineMs = this.deps.totalDeadlineMs ?? NETWORK_CHECK_TOTAL_DEADLINE_MS;
    const deadlineSec = Math.round(deadlineMs / 1000);
    this.deadlineTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.stop(`检测已超时（${deadlineSec} 秒）`);
    }, deadlineMs);
    return { generation, signal: abort.signal, keyword: keyword.trim() || DEFAULT_NETWORK_CHECK_KEYWORD };
  }

  async startPlatformCheck(rawKeyword = DEFAULT_NETWORK_CHECK_KEYWORD): Promise<void> {
    const { generation, signal, keyword } = this.armRun('platform', rawKeyword);
    const initialRows = NETWORK_CHECK_PLATFORMS.map(p => makeIdleRow('platform', p));
    this.publish({
      ...this.snapshot,
      activeMode: 'platform',
      running: true,
      startedAt: this.now(),
      finishedAt: undefined,
      finishReason: undefined,
      sampleKeyword: keyword,
      platformRows: initialRows,
    });

    void this.refreshNetwork();

    const timeouts = {
      discoverMs: this.deps.stageTimeouts?.discoverMs ?? 12_000,
      searchMs: this.deps.stageTimeouts?.searchMs ?? 12_000,
      resolveMs: this.deps.stageTimeouts?.resolveMs ?? 18_000,
      audioMs: this.deps.stageTimeouts?.audioMs ?? 14_000,
    };

    let cursor = 0;
    const runRow = async (row: NetworkCheckRow) => {
      if (signal.aborted || generation !== this.generation) return;

      // Stage 0: Discover
      this.patchPhase(generation, row.id, 0, { state: 'running', shortText: '检测中', detail: '正在请求发现目录…' });
      const discoverStart = this.now();
      try {
        const count = await bounded(child => this.deps.discover(row.platform, child), signal, timeouts.discoverMs);
        throwIfAborted(signal);
        const ms = Math.max(1, this.now() - discoverStart);
        if (count > 0) {
          this.patchPhase(generation, row.id, 0, {
            state: 'ok',
            shortText: `${ms} ms`,
            detail: `完成 · ${ms} ms · 返回 ${count} 项`,
            elapsedMs: ms,
          });
        } else {
          this.patchPhase(generation, row.id, 0, {
            state: 'uncertain',
            shortText: '空内容',
            detail: `未确认 · 平台返回空内容（${ms} ms）`,
            elapsedMs: ms,
          });
        }
      } catch (err) {
        if (signal.aborted || generation !== this.generation) return;
        const ms = Math.max(1, this.now() - discoverStart);
        this.patchPhase(generation, row.id, 0, {
          state: 'failed',
          shortText: err instanceof DeadlineError ? '超时' : '失败',
          detail: err instanceof DeadlineError ? `未通过 · 发现超时（${ms} ms）` : `未通过 · 发现接口请求失败（${ms} ms）`,
          elapsedMs: ms,
        });
      }

      if (signal.aborted || generation !== this.generation) return;

      // Stage 1: Search / Sample
      this.patchPhase(generation, row.id, 1, { state: 'running', shortText: '检测中', detail: `正在获取测试样本（${safeLabel(keyword)}）…` });
      const searchStart = this.now();
      let sample: Track | undefined;
      try {
        sample = await bounded(
          child => this.deps.searchSample(row.platform, keyword, child),
          signal,
          timeouts.searchMs,
        );
        throwIfAborted(signal);
        const ms = Math.max(1, this.now() - searchStart);
        if (!sample) {
          this.patchPhase(generation, row.id, 1, {
            state: 'uncertain',
            shortText: '无样本',
            detail: `未确认 · 未找到测试样本（${ms} ms）`,
            elapsedMs: ms,
          });
          this.patchPhase(generation, row.id, 2, { state: 'skipped', shortText: '跳过', detail: '跳过 · 搜索无可用样本' });
          this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 未取得音频地址' });
          return;
        }
        const sampleTitle = safeLabel(`${sample.title}${sample.artist ? ` · ${sample.artist}` : ''}`);
        this.patchPhase(
          generation,
          row.id,
          1,
          {
            state: 'ok',
            shortText: `${ms} ms`,
            detail: `完成 · ${ms} ms · 样本「${sampleTitle}」`,
            elapsedMs: ms,
          },
          { sampleTitle },
        );
      } catch (err) {
        if (signal.aborted || generation !== this.generation) return;
        const ms = Math.max(1, this.now() - searchStart);
        this.patchPhase(generation, row.id, 1, {
          state: 'failed',
          shortText: err instanceof DeadlineError ? '超时' : '失败',
          detail: err instanceof DeadlineError ? `未通过 · 搜索超时（${ms} ms）` : `未通过 · 搜索请求失败（${ms} ms）`,
          elapsedMs: ms,
        });
        this.patchPhase(generation, row.id, 2, { state: 'skipped', shortText: '跳过', detail: '跳过 · 搜索未取得测试样本' });
        this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 未取得音频地址' });
        return;
      }

      if (signal.aborted || generation !== this.generation) return;

      // Stage 2: Resolve playback URL (active chain: official/account direct -> LX -> public fallback)
      this.patchPhase(generation, row.id, 2, { state: 'running', shortText: '检测中', detail: '正在按当前策略解析音频地址…' });
      const resolveStart = this.now();
      let resolvedUrl: string | undefined;
      try {
        const media = await bounded(child => this.deps.resolveSample(sample!, child), signal, timeouts.resolveMs);
        throwIfAborted(signal);
        const ms = Math.max(1, this.now() - resolveStart);
        resolvedUrl = validAudioURL(media?.url);
        if (!resolvedUrl) {
          this.patchPhase(generation, row.id, 2, {
            state: 'failed',
            shortText: '失败',
            detail: `未通过 · 返回地址无效（${ms} ms）`,
            elapsedMs: ms,
          });
          this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 解析未取得有效地址' });
          return;
        }
        const resolvedLabel = [
          media.sourceName ? safeLabel(media.sourceName) : '已解析',
          media.quality ? media.quality.toUpperCase() : '',
          media.matchedTrack ? '跨平台匹配' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        const resolvedQuality = media.quality ? normalizeQuality(media.quality) : undefined;
        this.patchPhase(
          generation,
          row.id,
          2,
          {
            state: 'ok',
            shortText: `${ms} ms`,
            detail: `完成 · ${ms} ms · ${resolvedLabel}`,
            elapsedMs: ms,
          },
          { resolvedLabel, ...(resolvedQuality ? { resolvedQuality } : {}) },
        );
      } catch (err) {
        if (signal.aborted || generation !== this.generation) return;
        const ms = Math.max(1, this.now() - resolveStart);
        this.patchPhase(generation, row.id, 2, {
          state: 'failed',
          shortText: err instanceof DeadlineError ? '超时' : '失败',
          detail:
            err instanceof DeadlineError
              ? `未通过 · 解析超时（${ms} ms）`
              : `未通过 · 当前账号与已启用音源未能解析该样本（${ms} ms）`,
          elapsedMs: ms,
        });
        this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 解析未取得可用音频地址' });
        return;
      }

      if (signal.aborted || generation !== this.generation || !resolvedUrl) return;

      // Stage 3: Audio header probe (bounded 4 KiB Range check, zero player side effects)
      this.patchPhase(generation, row.id, 3, { state: 'running', shortText: '检测中', detail: '正在校验音频响应与容器头…' });
      const probeStart = this.now();
      try {
        const probeRes = await bounded(child => this.deps.probe(resolvedUrl!, child), signal, timeouts.audioMs);
        throwIfAborted(signal);
        const ms = Math.max(1, this.now() - probeStart);
        const phase = describeAudioProbe(probeRes, ms);
        this.patchPhase(generation, row.id, 3, phase, {
          audioFormat: probeRes.format,
          httpStatus: probeRes.status,
          bytes: probeRes.bytes,
        });
      } catch (err) {
        if (signal.aborted || generation !== this.generation) return;
        const ms = Math.max(1, this.now() - probeStart);
        this.patchPhase(generation, row.id, 3, {
          state: 'failed',
          shortText: err instanceof DeadlineError ? '超时' : '失败',
          detail: err instanceof DeadlineError ? `未通过 · 音频探测超时（${ms} ms）` : `未通过 · 音频响应检测失败（${ms} ms）`,
          elapsedMs: ms,
        });
      }
    };

    // Concurrency 2 matches native AudioURLProbe concurrency budget (< 2 active probes).
    const worker = async () => {
      while (cursor < initialRows.length && !signal.aborted && generation === this.generation) {
        const row = initialRows[cursor++]!;
        await runRow(row);
      }
    };

    try {
      await Promise.all([worker(), worker()]);
    } finally {
      if (generation === this.generation && !signal.aborted) {
        if (this.deadlineTimer) {
          clearTimeout(this.deadlineTimer);
          this.deadlineTimer = undefined;
        }
        this.abort = undefined;
        this.publish({
          ...this.snapshot,
          running: false,
          finishedAt: this.now(),
          finishReason: '检测完成',
        });
      }
    }
  }

  async startAllSourcesCheck(rawKeyword = DEFAULT_NETWORK_CHECK_KEYWORD): Promise<void> {
    const readySources = this.deps.registry
      .getSnapshot()
      .filter(source => this.deps.registry.isCurrent(source));

    if (readySources.length === 0) {
      this.publish({
        ...this.snapshot,
        activeMode: 'source',
        running: false,
        sourceGroups: [],
        sourceFinishReason: '没有已启用的自定义 LX 音源，请先在「音乐来源」中导入并启用。',
      });
      return;
    }

    const { generation, signal, keyword } = this.armRun('source', rawKeyword);

    const groups: SourceCheckGroup[] = readySources.map(source => {
      const displayName = safeLabel(this.deps.displayNameForSource?.(source) ?? source.name);
      const rows = SOURCE_CHECK_PLATFORMS.map(platform => {
        const supports = source.capabilities.some(
          cap => cap.platform === platform.id && cap.actions.includes('musicUrl') && cap.qualities.length > 0,
        );
        return supports
          ? makeIdleRow('source', platform, { id: source.id, name: displayName })
          : makeUnsupportedRow(platform, { id: source.id, name: displayName });
      });
      return { sourceId: source.id, sourceName: displayName, rows };
    });

    this.publish({
      ...this.snapshot,
      activeMode: 'source',
      running: true,
      startedAt: this.now(),
      finishedAt: undefined,
      sourceFinishReason: undefined,
      sampleKeyword: keyword,
      sourceGroups: groups,
    });

    void this.refreshNetwork();

    const timeouts = {
      discoverMs: this.deps.stageTimeouts?.discoverMs ?? 12_000,
      searchMs: this.deps.stageTimeouts?.searchMs ?? 12_000,
      resolveMs: this.deps.stageTimeouts?.resolveMs ?? 14_000,
      audioMs: this.deps.stageTimeouts?.audioMs ?? 14_000,
    };

    // Share discovery & sample track lookups across all tested scripts in this run.
    const discoverCache = new Map<
      OnlinePlatform,
      Promise<{ ok: boolean; count: number; elapsedMs: number; timeout?: boolean }>
    >();
    const sampleCache = new Map<
      OnlinePlatform,
      Promise<{ track?: Track; elapsedMs: number; timeout?: boolean; failed?: boolean }>
    >();

    const getDiscovery = (platform: OnlinePlatform) => {
      let cached = discoverCache.get(platform);
      if (!cached) {
        const started = this.now();
        cached = bounded(child => this.deps.discover(platform, child), signal, timeouts.discoverMs)
          .then(count => ({ ok: true, count, elapsedMs: Math.max(1, this.now() - started) }))
          .catch(err => ({
            ok: false,
            count: 0,
            elapsedMs: Math.max(1, this.now() - started),
            timeout: err instanceof DeadlineError,
          }));
        discoverCache.set(platform, cached);
      }
      return cached;
    };

    const getSample = (platform: OnlinePlatform) => {
      let cached = sampleCache.get(platform);
      if (!cached) {
        const started = this.now();
        cached = bounded(child => this.deps.searchSample(platform, keyword, child), signal, timeouts.searchMs)
          .then(async track => {
            if (!track) return { elapsedMs: Math.max(1, this.now() - started) };
            let enriched = track;
            if (this.deps.enrichOnlineTrack) {
              try {
                enriched = await bounded(child => this.deps.enrichOnlineTrack!(track, child), signal, 6_000);
              } catch {
                throwIfAborted(signal);
              }
            }
            return { track: enriched, elapsedMs: Math.max(1, this.now() - started) };
          })
          .catch(err => ({
            elapsedMs: Math.max(1, this.now() - started),
            timeout: err instanceof DeadlineError,
            failed: true,
          }));
        sampleCache.set(platform, cached);
      }
      return cached;
    };

    let sourceCursor = 0;
    const worker = async () => {
      while (sourceCursor < readySources.length && !signal.aborted && generation === this.generation) {
        const idx = sourceCursor++;
        const source = readySources[idx]!;
        const group = groups[idx]!;
        const testableRows = group.rows.filter(row => row.kind !== 'unsupported');
        if (testableRows.length === 0) continue;

        let session: DiagnosticSession | undefined;
        for (const row of testableRows) {
          this.patchPhase(generation, row.id, 0, { state: 'running', shortText: '初始化', detail: '正在初始化独立诊断会话…' });
        }
        try {
          session = await bounded(child => this.deps.openDiagnostic(source, child), signal, 20_000);
          throwIfAborted(signal);
          this.activeSessions.add(session);
        } catch (err) {
          if (signal.aborted || generation !== this.generation) break;
          const isTimeout = err instanceof DeadlineError;
          for (const row of testableRows) {
            this.patchPhase(generation, row.id, 0, {
              state: 'failed',
              shortText: isTimeout ? '超时' : '失败',
              detail: isTimeout ? '未通过 · 诊断会话初始化超时' : '未通过 · 诊断会话初始化失败',
            });
            this.patchPhase(generation, row.id, 1, { state: 'skipped', shortText: '跳过', detail: '跳过 · 音源会话未就绪' });
            this.patchPhase(generation, row.id, 2, { state: 'skipped', shortText: '跳过', detail: '跳过 · 音源会话未就绪' });
            this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 音源会话未就绪' });
          }
          continue;
        }

        try {
          for (const row of testableRows) {
            if (signal.aborted || generation !== this.generation) break;
            const platform = row.platform as OnlinePlatform;

            // Stage 0: Discover (cached per run)
            const disc = await getDiscovery(platform);
            if (signal.aborted || generation !== this.generation) break;
            this.patchPhase(
              generation,
              row.id,
              0,
              disc.ok
                ? disc.count > 0
                  ? {
                      state: 'ok',
                      shortText: `${disc.elapsedMs} ms`,
                      detail: `完成 · ${disc.elapsedMs} ms · 返回 ${disc.count} 项`,
                      elapsedMs: disc.elapsedMs,
                    }
                  : {
                      state: 'uncertain',
                      shortText: '空内容',
                      detail: `未确认 · 平台返回空内容（${disc.elapsedMs} ms）`,
                      elapsedMs: disc.elapsedMs,
                    }
                : {
                    state: 'failed',
                    shortText: disc.timeout ? '超时' : '失败',
                    detail: disc.timeout ? '未通过 · 发现超时' : '未通过 · 发现接口不可达',
                    elapsedMs: disc.elapsedMs,
                  },
            );

            // Stage 1: Search sample (cached per run)
            this.patchPhase(generation, row.id, 1, { state: 'running', shortText: '检测中', detail: '正在获取测试样本…' });
            const sampleRes = await getSample(platform);
            if (signal.aborted || generation !== this.generation) break;
            if (!sampleRes.track) {
              this.patchPhase(
                generation,
                row.id,
                1,
                sampleRes.failed
                  ? {
                      state: 'failed',
                      shortText: sampleRes.timeout ? '超时' : '失败',
                      detail: sampleRes.timeout ? '未通过 · 搜索超时' : '未通过 · 搜索接口失败',
                      elapsedMs: sampleRes.elapsedMs,
                    }
                  : {
                      state: 'uncertain',
                      shortText: '无样本',
                      detail: '未确认 · 没有可用搜索样本',
                      elapsedMs: sampleRes.elapsedMs,
                    },
              );
              this.patchPhase(generation, row.id, 2, { state: 'skipped', shortText: '跳过', detail: '跳过 · 搜索无可用样本' });
              this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 未取得音频地址' });
              continue;
            }
            const sampleTitle = safeLabel(
              `${sampleRes.track.title}${sampleRes.track.artist ? ` · ${sampleRes.track.artist}` : ''}`,
            );
            this.patchPhase(
              generation,
              row.id,
              1,
              {
                state: 'ok',
                shortText: `${sampleRes.elapsedMs} ms`,
                detail: `完成 · ${sampleRes.elapsedMs} ms · 样本「${sampleTitle}」`,
                elapsedMs: sampleRes.elapsedMs,
              },
              { sampleTitle },
            );

            // Stage 2: Resolve via isolated diagnostic session
            this.patchPhase(generation, row.id, 2, { state: 'running', shortText: '检测中', detail: '正在向该音源请求播放地址…' });
            const capability = session.capabilities.find(
              cap => cap.platform === platform && cap.actions.includes('musicUrl'),
            );
            const picked = capability ? pickDiagnosticQuality(capability.qualities) : undefined;
            if (!capability || !picked) {
              this.patchPhase(generation, row.id, 2, {
                state: 'uncertain',
                shortText: '未声明',
                detail: '未确认 · 音源未声明可用音质档位',
              });
              this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 未取得音频地址' });
              continue;
            }

            const resolveStart = this.now();
            let audioUrl: string | undefined;
            try {
              const rawResult = await bounded(
                child => session!.request(makeLXRequest(sampleRes.track!, picked.scriptQuality, capability), child),
                signal,
                timeouts.resolveMs,
              );
              throwIfAborted(signal);
              const ms = Math.max(1, this.now() - resolveStart);
              audioUrl = validAudioURL(rawResult);
              if (!audioUrl) {
                this.patchPhase(generation, row.id, 2, {
                  state: 'failed',
                  shortText: '失败',
                  detail: `未通过 · 音源未返回有效播放地址（${ms} ms）`,
                  elapsedMs: ms,
                });
                this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 解析未取得可用地址' });
                continue;
              }
              const resolvedLabel = `${group.sourceName} · ${picked.quality.toUpperCase()}`;
              this.patchPhase(
                generation,
                row.id,
                2,
                {
                  state: 'ok',
                  shortText: `${ms} ms`,
                  detail: `完成 · ${ms} ms · ${picked.quality.toUpperCase()}`,
                  elapsedMs: ms,
                },
                { resolvedLabel, resolvedQuality: picked.quality },
              );
            } catch (err) {
              if (signal.aborted || generation !== this.generation) break;
              const ms = Math.max(1, this.now() - resolveStart);
              this.patchPhase(generation, row.id, 2, {
                state: 'failed',
                shortText: err instanceof DeadlineError ? '超时' : '失败',
                detail: err instanceof DeadlineError ? `未通过 · 音源解析超时（${ms} ms）` : `未通过 · 音源解析失败（${ms} ms）`,
                elapsedMs: ms,
              });
              this.patchPhase(generation, row.id, 3, { state: 'skipped', shortText: '跳过', detail: '跳过 · 解析未取得可用地址' });
              continue;
            }

            // Stage 3: Probe audio header
            this.patchPhase(generation, row.id, 3, { state: 'running', shortText: '检测中', detail: '正在校验音频响应与容器头…' });
            const probeStart = this.now();
            try {
              const probeRes = await bounded(child => this.deps.probe(audioUrl!, child), signal, timeouts.audioMs);
              throwIfAborted(signal);
              const ms = Math.max(1, this.now() - probeStart);
              this.patchPhase(generation, row.id, 3, describeAudioProbe(probeRes, ms), {
                audioFormat: probeRes.format,
                httpStatus: probeRes.status,
                bytes: probeRes.bytes,
              });
            } catch (err) {
              if (signal.aborted || generation !== this.generation) break;
              const ms = Math.max(1, this.now() - probeStart);
              this.patchPhase(generation, row.id, 3, {
                state: 'failed',
                shortText: err instanceof DeadlineError ? '超时' : '失败',
                detail: err instanceof DeadlineError ? `未通过 · 音频探测超时（${ms} ms）` : `未通过 · 音频响应失败（${ms} ms）`,
                elapsedMs: ms,
              });
            }
          }
        } finally {
          this.activeSessions.delete(session);
          try {
            session.dispose();
          } catch {}
        }
      }
    };

    // Concurrency 2 matches native diagnosticRuntimes.count < 2 and probes.count < 2.
    try {
      await Promise.all([worker(), worker()]);
    } finally {
      if (generation === this.generation && !signal.aborted) {
        if (this.deadlineTimer) {
          clearTimeout(this.deadlineTimer);
          this.deadlineTimer = undefined;
        }
        this.abort = undefined;
        this.publish({
          ...this.snapshot,
          running: false,
          finishedAt: this.now(),
          sourceFinishReason: '检测完成',
        });
      }
    }
  }

  formatLocalReport(): string {
    const snap = this.snapshot;
    const lines: string[] = [
      `音枢网络与音源检测（仅本机脱敏结果） · ${new Date(snap.finishedAt ?? snap.startedAt ?? this.now()).toISOString()}`,
      `网络状态：${formatNetworkSummary(snap.network)}`,
      `测试样本词：${safeLabel(snap.sampleKeyword)}`,
    ];

    lines.push('', '【平台链路检测（7 平台 × 4 阶段）】');
    for (const row of snap.platformRows) {
      lines.push(`${row.platformLabel} · ${row.badge}`);
      NETWORK_CHECK_PHASES.forEach((name, idx) => {
        lines.push(`  ${name}：${row.phases[idx]!.detail}`);
      });
    }

    if (snap.sourceGroups.length > 0) {
      lines.push('', '【自定义 LX 音源检测】');
      for (const group of snap.sourceGroups) {
        const declared = group.rows.filter(r => r.kind !== 'unsupported');
        const okCount = declared.filter(r => r.kind === 'ok').length;
        lines.push(`${group.sourceName} · ${okCount}/${declared.length} 声明平台正常`);
        for (const row of group.rows) {
          if (row.kind === 'unsupported') continue;
          lines.push(`  ${row.platformLabel} · ${row.badge}（${row.phases.map((p, i) => `${NETWORK_CHECK_PHASES[i]}:${p.shortText}`).join(' / ')}）`);
        }
      }
    }

    lines.push('', '注：本报告不含任何音频 URL、Cookie、令牌或私人脚本输出；仅代表当前网络与样本状态。');
    return lines.join('\n');
  }
}

const LOSSLESS_FORMATS = new Set<AudioProbeResult['format']>(['flac', 'wav', 'aiff']);

function isSourceSideFailure(row: NetworkCheckRow): boolean {
  if (row.kind !== 'failed') return false;
  // Init failure (phase 0 mentions 诊断会话初始化) or resolve/audio stage failure is source-side.
  // Pure discovery/search failures are platform-side and must not blacklist a script.
  if (row.phases[2].state === 'failed' || row.phases[3].state === 'failed') return true;
  if (row.phases[0].state === 'failed' && row.phases[0].detail.includes('诊断会话初始化')) return true;
  return false;
}

function sourceFailureReason(row: NetworkCheckRow): string {
  if (row.phases[0].state === 'failed' && row.phases[0].detail.includes('诊断会话初始化')) {
    return '脚本初始化失败';
  }
  if (row.phases[2].state === 'failed') {
    return row.phases[2].shortText === '超时' ? '解析超时' : '解析失败';
  }
  if (row.phases[3].state === 'failed') {
    return row.phases[3].shortText === '超时'
      ? '音频响应超时'
      : row.httpStatus
        ? `音频 HTTP ${row.httpStatus}`
        : '音频不可达';
  }
  return row.badge;
}

function rowLatencyMs(row: NetworkCheckRow): number {
  const resolveMs = row.phases[2].elapsedMs;
  const probeMs = row.phases[3].elapsedMs;
  if (resolveMs === undefined && probeMs === undefined) return Number.MAX_SAFE_INTEGER;
  return (resolveMs ?? 0) + (probeMs ?? 0);
}

function qualityRank(quality?: Quality): number {
  if (!quality) return qualityOrder.length;
  const idx = qualityOrder.indexOf(quality);
  return idx >= 0 ? idx : qualityOrder.length;
}

/**
 * Generates per-platform LX source priority & exclusion recommendations from completed
 * all-sources diagnostic results across all 7 NexusMusic platforms.
 *
 * Safety guarantees:
 * - Only recommends excluding scripts that failed on source-side stages (init / resolve / audio),
 *   never for platform search hiccups or undeclared platforms.
 * - Never wipes out all sources for a platform: exclusions are only emitted when at least one
 *   verified working source exists for that platform.
 */
export function recommendPlatformSourceRouting(
  sourceGroups: readonly SourceCheckGroup[],
  currentRouting: PlatformSourceRouting = {},
): RoutingRecommendationPlan {
  if (sourceGroups.length === 0) {
    return {
      hasRecommendations: false,
      testedSources: 0,
      affectedPlatforms: 0,
      totalExcluded: 0,
      platforms: [],
      routing: normalizePlatformSourceRouting(currentRouting),
    };
  }

  const recommendations: PlatformRoutingRecommendation[] = [];

  // 1. Direct LX platforms (wy / tx / kw / kg / mg)
  for (const meta of SOURCE_CHECK_PLATFORMS) {
    const okCandidates: Array<{
      candidate: RecommendedPlatformCandidate;
      qRank: number;
      losslessRank: number;
      latency: number;
    }> = [];
    const failedCandidates: RecommendedPlatformExclusion[] = [];
    let declaredCount = 0;

    for (const group of sourceGroups) {
      const row = group.rows.find(r => r.platform === meta.id);
      if (!row || row.kind === 'unsupported') continue;
      declaredCount++;
      if (row.kind === 'ok') {
        const latency = rowLatencyMs(row);
        const displayLatency = Number.isFinite(latency) && latency < Number.MAX_SAFE_INTEGER ? latency : undefined;
        const reasonParts = [
          row.resolvedQuality ? row.resolvedQuality.toUpperCase() : '',
          row.audioFormat ? row.audioFormat.toUpperCase() : '',
          displayLatency !== undefined ? `${displayLatency} ms` : '',
        ].filter(Boolean);
        okCandidates.push({
          candidate: {
            sourceId: group.sourceId,
            sourceName: group.sourceName,
            ...(row.resolvedQuality ? { quality: row.resolvedQuality } : {}),
            ...(row.audioFormat ? { format: row.audioFormat } : {}),
            ...(displayLatency !== undefined ? { latencyMs: displayLatency } : {}),
            reason: reasonParts.join(' · ') || '实测可用',
          },
          qRank: qualityRank(row.resolvedQuality),
          losslessRank: LOSSLESS_FORMATS.has(row.audioFormat) ? 0 : 1,
          latency,
        });
      } else if (isSourceSideFailure(row)) {
        failedCandidates.push({
          sourceId: group.sourceId,
          sourceName: group.sourceName,
          reason: sourceFailureReason(row),
        });
      }
    }

    okCandidates.sort((a, b) => {
      if (a.qRank !== b.qRank) return a.qRank - b.qRank;
      if (a.losslessRank !== b.losslessRank) return a.losslessRank - b.losslessRank;
      return a.latency - b.latency;
    });

    const priority = okCandidates.map(item => item.candidate);
    // Safety guard: never exclude all sources if zero verified sources succeeded.
    const excluded = priority.length > 0 ? failedCandidates : [];
    const note =
      declaredCount === 0
        ? '当前已启用音源均未声明支持该平台'
        : priority.length === 0 && failedCandidates.length > 0
          ? '本轮暂无通过检测的音源，为避免无源可用暂不自动排除'
          : undefined;

    recommendations.push({
      platform: meta.id,
      platformLabel: meta.label,
      platformShort: meta.short,
      directLx: true,
      priority,
      excluded,
      ...(note ? { note } : {}),
    });
  }

  // 2. Imported platforms (qishui / bodian) cross-platform LX fallback ranking
  const crossStats = sourceGroups.map(group => {
    const declared = group.rows.filter(r => r.kind !== 'unsupported');
    const okRows = declared.filter(r => r.kind === 'ok');
    const failedRows = declared.filter(isSourceSideFailure);
    const latencies = okRows
      .map(rowLatencyMs)
      .filter(ms => Number.isFinite(ms) && ms < Number.MAX_SAFE_INTEGER);
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((sum, n) => sum + n, 0) / latencies.length)
      : Number.MAX_SAFE_INTEGER;
    const bestQRank = okRows.length
      ? Math.min(...okRows.map(r => qualityRank(r.resolvedQuality)))
      : qualityOrder.length;
    return {
      sourceId: group.sourceId,
      sourceName: group.sourceName,
      declaredCount: declared.length,
      okCount: okRows.length,
      failedCount: failedRows.length,
      avgLatency,
      bestQRank,
      bestQuality: bestQRank < qualityOrder.length ? qualityOrder[bestQRank] : undefined,
    };
  });

  const crossWorking = crossStats
    .filter(item => item.okCount > 0)
    .sort((a, b) => {
      if (a.okCount !== b.okCount) return b.okCount - a.okCount;
      if (a.bestQRank !== b.bestQRank) return a.bestQRank - b.bestQRank;
      return a.avgLatency - b.avgLatency;
    });

  const crossPriority: RecommendedPlatformCandidate[] = crossWorking.map(item => {
    const latencyMs = item.avgLatency < Number.MAX_SAFE_INTEGER ? item.avgLatency : undefined;
    const parts = [
      `通过 ${item.okCount}/${item.declaredCount} 平台`,
      item.bestQuality ? item.bestQuality.toUpperCase() : '',
      latencyMs !== undefined ? `均耗 ${latencyMs} ms` : '',
    ].filter(Boolean);
    return {
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      ...(item.bestQuality ? { quality: item.bestQuality } : {}),
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      okPlatforms: item.okCount,
      reason: parts.join(' · '),
    };
  });

  const crossExcluded: RecommendedPlatformExclusion[] =
    crossPriority.length > 0
      ? crossStats
          .filter(item => item.okCount === 0 && item.failedCount > 0)
          .map(item => ({
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            reason: `本轮 ${item.failedCount} 个声明平台均未通过`,
          }))
      : [];

  for (const importedMeta of [
    { id: 'qishui' as const, label: '汽水音乐', short: '汽水' },
    { id: 'bodian' as const, label: '波点音乐', short: '波点' },
  ]) {
    recommendations.push({
      platform: importedMeta.id,
      platformLabel: importedMeta.label,
      platformShort: importedMeta.short,
      directLx: false,
      priority: crossPriority,
      excluded: crossExcluded,
      note:
        crossPriority.length > 0
          ? '官方/账号直连受限时，按跨平台实测通过率与速度依次换源'
          : '本轮暂无通过检测的 LX 音源，暂不修改跨平台换源规则',
    });
  }

  const actionable = recommendations.filter(r => r.priority.length > 0 || r.excluded.length > 0);
  const totalExcluded = recommendations.reduce((sum, r) => sum + r.excluded.length, 0);
  const routing = mergeRecommendedRouting(currentRouting, recommendations);

  return {
    hasRecommendations: actionable.length > 0,
    testedSources: sourceGroups.length,
    affectedPlatforms: actionable.length,
    totalExcluded,
    platforms: recommendations,
    routing,
  };
}

export function mergeRecommendedRouting(
  currentRouting: PlatformSourceRouting,
  recommendations: readonly PlatformRoutingRecommendation[],
  selectedPlatforms?: ReadonlySet<MusicPlatform>,
): PlatformSourceRouting {
  const next: Record<string, PlatformSourceRule | undefined> = { ...currentRouting };
  for (const rec of recommendations) {
    if (selectedPlatforms && !selectedPlatforms.has(rec.platform)) continue;
    if (rec.priority.length === 0 && rec.excluded.length === 0) continue;
    next[rec.platform] = {
      priority: rec.priority.map(item => item.sourceId),
      excluded: rec.excluded.map(item => item.sourceId),
    };
  }
  return normalizePlatformSourceRouting(next);
}

