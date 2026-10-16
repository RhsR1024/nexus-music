import {InvalidRecordError} from '../storage/recovery.ts';
import { SourceRegistry, type SourceDefinition, type SourceState } from './sourceRegistry.ts';
import type { Repository } from '../storage/repository.ts';

export interface StoredSource extends SourceDefinition {
  enabled: boolean; version: string; author: string; description: string;
  subscription?: string; previous?: { script: string; version: string };
}
export interface SourceView extends SourceState {
  version: string; author: string; description: string; hasSubscription: boolean; canRollback: boolean;
}
export function scriptMetadata(script: string, fallback: string) {
  if (!script.trim() || script.length > 8 * 1024 * 1024 || /^\s*</.test(script)) throw new Error('文件不是有效的JS音源或超过8MiB');
  const header = script.slice(0, 16384).match(/^\s*(?:\/\*([\s\S]*?)\*\/|((?:\/\/[^\n]*\n)+))/)?.[0] ?? '';
  const field = (name: string, max: number) => (header.match(new RegExp(`@${name}\\s+([^\\r\\n]*)`))?.[1] ?? '').replace(/\*\/$/, '').trim().slice(0, max);
  return { name: field('name', 128) || fallback.replace(/\.js$/i, '').slice(0, 128) || '未命名音源',
    version: field('version', 64), author: field('author', 128), description: field('description', 300) };
}

export class SourceCatalog {
  readonly registry: SourceRegistry;
  private repository: Repository; private hash: (script: string) => Promise<string>;
  private records: StoredSource[] = [];
  private listeners = new Set<() => void>();
  private snapshot: readonly SourceView[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  constructor(registry: SourceRegistry, repository: Repository, hash: (script: string) => Promise<string>) {
    this.registry = registry; this.repository = repository; this.hash = hash;
    registry.subscribe(() => this.publish());
  }
  getSnapshot = () => this.snapshot;
  diagnosticDefinition(source:SourceState):SourceDefinition {
    const value=this.records.find(item=>item.id===source.id);
    if(!value||!this.registry.isCurrent(source)||value.fingerprint!==source.fingerprint)throw new Error('音源已变化，请重新检查');
    return{id:value.id,name:value.name,script:value.script,fingerprint:value.fingerprint};
  }
  private mutate<T>(run: () => Promise<T>): Promise<T> {
    const next = this.tail.then(run); this.tail = next.catch(() => {}); return next;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() {
    this.snapshot = this.registry.getSnapshot().map(state => {
      const record = this.records.find(item => item.id === state.id)!;
      return { ...state, version: record.version, author: record.author, description: record.description,
        hasSubscription: !!record.subscription, canRollback: !!record.previous };
    });
    for (const listener of this.listeners) listener();
  }
  async restore() {
    const stored = await this.repository.get<StoredSource[]>('sources.v1') ?? [];
    if (!Array.isArray(stored) || stored.length > 32 || stored.some(item => !item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim() || typeof item.script !== 'string' || !item.script.trim() || item.script.length>8*1024*1024 || typeof item.enabled !== 'boolean') || new Set(stored.map(item => item.id)).size !== stored.length) throw new InvalidRecordError();
    const restored=await Promise.all(stored.map(async item=>({...item,fingerprint:await this.hash(item.script)})));
    this.records = restored;
    for (const item of restored) this.registry.register(item);
  }
  async fingerprint(id:string){const source=this.records.find(item=>item.id===id);if(!source)throw new Error('音源已删除');return this.hash(source.script);}
  async restoreEnabled() { return this.registry.setManyEnabled(this.records.filter(item => item.enabled).map(item => item.id), true); }
  async import(script: string, filename: string, subscription?: string) {
    return this.mutate(() => this.importInner(script, filename, subscription));
  }
  private async importInner(script: string, filename: string, subscription?: string) {
    const metadata = scriptMetadata(script, filename);
    const id = await this.hash(script);
    const existing = this.records.find(item => item.id === id || item.script === script);
    if (existing) return { id, duplicate: true };
    if (this.records.length >= 32) throw new Error('最多保存32个音源，请先删除不需要的音源');
    const source: StoredSource = { id, script, fingerprint:id, ...metadata, enabled: false, ...(subscription ? { subscription } : {}) };
    const records = [...this.records, source];
    await this.repository.put('sources.v1', records);
    this.records = records; this.registry.register(source);
    return { id, duplicate: false };
  }
  async batch(ids: readonly string[], action: 'enable' | 'disable' | 'delete') {
    return this.mutate(() => this.batchInner(ids, action));
  }
  private async batchInner(ids: readonly string[], action: 'enable' | 'disable' | 'delete') {
    const wanted = new Set(ids);
    const actual = this.records.filter(item => wanted.has(item.id)).map(item => item.id);
    const records = action === 'delete' ? this.records.filter(item => !wanted.has(item.id)) :
      this.records.map(item => wanted.has(item.id) ? { ...item, enabled: action === 'enable' } : item);
    await this.repository.put('sources.v1', records);
    // Remove from the runtime before dropping metadata used by subscribers.
    if (action === 'delete') for (const id of actual) this.registry.remove(id);
    this.records = records;
    const result = action === 'delete' ? { succeeded: actual, failed: [] as string[] } : await this.registry.setManyEnabled(actual, action === 'enable');
    this.publish(); return result;
  }
  async update(id: string, script: string) {
    return this.mutate(() => this.updateInner(id, script));
  }
  private async updateInner(id: string, script: string) {
    const previous = this.records.find(item => item.id === id);
    if (!previous) throw new Error('音源不存在');
    if (script === previous.script) return false;
    const metadata = scriptMetadata(script, previous.name);
    const updated: StoredSource = { ...previous, ...metadata, script, fingerprint:await this.hash(script), enabled: false, previous: { script: previous.script, version: previous.version } };
    const records = this.records.map(item => item.id === id ? updated : item);
    await this.repository.put('sources.v1', records);
    this.records = records; this.registry.register(updated); return true;
  }
  async rollback(id: string) {
    return this.mutate(async () => {
      const source = this.records.find(item => item.id === id);
      if (!source?.previous) throw new Error('没有可恢复的旧版本');
      return this.updateInner(id, source.previous.script);
    });
  }
  subscription(id: string) { return this.records.find(item => item.id === id)?.subscription; }
  move(id: string, delta: -1 | 1) {
    return this.mutate(async () => {
      const index = this.records.findIndex(item => item.id === id), destination = index+delta;
      if (index < 0 || destination < 0 || destination >= this.records.length) return;
      const records = [...this.records]; [records[index],records[destination]]=[records[destination]!,records[index]!];
      await this.repository.put('sources.v1',records); this.records = records; this.registry.reorder(records.map(item => item.id));
    });
  }
}
