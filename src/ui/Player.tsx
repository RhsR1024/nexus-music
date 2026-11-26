import {TrackActions} from './TrackActions.tsx';
import {SimilarSongs} from './SimilarSongs.tsx';
import {supportsSimilarSongs} from '../providers/similarSongs.ts';
import {playbackTimeline} from '../playback/timeline.ts';
import {miniActionLabels} from '../domain/miniPlayer.ts';
import {MiniLyric} from './MiniLyric.tsx';
import {effectiveLyricFont} from '../storage/fontCatalog.ts';
import {Text} from './Typography.tsx';
import {CommentsModal} from './CommentsModal.tsx';
import {StatusBar} from 'expo-status-bar';
import {requireNativeView,requireOptionalNativeModule} from 'expo';
import {Ionicons,MaterialIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {AmbientBackground,GlassSurface} from './Materials.tsx';
import {ArtworkBackdrop,ModernPlayer} from './ModernPlayer.tsx';
import {Cover} from './Cover.tsx';
import {PlayerCover} from './TapeCover.tsx';
import {CupertinoGlyph} from './CupertinoGlyph.tsx';
import {SkipGlyph} from './SkipGlyph.tsx';
import {MatchModal} from './MatchModal.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import type {Track} from '../domain/track.ts';
import {QueuePanel,QueueView} from './QueueView.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {classicArtworkLayout,classicBlushBackground,classicInk,classicLyricLayout,classicMetadataLayout,classicSkipIcon,paper,sollinTokens} from './tokens.ts';
import { ClassicLyrics,ClassicLyricChrome } from './Lyrics.tsx';
import { LyricChoiceModal } from './LyricChoiceModal.tsx';
import { FontSettings } from './FontSettings.tsx';
import { EqualizerSettings } from './EqualizerSettings.tsx';
import { PlayerMenu } from './PlayerMenu.tsx';
import { PlaybackDiagnostics } from './PlaybackDiagnostics.tsx';
import { LyricOffsetPanel, RatePanel, SleepPanel } from './PlaybackSheets.tsx';
import { PlaybackProgress } from './PlaybackProgress.tsx';
import { useStablePlaybackStatus } from './usePlaybackStatus.ts';
import { useEffect, useRef, useState, useSyncExternalStore, type MutableRefObject, type PropsWithChildren } from 'react';
import {Alert, Platform, Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type ViewProps, useWindowDimensions} from 'react-native';
const NativeRoutePicker=requireNativeView<ViewProps&{tint:string;activeTint:string}>('NexusNative','RoutePicker');
const AndroidSystemBarSync=Platform.OS==='android'?requireNativeView<ViewProps&{darkIcons:boolean}>('NexusNative','SystemBarSync'):null;
const layoutLabels={classic:'经典',am:'AM 风格',immersive:'封面沉浸',photo:'写真歌词',vinyl:'黑胶唱机',wave:'声波核',stage:'歌词舞台',am2:'AM2'} as const;
import {DownloadQualityChoice} from './DownloadQualityChoice.tsx';
import {DownloadSubmissionView} from './DownloadSubmission.tsx';
import {downloadableTrack,type DownloadSubmission} from '../app/downloadSubmission.ts';
import {normalizeQuality,qualityOrder,type Quality} from '../domain/quality.ts';
import {Modal,SheetModal} from './AdaptiveModal.tsx';
import {SafeAreaProvider,SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { PlayerLayout } from '../app/preferences.ts';
import { currentEntry, remove, move } from '../domain/queue.ts';

function PlayerScroll({classic,scrollable=false,children}:PropsWithChildren<{classic:boolean;scrollable?:boolean}>){
  const styles=useThemedStyles(makeStyles);
  const body=classic&&!scrollable
    ?<View testID="classic-player-scroll" style={[styles.content,{flex:1,paddingTop:12,paddingBottom:12}]}>{children}</View>
    :<ScrollView testID={classic?'classic-player-scroll':undefined} style={{flex:1}} contentContainerStyle={[styles.content,classic&&{paddingTop:12,paddingBottom:20}]}>{children}</ScrollView>;
  // A full-screen Modal can rotate without rotating its presenting root.
  // Read the native safe area of this window instead of the root's stale insets.
  return classic?<SafeAreaProvider style={{flex:1}}><SafeAreaView style={{flex:1}}>{body}</SafeAreaView></SafeAreaProvider>:body;
}

function time(seconds: number) { return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2, '0')}`; }

function Spectrum({ services }: { services: Services }) {
  const theme=useTheme();const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const state = useSyncExternalStore(services.playback.spectrum.subscribe, services.playback.spectrum.getSnapshot);
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  return <View style={{borderRadius:18,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
      <Text style={{color:s.ink,fontSize:14,fontWeight:'700'}}>实时频谱</Text>
      <Text style={{color:s.muted,fontSize:12}}>{playback.intent==='paused'?'频谱已暂停':state.supported ? '实时音频频谱' : '等待可处理的PCM；此媒体尚未提供频谱/EQ处理能力。'}</Text>
    </View>
    <View accessible={false} style={{height:48,flexDirection:'row',alignItems:'flex-end',gap:3,paddingTop:4}}>{state.bands.map((value, index) => <View key={index} style={{flex:1,borderRadius:2,backgroundColor:s.accent,opacity:playback.intent==='paused'?0.3:0.86,height:Math.max(3, value*44)}} />)}</View>
  </View>;
}

export function Player({ services, fused=false, barVariant='liquid', onSearchArtist }: { services: Services; fused?: boolean; barVariant?: 'liquid'|'frosted'|'acrylic'; onSearchArtist?: (artist: string) => void }) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const {width,height,fontScale}=useWindowDimensions(),landscape=width>height,insets=useSafeAreaInsets();
  const { controller } = services.playback;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const status = useStablePlaybackStatus(state,{resolving:'正在选择音源…',buffering:'缓冲中…'});
  const detailStatus = useStablePlaybackStatus(state,{resolving:'正在跨源解析播放地址…',buffering:'正在缓冲…'});
  const timeline=playbackTimeline(state);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  // Multi-source fallback may land below the preferred quality; say so instead
  // of letting the request tier read as the requested one.
  const reportedQuality=normalizeQuality(state.media?.quality??'');
  const qualityNotice = currentEntry(state.queue)?.track.origin.kind!=='local' && reportedQuality && qualityOrder.indexOf(reportedQuality)>qualityOrder.indexOf(preferences.quality) ? `，已降级为 ${reportedQuality}` : '';
  const fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
  useSyncExternalStore(services.offlineDownloads.subscribe,services.offlineDownloads.getSnapshot);
  const [commenting,setCommenting]=useState<Track|null>(null),[similarTrack,setSimilarTrack]=useState<Track|null>(null);
  const [choosingLyric,setChoosingLyric]=useState(false),[classicLyricRequest,setClassicLyricRequest]=useState(0);
  const [matching,setMatching]=useState<Track|null>(null),[adding,setAdding]=useState<readonly Track[]>([]);
  const [open, setOpen] = useState(false);
  const launchApplied=useRef(false);
  useEffect(()=>{
    if(launchApplied.current||!state.queue.currentId)return;
    launchApplied.current=true;
    if(preferences.openPlayerOnLaunch)setOpen(true);
  },[state.queue.currentId,preferences.openPlayerOnLaunch]);
  useEffect(()=>{
    const active=open&&preferences.keepScreenOn;
    const mod=requireOptionalNativeModule<{setKeepScreenOn?:(enabled:boolean)=>Promise<void>}>('NexusNative');
    void mod?.setKeepScreenOn?.(active)?.catch(()=>{});
    return()=>{if(active)void mod?.setKeepScreenOn?.(false)?.catch(()=>{});};
  },[open,preferences.keepScreenOn]);
  type DetailPanel='menu'|'queue'|'content'|'style'|'lyrics'|'offset'|'eq'|'output'|'globalFont'|'lyricFont'|'download'|'similar'|'diagnostics'|'comments'|'playlist'|'lyricChoice'|'match';
  const [details,setDetails]=useState(false),[detailPanel,setDetailPanel]=useState<DetailPanel>('menu');
  const [returnPanel,setReturnPanel]=useState<DetailPanel|null>(null);
  const [panel,setPanel]=useState<'rate'|'sleep'|null>(null),[panelReturnsToMenu,setPanelReturnsToMenu]=useState(false);
  const closePanel=()=>{setPanel(null);if(panelReturnsToMenu){setPanelReturnsToMenu(false);setDetailPanel('menu');setTimeout(()=>setDetails(true),320);}};
  const [download,setDownload]=useState<{track:Track;returnPanel:'menu'|'content'|null;submitting:boolean;report?:DownloadSubmission;error?:string}|null>(null),downloadSerial=useRef(0);
  useEffect(()=>{
    downloadSerial.current++;setDownload(null);
    if(!open){setDetails(false);setPanel(null);setCommenting(null);setAdding([]);setMatching(null);setChoosingLyric(false);setReturnPanel(null);}
    else if(detailPanel==='download'||detailPanel==='similar')setDetails(false);
  },[open,state.queue.currentId]);
  useEffect(()=>()=>{downloadSerial.current++;},[]);
  const styleReturnsToMenu=useRef(true);
  const miniTouchStart=useRef<{x:number;y:number}|undefined>(undefined);
  const dismissTouchStart=useRef<{x:number;y:number}|undefined>(undefined);
  const playerGestureStart=useRef<{x:number;y:number}|undefined>(undefined);
  const startTouch=(ref:MutableRefObject<{x:number;y:number}|undefined>)=>(event:GestureResponderEvent)=>{ref.current={x:event.nativeEvent.pageX,y:event.nativeEvent.pageY};};
  const finishTouch=(ref:MutableRefObject<{x:number;y:number}|undefined>,direction:'up'|'down',action:()=>void)=>(event:GestureResponderEvent)=>{
    const start=ref.current;ref.current=undefined;if(!start)return;
    const dx=event.nativeEvent.pageX-start.x,dy=event.nativeEvent.pageY-start.y;
    if(Math.abs(dy)>36&&Math.abs(dy)>Math.abs(dx)*1.2&&((direction==='up'&&dy<0)||(direction==='down'&&dy>0)))action();
  };
  const finishPlayerGesture=(event:GestureResponderEvent)=>{
    const start=playerGestureStart.current;playerGestureStart.current=undefined;
    if(!start||details||panel)return;
    const dx=event.nativeEvent.pageX-start.x,dy=event.nativeEvent.pageY-start.y;
    // Left-edge swipe right dismisses any player layout without conflicting with track swipe or lyrics scroll.
    if(start.x<=32&&dx>68&&dx>Math.abs(dy)*1.4){setOpen(false);return;}
    // Top-band swipe down dismisses the full-screen player cleanly without stealing ScrollView/FlatList scrolls.
    const topZone=preferences.playerLayout==='classic'?Math.max(insets.top+88,128):Math.max(insets.top+136,184);
    if(start.y<=topZone&&dy>64&&dy>Math.abs(dx)*1.35){setOpen(false);}
  };
  const entry = currentEntry(state.queue);
  if (!entry) return null;
  const localQuality=entry.track.origin.kind==='local'?`本地 ${typeof entry.track.metadata.localFormat==='string'?entry.track.metadata.localFormat.toUpperCase():'音频'} · 原始文件`:null;
  const match=entry.track.origin.kind==='imported'||entry.track.origin.kind==='online'?services.library.matchFor(entry.track):undefined;
  const actualMatch=state.media?.matchedTrack,lyricTrack=actualMatch??(entry.track.origin.kind==='imported'?match?.target:match?.method==='manual'&&!state.media?match.target:undefined)??entry.track;
  const toggle = () => { if (state.intent === 'playing') controller.pause(); else void controller.play(); };
  const offline=services.offlineDownloads.find(entry.track);
  const submitDownload=async(track:Track,returnPanel:'menu'|'content'|null,preferredQuality?:Quality)=>{
    const serial=++downloadSerial.current;setDownload({track,returnPanel,submitting:true});
    try{const report=await services.submitDownloads([track],preferredQuality?{preferredQuality}:undefined);if(serial===downloadSerial.current)setDownload({track,returnPanel,submitting:false,report});}
    catch{if(serial===downloadSerial.current)setDownload({track,returnPanel,submitting:false,error:'下载提交未完成，请在下载管理检查已有任务。'});}
  };
  const saveOffline=()=>{
    if(!downloadableTrack(entry.track))return;
    const track=entry.track,returnPanel=details&&(detailPanel==='menu'||detailPanel==='content')?detailPanel:null;downloadSerial.current++;setDetailPanel('download');setDetails(true);
    if(track.origin.kind==='online'&&!services.offlineDownloads.find(track))setDownload({track,returnPanel,submitting:false});else void submitDownload(track,returnPanel);
  };
  const returnFromDownload=()=>{const panel=download?.returnPanel;downloadSerial.current++;if(panel){setDownload(null);setDetailPanel(panel);}else setDetails(false);};
  const closeDetails=()=>{downloadSerial.current++;setDetails(false);setCommenting(null);setAdding([]);setMatching(null);setChoosingLyric(false);setReturnPanel(null);};
  const openInSheet=(next:DetailPanel,backTo:DetailPanel|null=details?detailPanel:null)=>{setReturnPanel(backTo);setDetailPanel(next);setDetails(true);};
  const closeSubSheet=()=>{
    const back=returnPanel;setReturnPanel(null);setCommenting(null);setAdding([]);setMatching(null);setChoosingLyric(false);
    if(back)setDetailPanel(back);else setDetails(false);
  };
  const openComments=(target:Track,fromSheet=false)=>{setCommenting(target);openInSheet('comments',fromSheet?detailPanel:null);};
  const openPlaylist=(targets:readonly Track[],fromSheet=false)=>{setAdding(targets);openInSheet('playlist',fromSheet?detailPanel:null);};
  const openMatch=(target:Track,fromSheet=false)=>{setMatching(target);openInSheet('match',fromSheet?detailPanel:null);};
  const openLyricChoice=(fromSheet=false)=>{setChoosingLyric(true);openInSheet('lyricChoice',fromSheet?detailPanel:null);};
  const openQueueSheet=(backTo:DetailPanel|null=null)=>{openInSheet('queue',backTo);};
  const button = (label: string, action: () => void, primary=false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={[styles.button,primary&&{backgroundColor:s.control,borderColor:s.control}]}>
      <Text style={[styles.buttonText,primary&&{color:'#FFFFFF'}]}>{label}</Text>
    </Pressable>
  );
  // Start the pageSheet dismissal before the player tree changes shape. iOS can
  // leave an empty sheet intercepting touches when the presented content is
  // replaced on the same frame the modal begins to close.
  const selectSkin=(id:PlayerLayout)=>{closeDetails();void services.preferences.update({playerLayout:id}).catch(()=>Alert.alert('界面未保存','之前的播放界面保持不变，请重试。'));};
  const skinSelector=(<View style={{gap:14}}>
    <View style={{borderRadius:20,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>
      {([
        ['classic','经典','封面与歌词分栏、原始播放器布局','radio-button-on-outline'],
        ['vinyl','黑胶唱机','旋转黑胶唱片与动态唱针','disc-outline'],
        ['am','AM 风格','根层拖拽展开、动态封面与三态歌词队列','musical-notes-outline'],
        ['am2','AM2','流动封面背景、大字逐词歌词与独立队列面板','pulse-outline'],
        ['immersive','封面沉浸','大封面沉浸、多行歌词与快捷操作','image-outline'],
        ['wave','声波核','环形进度、实时音频频谱环与居中歌词','analytics-outline'],
        ['photo','写真歌词','写真封面、长歌词与轻触快捷操作','person-outline'],
        ['stage','歌词舞台','全屏逐字大字舞台，支持经典/霓虹/赛博/炫彩','text-outline'],
      ] as const).map(([id,title,desc,icon],idx)=>{
        const active=preferences.playerLayout===id;
        return <View key={id}>
          <Pressable testID={`play-skin-${id}`} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{selected:active}} onPress={()=>selectSkin(id)} style={{minHeight:66,paddingHorizontal:16,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'transparent'}}>
            <View style={{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={22} color={active?s.accent:s.ink}/></View>
            <View style={{flex:1,minWidth:0,gap:3}}><Text style={{color:active?s.accent:s.ink,fontWeight:active?'700':'600',fontSize:16}}>{title}</Text><Text numberOfLines={2} style={{color:s.muted,fontSize:12.5,lineHeight:17}}>{desc}</Text></View>
            {active&&<Ionicons name="checkmark" size={20} color={s.accent}/>}
          </Pressable>
          {idx<7&&<View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline,marginLeft:64}}/>}
        </View>;
      })}
    </View>
  </View>);
  const isFav=services.songFavorites.isFavorite(entry.track);
  const canMatch=entry.track.origin.kind==='imported'||entry.track.origin.kind==='online';
  const detailContent=(<View style={{gap:14}}>
    <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <Cover services={services} track={entry.track} size={58} radius={13}/>
        <View style={{flex:1,minWidth:0,gap:3}}>
          <Text numberOfLines={1} style={{color:s.ink,fontSize:17,fontWeight:'700'}}>{entry.track.title}</Text>
          <Text numberOfLines={1} style={{color:s.muted,fontSize:13}}>{entry.track.artist}{entry.track.album?` · ${entry.track.album}`:''}</Text>
          <Text style={{color:s.subtle,fontSize:11.5}}>{localQuality??`偏好 ${preferences.quality} · 成功请求档位 ${state.media?.quality??'待解析'}${qualityNotice}（非实际文件格式证明）`}</Text>
        </View>
      </View>
      {canMatch&&<View style={{paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:s.hairline,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <Text style={{flex:1,color:s.muted,fontSize:12,lineHeight:17}}>{actualMatch?`正在通过 ${actualMatch.origin.kind==='online'?actualMatch.origin.platform:''} · ${actualMatch.title} 播放`:match?.method==='manual'?'已指定版本，重新播放后使用':entry.track.origin.kind==='imported'?'汽水原曲 · 待匹配':'保留原曲，可选择其他录音版本'}</Text>
        {button('匹配歌曲',()=>openMatch(entry.track,true))}
      </View>}
      {!!detailStatus.text&&<Text style={{color:s.accent,fontSize:12.5}}>{detailStatus.text}</Text>}
    </View>

    <Spectrum services={services}/>

    <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
      <Text style={{color:s.ink,fontSize:14,fontWeight:'700'}}>歌曲与歌词操作</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {button(isFav?'取消本地收藏':'本地收藏',()=>{void services.songFavorites.toggle(entry.track).catch(()=>Alert.alert('保存失败','原有收藏保留，请重试。'));})}
        {button('加入歌单',()=>openPlaylist([entry.track],true))}
        {button('歌曲评论',()=>openComments(entry.track,true))}
        {downloadableTrack(entry.track)&&button(offline?.status==='completed'?'已保存离线':offline?.status==='downloading'?'正在保存离线':'保存离线',saveOffline)}
        {button('选择歌词来源',()=>openLyricChoice(true))}
        {button('歌词时间偏移',()=>openInSheet('offset','content'))}
      </View>
    </View>

    <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text style={{color:s.ink,fontSize:14,fontWeight:'700'}}>播放控制</Text>
        <Text style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>{time(timeline.position)} / {time(timeline.duration)}</Text>
      </View>
      <Pressable accessibilityRole="adjustable" accessibilityLabel="播放进度" accessibilityState={{disabled:!timeline.seekable}} accessibilityValue={{ min: 0, max: Math.floor(timeline.duration), now: Math.floor(timeline.position) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => {if(timeline.seekable)controller.seek(state.position+(event.nativeEvent.actionName === 'increment' ? 10 : -10));}}
        onPress={event => { if (timeline.seekable) controller.seek(event.nativeEvent.locationX / 300 * state.duration); }} style={{height:10,borderRadius:5,backgroundColor:s.chip,overflow:'hidden'}}>
        <View style={{height:10,borderRadius:5,backgroundColor:s.accent,width:`${timeline.duration ? Math.min(100, timeline.position/timeline.duration*100) : 0}%`}} />
      </Pressable>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {button('上一首', () => services.playback.next(-1))}
        {button(state.intent === 'playing' ? '暂停' : '播放', toggle, true)}
        {button('下一首', () => services.playback.next())}
        {button('−15秒', () => controller.seek(state.position-15))}
        {button('＋15秒', () => controller.seek(state.position+15))}
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {button(`播放倍速 ${preferences.rate}x`,()=>{setPanelReturnsToMenu(false);closeDetails();setTimeout(()=>setPanel('rate'),260);})}
        {button('睡眠定时器',()=>{setPanelReturnsToMenu(false);closeDetails();setTimeout(()=>setPanel('sleep'),260);})}
        {button(`循环：${preferences.repeat}`, () => { void services.preferences.update({ repeat: preferences.repeat === 'off' ? 'all' : preferences.repeat === 'all' ? 'one' : 'off' }); })}
        {button(`随机：${preferences.shuffle ? '开' : '关'}`, () => { void services.preferences.update({ shuffle: !preferences.shuffle }); })}
      </View>
    </View>

    <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>播放队列 · {state.queue.entries.length} 首</Text>
      </View>
      <QueueView services={services} onOpen={()=>openQueueSheet('content')}/>
      {state.queue.entries.slice(0,5).map((item, index) => <View key={item.id} style={{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:s.hairline,paddingTop:10,flexDirection:'row',gap:8,alignItems:'center'}}>
        <Pressable onPress={() => { void controller.play({ ...state.queue, currentId: item.id, priorityIds: [] }); }} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{fontSize:14,fontWeight:item.id===state.queue.currentId?'700':'500',color:item.id === state.queue.currentId ? s.accent : s.ink}}>{index+1}. {item.track.title}</Text>
          <Text numberOfLines={1} style={{fontSize:12,color:s.muted,marginTop:2}}>{item.track.artist}</Text>
        </Pressable>
        {index > 0 && button('上移', () => controller.setQueue(move(state.queue, item.id, index-1)))}
        {button('移除', () => {
          const queue = remove(state.queue, item.id);
          if (item.id === state.queue.currentId && state.intent === 'playing') void controller.play(queue); else controller.setQueue(queue);
        })}
      </View>)}
    </View>
  </View>);

  const iconButton=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=24,color:string=theme.palette.text,style?:React.ComponentProps<typeof Ionicons>['style'])=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color={color} style={style}/></Pressable>);
  const glyphButton=(glyph:React.ReactNode,label:string,action:()=>void,value?:string)=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value?{text:value}:undefined} onPress={action} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}>{glyph}</Pressable>);
  // IMG_4854: header dots are #423E3C, back/next #403A39, tool glyphs lighter
  // still at #5E514F; dark layouts keep the theme text ink.
  const classicHeaderInk=theme.mode==='dark'?theme.palette.text:paper.iconStrong;
  const classicToolInk=theme.mode==='dark'?theme.palette.text:paper.toolInk;
  // IMG_4854 playlist jar icon: 17.33x23.33pt, two lid rules over a 17.5pt body -> opens PlaylistPicker.
  const playlistJar=(
    <View style={{width:17.5,height:23.4,alignItems:'center'}}>
      <View style={{width:9.5,height:1.2,backgroundColor:classicToolInk}}/>
      <View style={{width:12.9,height:1.2,backgroundColor:classicToolInk,marginTop:1.4}}/>
      <View style={{width:17.5,height:17.1,borderWidth:1.4,borderColor:classicToolInk,borderRadius:4,marginTop:2.5,alignItems:'center',justifyContent:'center'}}><Ionicons name="musical-note" size={10} color={classicToolInk}/></View>
    </View>);
  // Rounded double-triangle ink from the existing official font.
  const skipGlyph=(dir:'back'|'forward')=><View style={{flexDirection:'row',gap:classicSkipIcon.gap}}>{[0,1].map(index=><View key={index} style={{width:classicSkipIcon.triangleWidth,height:classicSkipIcon.lineHeight,alignItems:'center'}}><CupertinoGlyph name="playFill" size={classicSkipIcon.size} color={classicHeaderInk} style={{width:24,lineHeight:classicSkipIcon.lineHeight,textAlign:'center',transform:[{scaleX:dir==='back'?-classicSkipIcon.scaleX:classicSkipIcon.scaleX}]}}/></View>)}</View>;
  const cycleRepeat=()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));};
  // IMG_4854: 308pt square at 430pt width (61pt side margins), transport 70pt play.
  const artworkSide=Math.min(width-122,308);
  const classicHero=<>
    {/* IMG_4854 places the menu dots 5pt higher and 14pt further right than
        the shared 24pt inset; the 35pt row preserves the menu anchor. */}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',height:35}}>
      <Pressable testID="player-drag-handle" accessibilityRole="button" accessibilityLabel="收起播放页" onTouchStart={startTouch(dismissTouchStart)} onTouchEnd={finishTouch(dismissTouchStart,'down',()=>setOpen(false))} onPress={()=>setOpen(false)} style={{minWidth:44,minHeight:44,justifyContent:'center'}}><Ionicons name="chevron-down" size={24} color={theme.palette.secondary}/></Pressable>
      <View style={{marginRight:-14}}>{iconButton('ellipsis-vertical','更多播放控制',()=>{setReturnPanel(null);setDetailPanel('menu');setDetails(true);},theme.mode==='dark'?22:20,theme.mode==='dark'?theme.palette.secondary:classicHeaderInk,{transform:[{translateY:-1.83}]})}</View>
    </View>
    <View testID="classic-artwork" collapsable={false} style={{marginTop:classicArtworkLayout.before,alignSelf:'center',width:artworkSide,height:artworkSide,borderRadius:preferences.coverRadius,overflow:'hidden'}}><PlayerCover services={services} track={entry.track} size={artworkSide}/></View>
    <View style={{marginTop:classicArtworkLayout.titleBefore,alignItems:'center',gap:2}}>
      <Text numberOfLines={1} style={{fontSize:classicMetadataLayout.titleSize,lineHeight:classicMetadataLayout.titleLineHeight,fontWeight:'700',color:theme.mode==='dark'?theme.palette.text:classicInk.text,transform:[{translateY:classicMetadataLayout.titleOffset}]}}>{entry.track.title}</Text>
      {/* IMG_4854: artist ink 493.7..508.3pt is 0.74x the 22pt title, i.e. 17pt. */}
      <Text numberOfLines={1} style={{marginTop:10,fontSize:17,color:theme.mode==='dark'?theme.palette.secondary:classicInk.secondary,transform:[{translateY:classicMetadataLayout.artistOffset}]}}>{entry.track.artist}</Text>
    </View>
    <View style={{marginTop:classicLyricLayout.before,marginBottom:classicLyricLayout.after}}><ClassicLyrics services={services} track={lyricTrack} font={effectiveLyricFont(fonts)} onOpenSettings={()=>setClassicLyricRequest(value=>value+1)}/></View>
    {/* Reference metrics: track 42..388pt, centre 668pt; 17pt artist pushes the
        stack down 3.6pt, so -4.5pt keeps the transport/tools on their anchors. */}
    <View style={{marginHorizontal:18,marginTop:-4.5}}><PlaybackProgress services={services} variant={theme.mode==='dark'?'default':'paper'}/></View>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:24.5,marginTop:2}}>
      {glyphButton(skipGlyph('back'),'上一首',()=>services.playback.next(-1))}
      {/* IMG_4854 pause is two 6.3x22.55pt capsule bars 6.6pt apart, not the Ionicons glyph. */}
      <Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={toggle} style={{width:70,height:70,borderRadius:35,backgroundColor:theme.mode==='dark'?theme.palette.accent:paper.accent,alignItems:'center',justifyContent:'center'}}>{state.intent==='playing'?<View style={{flexDirection:'row',gap:6.6}}><View style={{width:6.3,height:22.55,borderRadius:3.15,backgroundColor:'#FFFFFF'}}/><View style={{width:6.3,height:22.55,borderRadius:3.15,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={30} color="#FFFFFF" style={{marginLeft:4}}/>}</Pressable>
      {glyphButton(skipGlyph('forward'),'下一首',()=>services.playback.next())}
    </View>
    {/* IMG_4854 tool centres run 71.5..358.2pt; 4th icon adds to playlist, 5th opens dedicated queue. */}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:0,marginHorizontal:25.5}}>
      {glyphButton(<Ionicons name="repeat" size={26} color={classicToolInk} style={{transform:[{scaleX:1.047},{scaleY:1.171}]}}/>,`循环：${preferences.repeat}`,cycleRepeat)}
      {glyphButton(<Ionicons name="chatbubbles-outline" size={20} color={classicToolInk} style={{transform:[{scaleX:-1.164},{scaleY:.957}]}}/>,'歌曲评论',()=>openComments(entry.track,false))}
      {glyphButton(<MaterialIcons name={isFav?'favorite':'favorite-border'} size={24} color={classicToolInk}/>,'收藏歌曲',()=>{void services.songFavorites.toggle(entry.track).catch(()=>Alert.alert('保存失败','原有收藏保留，请重试。'));},isFav?'已收藏':'未收藏')}
      <Pressable accessibilityRole="button" accessibilityLabel="加入歌单" onPress={()=>openPlaylist([entry.track],false)} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}>{playlistJar}</Pressable>
      {glyphButton(<MaterialIcons name="format-list-bulleted" size={24} color={classicToolInk} style={{transform:[{scaleX:1.091}]}}/>,'查看播放队列',()=>openQueueSheet(null))}
    </View>
    {/* Kept above the safe-area fold (932pt screen, ~898pt viewport) so the
        reference's last line stays crisp on a single clean non-scrolling screen. */}
    <Text style={{textAlign:'center',marginTop:-9,fontSize:11,color:theme.palette.secondary}}>{status.text?status.text:(localQuality??`${preferences.quality} 档位 · ${state.media?.quality??'待解析'}${qualityNotice} 实际请求`)}</Text>
    <ClassicLyricChrome chrome={false} services={services} track={lyricTrack} font={effectiveLyricFont(fonts)} openRequest={classicLyricRequest}/>
  </>;
  const miniInner=<View style={[styles.mini,fontScale>1.45&&{flexWrap:'wrap'}]}>
      <View style={{width:40,height:40,borderRadius:10,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
        <Cover services={services} track={entry.track} size={40} radius={10}/>
      </View>
      <View style={{flex:1,minWidth:80}}><Pressable accessibilityRole="button" accessibilityLabel="打开播放页" onPress={()=>setOpen(true)} style={{minHeight:40,justifyContent:'center'}}>
        <Text numberOfLines={1} style={[styles.track,{color:s.ink,fontSize:14,fontWeight:'600',lineHeight:19}]}>{entry.track.title}{preferences.miniLyrics&&!open&&entry.track.artist?<Text style={{color:s.muted,fontWeight:'400',fontSize:12.5}}> · {entry.track.artist}</Text>:null}</Text>
        {(!preferences.miniLyrics||open)&&<Text numberOfLines={1} style={[styles.caption,{color:s.muted,fontSize:12,lineHeight:16}]}>{entry.track.artist}{status.text?` · ${status.text}`:''}</Text>}
      </Pressable>{preferences.miniLyrics&&!open&&<MiniLyric key={entry.id} services={services} track={lyricTrack}/>}</View>
      <View style={{flexDirection:'row',flexShrink:0,alignItems:'center',gap:2}}>{preferences.miniActions.map(action=>{
        if(action==='queue')return <QueueView key={action} services={services} compact/>;
        const favorite=isFav,label=action==='toggle'?(state.intent==='playing'?'暂停':'播放'):miniActionLabels[action];
        const icon=action==='toggle'?(state.intent==='playing'?'pause':'play'):favorite?'heart':'heart-outline';
        return <Pressable key={action} testID={`mini-action-${action}`} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={action==='favorite'?{text:favorite?'已收藏':'未收藏'}:undefined} onPress={()=>{
          if(action==='toggle')toggle();else if(action==='previous')services.playback.next(-1);else if(action==='next')services.playback.next();else void services.songFavorites.toggle(entry.track).catch(()=>Alert.alert('收藏未保存','原有数据保留，请重试。'));
        }} style={{minWidth:40,minHeight:44,alignItems:'center',justifyContent:'center'}}>{action==='previous'||action==='next'?<SkipGlyph direction={action==='previous'?'back':'forward'} width={15} height={18} gap={2.5} color={s.ink}/>:<Ionicons name={icon} size={action==='toggle'?22:20} color={action==='favorite'&&favorite?s.accent:s.ink}/>}</Pressable>;
      })}</View>
    </View>;
  const handleArtistPress=onSearchArtist?(artist:string)=>{setOpen(false);onSearchArtist(artist);}:undefined;
  return <>
    <View testID="mini-player" onTouchStart={startTouch(miniTouchStart)} onTouchEnd={finishTouch(miniTouchStart,'up',()=>setOpen(true))}>{fused?miniInner:<GlassSurface variant={barVariant} radius={28}>{miniInner}</GlassSurface>}</View>
    <Modal visible={open} animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
      {open&&<StatusBar hidden={preferences.fullScreenMode} style={preferences.playerLayout==='vinyl'?'dark':preferences.playerLayout!=='classic'?'light':theme.mode==='dark'?'light':'dark'}/>}
      {open&&AndroidSystemBarSync&&<AndroidSystemBarSync pointerEvents="none" darkIcons={preferences.playerLayout==='vinyl'?true:preferences.playerLayout!=='classic'?false:theme.mode!=='dark'} style={{position:'absolute',width:0,height:0}}/>}
      <View onTouchStart={startTouch(playerGestureStart)} onTouchEnd={finishPlayerGesture} style={{flex:1,backgroundColor:preferences.playerLayout==='classic'?theme.palette.background[0]:preferences.playerLayout==='vinyl'?paper.background:preferences.playerLayout==='stage'?'#060607':'#183647'}}>
      {open&&(preferences.playerLayout==='classic'?<AmbientBackground services={services} gradient={theme.mode==='light'&&theme.appearance.visualTheme==='blush'?classicBlushBackground:undefined}/>:preferences.playerLayout==='vinyl'||preferences.playerLayout==='stage'?null:<ArtworkBackdrop services={services} track={actualMatch??entry.track} photo={preferences.playerLayout==='photo'}/>)}
      {preferences.playerLayout!=='classic'?<View style={{flex:1,paddingHorizontal:(preferences.playerLayout==='vinyl'||preferences.playerLayout==='immersive')?0:landscape?60:24,paddingTop:(preferences.playerLayout==='vinyl'||preferences.playerLayout==='immersive')?0:landscape?12:Platform.OS==='android'&&preferences.playerLayout==='wave'?Math.max(insets.top+48,76):55,paddingBottom:(preferences.playerLayout==='vinyl'||preferences.playerLayout==='immersive')?0:20}}>
        {preferences.playerLayout==='am2'&&<View pointerEvents="none" style={{position:'absolute',top:landscape?10:Math.max(insets.top+10,54),left:0,right:0,alignItems:'center',zIndex:2}}><View style={{width:38,height:4.5,borderRadius:2.25,backgroundColor:'rgba(255,255,255,0.36)'}}/></View>}
        <Pressable testID="player-drag-handle" accessibilityRole="button" accessibilityLabel="收起播放页" onTouchStart={startTouch(dismissTouchStart)} onTouchEnd={finishTouch(dismissTouchStart,'down',()=>setOpen(false))} onPress={()=>setOpen(false)} style={{position:'absolute',top:landscape?8:preferences.playerLayout==='vinyl'?Math.max(insets.top+6,58):Platform.OS==='android'&&preferences.playerLayout==='wave'?Math.max(insets.top+2,30):Math.max(insets.top+4,52),left:preferences.playerLayout==='vinyl'||preferences.playerLayout==='immersive'||preferences.playerLayout==='am'||preferences.playerLayout==='am2'?16:10,minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',zIndex:4}}>
          {preferences.playerLayout==='immersive'||preferences.playerLayout==='am'||preferences.playerLayout==='am2'?<View style={{width:36,height:36,borderRadius:18,backgroundColor:preferences.playerLayout==='immersive'?'rgba(0,0,0,0.28)':'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'}}><Ionicons name="chevron-down" color="#FFFFFF" size={22}/></View>:preferences.playerLayout==='vinyl'?<View style={{width:36,height:36,borderRadius:18,backgroundColor:'rgba(66,62,60,0.07)',alignItems:'center',justifyContent:'center'}}><Ionicons name="chevron-down" color={paper.icon} size={22}/></View>:<Ionicons name="chevron-down" color={preferences.playerLayout==='photo'?'rgba(255,255,255,0.82)':'#FFFFFF'} size={26}/>}
        </Pressable>
        {(preferences.playerLayout==='wave'||preferences.playerLayout==='immersive'||preferences.playerLayout==='am2')&&<Pressable accessibilityRole="button" accessibilityLabel="选择歌词来源" onPress={()=>openLyricChoice(false)} style={{position:'absolute',top:landscape?8:Platform.OS==='android'&&preferences.playerLayout==='wave'?Math.max(insets.top+2,30):Math.max(insets.top+4,52),right:16,minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',zIndex:4}}>{preferences.playerLayout==='immersive'||preferences.playerLayout==='am2'?<View style={{width:36,height:36,borderRadius:18,backgroundColor:preferences.playerLayout==='immersive'?'rgba(0,0,0,0.28)':'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'}}><Ionicons name="language-outline" size={19} color="rgba(255,255,255,0.86)"/></View>:<Ionicons name="language-outline" size={20} color="rgba(255,255,255,0.68)"/>}</Pressable>}
        {open&&<ModernPlayer key={JSON.stringify([entry.id,lyricTrack.origin,lyricTrack.metadata.davVersion])} services={services} track={actualMatch??entry.track} favoriteTrack={entry.track} lyricTrack={lyricTrack} font={effectiveLyricFont(fonts)} layout={preferences.playerLayout} visible={!details} onMore={()=>{setReturnPanel(null);setDetailPanel('menu');setDetails(true);}} onStyle={()=>{styleReturnsToMenu.current=false;setReturnPanel(null);setDetailPanel('style');setDetails(true);}} onLyricsSettings={()=>{setReturnPanel(null);setDetailPanel('lyrics');setDetails(true);}} onLyricSource={()=>openLyricChoice(false)} onQueue={()=>openQueueSheet(null)} onComments={()=>openComments(actualMatch??entry.track,false)} onSleep={()=>{setPanelReturnsToMenu(false);setPanel('sleep');}} onPlaylist={()=>openPlaylist([entry.track],false)} onArtistPress={handleArtistPress}/>}
      </View>:<PlayerScroll classic scrollable={landscape||fontScale>1.35}>
        {classicHero}
      </PlayerScroll>}</View>
      <SheetModal allowSwipeDismissal={detailPanel==='comments'||detailPanel==='queue'} visible={details&&open} animationType="slide" onRequestClose={closeDetails} onDismiss={()=>{if(detailPanel==='download')setDownload(null);}}>
        {details&&<StatusBar style={theme.mode==='dark'?'light':'dark'}/>}
        {details&&AndroidSystemBarSync&&<AndroidSystemBarSync pointerEvents="none" darkIcons={theme.mode!=='dark'} style={{position:'absolute',width:0,height:0}}/>}
        <View style={{flex:1}}>
          <LinearGradient colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        {detailPanel==='queue'?<QueuePanel services={services} inSheet onClose={closeSubSheet}/>:detailPanel==='comments'?<SafeAreaProvider><SafeAreaView style={{flex:1}} edges={['bottom']}><View style={{alignSelf:'center',width:36,height:4,borderRadius:2,backgroundColor:s.subtle+'66',marginTop:10}}/><CommentsModal services={services} track={commenting} embedded onClose={closeSubSheet}/></SafeAreaView></SafeAreaProvider>:detailPanel==='playlist'?<PlaylistPicker services={services} tracks={adding} visible={adding.length>0} inline onClose={closeSubSheet}/>:detailPanel==='lyricChoice'?<LyricChoiceModal services={services} track={choosingLyric?lyricTrack:null} inline onClose={closeSubSheet}/>:detailPanel==='match'?<MatchModal services={services} track={matching} inline onClose={closeSubSheet}/>:detailPanel==='similar'&&similarTrack?<SimilarSongs services={services} track={similarTrack} renderSongActions={(song,close)=><TrackActions services={services} track={song} prefix="similar" extras onClose={close} onSearchArtist={handleArtistPress}/>} backLabel="返回播放选项" onBack={()=>setDetailPanel('menu')} onSelect={(tracks,index)=>{closeDetails();services.playTracks(tracks,index);}}/>:detailPanel==='download'&&download?(download.report?<DownloadSubmissionView services={services} report={download.report} backLabel={download.returnPanel==='menu'?'返回播放选项':download.returnPanel==='content'?'返回队列与播放选项':'返回播放页'} onClose={returnFromDownload}/>:download.track.origin.kind==='online'&&!download.submitting&&!download.error?<DownloadQualityChoice services={services} track={download.track} busy={false} backLabel={download.returnPanel==='menu'?'返回播放选项':download.returnPanel==='content'?'返回队列与播放选项':'返回播放页'} onBack={returnFromDownload} onConfirm={q=>{void submitDownload(download.track,download.returnPanel,q);}}/>:<View style={{flex:1,padding:24,gap:16}}>{button(download.returnPanel==='menu'?'返回播放选项':download.returnPanel==='content'?'返回队列与播放选项':'返回播放页',returnFromDownload)}<Text style={styles.title}>{download.track.title}</Text><Text accessibilityRole={download.error?'alert':undefined} style={styles.caption}>{download.error??'正在提交下载任务…'}</Text></View>):<ScrollView testID="player-details-scroll" key={detailPanel} style={{flex:1}} contentContainerStyle={detailPanel==='menu'||detailPanel==='offset'?{flexGrow:1}:{paddingHorizontal:18,paddingTop:14,paddingBottom:36,gap:16}}>
          {detailPanel==='style'?<>
            <Pressable accessibilityRole="button" accessibilityLabel="收起播放界面样式" onPress={()=>{if(styleReturnsToMenu.current)setDetailPanel('menu');else closeDetails();}} style={{alignSelf:'center',paddingVertical:8,paddingHorizontal:28}}><View style={{width:38,height:4.5,borderRadius:2.25,backgroundColor:s.dark?'rgba(255,255,255,0.28)':'rgba(60,48,50,0.26)'}}/></Pressable>
            <Text style={{color:s.ink,fontSize:26,fontWeight:'700',letterSpacing:-0.3}}>播放界面样式</Text>{skinSelector}
          </>:detailPanel==='offset'?<LyricOffsetPanel services={services} track={lyricTrack} onBack={()=>setDetailPanel(returnPanel??'menu')}/>:detailPanel==='eq'?<>
            <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={()=>setDetailPanel('menu')} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}><Ionicons name="chevron-back" size={16} color={s.ink}/><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>返回播放选项</Text></Pressable>
            <EqualizerSettings services={services}/>
          </>:detailPanel==='output'?<>
            <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={()=>setDetailPanel('menu')} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}><Ionicons name="chevron-back" size={16} color={s.ink}/><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>返回播放选项</Text></Pressable>
            <Text style={{color:s.ink,fontSize:24,fontWeight:'700'}}>音频输出设备</Text>
            <View style={{borderRadius:20,padding:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <View style={{flex:1,gap:4}}>
                <Text style={{color:s.ink,fontSize:16,fontWeight:'600'}}>AirPlay 与蓝牙音频</Text>
                <Text style={{color:s.muted,fontSize:12.5}}>轻触右侧图标切换当前系统音频输出设备</Text>
              </View>
              <NativeRoutePicker tint={s.ink} activeTint={s.accent} pointerEvents="auto" style={{width:44,height:44}}/>
            </View>
            <View style={{borderRadius:20,padding:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12}}>
              <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>应用内播放音量 · {Math.round(preferences.volume*100)}%</Text>
              <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
                {[0.25,0.5,0.75,1].map(v=>{const active=Math.abs(preferences.volume-v)<0.04;return <Pressable key={v} accessibilityRole="button" onPress={()=>{void services.preferences.update({volume:v}).catch(()=>{});}} style={{flex:1,minWidth:64,minHeight:42,borderRadius:12,backgroundColor:active?s.accentSoft:s.chip,borderWidth:1,borderColor:active?s.accent:s.cardBorder,alignItems:'center',justifyContent:'center'}}><Text style={{color:active?s.accent:s.ink,fontSize:13,fontWeight:'600'}}>{Math.round(v*100)}%</Text></Pressable>;})}
              </View>
            </View>
          </>:detailPanel==='diagnostics'?<>
            <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={()=>setDetailPanel('menu')} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}><Ionicons name="chevron-back" size={16} color={s.ink}/><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>返回播放选项</Text></Pressable>
            <PlaybackDiagnostics services={services}/>
          </>:detailPanel==='lyrics'||detailPanel==='globalFont'||detailPanel==='lyricFont'?<>
            <Pressable accessibilityRole="button" accessibilityLabel={detailPanel==='lyrics'?'收起歌词显示设置':'返回歌词设置'} onPress={()=>setDetailPanel(detailPanel==='lyrics'?'menu':'lyrics')} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}><Ionicons name="chevron-back" size={16} color={s.ink}/><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{detailPanel==='lyrics'?'收起歌词显示设置':'返回歌词设置'}</Text></Pressable>
            <Text style={{color:s.ink,fontSize:24,fontWeight:'700'}}>{detailPanel==='lyrics'?'歌词显示设置':detailPanel==='globalFont'?'全局字体':'歌词字体'}</Text>{detailPanel==='lyrics'&&<Pressable accessibilityRole="button" accessibilityLabel="选择歌词来源" onPress={()=>openLyricChoice(true)} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingVertical:11,borderRadius:999,backgroundColor:s.control}}><Ionicons name="search-outline" size={16} color="#FFFFFF"/><Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'600'}}>选择歌词来源</Text></Pressable>}<FontSettings services={services} section={detailPanel==='lyrics'?'display':detailPanel==='globalFont'?'global':'lyric'} onOpen={section=>setDetailPanel(section==='display'?'lyrics':section==='global'?'globalFont':'lyricFont')}/>
          </>:detailPanel==='menu'?<PlayerMenu services={services} track={actualMatch??entry.track} favoriteTrack={entry.track} layoutLabel={layoutLabels[preferences.playerLayout]??'经典'} queueCount={state.queue.entries.length} onClose={closeDetails} onStyle={()=>{styleReturnsToMenu.current=true;setDetailPanel('style');}} onLyricsSettings={()=>setDetailPanel('lyrics')} onLyricSource={()=>openLyricChoice(true)} onAllLyrics={preferences.playerLayout==='classic'?()=>{closeDetails();setTimeout(()=>setClassicLyricRequest(v=>v+1),320);}:undefined} onLyricOffset={()=>openInSheet('offset','menu')} onEQ={()=>setDetailPanel('eq')} onAudioOutput={()=>setDetailPanel('output')} onQueue={()=>setDetailPanel('content')} onMatch={canMatch?()=>openMatch(entry.track,true):undefined} onRate={()=>{setPanelReturnsToMenu(true);closeDetails();setTimeout(()=>setPanel('rate'),320);}} onSleep={()=>{setPanelReturnsToMenu(true);closeDetails();setTimeout(()=>setPanel('sleep'),320);}} onSimilar={supportsSimilarSongs(actualMatch??entry.track)?()=>{setSimilarTrack(actualMatch??entry.track);setDetailPanel('similar');}:undefined} onComments={()=>openComments(actualMatch??entry.track,true)} onPlaylist={()=>openPlaylist([entry.track],true)} onDownload={downloadableTrack(entry.track)?saveOffline:undefined} onDiagnostics={()=>setDetailPanel('diagnostics')} downloadLabel={offline?.status==='completed'?'已下载':offline?.status==='downloading'?'下载中':'下载'}/>:<>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
              <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={()=>setDetailPanel('menu')} style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}><Ionicons name="chevron-back" size={16} color={s.ink}/><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>返回播放选项</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="收起播放选项" onPress={closeDetails} style={{paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>收起播放选项</Text></Pressable>
            </View>
            <Text style={{color:s.ink,fontSize:24,fontWeight:'700'}}>队列与播放选项</Text>{detailContent}
          </>}
        </ScrollView>}
        </View>
      </SheetModal>
      {open&&panel&&<View style={{position:'absolute',left:0,right:0,top:0,bottom:0}}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭面板" onPress={()=>{setPanelReturnsToMenu(false);setPanel(null);}} style={{flex:1,backgroundColor:'rgba(24,18,16,0.28)'}}/>
        <SafeAreaView edges={['bottom']} style={{maxHeight:'86%',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'}}>
          <LinearGradient colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
          <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.dark?'rgba(255,255,255,0.28)':'rgba(60,48,50,0.26)',marginTop:10}}/>
          <ScrollView testID="playback-control-panel-scroll" contentContainerStyle={{paddingBottom:20}}>
            {panel==='rate'?<RatePanel services={services} onBack={closePanel}/>:<SleepPanel services={services} onBack={closePanel}/>}
          </ScrollView>
        </SafeAreaView>
      </View>}
    </Modal>
  </>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color('#111318') }, content: { padding: 24, paddingTop: 65, gap: 18 },
  mini: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { color: theme.color('#E8E9E4'), fontSize: 14, lineHeight: 21 }, caption: { color: theme.color('#959EAC'), fontSize: 11, lineHeight: 20 },
  title: { color: theme.color('#F1EDE7'), fontSize: 24, fontWeight: '700' }, artist: { color: theme.color('#BFC8D9'), fontSize: 16 },
  button: { backgroundColor: theme.mode==='dark'?'rgba(255,255,255,0.09)':'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: theme.mode==='dark'?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.88)', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999 }, buttonText: { color: theme.palette.text, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, error: { color: theme.color('#D6B69A'), fontSize: 12 },
});
