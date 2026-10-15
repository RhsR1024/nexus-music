import type { LXSource } from './lx.ts';
import { bounded } from './async.ts';

export interface SourceDefinition { id: string; name: string; script: string; fingerprint?: string }
export interface SourceState {
  readonly id: string; readonly name: string; readonly revision: number; readonly fingerprint?: string;
  readonly enabled: boolean; readonly status: 'disabled' | 'initializing' | 'ready' | 'failed';
  readonly capabilities: readonly LXSource[];
}
export interface SourceLifecycle {
  initialize(source: SourceDefinition, revision: number, signal: AbortSignal): Promise<readonly LXSource[]>;
  destroy(id: string, revision: number): void;
}

export class SourceRegistry {
  private definitions = new Map<string, SourceDefinition>();
  private states = new Map<string, SourceState>();
  private pending = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private snapshot: readonly SourceState[] = [];
  private revisions = new Map<string, number>();
  private lifecycle: SourceLifecycle;
  private timeoutMs: number;
  private batchGeneration = 0;
  constructor(lifecycle: SourceLifecycle, timeoutMs = 20000) { this.lifecycle = lifecycle; this.timeoutMs = timeoutMs; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.snapshot = [...this.states.values()]; for (const listener of this.listeners) listener(); }
  private invalidate(id: string) {
    this.pending.get(id)?.abort(); this.pending.delete(id);
    const state = this.states.get(id);
    if (state) this.lifecycle.destroy(id, state.revision);
  }
  register(source: SourceDefinition): void {
    if (!source.id || !source.name || !source.script.trim()) throw new Error('音源信息不完整');
    this.invalidate(source.id);
    const revision = (this.revisions.get(source.id) ?? 0) + 1;
    this.revisions.set(source.id, revision); this.definitions.set(source.id, { ...source });
    // Replacing a script requires initialization again; never keep stale capabilities.
    this.states.set(source.id, { id: source.id, name: source.name, revision, fingerprint: source.fingerprint, enabled: false, status: 'disabled', capabilities: [] });
    this.publish();
  }
  isCurrent(source: SourceState): boolean {
    const current = this.states.get(source.id);
    return !!current && current.revision === source.revision && current.enabled && current.status === 'ready';
  }
  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const source = this.definitions.get(id); const previous = this.states.get(id);
    if (!source || !previous) throw new Error('音源不存在');
    if (enabled && previous.status === 'ready' && previous.enabled) return true;
    this.invalidate(id);
    const revision = (this.revisions.get(id) ?? 0) + 1; this.revisions.set(id, revision);
    const pending = new AbortController();
    if (enabled) this.pending.set(id, pending);
    this.states.set(id, { ...previous, revision, enabled, status: enabled ? 'initializing' : 'disabled', capabilities: [] });
    this.publish();
    if (!enabled) return true;
    try {
      const capabilities = await bounded(signal => this.lifecycle.initialize(source, revision, signal), pending.signal, this.timeoutMs);
      if (pending.signal.aborted || this.states.get(id)?.revision !== revision) return false;
      this.states.set(id, { ...this.states.get(id)!, capabilities, status: 'ready' });
      this.publish(); return true;
    } catch {
      if (!pending.signal.aborted && this.states.get(id)?.revision === revision) {
        this.lifecycle.destroy(id, revision);
        this.states.set(id, { ...this.states.get(id)!, status: 'failed', capabilities: [] });
        this.publish();
      }
      return false;
    } finally { if (this.pending.get(id) === pending) this.pending.delete(id); }
  }
  async setManyEnabled(ids: readonly string[], enabled: boolean) {
    const generation = ++this.batchGeneration;
    const ordered = [...new Set(ids)], results = new Array<boolean>(ordered.length).fill(false);
    let next = 0;
    // Initialize at most three contexts together; routing and result order stay
    // in user order. A newer batch cancels work not yet started by an older one.
    const worker = async () => {
      while (next < ordered.length && generation === this.batchGeneration) {
        const index = next++;
        try { results[index] = await this.setEnabled(ordered[index]!, enabled); } catch { /* Partial failure. */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, ordered.length) }, worker));
    return { succeeded: ordered.filter((_, index) => results[index]), failed: ordered.filter((_, index) => !results[index]) };
  }
  remove(id: string): void { this.invalidate(id); this.states.delete(id); this.definitions.delete(id); this.publish(); }
  reorder(ids: readonly string[]) {
    if (ids.length !== this.states.size || new Set(ids).size !== ids.length || ids.some(id => !this.states.has(id))) throw new Error('音源顺序无效');
    this.states = new Map(ids.map(id => [id,this.states.get(id)!])); this.publish();
  }
  dispose(): void { this.batchGeneration++; for (const id of this.states.keys()) this.invalidate(id); this.states.clear(); this.definitions.clear(); this.publish(); this.listeners.clear(); }
}
