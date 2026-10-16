import {Text} from './Typography.tsx';
import {useThemedStyles,type Theme} from './theme.tsx';
import {useSyncExternalStore} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type { Services } from '../app/services.ts';
import { qualityOrder } from '../domain/quality.ts';
export function AudioSettings({ services }: { services: Services }) {
  const styles=useThemedStyles(makeStyles);
  const value = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  return <View style={styles.card}>
    <Text style={styles.title}>音质偏好</Text>
    <Text style={styles.caption}>偏好音质 · 同档跨源后逐级降档</Text>
    <View style={styles.wrap}>{qualityOrder.map(quality => <Pressable key={quality} accessibilityRole="radio" accessibilityState={{ selected: value.quality === quality }}
      onPress={() => { void services.preferences.update({ quality }); }} style={[styles.button, value.quality === quality && styles.selected]}><Text style={styles.text}>{quality}</Text></Pressable>)}</View>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  card: { padding: 18, marginTop: 24, borderRadius: 20, backgroundColor: theme.color('#1D222B'), gap: 12 },
  title: { color: theme.color('#ECEBF3'), fontSize: 18, fontWeight: '600' }, caption: { color: theme.color('#9296A2'), fontSize: 11, lineHeight: 20 },
  text: { color: theme.color('#D9E1CE'), fontSize: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: theme.color('#303A32'), paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9 }, selected: { borderWidth: 1, borderColor: theme.color('#D9F49B') },
});
