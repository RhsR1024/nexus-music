import {normalizeLyricOffsets,type LyricAlignment} from '../lyrics/settings.ts';
import {normalizePresets,validGains,validPreamp,type EQPreset} from '../domain/equalizer.ts';
import {InvalidRecordError} from '../storage/recovery.ts';
import type { Repository } from '../storage/repository.ts';
import { normalizeQuality, type Quality } from '../domain/quality.ts';
import {appearanceDefaults,type AppearanceOptions} from '../domain/appearance.ts';
export type PlayerLayout='classic'|'am'|'immersive'|'photo'|'vinyl'|'wave';
export interface Preferences extends AppearanceOptions { autoMatch:boolean; lyricAlignment:LyricAlignment; lyricOffsets:Readonly<Record<string,number>>; volume:number; preampDB:number; eqPresets:readonly EQPreset[]; playerLayout:PlayerLayout; quality: Quality; eqEnabled: boolean; gains: readonly number[]; repeat: 'off' | 'all' | 'one'; shuffle: boolean; lyricOffsetMs: number; fontScale: number; theme: 'system' | 'dark' | 'light'; cacheLimitMB: number }
export const defaults: Preferences = { ...appearanceDefaults,autoMatch:true,lyricAlignment:'auto',lyricOffsets:{},volume:1,preampDB:0,eqPresets:[],playerLayout:'classic',quality: 'flac', eqEnabled: false, gains: Array(10).fill(0), repeat: 'off', shuffle: false, lyricOffsetMs: 0, fontScale: 1, theme: 'system', cacheLimitMB: 256 };
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
    if(typeof value.autoMatch!=='boolean')throw new Error('自动匹配设置无效');
    if(!['auto','left','center'].includes(value.lyricAlignment))throw new Error('歌词对齐方式无效');
    if(!['classic','am','immersive','photo','vinyl','wave'].includes(value.playerLayout))throw new Error('播放界面无效');
    if(!['classic','blush','soft'].includes(value.visualTheme)||!['rose','coral','purple','blue','orange'].includes(value.accent)||!['gradient','solid'].includes(value.backgroundStyle)||typeof value.glassNavigation!=='boolean')throw new Error('外观设置无效');
    if (!Number.isFinite(value.volume)||value.volume<0||value.volume>1||!normalizeQuality(value.quality) || !validGains(value.gains) || !validPreamp(value.preampDB) ||
      !['off', 'all', 'one'].includes(value.repeat) || !Number.isFinite(value.lyricOffsetMs) || Math.abs(value.lyricOffsetMs)>600000 || !Number.isFinite(value.fontScale) || value.fontScale < .7 || value.fontScale > 2 ||
      !['system', 'dark', 'light'].includes(value.theme) || !Number.isFinite(value.cacheLimitMB) || value.cacheLimitMB < 32 || value.cacheLimitMB > 2048) throw new Error('设置数据无效');
    return { ...value, gains: [...value.gains], eqPresets:normalizePresets(value.eqPresets),lyricOffsets:normalizeLyricOffsets(value.lyricOffsets) };
  }
  setLyricOffset(key:string,offset:number) {return this.mutate(value=>({lyricOffsets:{...value.lyricOffsets,[key]:offset}}));}
  saveEQPreset(name:string) {
    return this.mutate(value=>({eqPresets:normalizePresets([...value.eqPresets.filter(preset=>preset.name!==name.trim()),{name,gains:value.gains,preampDB:value.preampDB}])}));
  }
  deleteEQPreset(name:string) {return this.mutate(value=>({eqPresets:value.eqPresets.filter(preset=>preset.name!==name)}));}
  update(patch: Partial<Preferences>) {return this.mutate(()=>patch);}
  private mutate(patch:(value:Preferences)=>Partial<Preferences>) {
    const next = this.tail.then(async () => {
      const value = this.validate({ ...this.value, ...patch(this.value) });
      await this.repository.put('preferences.v1', value); this.value = value;
      for (const listener of this.listeners) listener();
    });
    this.tail = next.catch(() => {}); return next;
  }
}
