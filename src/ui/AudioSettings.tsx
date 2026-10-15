import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Services } from '../app/services.ts';
import { qualityOrder } from '../domain/quality.ts';
const frequencies = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
export function AudioSettings({ services }: { services: Services }) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const value = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const spectrum = useSyncExternalStore(services.playback.spectrum.subscribe, services.playback.spectrum.getSnapshot);
  const update = (patch: Parameters<typeof services.preferences.update>[0]) => { void services.preferences.update(patch).catch(() => {}); };
  const preset = (gains: readonly number[]) => update({ gains });
  return <View style={styles.card}>
    <Text style={styles.title}>播放与音效</Text>
    <Text style={styles.caption}>偏好音质 · 同档跨源后逐级降档</Text>
    <View style={styles.wrap}>{qualityOrder.map(quality => <Pressable key={quality} accessibilityRole="radio" accessibilityState={{ selected: value.quality === quality }}
      onPress={() => update({ quality })} style={[styles.button, value.quality === quality && styles.selected]}><Text style={styles.text}>{quality}</Text></Pressable>)}</View>
    <View style={styles.row}><Text style={styles.text}>10段均衡器</Text><Switch accessibilityLabel="启用均衡器" value={value.eqEnabled} onValueChange={eqEnabled => update({ eqEnabled })} /></View>
    <Text style={styles.caption}>{spectrum.supported ? `当前音频可处理 · 前级余量 ${spectrum.headroomDB.toFixed(1)} dB` : '播放后检测PCM支持；不支持处理的媒体会明确提示。'}</Text>
    <View style={styles.wrap}>
      {[['平直', Array(10).fill(0)], ['低音', [5, 4, 3, 1, 0, 0, 0, 0, 0, 0]], ['人声', [-2, -2, 0, 2, 3, 3, 2, 0, -1, -2]]] .map(([name, gains]) =>
        <Pressable key={String(name)} accessibilityRole="button" style={styles.button} onPress={() => preset(gains as number[])}><Text style={styles.text}>{String(name)}</Text></Pressable>)}
    </View>
    {frequencies.map((label, index) => <View key={label} style={styles.row}>
      <Text style={styles.band}>{label} Hz</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}Hz降低1dB`} style={styles.button} onPress={() => update({ gains: value.gains.map((gain, i) => i === index ? Math.max(-12, gain-1) : gain) })}><Text style={styles.text}>−</Text></Pressable>
      <Text style={styles.value}>{value.gains[index]} dB</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}Hz提高1dB`} style={styles.button} onPress={() => update({ gains: value.gains.map((gain, i) => i === index ? Math.min(12, gain+1) : gain) })}><Text style={styles.text}>＋</Text></Pressable>
    </View>)}
    <Text style={styles.caption}>提升频段时自动降低前级，为输出留出余量。关闭均衡器后原样旁路。</Text>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  card: { padding: 18, marginTop: 24, borderRadius: 20, backgroundColor: theme.color('#1D222B'), gap: 12 },
  title: { color: theme.color('#ECEBF3'), fontSize: 18, fontWeight: '600' }, caption: { color: theme.color('#9296A2'), fontSize: 11, lineHeight: 20 },
  text: { color: theme.color('#D9E1CE'), fontSize: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  button: { backgroundColor: theme.color('#303A32'), paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9 }, selected: { borderWidth: 1, borderColor: theme.color('#D9F49B') },
  band: { color: theme.color('#C2C7D3'), fontSize: 12, width: 70 }, value: { color: theme.color('#D9F49B'), fontSize: 12, width: 50, textAlign: 'center' },
});
