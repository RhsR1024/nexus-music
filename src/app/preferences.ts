import {InvalidRecordError} from '../storage/recovery.ts';
import type { Repository } from '../storage/repository.ts';
import { normalizeQuality, type Quality } from '../domain/quality.ts';
import {appearanceDefaults,type AppearanceOptions} from '../domain/appearance.ts';
export type PlayerLayout='classic'|'am'|'immersive'|'photo'|'vinyl'|'wave';
export interface Preferences extends AppearanceOptions { playerLayout:PlayerLayout; quality: Quality; eqEnabled: boolean; gains: readonly number[]; repeat: 'off' | 'all' | 'one'; shuffle: boolean; lyricOffsetMs: number; fontScale: number; theme: 'system' | 'dark' | 'light'; cacheLimitMB: number }
export const defaults: Preferences = { ...appearanceDefaults,playerLayout:'classic',quality: 'flac', eqEnabled: false, gains: Array(10).fill(0), repeat: 'off', shuffle: false, lyricOffsetMs: 0, fontScale: 1, theme: 'system', cacheLimitMB: 256 };
export class PreferenceStore {
  private repository: Repository; private value: Preferences = defaults;
  private listeners = new Set<() => void>(); private tail: Promise<unknown> = Promise.resolve();
  constructor(repository: Repository) { this.repository = repository; }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  async restore() {
    const value = await this.repository.get<Preferences>('preferences.v1');
    if (value) {try{this.value = this.validate({ ...defaults, ...value });}catch{throw new InvalidRecordError();}}
  }
  private validate(value: Preferences): Preferences {
    if(!['classic','am','immersive','photo','vinyl','wave'].includes(value.playerLayout))throw new Error('播放界面无效');
    if(!['classic','blush','soft'].includes(value.visualTheme)||!['rose','coral','purple','blue','orange'].includes(value.accent)||!['gradient','solid'].includes(value.backgroundStyle)||typeof value.glassNavigation!=='boolean')throw new Error('外观设置无效');
    if (!normalizeQuality(value.quality) || value.gains.length !== 10 || !value.gains.every(gain => Number.isFinite(gain) && Math.abs(gain) <= 12) ||
      !['off', 'all', 'one'].includes(value.repeat) || !Number.isFinite(value.lyricOffsetMs) || !Number.isFinite(value.fontScale) || value.fontScale < .7 || value.fontScale > 2 ||
      !['system', 'dark', 'light'].includes(value.theme) || !Number.isFinite(value.cacheLimitMB) || value.cacheLimitMB < 32 || value.cacheLimitMB > 2048) throw new Error('设置数据无效');
    return { ...value, gains: [...value.gains] };
  }
  update(patch: Partial<Preferences>) {
    const next = this.tail.then(async () => {
      const value = this.validate({ ...this.value, ...patch });
      await this.repository.put('preferences.v1', value); this.value = value;
      for (const listener of this.listeners) listener();
    });
    this.tail = next.catch(() => {}); return next;
  }
}
