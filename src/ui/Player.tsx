import {miniActionLabels} from '../domain/miniPlayer.ts';
import {MiniLyric} from './MiniLyric.tsx';
import {effectiveLyricFont} from '../storage/fontCatalog.ts';
import {Text} from './Typography.tsx';
import {CommentsModal} from './CommentsModal.tsx';
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {AmbientBackground,GlassSurface} from './Materials.tsx';
import {ArtworkBackdrop,ModernPlayer} from './ModernPlayer.tsx';
import {Cover} from './Cover.tsx';
import {MatchModal} from './MatchModal.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import type {Track} from '../domain/track.ts';
import {QueueView} from './QueueView.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { Lyrics } from './Lyrics.tsx';
import { FontSettings } from './FontSettings.tsx';
import { useEffect, useRef, useState, useSyncExternalStore, type MutableRefObject, type PropsWithChildren } from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, useWindowDimensions} from 'react-native';
import {Modal,SheetModal} from './AdaptiveModal.tsx';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { PlayerLayout } from '../app/preferences.ts';
import { currentEntry, remove, move } from '../domain/queue.ts';
function PlayerScroll({classic,children}:PropsWithChildren<{classic:boolean}>){
  const styles=useThemedStyles(makeStyles);
  const scroll=<ScrollView testID={classic?'classic-player-scroll':undefined} style={{flex:1}} contentContainerStyle={[styles.content,classic&&{paddingTop:12}]}>{children}</ScrollView>;
  // A full-screen Modal can rotate without rotating its presenting root.
  // Read the native safe area of this window instead of the root's stale insets.
  return classic?<SafeAreaProvider style={{flex:1}}><SafeAreaView style={{flex:1}}>{scroll}</SafeAreaView></SafeAreaProvider>:scroll;
}
function time(seconds: number) { return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2, '0')}`; }
function Spectrum({ services }: { services: Services }) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const state = useSyncExternalStore(services.playback.spectrum.subscribe, services.playback.spectrum.getSnapshot);
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  return <View>
    <View accessible={false} style={styles.spectrum}>{state.bands.map((value, index) => <View key={index} style={[styles.bar, { height: Math.max(2, value*72) }]} />)}</View>
    <Text style={styles.caption}>{playback.intent==='paused'?'频谱已暂停':state.supported ? '实时音频频谱' : '等待可处理的PCM；此媒体尚未提供频谱/EQ处理能力。'}</Text>
  </View>;
}
export function Player({ services }: { services: Services }) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const {width,height}=useWindowDimensions(),landscape=width>height;
  const { controller } = services.playback;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [commenting,setCommenting]=useState<Track|null>(null);
  const [matching,setMatching]=useState<Track|null>(null),[adding,setAdding]=useState<readonly Track[]>([]);
  const [open, setOpen] = useState(false);
  const [details,setDetails]=useState(false),[detailPanel,setDetailPanel]=useState<'menu'|'content'|'style'|'lyrics'|'globalFont'|'lyricFont'>('menu');
  const styleReturnsToMenu=useRef(true);
  const miniTouchStart=useRef<{x:number;y:number}|undefined>(undefined);
  const dismissTouchStart=useRef<{x:number;y:number}|undefined>(undefined);
  const startTouch=(ref:MutableRefObject<{x:number;y:number}|undefined>)=>(event:GestureResponderEvent)=>{ref.current={x:event.nativeEvent.pageX,y:event.nativeEvent.pageY};};
  const finishTouch=(ref:MutableRefObject<{x:number;y:number}|undefined>,direction:'up'|'down',action:()=>void)=>(event:GestureResponderEvent)=>{
    const start=ref.current;ref.current=undefined;if(!start)return;
    const dx=event.nativeEvent.pageX-start.x,dy=event.nativeEvent.pageY-start.y;
    if(Math.abs(dy)>36&&Math.abs(dy)>Math.abs(dx)*1.2&&((direction==='up'&&dy<0)||(direction==='down'&&dy>0)))action();
  };
  const entry = currentEntry(state.queue);
  if (!entry) return null;
  const match=entry.track.origin.kind==='imported'||entry.track.origin.kind==='online'?services.library.matchFor(entry.track):undefined;
  const actualMatch=state.media?.matchedTrack,lyricTrack=actualMatch??(entry.track.origin.kind==='imported'?match?.target:match?.method==='manual'&&!state.media?match.target:undefined)??entry.track;
  const toggle = () => { if (state.intent === 'playing') controller.pause(); else void controller.play(); };
  const offline=services.offlineDownloads.find(entry.track);
  const saveOffline=()=>{void services.offlineDownloads.enqueue(entry.track).then(item=>services.offlineDownloads.start(item.id)).catch(()=>Alert.alert('离线保存失败','当前来源无法保存或存储空间不足，原有数据保留。'));};
  const closeDetails=()=>setDetails(false);
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const selectSkin=(id:PlayerLayout)=>{void services.preferences.update({playerLayout:id}).then(closeDetails).catch(()=>Alert.alert('界面未保存','之前的播放界面保持不变，请重试。'));};
  const skinSelector=(<View style={{gap:10}}><Text style={styles.caption}>选择后立即应用，播放进度和播放意图保持不变。</Text><View style={{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:theme.palette.border}}>{([['classic','经典','albums-outline'],['am','AM 风格','musical-notes-outline'],['immersive','封面沉浸','image-outline'],['photo','写真歌词','person-outline'],['vinyl','黑胶唱机','disc-outline'],['wave','声波核','pulse-outline'],['stage','歌词舞台','text-outline'],['am2','AM2','reader-outline']] as const).map(([id,title,icon])=><Pressable key={id} testID={`play-skin-${id}`} accessibilityRole="radio" accessibilityState={{selected:preferences.playerLayout===id}} onPress={()=>selectSkin(id)} style={{minHeight:64,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:14,borderBottomWidth:id==='am2'?0:1,borderBottomColor:theme.palette.border,backgroundColor:preferences.playerLayout===id?theme.palette.selected:theme.palette.surface}}><View style={{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:preferences.playerLayout===id?theme.palette.accent:theme.palette.selected}}><Ionicons name={icon} size={19} color={preferences.playerLayout===id?theme.palette.surface:theme.palette.accent}/></View><Text style={{flex:1,color:preferences.playerLayout===id?theme.palette.accent:theme.palette.text,fontWeight:preferences.playerLayout===id?'600':'400',fontSize:15}}>{title}</Text><Ionicons name={preferences.playerLayout===id?'checkmark-circle':'chevron-forward'} size={21} color={preferences.playerLayout===id?theme.palette.accent:theme.palette.secondary}/></Pressable>)}</View></View>);
  const detailContent=(<>
        <Cover services={services} track={entry.track} size={240}/>
        <Text style={styles.title}>{entry.track.title}</Text><Text style={styles.artist}>{entry.track.artist}</Text><Text style={styles.caption}>{entry.track.album}</Text>
        <Text style={styles.caption}>偏好 {preferences.quality} · 成功请求档位 {state.media?.quality ?? '待解析'}（非实际文件格式证明）</Text>
        <Spectrum services={services} />
        {(entry.track.origin.kind==='imported'||entry.track.origin.kind==='online')&&<View style={styles.row}><Text style={styles.caption}>{actualMatch?`正在通过 ${actualMatch.origin.kind==='online'?actualMatch.origin.platform:''} · ${actualMatch.title} 播放`:match?.method==='manual'?'已指定版本，重新播放后使用':entry.track.origin.kind==='imported'?'汽水原曲 · 待匹配':'保留原曲，可选择其他录音版本'}</Text>{button('匹配歌曲',()=>setMatching(entry.track))}</View>}
        {open&&preferences.playerLayout==='classic'&&<Lyrics services={services} track={lyricTrack} font={effectiveLyricFont(fonts)}/>}
        <View style={styles.row}>{button(services.library.isFavorite(entry.track)?'取消本地收藏':'本地收藏',()=>{void services.library.favorite(entry.track).catch(()=>Alert.alert('保存失败','原有收藏保留，请重试。'));})}{button('加入歌单',()=>setAdding([entry.track]))}{button('歌曲评论',()=>setCommenting(entry.track))}{button(offline?.status==='completed'?'已保存离线':offline?.status==='downloading'?'正在保存离线':'保存离线',saveOffline)}</View>
        <Text style={styles.error}>{state.error ?? (state.phase === 'resolving' ? '正在跨源解析播放地址…' : state.buffering ? '正在缓冲…' : '')}</Text>
        <Pressable accessibilityRole="adjustable" accessibilityLabel="播放进度" accessibilityValue={{ min: 0, max: Math.floor(state.duration), now: Math.floor(state.position) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => controller.seek(state.position+(event.nativeEvent.actionName === 'increment' ? 10 : -10))}
          onPress={event => { if (state.duration) controller.seek(event.nativeEvent.locationX / 300 * state.duration); }} style={styles.progress}>
          <View style={[styles.fill, { width: `${state.duration ? Math.min(100, state.position/state.duration*100) : 0}%` }]} />
        </Pressable>
        <Text style={styles.caption}>{time(state.position)} / {time(state.duration)}</Text>
        <View style={styles.row}>{button('上一首', () => services.playback.next(-1))}{button(state.intent === 'playing' ? '暂停' : '播放', toggle)}{button('下一首', () => services.playback.next())}</View>
        <View style={styles.row}>{button('−15秒', () => controller.seek(state.position-15))}{button('＋15秒', () => controller.seek(state.position+15))}</View>
        <View style={styles.row}>
          {button(`循环：${preferences.repeat}`, () => { void services.preferences.update({ repeat: preferences.repeat === 'off' ? 'all' : preferences.repeat === 'all' ? 'one' : 'off' }); })}
          {button(`随机：${preferences.shuffle ? '开' : '关'}`, () => { void services.preferences.update({ shuffle: !preferences.shuffle }); })}
        </View>
        <Text style={styles.artist}>播放队列 · {state.queue.entries.length}</Text>
        <QueueView services={services}/>
        {state.queue.entries.slice(0,5).map((item, index) => <View key={item.id} style={styles.queueRow}>
          <Pressable onPress={() => { void controller.play({ ...state.queue, currentId: item.id, priorityIds: [] }); }} style={{ flex: 1 }}><Text style={[styles.track, item.id === state.queue.currentId && styles.current]}>{index+1}. {item.track.title}</Text><Text style={styles.caption}>{item.track.artist}</Text></Pressable>
          {index > 0 && button('上移', () => controller.setQueue(move(state.queue, item.id, index-1)))}
          {button('移除', () => {
            const queue = remove(state.queue, item.id);
            if (item.id === state.queue.currentId && state.intent === 'playing') void controller.play(queue); else controller.setQueue(queue);
          })}
        </View>)}
  </>);
  return <>
    <View testID="mini-player" onTouchStart={startTouch(miniTouchStart)} onTouchEnd={finishTouch(miniTouchStart,'up',()=>setOpen(true))}><GlassSurface><View style={styles.mini}>
      <Cover services={services} track={entry.track} size={44}/>
      <View style={{flex:1,minWidth:80}}><Pressable accessibilityRole="button" accessibilityLabel="打开播放页" onPress={()=>setOpen(true)} style={{minHeight:44,justifyContent:'center'}}>
        <Text numberOfLines={1} style={styles.track}>{entry.track.title}</Text>{(!preferences.miniLyrics||open)&&<Text numberOfLines={1} style={styles.caption}>{entry.track.artist} · {state.phase==='resolving'?'正在选择音源…':state.error??(state.buffering?'缓冲中…':time(state.position))}</Text>}
      </Pressable>{preferences.miniLyrics&&!open&&<MiniLyric key={JSON.stringify(lyricTrack.origin)} services={services} track={lyricTrack}/>}</View><View style={{flexDirection:'row',flexShrink:0,alignItems:'center'}}>{preferences.miniActions.map(action=>{
        if(action==='queue')return <QueueView key={action} services={services} compact/>;
        const favorite=services.library.isFavorite(entry.track),label=action==='toggle'?(state.intent==='playing'?'暂停':'播放'):miniActionLabels[action];
        const icon=action==='previous'?'play-skip-back':action==='toggle'?(state.intent==='playing'?'pause':'play'):action==='next'?'play-skip-forward':favorite?'heart':'heart-outline';
        return <Pressable key={action} testID={`mini-action-${action}`} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={action==='favorite'?{text:favorite?'已收藏':'未收藏'}:undefined} onPress={()=>{
          if(action==='toggle')toggle();else if(action==='previous')services.playback.next(-1);else if(action==='next')services.playback.next();else void services.library.favorite(entry.track).catch(()=>Alert.alert('收藏未保存','原有数据保留，请重试。'));
        }} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={24} color={theme.palette.text}/></Pressable>;
      })}</View>
    </View></GlassSurface></View>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      {open&&<StatusBar style={preferences.playerLayout!=='classic'?'light':theme.mode==='dark'?'light':'dark'}/>}
      <View style={{flex:1,backgroundColor:preferences.playerLayout==='classic'?theme.palette.background[0]:'#183647'}}>
      {open&&(preferences.playerLayout==='classic'?<AmbientBackground services={services}/>:<ArtworkBackdrop services={services} track={actualMatch??entry.track} photo={preferences.playerLayout==='photo'}/>)}
      {preferences.playerLayout==='am2'?<View style={{flex:1,paddingHorizontal:landscape?60:24,paddingTop:landscape?12:55,paddingBottom:20}}><Pressable testID="player-drag-handle" accessibilityRole="button" accessibilityLabel="收起播放页" onTouchStart={startTouch(dismissTouchStart)} onTouchEnd={finishTouch(dismissTouchStart,'down',()=>setOpen(false))} onPress={()=>setOpen(false)} style={{minHeight:44,justifyContent:'center'}}><Ionicons name="chevron-down" color="#FFFFFF" size={28}/></Pressable>{open&&<ModernPlayer key={JSON.stringify([entry.id,lyricTrack.origin,lyricTrack.metadata.davVersion])} services={services} track={actualMatch??entry.track} favoriteTrack={entry.track} lyricTrack={lyricTrack} font={effectiveLyricFont(fonts)} layout="am2" visible={!details} onMore={()=>{setDetailPanel('menu');setDetails(true);}} onStyle={()=>{styleReturnsToMenu.current=false;setDetailPanel('style');setDetails(true);}}/>}</View>:<PlayerScroll classic={preferences.playerLayout==='classic'}>
        {preferences.playerLayout==='classic'?<View onTouchStart={startTouch(dismissTouchStart)} onTouchEnd={finishTouch(dismissTouchStart,'down',()=>setOpen(false))} style={{minHeight:44,justifyContent:'center',alignSelf:'stretch'}} testID="player-drag-handle">{button('收起播放页',()=>setOpen(false))}</View>:<Pressable testID="player-drag-handle" accessibilityRole="button" accessibilityLabel="收起播放页" onTouchStart={startTouch(dismissTouchStart)} onTouchEnd={finishTouch(dismissTouchStart,'down',()=>setOpen(false))} onPress={()=>setOpen(false)} style={{minWidth:48,minHeight:44,alignSelf:'flex-start',justifyContent:'center'}}><Ionicons name="chevron-down" size={28} color="#FFFFFF"/></Pressable>}
        {preferences.playerLayout==='classic'&&skinSelector}
        {open&&preferences.playerLayout!=='classic'&&<ModernPlayer services={services} track={actualMatch??entry.track} favoriteTrack={entry.track} lyricTrack={lyricTrack} font={effectiveLyricFont(fonts)} layout={preferences.playerLayout} onMore={()=>{setDetailPanel('menu');setDetails(true);}} onStyle={()=>{styleReturnsToMenu.current=false;setDetailPanel('style');setDetails(true);}}/>}
        {preferences.playerLayout==='classic'&&detailContent}
      </PlayerScroll>}</View>
      <SheetModal visible={details&&open&&preferences.playerLayout!=='classic'} animationType="slide" onRequestClose={closeDetails}>
        {details&&<StatusBar style={theme.mode==='dark'?'light':'dark'}/>}
        <ScrollView key={detailPanel} style={styles.root} contentContainerStyle={styles.content}>
          {detailPanel==='style'?<>
            {button('收起播放界面样式',()=>{if(styleReturnsToMenu.current)setDetailPanel('menu');else closeDetails();})}
            <Text style={styles.title}>播放界面样式</Text>{skinSelector}
          </>:detailPanel==='lyrics'||detailPanel==='globalFont'||detailPanel==='lyricFont'?<>
            {button(detailPanel==='lyrics'?'收起歌词显示设置':'返回歌词设置',()=>setDetailPanel(detailPanel==='lyrics'?'menu':'lyrics'))}
            <Text style={styles.title}>{detailPanel==='lyrics'?'歌词显示设置':detailPanel==='globalFont'?'全局字体':'歌词字体'}</Text><FontSettings services={services} section={detailPanel==='lyrics'?'display':detailPanel==='globalFont'?'global':'lyric'} onOpen={section=>setDetailPanel(section==='display'?'lyrics':section==='global'?'globalFont':'lyricFont')}/>
          </>:detailPanel==='menu'?<>
            {button('收起播放选项',closeDetails)}
            <Text style={styles.title}>播放选项</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="播放界面样式" onPress={()=>{styleReturnsToMenu.current=true;setDetailPanel('style');}} style={styles.optionRow}><View style={{flex:1}}><Text style={styles.optionTitle}>播放界面样式</Text><Text style={styles.caption}>{(['classic','am','immersive','photo','vinyl','wave','stage','am2'] as const).includes(preferences.playerLayout)?({classic:'经典',am:'AM 风格',immersive:'封面沉浸',photo:'写真歌词',vinyl:'黑胶唱机',wave:'声波核',stage:'歌词舞台',am2:'AM2'} as const)[preferences.playerLayout]:'经典'}</Text></View><Ionicons name="chevron-forward" size={20} color={theme.palette.secondary}/></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="歌词显示设置" onPress={()=>setDetailPanel('lyrics')} style={styles.optionRow}><View style={{flex:1}}><Text style={styles.optionTitle}>歌词显示设置</Text><Text style={styles.caption}>字体、颜色、对齐、行距与逐字效果</Text></View><Ionicons name="chevron-forward" size={20} color={theme.palette.secondary}/></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="队列与播放选项" onPress={()=>setDetailPanel('content')} style={styles.optionRow}><View style={{flex:1}}><Text style={styles.optionTitle}>队列与播放选项</Text><Text style={styles.caption}>歌词、匹配、收藏、队列和播放控制</Text></View><Ionicons name="chevron-forward" size={20} color={theme.palette.secondary}/></Pressable>
          </>:<>
            {button('收起播放选项',closeDetails)}
            {button('返回播放选项',()=>setDetailPanel('menu'))}
            <Text style={styles.title}>队列与播放选项</Text>{detailContent}
          </>}
        </ScrollView>
      </SheetModal>
      <CommentsModal services={services} track={commenting} onClose={()=>setCommenting(null)}/>
      <MatchModal services={services} track={matching} onClose={()=>setMatching(null)}/>
      <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/>
    </Modal>
  </>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color('#111318') }, content: { padding: 24, paddingTop: 65, gap: 18 },
  mini: { paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row',flexWrap:'wrap', alignItems: 'center', gap: 10 },
  track: { color: theme.color('#E8E9E4'), fontSize: 14, lineHeight: 21 }, caption: { color: theme.color('#959EAC'), fontSize: 11, lineHeight: 20 },
  title: { color: theme.color('#F1EDE7'), fontSize: 30, fontWeight: '600' }, artist: { color: theme.color('#BFC8D9'), fontSize: 18 },
  button: { backgroundColor: theme.color('#303A32'), padding: 12, borderRadius: 12 }, buttonText: { color: theme.color('#D9F49B'), fontSize: 13 },
  row: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' }, error: { color: theme.color('#D6B69A'), fontSize: 12 },
  progress: { width: 300, height: 24, borderRadius: 12, backgroundColor: theme.color('#303745'), overflow: 'hidden' }, fill: { height: 24, backgroundColor: theme.color('#A0BE79') },
  spectrum: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginVertical: 15 }, bar: { flex: 1, backgroundColor: theme.color('#BCD994'), borderRadius: 2 },
  queueRow: { borderTopWidth: 1, borderTopColor: theme.color('#333946'), paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }, current: { color: theme.color('#D9F49B') },
  optionRow: { minHeight: 72, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.color('#333946'), backgroundColor: theme.color('#202630'), flexDirection: 'row', alignItems: 'center', gap: 12 }, optionTitle: { color: theme.color('#F1EDE7'), fontSize: 16, fontWeight: '600' },
});
