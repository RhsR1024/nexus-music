import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {GlassSurface} from './Materials.tsx';
import {ArtworkBackdrop,ModernPlayer} from './ModernPlayer.tsx';
import {Cover} from './Cover.tsx';
import {MatchModal} from './MatchModal.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import type {Track} from '../domain/track.ts';
import {QueueView} from './QueueView.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { Lyrics } from './Lyrics.tsx';
import { useState, useSyncExternalStore } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Services } from '../app/services.ts';
import { currentEntry, remove, move } from '../domain/queue.ts';
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
  const { controller } = services.playback;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [matching,setMatching]=useState<Track|null>(null),[adding,setAdding]=useState<readonly Track[]>([]);
  const [open, setOpen] = useState(false);
  const [details,setDetails]=useState(false);
  const entry = currentEntry(state.queue);
  if (!entry) return null;
  const match=entry.track.origin.kind==='imported'||entry.track.origin.kind==='online'?services.library.matchFor(entry.track):undefined;
  const actualMatch=state.media?.matchedTrack,lyricTrack=actualMatch??(entry.track.origin.kind==='imported'?match?.target:match?.method==='manual'&&!state.media?match.target:undefined)??entry.track;
  const toggle = () => { if (state.intent === 'playing') controller.pause(); else void controller.play(); };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const skinSelector=(<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{([['classic','经典'],['am','AM 风格'],['immersive','封面沉浸'],['photo','写真歌词'],['vinyl','黑胶唱机'],['wave','声波核']]as const).map(([id,title])=><Pressable key={id} testID={`play-skin-${id}`} accessibilityRole="radio" accessibilityState={{selected:preferences.playerLayout===id}} onPress={()=>{void services.preferences.update({playerLayout:id}).then(()=>setDetails(false)).catch(()=>Alert.alert('界面未保存'));}} style={{padding:10,borderRadius:16,backgroundColor:preferences.playerLayout===id?theme.palette.selected:theme.palette.surface}}><Text style={{color:theme.palette.accent}}>{title}</Text></Pressable>)}</View>);
  const detailContent=(<>
        <Cover services={services} track={entry.track} size={240}/>
        <Text style={styles.title}>{entry.track.title}</Text><Text style={styles.artist}>{entry.track.artist}</Text><Text style={styles.caption}>{entry.track.album}</Text>
        <Text style={styles.caption}>偏好 {preferences.quality} · 成功请求档位 {state.media?.quality ?? '待解析'}（非实际文件格式证明）</Text>
        <Spectrum services={services} />
        {(entry.track.origin.kind==='imported'||entry.track.origin.kind==='online')&&<View style={styles.row}><Text style={styles.caption}>{actualMatch?`正在通过 ${actualMatch.origin.kind==='online'?actualMatch.origin.platform:''} · ${actualMatch.title} 播放`:match?.method==='manual'?'已指定版本，重新播放后使用':entry.track.origin.kind==='imported'?'汽水原曲 · 待匹配':'保留原曲，可选择其他录音版本'}</Text>{button('匹配歌曲',()=>setMatching(entry.track))}</View>}
        {open&&preferences.playerLayout==='classic'&&<Lyrics services={services} track={lyricTrack} font={fonts.selected??undefined}/>}
        <View style={styles.row}>{button(services.library.isFavorite(entry.track)?'取消本地收藏':'本地收藏',()=>{void services.library.favorite(entry.track).catch(()=>Alert.alert('保存失败','原有收藏保留，请重试。'));})}{button('加入歌单',()=>setAdding([entry.track]))}</View>
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
    <GlassSurface><View style={styles.mini}>
      <Cover services={services} track={entry.track} size={44}/>
      <Pressable accessibilityRole="button" accessibilityLabel="打开播放页" onPress={() => setOpen(true)} style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.track}>{entry.track.title}</Text><Text numberOfLines={1} style={styles.caption}>{entry.track.artist} · {state.phase === 'resolving' ? '正在选择音源…' : state.error ?? (state.buffering ? '缓冲中…' : time(state.position))}</Text>
      </Pressable><Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={toggle} style={{padding:10,minHeight:44,minWidth:44}}><Ionicons name={state.intent==='playing'?'pause':'play'} size={25} color={theme.palette.text}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={{padding:8,minHeight:44,minWidth:44}}><Ionicons name="play-skip-forward" size={24} color={theme.palette.text}/></Pressable>
    </View></GlassSurface>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      {open&&<StatusBar style={preferences.playerLayout!=='classic'?'light':theme.mode==='dark'?'light':'dark'}/>}
      <View style={{flex:1,backgroundColor:preferences.playerLayout==='classic'?theme.palette.background[0]:'#183647'}}>
      {open&&preferences.playerLayout!=='classic'&&<ArtworkBackdrop services={services} track={entry.track} photo={preferences.playerLayout==='photo'}/>}
      <ScrollView style={{flex:1}} contentContainerStyle={styles.content}>
        {preferences.playerLayout==='classic'?button('收起播放页',()=>setOpen(false)):<Pressable accessibilityRole="button" accessibilityLabel="收起播放页" onPress={()=>setOpen(false)} style={{minWidth:44,minHeight:30,alignSelf:'flex-start',justifyContent:'center'}}><Ionicons name="chevron-down" size={28} color="#FFFFFF"/></Pressable>}
        {preferences.playerLayout==='classic'&&skinSelector}
        {open&&preferences.playerLayout!=='classic'&&<ModernPlayer services={services} track={entry.track} lyricTrack={lyricTrack} font={fonts.selected??undefined} layout={preferences.playerLayout} onMore={()=>setDetails(true)}/>}
        {preferences.playerLayout==='classic'&&detailContent}
      </ScrollView></View>
      <Modal visible={details&&open&&preferences.playerLayout!=='classic'} animationType="slide" onRequestClose={()=>setDetails(false)}>
        {details&&<StatusBar style={theme.mode==='dark'?'light':'dark'}/>}
        <ScrollView style={styles.root} contentContainerStyle={styles.content}>
          {button('收起播放选项',()=>setDetails(false))}
          <Text style={styles.title}>播放选项</Text>{skinSelector}{detailContent}
        </ScrollView>
      </Modal>
      <MatchModal services={services} track={matching} onClose={()=>setMatching(null)}/>
      <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/>
    </Modal>
  </>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color('#111318') }, content: { padding: 24, paddingTop: 65, gap: 18 },
  mini: { paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { color: theme.color('#E8E9E4'), fontSize: 14, lineHeight: 21 }, caption: { color: theme.color('#959EAC'), fontSize: 11, lineHeight: 20 },
  title: { color: theme.color('#F1EDE7'), fontSize: 30, fontWeight: '600' }, artist: { color: theme.color('#BFC8D9'), fontSize: 18 },
  button: { backgroundColor: theme.color('#303A32'), padding: 12, borderRadius: 12 }, buttonText: { color: theme.color('#D9F49B'), fontSize: 13 },
  row: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' }, error: { color: theme.color('#D6B69A'), fontSize: 12 },
  progress: { width: 300, height: 24, borderRadius: 12, backgroundColor: theme.color('#303745'), overflow: 'hidden' }, fill: { height: 24, backgroundColor: theme.color('#A0BE79') },
  spectrum: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginVertical: 15 }, bar: { flex: 1, backgroundColor: theme.color('#BCD994'), borderRadius: 2 },
  queueRow: { borderTopWidth: 1, borderTopColor: theme.color('#333946'), paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }, current: { color: theme.color('#D9F49B') },
});
