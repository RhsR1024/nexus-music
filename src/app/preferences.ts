import {localSortFields,type LocalSortField,type LocalSortDirection} from '../domain/localAudioSort.ts';
import {normalizeLyricOffsets,normalizeLyricStyle,lyricStyleDefaults,type LyricStyle,type LyricAlignment} from '../lyrics/settings.ts';
import {normalizePresets,validGains,validPreamp,type EQPreset} from '../domain/equalizer.ts';
import {InvalidRecordError} from '../storage/recovery.ts';
import {MutationQueue} from '../storage/mutations.ts';
import type { Repository } from '../storage/repository.ts';
import { normalizeQuality, type Quality } from '../domain/quality.ts';
import {appearanceDefaults,visualThemes,type AppearanceOptions,type VisualTheme} from '../domain/appearance.ts';
import {miniPlayerDefaults,normalizeMiniActions,toggleMiniAction,moveMiniAction,type MiniPlayerOptions,type MiniAction} from '../domain/miniPlayer.ts';
export type StageStyle='classic'|'neon'|'cyberpunk'|'aurora';
export type PlayerLayout='classic'|'am'|'immersive'|'photo'|'vinyl'|'wave'|'stage'|'am2';
export interface Preferences extends AppearanceOptions,MiniPlayerOptions { localAudioSortField:LocalSortField;localAudioSortDirection:LocalSortDirection; stageStyle:StageStyle;stageBackdrop:boolean; am2AutoLyrics:boolean;am2DelaySeconds:number;am2ShowVolume:boolean; lyricStyle:LyricStyle; autoMatch:boolean; lyricAlignment:LyricAlignment; lyricOffsets:Readonly<Record<string,number>>; volume:number; preampDB:number; eqPresets:readonly EQPreset[]; playerLayout:PlayerLayout; favoriteVisualTheme:VisualTheme|null; quality: Quality; eqEnabled: boolean; gains: readonly number[]; repeat: 'off' | 'all' | 'one'; shuffle: boolean; lyricOffsetMs: number; fontScale: number; rate:number; theme: 'system' | 'dark' | 'light'; cacheLimitMB: number; offlineLimitMB:number; downloadConcurrency:1|2|3 }
export const defaults: Preferences = { ...appearanceDefaults,...miniPlayerDefaults,localAudioSortField:'title',localAudioSortDirection:'asc',stageStyle:'classic',stageBackdrop:true,am2AutoLyrics:true,am2DelaySeconds:5,am2ShowVolume:false,lyricStyle:lyricStyleDefaults,autoMatch:true,lyricAlignment:'auto',lyricOffsets:{},volume:1,preampDB:0,eqPresets:[],playerLayout:'classic',favoriteVisualTheme:null,quality: 'flac', eqEnabled: false, gains: Array(10).fill(0), repeat: 'off', shuffle: false, lyricOffsetMs: 0, fontScale: 1, rate: 1, theme: 'system', cacheLimitMB: 256, offlineLimitMB: 2048,downloadConcurrency:1 };
export function validatePreferences(value: Preferences): Preferences {
    if(!Number.isInteger(value.downloadConcurrency)||![1,2,3].includes(value.downloadConcurrency))throw new Error('下载并发设置无效');
    if(!localSortFields.includes(value.localAudioSortField)||!['asc','desc'].includes(value.localAudioSortDirection))throw new Error('本地排序设置无效');
    if(!['classic','neon','cyberpunk','aurora'].includes(value.stageStyle)||typeof value.stageBackdrop!=='boolean')throw new Error('舞台样式无效');
    if(typeof value.am2AutoLyrics!=='boolean'||typeof value.am2ShowVolume!=='boolean'||!Number.isFinite(value.am2DelaySeconds)||value.am2DelaySeconds<1||value.am2DelaySeconds>60)throw new Error('AM2 设置无效');
    if(typeof value.miniLyrics!=='boolean')throw new Error('迷你歌词设置无效');
    if(typeof value.autoMatch!=='boolean')throw new Error('自动匹配设置无效');
    if(!['auto','left','center'].includes(value.lyricAlignment))throw new Error('歌词对齐方式无效');
    if(!['classic','am','immersive','photo','vinyl','wave','stage','am2'].includes(value.playerLayout))throw new Error('播放界面无效');
    if(!visualThemes.includes(value.visualTheme as VisualTheme)||(value.favoriteVisualTheme!==null&&!visualThemes.includes(value.favoriteVisualTheme as VisualTheme))||!['rose','coral','purple','blue','orange'].includes(value.accent)||!['gradient','solid','image'].includes(value.backgroundStyle)||typeof value.glassNavigation!=='boolean')throw new Error('外观设置无效');
    if(typeof value.cardOpacity!=='number'||!Number.isFinite(value.cardOpacity)||value.cardOpacity<0||value.cardOpacity>1||typeof value.backgroundMask!=='number'||!Number.isFinite(value.backgroundMask)||value.backgroundMask<0||value.backgroundMask>1||typeof value.maskColor!=='string'||!/^#[0-9a-f]{6}$/i.test(value.maskColor))throw new Error('卡片与遮罩设置无效');
    if(!['artwork','solid','photo'].includes(value.playerBackground)||typeof value.coverColor!=='boolean'||typeof value.globalBackgroundMotion!=='boolean'||typeof value.dynamicBackground!=='boolean'||!Number.isFinite(value.backgroundOpacity)||value.backgroundOpacity<0||value.backgroundOpacity>1||!Number.isFinite(value.playerBlur)||value.playerBlur<0||value.playerBlur>80||!Number.isFinite(value.playerDarkness)||value.playerDarkness<.35||value.playerDarkness>.9||!Number.isFinite(value.coverRadius)||value.coverRadius<0||value.coverRadius>48)throw new Error('图片外观设置无效');
    if (typeof value.shuffle!=='boolean'||typeof value.eqEnabled!=='boolean'||!Number.isFinite(value.volume)||value.volume<0||value.volume>1||!normalizeQuality(value.quality) || !validGains(value.gains) || !validPreamp(value.preampDB) ||
      !['off', 'all', 'one'].includes(value.repeat) || !Number.isFinite(value.lyricOffsetMs) || Math.abs(value.lyricOffsetMs)>600000 || !Number.isFinite(value.fontScale) || value.fontScale < .7 || value.fontScale > 2 || !Number.isFinite(value.rate) || value.rate < .5 || value.rate > 3 ||
      !['system', 'dark', 'light'].includes(value.theme) || !Number.isFinite(value.cacheLimitMB) || value.cacheLimitMB < 32 || value.cacheLimitMB > 2048 || !Number.isFinite(value.offlineLimitMB) || value.offlineLimitMB < 256 || value.offlineLimitMB > 8192) throw new Error('设置数据无效');
    return { ...value, miniActions:normalizeMiniActions(value.miniActions), lyricStyle:normalizeLyricStyle(value.lyricStyle), gains: [...value.gains], eqPresets:normalizePresets(value.eqPresets),lyricOffsets:normalizeLyricOffsets(value.lyricOffsets) };
  }

export class PreferenceStore {
  private repository: Repository; private value: Preferences = defaults;
  private listeners = new Set<() => void>(); private tail: Promise<unknown> = Promise.resolve();
  private mutations:MutationQueue;
  constructor(repository: Repository,mutations=new MutationQueue()) { this.repository = repository;this.mutations=mutations; }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  async restore() {
    const value = await this.repository.get<Preferences>('preferences.v1');
    if (value) {try{
      // The old motion switch animated the global layer only with cover color.
      // Preserve that effective choice once, then persist both controls separately.
      const globalBackgroundMotion=Object.hasOwn(value,'globalBackgroundMotion')?value.globalBackgroundMotion:value.dynamicBackground===true&&value.coverColor===true;
      // The cover palette used to ship off, leaving every background on the fixed
      // theme gradient. Records written before the default flipped upgrade once;
      // after that the stored choice (including a manual off) is kept.
      const coverColor=(value as {coverColorDefaultOn?:boolean}).coverColorDefaultOn===true?value.coverColor===true:true;
      this.value = validatePreferences({ ...defaults, ...value,globalBackgroundMotion,coverColor,coverColorDefaultOn:true } as Preferences);
    }catch{throw new InvalidRecordError();}}
    for(const listener of this.listeners)listener();
  }
  toggleMiniAction(action:MiniAction){return this.mutate(value=>({miniActions:toggleMiniAction(value.miniActions,action)}));}
  moveMiniAction(action:MiniAction,delta:-1|1){return this.mutate(value=>({miniActions:moveMiniAction(value.miniActions,action,delta)}));}
  setLyricOffset(key:string,offset:number) {return this.mutate(value=>({lyricOffsets:{...value.lyricOffsets,[key]:offset}}));}
  updateLyricStyle(patch:Partial<LyricStyle>) {return this.mutate(value=>({lyricStyle:{...value.lyricStyle,...patch}}));}
  adjustLyricStyle(field:'lineHeight'|'spacing'|'blur',delta:number) {
    const limits={lineHeight:[1.1,2],spacing:[0,32],blur:[0,4]} as const;
    return this.mutate(value=>({lyricStyle:{...value.lyricStyle,[field]:Math.max(limits[field][0],Math.min(limits[field][1],Math.round((value.lyricStyle[field]+delta)*100)/100))}}));
  }
  saveEQPreset(name:string) {
    return this.mutate(value=>({eqPresets:normalizePresets([...value.eqPresets.filter(preset=>preset.name!==name.trim()),{name,gains:value.gains,preampDB:value.preampDB}])}));
  }
  deleteEQPreset(name:string) {return this.mutate(value=>({eqPresets:value.eqPresets.filter(preset=>preset.name!==name)}));}
  update(patch: Partial<Preferences>) {return this.mutate(()=>patch);}
  private mutate(patch:(value:Preferences)=>Partial<Preferences>) {
    const next = this.mutations.run(async () => {
      // Every new write is already past the cover-default migration, including
      // the first explicit choice on a fresh installation.
      const value = validatePreferences({ ...this.value, ...patch(this.value),coverColorDefaultOn:true } as Preferences);
      await this.repository.put('preferences.v1', value); this.value = value;
      for (const listener of this.listeners) listener();
    });
    this.tail = next.catch(() => {}); return next;
  }
}
