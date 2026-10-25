import {addSearchHistory, clearSearchHistory, normalizeSearchHistory} from '../domain/searchHistory.ts';
import type { Repository } from './repository.ts';

export class SearchHistoryStore {
  private repository: Repository;
  private value: readonly string[] = [];
  private listeners = new Set<() => void>();
  private tail: Promise<unknown> = Promise.resolve();

  constructor(repository: Repository) { this.repository = repository; }

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  async restore() {
    const stored = await this.repository.get<unknown>('search.history.v1');
    if (stored !== undefined) this.value = normalizeSearchHistory(stored);
  }

  record(query: string) { return this.mutate(history => addSearchHistory(history, query)); }
  clear() { return this.mutate(() => clearSearchHistory()); }

  private mutate(patch: (history: readonly string[]) => readonly string[]) {
    const next = this.tail.then(async () => {
      const value = normalizeSearchHistory(patch(this.value));
      if (value.length === this.value.length && value.every((item, index) => item === this.value[index])) return;
      await this.repository.put('search.history.v1', value);
      this.value = value;
      for (const listener of this.listeners) listener();
    });
    this.tail = next.catch(() => {});
    return next;
  }
}
