import { qualityOrder, type Quality } from './quality.ts';
import { allMusicPlatforms, type MusicPlatform } from './track.ts';

export type PlaybackQualityMap = Readonly<Partial<Record<MusicPlatform, Quality>>>;

export interface PlatformSourceRule {
  readonly priority: readonly string[];
  readonly excluded: readonly string[];
}

export type PlatformSourceRouting = Readonly<Partial<Record<MusicPlatform, PlatformSourceRule>>>;

export const platformSourceRoutingDefaults: PlatformSourceRouting = Object.freeze({});

const MAX_ROUTING_SOURCE_IDS = 32;
const MAX_SOURCE_ID_LENGTH = 128;

export function normalizePlaybackQualities(value: unknown): PlaybackQualityMap {
  if (value === undefined) return Object.freeze({});
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('分平台播放音质设置无效');
  }
  const result: Partial<Record<MusicPlatform, Quality>> = {};
  for (const [platform, quality] of Object.entries(value)) {
    if (quality === undefined) continue;
    if (
      !allMusicPlatforms.includes(platform as MusicPlatform) ||
      typeof quality !== 'string' ||
      !qualityOrder.includes(quality as Quality)
    ) {
      throw new Error('分平台播放音质设置无效');
    }
    result[platform as MusicPlatform] = quality as Quality;
  }
  return Object.freeze(result);
}

function normalizeSourceIdList(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ROUTING_SOURCE_IDS) {
    throw new Error(`分平台音源${label}配置无效`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      !item.trim() ||
      item.length > MAX_SOURCE_ID_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(item)
    ) {
      throw new Error(`分平台音源${label}包含无效标识`);
    }
    const id = item.trim();
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function normalizePlatformSourceRouting(value: unknown): PlatformSourceRouting {
  if (value === undefined) return platformSourceRoutingDefaults;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('分平台音源路由配置无效');
  }
  const result: Partial<Record<MusicPlatform, PlatformSourceRule>> = {};
  for (const [platform, rawRule] of Object.entries(value)) {
    if (rawRule === undefined) continue;
    if (
      !allMusicPlatforms.includes(platform as MusicPlatform) ||
      !rawRule ||
      typeof rawRule !== 'object' ||
      Array.isArray(rawRule)
    ) {
      throw new Error('分平台音源路由配置无效');
    }
    const record = rawRule as Record<string, unknown>;
    const excluded = normalizeSourceIdList(record.excluded, '排除列表');
    const excludedSet = new Set(excluded);
    const priority = normalizeSourceIdList(record.priority, '优先级列表').filter(
      id => !excludedSet.has(id),
    );
    if (priority.length === 0 && excluded.length === 0) continue;
    result[platform as MusicPlatform] = Object.freeze({
      priority: Object.freeze(priority),
      excluded: Object.freeze(excluded),
    });
  }
  return Object.freeze(result);
}

/**
 * Applies per-platform exclusion & priority rules on top of global source order.
 *
 * - Excludes sources listed in `targetPlatform.excluded` and (if different) `originPlatform.excluded`.
 * - Prioritizes `originPlatform.priority` (when an imported track like Qishui/Bodian falls back to LX),
 *   then `targetPlatform.priority`, then any remaining non-excluded sources in global order.
 */
