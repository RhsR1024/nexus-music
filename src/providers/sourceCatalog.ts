import {InvalidRecordError} from '../storage/recovery.ts';
import { SourceRegistry, type SourceDefinition, type SourceState } from './sourceRegistry.ts';
import type { Repository } from '../storage/repository.ts';

export interface SourceUpdateInfo {
  readonly log: string;
  readonly updateUrl?: string;
  readonly latestVersion?: string;
  readonly detectedAt: number;
  readonly kind: 'alert' | 'subscription';
}
export interface StoredSource extends SourceDefinition {
  enabled: boolean; version: string; author: string; description: string;
  alias?: string;
  allowUpdateAlert?: boolean;
  subscription?: string; previous?: { script: string; version: string };
  updateInfo?: SourceUpdateInfo;
}
export interface SourceView extends SourceState {
  version: string; author: string; description: string;
  alias?: string; displayName: string;
  allowUpdateAlert: boolean;
  hasSubscription: boolean; subscriptionUrl?: string;
  canRollback: boolean;
  hasUpdate: boolean; updateInfo?: SourceUpdateInfo;
}
export interface SourceUpdateCheckHelpers {
  probeAlert?: (id: string, name: string, script: string, waitMs?: number) => Promise<string | null>;
  fetchScript?: (url: string) => Promise<string>;
}
export function parseUpdateAlertPayload(raw: string | Record<string, unknown>): Omit<SourceUpdateInfo, 'detectedAt'> | null {
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    if (!raw.trim() || raw.length > 16384) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed as Record<string, unknown>;
    } catch { return null; }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw;
  }
  if (!obj) return null;
  const rawLog = typeof obj.log === 'string' ? obj.log.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 1000) : '';
  let updateUrl: string | undefined;
  const candidateUrl = typeof obj.updateUrl === 'string' ? obj.updateUrl.trim() : '';
  if (candidateUrl && candidateUrl.length <= 2048) {
    try {
      const parsed = new URL(candidateUrl);
      if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.hostname) {
        updateUrl = parsed.toString();
      }
    } catch {}
  }
  if (!rawLog && !updateUrl) return null;
  return {
    log: rawLog || '检测到新版本，可点击更新或查看发布地址',
    ...(updateUrl ? { updateUrl } : {}),
    kind: 'alert',
  };
}
function validUpdateInfo(value: unknown): value is SourceUpdateInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.log === 'string' && item.log.length > 0 && item.log.length <= 1000 &&
    (item.updateUrl === undefined || typeof item.updateUrl === 'string' && item.updateUrl.length <= 2048) &&
    (item.latestVersion === undefined || typeof item.latestVersion === 'string' && item.latestVersion.length <= 64) &&
    Number.isFinite(item.detectedAt) && (item.kind === 'alert' || item.kind === 'subscription');
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
  private updateCheckRunning = false;
  constructor(registry: SourceRegistry, repository: Repository, hash: (script: string) => Promise<string>) {
    this.registry = registry; this.repository = repository; this.hash = hash;
    registry.subscribe(() => this.publish());
  }
  getSnapshot = () => this.snapshot;
  isCheckingUpdates = () => this.updateCheckRunning;
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
      const alias = record.alias?.trim() || undefined;
      return {
        ...state,
        version: record.version,
        author: record.author,
        description: record.description,
        ...(alias ? { alias } : {}),
        displayName: alias ?? state.name,
        allowUpdateAlert: record.allowUpdateAlert !== false,
        hasSubscription: !!record.subscription,
        ...(record.subscription ? { subscriptionUrl: record.subscription } : {}),
        canRollback: !!record.previous,
        hasUpdate: !!record.updateInfo,
        ...(record.updateInfo ? { updateInfo: record.updateInfo } : {}),
      };
    });
    for (const listener of this.listeners) listener();
  }
  async restore() {
    const stored = await this.repository.get<StoredSource[]>('sources.v1') ?? [];
    if (!Array.isArray(stored) || stored.length > 32 || stored.some(item => !item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim() || typeof item.script !== 'string' || !item.script.trim() || item.script.length>8*1024*1024 || typeof item.enabled !== 'boolean') || new Set(stored.map(item => item.id)).size !== stored.length) throw new InvalidRecordError();
    const restored=await Promise.all(stored.map(async item=>{
      const alias = typeof item.alias === 'string' && item.alias.trim() ? item.alias.trim().slice(0, 64) : undefined;
      const updateInfo = validUpdateInfo(item.updateInfo) ? item.updateInfo : undefined;
      return {
        ...item,
        ...(alias ? { alias } : { alias: undefined }),
        allowUpdateAlert: item.allowUpdateAlert !== false,
        ...(updateInfo ? { updateInfo } : { updateInfo: undefined }),
        fingerprint: await this.hash(item.script),
      };
    }));
    this.records = restored;
    this.registry.registerMany(restored);
  }
  async fingerprint(id:string){const source=this.records.find(item=>item.id===id);if(!source)throw new Error('音源已删除');return this.hash(source.script);}
  async restoreEnabled() { return this.registry.setManyEnabled(this.records.filter(item => item.enabled).map(item => item.id), true); }
  async import(script: string, filename: string, subscription?: string) {
    return this.mutate(() => this.importInner(script, filename, subscription));
  }
  async importMany(entries: readonly { script: string; filename: string; subscription?: string }[]) {
    return this.mutate(async () => {
      let added = 0, duplicates = 0, failed = 0;
      const records = [...this.records];
      const next: StoredSource[] = [];
      for (const entry of entries) {
        try {
          const metadata = scriptMetadata(entry.script, entry.filename);
          const id = await this.hash(entry.script);
          if (records.some(item => item.id === id || item.script === entry.script)) { duplicates++; continue; }
          if (records.length >= 32) { failed++; continue; }
          const source: StoredSource = { id, script: entry.script, fingerprint: id, ...metadata, enabled: false, ...(entry.subscription ? { subscription: entry.subscription } : {}) };
          records.push(source); next.push(source); added++;
        } catch { failed++; }
      }
      if (next.length) {
        await this.repository.put('sources.v1', records);
        this.records = records;
        this.registry.registerMany(next);
      }
      return { added, duplicates, failed };
    });
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
  async update(id: string, script: string, subscription?: string) {
    return this.mutate(() => this.updateInner(id, script, subscription));
  }
  private async updateInner(id: string, script: string, subscription?: string) {
    const previous = this.records.find(item => item.id === id);
    if (!previous) throw new Error('音源不存在');
    const nextSub = subscription?.trim() || previous.subscription;
    if (script === previous.script) {
      if (nextSub !== previous.subscription || previous.updateInfo) {
        const cleaned: StoredSource = { ...previous, ...(nextSub ? { subscription: nextSub } : {}), updateInfo: undefined };
        const records = this.records.map(item => item.id === id ? cleaned : item);
        await this.repository.put('sources.v1', records);
        this.records = records;
        this.publish();
      }
      return false;
    }
    const metadata = scriptMetadata(script, previous.name);
    const updated: StoredSource = {
      ...previous,
      ...metadata,
      script,
      fingerprint: await this.hash(script),
      enabled: false,
      ...(nextSub ? { subscription: nextSub } : {}),
      updateInfo: undefined,
      previous: { script: previous.script, version: previous.version },
    };
    const records = this.records.map(item => item.id === id ? updated : item);
    await this.repository.put('sources.v1', records);
    this.records = records; this.registry.register(updated); return true;
  }
  async setAlias(id: string, alias: string) {
    return this.mutate(async () => {
      const existing = this.records.find(item => item.id === id);
      if (!existing) throw new Error('音源不存在');
      const cleaned = alias.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 64);
      const nextRecord: StoredSource = { ...existing, ...(cleaned ? { alias: cleaned } : { alias: undefined }) };
      const records = this.records.map(item => item.id === id ? nextRecord : item);
      await this.repository.put('sources.v1', records);
      this.records = records;
      this.publish();
    });
  }
  async setAllowUpdateAlert(id: string, allow: boolean) {
    return this.mutate(async () => {
      const existing = this.records.find(item => item.id === id);
      if (!existing) throw new Error('音源不存在');
      const nextRecord: StoredSource = { ...existing, allowUpdateAlert: allow };
      const records = this.records.map(item => item.id === id ? nextRecord : item);
      await this.repository.put('sources.v1', records);
      this.records = records;
      this.publish();
    });
  }
  async recordUpdateAlert(id: string, rawPayload: string | Record<string, unknown>): Promise<SourceUpdateInfo | null> {
    const parsed = parseUpdateAlertPayload(rawPayload);
    if (!parsed) return null;
    return this.mutate(async () => {
      const existing = this.records.find(item => item.id === id);
      if (!existing) return null;
      const info: SourceUpdateInfo = { ...parsed, detectedAt: Date.now() };
      const same = existing.updateInfo?.log === info.log && existing.updateInfo?.updateUrl === info.updateUrl && existing.updateInfo?.kind === info.kind;
      if (same) return existing.updateInfo!;
      const records = this.records.map(item => item.id === id ? { ...item, updateInfo: info } : item);
      await this.repository.put('sources.v1', records);
      this.records = records;
      this.publish();
      return info;
    });
  }
  async dismissUpdate(id: string) {
    return this.mutate(async () => {
      const existing = this.records.find(item => item.id === id);
      if (!existing?.updateInfo) return;
      const records = this.records.map(item => item.id === id ? { ...item, updateInfo: undefined } : item);
      await this.repository.put('sources.v1', records);
      this.records = records;
      this.publish();
    });
  }
  async checkUpdate(id: string, helpers: SourceUpdateCheckHelpers): Promise<{ hasUpdate: boolean; info?: SourceUpdateInfo }> {
    const target = this.records.find(item => item.id === id);
    if (!target) throw new Error('音源不存在');
    let detected: SourceUpdateInfo | undefined;
    if (helpers.probeAlert) {
      try {
        const raw = await helpers.probeAlert(target.id, target.name, target.script, 5500);
        if (raw) {
          const parsed = parseUpdateAlertPayload(raw);
          if (parsed) detected = { ...parsed, detectedAt: Date.now() };
        }
      } catch {}
    }
    if (!detected && target.subscription && helpers.fetchScript) {
      try {
        const remote = await helpers.fetchScript(target.subscription);
        if (remote && remote !== target.script) {
          const meta = scriptMetadata(remote, target.name);
          const verHint = meta.version && meta.version !== target.version
            ? `${target.version || '当前版本'} → ${meta.version}`
            : '远端脚本内容已有更新';
          detected = {
            log: `检测到订阅脚本新版本（${verHint}），可点击「一键/手动更新」直接升级。`,
            updateUrl: target.subscription,
            ...(meta.version ? { latestVersion: meta.version } : {}),
            detectedAt: Date.now(),
            kind: 'subscription',
          };
        }
      } catch {}
    }
    await this.mutate(async () => {
      const latest = this.records.find(item => item.id === id);
      if (!latest || latest.fingerprint !== target.fingerprint) return;
      const records = this.records.map(item => item.id === id ? { ...item, updateInfo: detected } : item);
      await this.repository.put('sources.v1', records);
      this.records = records;
      this.publish();
    });
    return { hasUpdate: !!detected, ...(detected ? { info: detected } : {}) };
  }
  async checkAllUpdates(helpers: SourceUpdateCheckHelpers): Promise<{ checked: number; updatedIds: string[] }> {
    if (this.updateCheckRunning) return { checked: 0, updatedIds: [] };
    this.updateCheckRunning = true;
    this.publish();
    const ids = this.records.map(item => item.id);
    const updatedIds: string[] = [];
    let cursor = 0;
    let checked = 0;
    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++]!;
        try {
          const res = await this.checkUpdate(id, helpers);
          checked++;
          if (res.hasUpdate) updatedIds.push(id);
        } catch {}
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(2, ids.length) }, worker));
      return { checked, updatedIds };
    } finally {
      this.updateCheckRunning = false;
      this.publish();
    }
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
