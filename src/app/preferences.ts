import {downloadCoverDefaults,normalizeDownloadCoverSizes,type DownloadCoverPreferences,type DownloadCoverSize} from '../domain/downloadCover.ts';
import {downloadPlatforms,downloadQualityDefaults,normalizeDownloadQualities,type DownloadQualityPreferences} from '../domain/downloadQuality.ts';
import type {OnlinePlatform} from '../domain/track.ts';
import {downloadAttachmentDefaults,validateDownloadAttachments,type DownloadAttachments} from '../domain/downloadAttachments.ts';
import {downloadNamingDefaults,validateDownloadNaming,type DownloadNaming} from '../domain/downloadNaming.ts';
import {localSortFields,type LocalSortField,type LocalSortDirection} from '../domain/localAudioSort.ts';
import {normalizeLyricOffsets,normalizeLyricStyle,lyricStyleDefaults,type LyricStyle,type LyricAlignment} from '../lyrics/settings.ts';
import {normalizePresets,validGains,validPreamp,type EQPreset} from '../domain/equalizer.ts';
import {InvalidRecordError} from '../storage/recovery.ts';
import {MutationQueue} from '../storage/mutations.ts';
import type { Repository } from '../storage/repository.ts';
import { normalizeQuality, type Quality } from '../domain/quality.ts';
import {appearanceDefaults,glassLevels,visualThemes,type AppearanceOptions,type GlassLevel,type VisualTheme} from '../domain/appearance.ts';
import {miniPlayerDefaults,normalizeMiniActions,toggleMiniAction,moveMiniAction,type MiniPlayerOptions,type MiniAction} from '../domain/miniPlayer.ts';
export type StageStyle='classic'|'neon'|'cyberpunk'|'aurora';
export type GrooveSpinSpeed='slow'|'normal'|'fast';
export type TeletypeTheme='paper'|'terminal'|'amber';
export type PlayerLayout='classic'|'am'|'immersive'|'photo'|'vinyl'|'wave'|'stage'|'am2'|'groove'|'teletype';
export type NavigationStyle='liquid'|'frosted'|'acrylic';
export type PlaylistAddPosition='end'|'start';
export type LyricChineseMode='original'|'simplified'|'traditional';
export type SystemLyricsPosition='artist'|'title';
export type BluetoothLyricsOrder='lyric-first'|'artist-first';
export type AutoPlaySource='last'|'favorites';
export type SmartDegradeMode='progressive'|'direct128k';
export interface Preferences extends AppearanceOptions,MiniPlayerOptions,DownloadNaming,DownloadAttachments,DownloadQualityPreferences,DownloadCoverPreferences { navigationStyle:NavigationStyle;showLocalTab:boolean;playlistAddPosition:PlaylistAddPosition;keepScreenOn:boolean;fullScreenMode:boolean;autoPlayOnLaunch:boolean;autoPlaySource:AutoPlaySource;openPlayerOnLaunch:boolean;mixWithOtherAudio:boolean;preloadNextTrack:boolean;preloadCount:number;playbackFadeEnabled:boolean;playbackFadeDurationMs:number;systemLyricsEnabled:boolean;systemLyricsPosition:SystemLyricsPosition;bluetoothLyricsOrder:BluetoothLyricsOrder;bluetoothLyricsRestoreOnPause:boolean;floatingLyricsEnabled:boolean;floatingLyricsLocked:boolean;playbackQualities:Partial<Record<OnlinePlatform,Quality>>;smartDegradeMode:SmartDegradeMode;smartCrossScript:boolean;smartSkipOnFailure:boolean;homePlatform:OnlinePlatform;lyricChineseMode:LyricChineseMode;localAudioSortField:LocalSortField;localAudioSortDirection:LocalSortDirection; stageStyle:StageStyle;stageBackdrop:boolean;grooveSpinSpeed:GrooveSpinSpeed;teletypeTheme:TeletypeTheme; am2AutoLyrics:boolean;am2DelaySeconds:number;am2ShowVolume:boolean; lyricStyle:LyricStyle; autoMatch:boolean; lyricAlignment:LyricAlignment; lyricOffsets:Readonly<Record<string,number>>; volume:number; preampDB:number; eqPresets:readonly EQPreset[]; playerLayout:PlayerLayout; favoriteVisualTheme:VisualTheme|null; quality: Quality; eqEnabled: boolean; gains: readonly number[]; repeat: 'off' | 'all' | 'one'; shuffle: boolean; lyricOffsetMs: number; fontScale: number; rate:number; theme: 'system' | 'dark' | 'light'; cacheLimitMB: number; offlineLimitMB:number; downloadConcurrency:1|2|3 }
export const defaults: Preferences = { ...downloadCoverDefaults,...downloadQualityDefaults,...downloadAttachmentDefaults,...downloadNamingDefaults,...appearanceDefaults,...miniPlayerDefaults,navigationStyle:'liquid',showLocalTab:true,playlistAddPosition:'end',keepScreenOn:false,fullScreenMode:false,autoPlayOnLaunch:false,autoPlaySource:'last',openPlayerOnLaunch:false,mixWithOtherAudio:false,preloadNextTrack:false,preloadCount:1,playbackFadeEnabled:false,playbackFadeDurationMs:500,systemLyricsEnabled:false,systemLyricsPosition:'artist',bluetoothLyricsOrder:'lyric-first',bluetoothLyricsRestoreOnPause:true,floatingLyricsEnabled:false,floatingLyricsLocked:false,playbackQualities:{},smartDegradeMode:'progressive',smartCrossScript:true,smartSkipOnFailure:true,homePlatform:'wy',lyricChineseMode:'original',localAudioSortField:'title',localAudioSortDirection:'asc',stageStyle:'classic',stageBackdrop:true,grooveSpinSpeed:'normal',teletypeTheme:'paper',am2AutoLyrics:true,am2DelaySeconds:5,am2ShowVolume:false,lyricStyle:lyricStyleDefaults,autoMatch:true,lyricAlignment:'auto',lyricOffsets:{},volume:1,preampDB:0,eqPresets:[],playerLayout:'classic',favoriteVisualTheme:null,quality: 'flac', eqEnabled: false, gains: Array(10).fill(0), repeat: 'off', shuffle: false, lyricOffsetMs: 0, fontScale: 1, rate: 1, theme: 'system', cacheLimitMB: 256, offlineLimitMB: 2048,downloadConcurrency:1 };
export function validatePreferences(value: Preferences): Preferences {
    validateDownloadNaming(value);validateDownloadAttachments(value);
    if(!['liquid','frosted','acrylic'].includes(value.navigationStyle)||typeof value.showLocalTab!=='boolean')throw new Error('底栏导航设置无效');
    if(!['end','start'].includes(value.playlistAddPosition)||!['original','simplified','traditional'].includes(value.lyricChineseMode)||typeof value.keepScreenOn!=='boolean'||typeof value.fullScreenMode!=='boolean'||typeof value.autoPlayOnLaunch!=='boolean'||!['last','favorites'].includes(value.autoPlaySource)||typeof value.openPlayerOnLaunch!=='boolean'||typeof value.mixWithOtherAudio!=='boolean'||typeof value.preloadNextTrack!=='boolean')throw new Error('播放与展示偏好无效');
    if(!Number.isInteger(value.preloadCount)||value.preloadCount<1||value.preloadCount>3)throw new Error('预加载数量设置无效');
    if(typeof value.playbackFadeEnabled!=='boolean'||!Number.isFinite(value.playbackFadeDurationMs)||value.playbackFadeDurationMs<100||value.playbackFadeDurationMs>3000)throw new Error('淡入淡出设置无效');
    if(typeof value.systemLyricsEnabled!=='boolean'||!['artist','title'].includes(value.systemLyricsPosition)||!['lyric-first','artist-first'].includes(value.bluetoothLyricsOrder)||typeof value.bluetoothLyricsRestoreOnPause!=='boolean'||typeof value.floatingLyricsEnabled!=='boolean'||typeof value.floatingLyricsLocked!=='boolean')throw new Error('系统歌词推送设置无效');
    if(!['progressive','direct128k'].includes(value.smartDegradeMode)||typeof value.smartCrossScript!=='boolean'||typeof value.smartSkipOnFailure!=='boolean'||!downloadPlatforms.includes(value.homePlatform))throw new Error('智能换源或平台偏好无效');
    if(!Number.isInteger(value.downloadConcurrency)||![1,2,3].includes(value.downloadConcurrency))throw new Error('下载并发设置无效');
    if(!localSortFields.includes(value.localAudioSortField)||!['asc','desc'].includes(value.localAudioSortDirection))throw new Error('本地排序设置无效');
    if(!['classic','neon','cyberpunk','aurora'].includes(value.stageStyle)||typeof value.stageBackdrop!=='boolean'||!['slow','normal','fast'].includes(value.grooveSpinSpeed)||!['paper','terminal','amber'].includes(value.teletypeTheme))throw new Error('舞台样式无效');
    if(typeof value.am2AutoLyrics!=='boolean'||typeof value.am2ShowVolume!=='boolean'||!Number.isFinite(value.am2DelaySeconds)||value.am2DelaySeconds<1||value.am2DelaySeconds>60)throw new Error('AM2 设置无效');
    if(typeof value.miniLyrics!=='boolean')throw new Error('迷你歌词设置无效');
    if(typeof value.autoMatch!=='boolean')throw new Error('自动匹配设置无效');
    if(!['auto','left','center'].includes(value.lyricAlignment))throw new Error('歌词对齐方式无效');
    if(!['classic','am','immersive','photo','vinyl','wave','stage','am2','groove','teletype'].includes(value.playerLayout))throw new Error('播放界面无效');
    if(!visualThemes.includes(value.visualTheme as VisualTheme)||(value.favoriteVisualTheme!==null&&!visualThemes.includes(value.favoriteVisualTheme as VisualTheme))||!['rose','coral','purple','blue','orange'].includes(value.accent)||!['gradient','solid','image'].includes(value.backgroundStyle)||typeof value.glassNavigation!=='boolean'||!glassLevels.includes(value.glassLevel as GlassLevel))throw new Error('外观设置无效');
    if(typeof value.cardOpacity!=='number'||!Number.isFinite(value.cardOpacity)||value.cardOpacity<0||value.cardOpacity>1||typeof value.backgroundMask!=='number'||!Number.isFinite(value.backgroundMask)||value.backgroundMask<0||value.backgroundMask>1||typeof value.maskColor!=='string'||!/^#[0-9a-f]{6}$/i.test(value.maskColor))throw new Error('卡片与遮罩设置无效');
    if(!['artwork','solid','photo'].includes(value.playerBackground)||typeof value.tapeStyle!=='boolean'||typeof value.coverColor!=='boolean'||typeof value.globalBackgroundMotion!=='boolean'||typeof value.dynamicBackground!=='boolean'||!Number.isFinite(value.backgroundOpacity)||value.backgroundOpacity<0||value.backgroundOpacity>1||!Number.isFinite(value.playerBlur)||value.playerBlur<0||value.playerBlur>80||!Number.isFinite(value.playerDarkness)||value.playerDarkness<.35||value.playerDarkness>.9||!Number.isFinite(value.coverRadius)||value.coverRadius<0||value.coverRadius>48)throw new Error('图片外观设置无效');
    if (typeof value.shuffle!=='boolean'||typeof value.eqEnabled!=='boolean'||!Number.isFinite(value.volume)||value.volume<0||value.volume>1||!normalizeQuality(value.quality) || !validGains(value.gains) || !validPreamp(value.preampDB) ||
      !['off', 'all', 'one'].includes(value.repeat) || !Number.isFinite(value.lyricOffsetMs) || Math.abs(value.lyricOffsetMs)>600000 || !Number.isFinite(value.fontScale) || value.fontScale < .7 || value.fontScale > 2 || !Number.isFinite(value.rate) || value.rate < .5 || value.rate > 3 ||
      !['system', 'dark', 'light'].includes(value.theme) || !Number.isFinite(value.cacheLimitMB) || value.cacheLimitMB < 32 || value.cacheLimitMB > 2048 || !Number.isFinite(value.offlineLimitMB) || value.offlineLimitMB < 256 || value.offlineLimitMB > 8192) throw new Error('设置数据无效');
    return { ...value, playbackQualities:normalizeDownloadQualities(value.playbackQualities), downloadCoverSizes:normalizeDownloadCoverSizes(value.downloadCoverSizes), downloadQualities:normalizeDownloadQualities(value.downloadQualities), miniActions:normalizeMiniActions(value.miniActions), lyricStyle:normalizeLyricStyle(value.lyricStyle), gains: [...value.gains], eqPresets:normalizePresets(value.eqPresets),lyricOffsets:normalizeLyricOffsets(value.lyricOffsets) };
  }

export class PreferenceStore {
  private repository: Pick<Repository,'get'|'put'>; private value: Preferences = defaults;
  private listeners = new Set<() => void>(); private tail: Promise<unknown> = Promise.resolve();
  private mutations:MutationQueue;
  constructor(repository: Pick<Repository,'get'|'put'>,mutations=new MutationQueue()) { this.repository = repository;this.mutations=mutations; }
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
  setDownloadCoverSize(platform:OnlinePlatform,size?:DownloadCoverSize) {
    if(!downloadPlatforms.includes(platform))return Promise.reject(Error('下载平台无效'));
    return this.mutate(value=>{const downloadCoverSizes={...value.downloadCoverSizes};if(size===undefined)delete downloadCoverSizes[platform];else downloadCoverSizes[platform]=size;return{downloadCoverSizes};});
  }
  setDownloadQuality(platform:OnlinePlatform,quality?:Quality) {
    if(!downloadPlatforms.includes(platform))return Promise.reject(Error('下载平台无效'));
    return this.mutate(value=>{const downloadQualities={...value.downloadQualities};if(quality===undefined)delete downloadQualities[platform];else downloadQualities[platform]=quality;return{downloadQualities};});
  }
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
