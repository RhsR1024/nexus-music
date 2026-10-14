import { validateTrack, type Track } from './track.ts';

export interface QueueEntry { id: string; track: Track }
export interface QueueState {
  readonly entries: readonly QueueEntry[];
  readonly currentId: string | null;
  readonly priorityIds: readonly string[];
}

export const emptyQueue: QueueState = { entries: [], currentId: null, priorityIds: [] };

function validateEntry(entry: QueueEntry): void {
  if (!entry.id || typeof entry.id !== 'string') throw new Error('队列条目 ID 无效');
  validateTrack(entry.track);
}

export function makeQueue(entries: readonly QueueEntry[], currentId = entries[0]?.id ?? null): QueueState {
  entries.forEach(validateEntry);
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) {
    throw new Error('队列条目 ID 不可重复；相同歌曲可以多次出现');
  }
  if (currentId !== null && !entries.some(entry => entry.id === currentId)) {
    throw new Error('当前歌曲不在队列中');
  }
  return { entries: [...entries], currentId, priorityIds: [] };
}

export function currentEntry(queue: QueueState): QueueEntry | undefined {
  return queue.entries.find(entry => entry.id === queue.currentId);
}

export function append(queue: QueueState, entry: QueueEntry): QueueState {
  validateEntry(entry);
  if (queue.entries.some(item => item.id === entry.id)) throw new Error('队列条目 ID 已存在');
  return { ...queue, entries: [...queue.entries, entry], currentId: queue.currentId ?? entry.id };
}

export function enqueueNext(queue: QueueState, entry: QueueEntry): QueueState {
  const validated = append(queue, entry);
  if (!queue.currentId) return validated;
  const lastPriority = queue.priorityIds.at(-1) ?? queue.currentId;
  const insertion = queue.entries.findIndex(item => item.id === lastPriority) + 1;
  const entries = [...queue.entries];
  entries.splice(insertion, 0, entry);
  return { ...queue, entries, priorityIds: [...queue.priorityIds, entry.id] };
}

export function select(queue: QueueState, id: string): QueueState {
  if (!queue.entries.some(entry => entry.id === id)) throw new Error('队列条目不存在');
  return { ...queue, currentId: id, priorityIds: [] };
}

export function advance(queue: QueueState, repeat: 'off' | 'all' | 'one' = 'off'): QueueState {
  if (!queue.currentId) return queue;
  if (repeat === 'one') return queue;
  const index = queue.entries.findIndex(entry => entry.id === queue.currentId);
  const next = queue.entries[index + 1] ?? (repeat === 'all' ? queue.entries[0] : undefined);
  return { ...queue, currentId: next?.id ?? null,
    priorityIds: queue.priorityIds.filter(id => id !== next?.id) };
}

export function remove(queue: QueueState, id: string): QueueState {
  const index = queue.entries.findIndex(entry => entry.id === id);
  if (index < 0) return queue;
  const entries = queue.entries.filter(entry => entry.id !== id);
  // Removing the current entry selects its successor; at the end, stop.
  const currentId = id === queue.currentId ? entries[index]?.id ?? null : queue.currentId;
  return { entries, currentId, priorityIds: queue.priorityIds.filter(item => item !== id && item !== currentId) };
}

export function move(queue: QueueState, id: string, to: number): QueueState {
  const from = queue.entries.findIndex(entry => entry.id === id);
  if (from < 0 || !Number.isInteger(to) || to < 0 || to >= queue.entries.length) {
    throw new Error('队列移动位置无效');
  }
  const entries = [...queue.entries];
  const [entry] = entries.splice(from, 1);
  entries.splice(to, 0, entry!);
  // Explicit user reordering establishes the new order.
  return { ...queue, entries, priorityIds: [] };
}
