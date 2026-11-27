// Incremental library delta computation & projection for WebDAV multi-device sync (Item #10).
import { canonical, syncRecords, type SyncKind, type SyncPlan, type SyncRecord, type SyncState } from './multiDeviceSync.ts';
import type { LibraryState } from './library.ts';

export type DeltaOp = 'add' | 'update' | 'delete';

export interface LibraryDeltaEntry {
  readonly id: string;
  readonly kind: SyncKind;
  readonly op: DeltaOp;
  readonly record: SyncRecord;
}

export interface LibraryDelta {
  readonly baseRevision: number;
  readonly entries: readonly LibraryDeltaEntry[];
  readonly counts: Readonly<Record<DeltaOp, number>>;
  readonly byKind: Readonly<Record<SyncKind, number>>;
}

export function computeLibraryDelta(
  baseline: SyncState | undefined,
  current: LibraryState,
): LibraryDelta {
  const baseRecords = new Map<string, SyncRecord>((baseline?.records ?? []).map(r => [r.id, r]));
  const currentRecords = new Map<string, SyncRecord>(syncRecords(current).map(r => [r.id, r]));
  const entries: LibraryDeltaEntry[] = [];

  for (const [id, rec] of currentRecords) {
    const prev = baseRecords.get(id);
    if (!prev || prev.deleted) {
      entries.push({ id, kind: rec.kind, op: 'add', record: rec });
    } else if (canonical(prev.payload) !== canonical(rec.payload)) {
      entries.push({ id, kind: rec.kind, op: 'update', record: rec });
    }
  }
  for (const [id, prev] of baseRecords) {
    if (!prev.deleted && !currentRecords.has(id)) {
      entries.push({ id, kind: prev.kind, op: 'delete', record: { id: prev.id, kind: prev.kind, deleted: true } });
    }
  }

  return buildDeltaStats(baseline?.revision ?? 0, entries);
}

export function computePlanDelta(baseline: SyncState | undefined, plan: SyncPlan): LibraryDelta {
  const baseRecords = new Map<string, SyncRecord>((baseline?.records ?? []).map(r => [r.id, r]));
  const entries: LibraryDeltaEntry[] = [];
  for (const rec of plan.records) {
    const prev = baseRecords.get(rec.id);
    if (rec.deleted) {
      if (prev && !prev.deleted) entries.push({ id: rec.id, kind: rec.kind, op: 'delete', record: { id: rec.id, kind: rec.kind, deleted: true } });
    } else if (!prev || prev.deleted) {
      entries.push({ id: rec.id, kind: rec.kind, op: 'add', record: rec });
    } else if (canonical(prev.payload) !== canonical(rec.payload)) {
      entries.push({ id: rec.id, kind: rec.kind, op: 'update', record: rec });
    }
  }
  return buildDeltaStats(baseline?.revision ?? 0, entries);
}

export function projectLibraryDelta(
  baselineRecords: readonly SyncRecord[],
  delta: LibraryDelta,
): readonly SyncRecord[] {
  const map = new Map<string, SyncRecord>(baselineRecords.map(r => [r.id, r]));
  for (const entry of delta.entries) {
    map.set(entry.id, entry.record);
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function summarizeLibraryDelta(delta: LibraryDelta): string {
  if (!delta.entries.length) return '与上次基线一致，无增量变更';
  const parts: string[] = [];
  if (delta.counts.add > 0) parts.push(`新增 ${delta.counts.add}`);
  if (delta.counts.update > 0) parts.push(`更新 ${delta.counts.update}`);
  if (delta.counts.delete > 0) parts.push(`删除 ${delta.counts.delete}`);
  return `增量变更：${parts.join(' · ')}`;
}

function buildDeltaStats(baseRevision: number, entries: LibraryDeltaEntry[]): LibraryDelta {
  const counts: Record<DeltaOp, number> = { add: 0, update: 0, delete: 0 };
  const byKind: Record<SyncKind, number> = {
    favorite: 0,
    playlist: 0,
    catalogFavorite: 0,
    match: 0,
    lyricChoice: 0,
  };
  for (const e of entries) {
    counts[e.op]++;
    byKind[e.kind]++;
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  return { baseRevision, entries, counts, byKind };
}
