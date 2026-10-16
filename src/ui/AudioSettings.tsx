import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { useState,useSyncExternalStore } from 'react';
import {Pressable, StyleSheet, Switch, View} from 'react-native';
import type { Services } from '../app/services.ts';
import { qualityOrder } from '../domain/quality.ts';
import {EqualizerGraph,GainSlider} from './EqualizerGraph.tsx';
import {builtInEQ} from '../domain/equalizer.ts';
const frequencies = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
export function AudioSettings({ services }: { services: Services }) {
  const [name,setName]=useState(''),[error,setError]=useState('');
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const value = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const spectrum = useSyncExternalStore(services.playback.spectrum.subscribe, services.playback.spectrum.getSnapshot);
  const update = (patch: Parameters<typeof services.preferences.update>[0]) => { void services.preferences.update(patch).then(()=>setError('')).catch(error=>setError(error instanceof Error?error.message:'保存失败')); };

  return <View style={styles.card}>
    <Text style={styles.title}>播放与音效</Text>
    <Text style={styles.caption}>偏好音质 · 同档跨源后逐级降档</Text>
    <View style={styles.wrap}>{qualityOrder.map(quality => <Pressable key={quality} accessibilityRole="radio" accessibilityState={{ selected: value.quality === quality }}
      onPress={() => update({ quality })} style={[styles.button, value.quality === quality && styles.selected]}><Text style={styles.text}>{quality}</Text></Pressable>)}</View>
    <View style={styles.row}><Text style={styles.text}>10段均衡器</Text><Switch accessibilityLabel="启用均衡器" value={value.eqEnabled} onValueChange={eqEnabled => update({ eqEnabled })} /></View>
    <Text style={styles.caption}>{spectrum.supported ? `当前音频可处理 · 前级余量 ${spectrum.headroomDB.toFixed(1)} dB` : '播放后检测PCM支持；不支持处理的媒体会明确提示。'}</Text>
    <GainSlider testID="eq-preamp-slider" label="整体增益 · 前置放大器" value={value.preampDB} onChange={preampDB=>update({preampDB})}/>
    <Pressable accessibilityRole="button" style={styles.button} onPress={()=>update({preampDB:0})}><Text style={styles.text}>前级归零</Text></Pressable>
    <EqualizerGraph gains={value.gains} onChange={gains=>update({gains})}/>
    <Text style={styles.title}>声音预设</Text>
    <View style={styles.wrap}>{builtInEQ.map(preset=><Pressable key={preset.name} accessibilityRole="button" style={styles.button} onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})}><Text style={styles.text}>{preset.name}</Text></Pressable>)}</View>
    <TextInput testID="eq-preset-name" accessibilityLabel="自定义声音预设名称" placeholder="预设名称（同名覆盖）" placeholderTextColor={theme.palette.secondary} maxLength={32} value={name} onChangeText={setName} style={[styles.button,{color:theme.palette.text}]}/>
    <Pressable testID="eq-save-preset" accessibilityRole="button" style={styles.button} onPress={()=>{void services.preferences.saveEQPreset(name).then(()=>{setName('');setError('');}).catch(error=>setError(error instanceof Error?error.message:'保存失败'));}}><Text style={styles.text}>保存当前声音预设</Text></Pressable>
    {value.eqPresets.map(preset=><View key={preset.name} style={styles.row}><Pressable accessibilityRole="button" onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})} style={[styles.button,{flex:1}]}><Text style={styles.text}>{preset.name}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`删除预设${preset.name}`} onPress={()=>{void services.preferences.deleteEQPreset(preset.name).catch(()=>setError('删除失败'));}}><Text style={styles.caption}>删除</Text></Pressable></View>)}
    {error?<Text accessibilityRole="alert" style={{color:theme.palette.accent}}>{error}</Text>:null}
    {frequencies.map((label, index) => <View key={label} style={styles.row}>
      <Text style={styles.band}>{label} Hz</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}Hz降低1dB`} style={styles.button} onPress={() => update({ gains: value.gains.map((gain, i) => i === index ? Math.max(-12, gain-1) : gain) })}><Text style={styles.text}>−</Text></Pressable>
      <Text testID={`eq-gain-${index}`} style={styles.value}>{value.gains[index]!>0?'+':''}{value.gains[index]!.toFixed(1)} dB</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}Hz提高1dB`} style={styles.button} onPress={() => update({ gains: value.gains.map((gain, i) => i === index ? Math.min(12, gain+1) : gain) })}><Text style={styles.text}>＋</Text></Pressable>
    </View>)}
    <Text style={styles.caption}>自动余量与用户前级叠加；正增益可能削波。关闭均衡器后前级和频段全部旁路。</Text>
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
