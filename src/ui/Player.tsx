import {QueueView} from './QueueView.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { Lyrics } from './Lyrics.tsx';
import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [open, setOpen] = useState(false);
  const entry = currentEntry(state.queue);
  if (!entry) return null;
  const toggle = () => { if (state.intent === 'playing') controller.pause(); else void controller.play(); };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <>
    <View style={styles.mini}>
      <Pressable accessibilityRole="button" accessibilityLabel="打开播放页" onPress={() => setOpen(true)} style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.track}>{entry.track.title}</Text><Text numberOfLines={1} style={styles.caption}>{entry.track.artist} · {state.phase === 'resolving' ? '正在选择音源…' : state.error ?? (state.buffering ? '缓冲中…' : time(state.position))}</Text>
      </Pressable>{button(state.intent === 'playing' ? '暂停' : '播放', toggle)}
    </View>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {button('收起播放页', () => setOpen(false))}
        <Text style={styles.title}>{entry.track.title}</Text><Text style={styles.artist}>{entry.track.artist}</Text><Text style={styles.caption}>{entry.track.album}</Text>
        <Text style={styles.caption}>偏好 {preferences.quality} · 成功请求档位 {state.media?.quality ?? '待解析'}（非实际文件格式证明）</Text>
        <Spectrum services={services} />
        {open&&<Lyrics services={services} track={entry.track} font={fonts.selected??undefined}/>}
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
      </ScrollView>
    </Modal>
  </>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color('#111318') }, content: { padding: 24, paddingTop: 65, gap: 18 },
  mini: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: theme.color('#252D2A') },
  track: { color: theme.color('#E8E9E4'), fontSize: 14, lineHeight: 21 }, caption: { color: theme.color('#959EAC'), fontSize: 11, lineHeight: 20 },
  title: { color: theme.color('#F1EDE7'), fontSize: 30, fontWeight: '600' }, artist: { color: theme.color('#BFC8D9'), fontSize: 18 },
  button: { backgroundColor: theme.color('#303A32'), padding: 12, borderRadius: 12 }, buttonText: { color: theme.color('#D9F49B'), fontSize: 13 },
  row: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' }, error: { color: theme.color('#D6B69A'), fontSize: 12 },
  progress: { width: 300, height: 24, borderRadius: 12, backgroundColor: theme.color('#303745'), overflow: 'hidden' }, fill: { height: 24, backgroundColor: theme.color('#A0BE79') },
  spectrum: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginVertical: 15 }, bar: { flex: 1, backgroundColor: theme.color('#BCD994'), borderRadius: 2 },
  queueRow: { borderTopWidth: 1, borderTopColor: theme.color('#333946'), paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }, current: { color: theme.color('#D9F49B') },
});