export function applyPlatformSourceRouting<T extends { readonly id: string }>(
  sources: readonly T[],
  targetPlatform: MusicPlatform,
  routing?: PlatformSourceRouting,
  originPlatform?: MusicPlatform,
): T[] {
  if (!routing || sources.length === 0) return [...sources];

  const targetRule = routing[targetPlatform];
  const originRule =
    originPlatform && originPlatform !== targetPlatform ? routing[originPlatform] : undefined;

  if (!targetRule && !originRule) return [...sources];

  const excluded = new Set<string>([
    ...(targetRule?.excluded ?? []),
    ...(originRule?.excluded ?? []),
  ]);

  const allowed = excluded.size > 0 ? sources.filter(item => !excluded.has(item.id)) : [...sources];
  if (allowed.length <= 1) return allowed;

  const priorityOrder: string[] = [];
  const seenPriority = new Set<string>();
  const addPriority = (ids?: readonly string[]) => {
    if (!ids) return;
    for (const id of ids) {
      if (!excluded.has(id) && !seenPriority.has(id)) {
        seenPriority.add(id);
        priorityOrder.push(id);
      }
    }
  };
  addPriority(originRule?.priority);
  addPriority(targetRule?.priority);

  if (priorityOrder.length === 0) return allowed;

  const byId = new Map<string, T>();
  for (const item of allowed) byId.set(item.id, item);

  const ordered: T[] = [];
  const placed = new Set<string>();
  for (const id of priorityOrder) {
    const match = byId.get(id);
    if (match && !placed.has(id)) {
      ordered.push(match);
      placed.add(id);
    }
  }
  for (const item of allowed) {
    if (!placed.has(item.id)) ordered.push(item);
  }
  return ordered;
}

export function setSourceExcludedForPlatform(
  routing: PlatformSourceRouting,
  platform: MusicPlatform,
  sourceId: string,
  excluded: boolean,
): PlatformSourceRouting {
  const current = routing[platform];
  const nextExcluded = excluded
    ? [...new Set([...(current?.excluded ?? []), sourceId])]
    : (current?.excluded ?? []).filter(id => id !== sourceId);
  const nextPriority = excluded
    ? (current?.priority ?? []).filter(id => id !== sourceId)
    : [...(current?.priority ?? [])];
  const next: Record<string, PlatformSourceRule | undefined> = { ...routing };
  if (nextPriority.length === 0 && nextExcluded.length === 0) {
    delete next[platform];
  } else {
    next[platform] = { priority: nextPriority, excluded: nextExcluded };
  }
  return normalizePlatformSourceRouting(next);
}

export function moveSourcePriorityForPlatform(
  routing: PlatformSourceRouting,
  platform: MusicPlatform,
  sourceId: string,
  currentAllowedOrder: readonly string[],
  delta: -1 | 1,
): PlatformSourceRouting {
  const index = currentAllowedOrder.indexOf(sourceId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= currentAllowedOrder.length) return routing;
  const reordered = [...currentAllowedOrder];
  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
  const excluded = [...(routing[platform]?.excluded ?? [])];
  return normalizePlatformSourceRouting({
    ...routing,
    [platform]: { priority: reordered, excluded },
  });
}

export function pinSourceTopForPlatform(
  routing: PlatformSourceRouting,
  platform: MusicPlatform,
  sourceId: string,
  currentAllowedOrder: readonly string[],
): PlatformSourceRouting {
  if (!currentAllowedOrder.includes(sourceId)) return routing;
  const reordered = [sourceId, ...currentAllowedOrder.filter(id => id !== sourceId)];
  const excluded = (routing[platform]?.excluded ?? []).filter(id => id !== sourceId);
  return normalizePlatformSourceRouting({
    ...routing,
    [platform]: { priority: reordered, excluded },
  });
}

export function clearPlatformSourceRule(
  routing: PlatformSourceRouting,
  platform: MusicPlatform,
): PlatformSourceRouting {
  if (!routing[platform]) return routing;
  const next: Record<string, PlatformSourceRule | undefined> = { ...routing };
  delete next[platform];
  return normalizePlatformSourceRouting(next);
}

export function countPlatformRoutingCustomizations(
  rule: PlatformSourceRule | undefined,
  knownSourceIds?: ReadonlySet<string>,
): { priorityCount: number; excludedCount: number; hasCustom: boolean } {
  if (!rule) return { priorityCount: 0, excludedCount: 0, hasCustom: false };
  const filter = (ids: readonly string[]) =>
    knownSourceIds ? ids.filter(id => knownSourceIds.has(id)) : ids;
  const priorityCount = filter(rule.priority).length;
  const excludedCount = filter(rule.excluded).length;
  return {
    priorityCount,
    excludedCount,
    hasCustom: priorityCount > 0 || excludedCount > 0,
  };
}
