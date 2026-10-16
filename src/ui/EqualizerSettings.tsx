import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useState,useSyncExternalStore} from 'react';
import {Pressable,StyleSheet,Switch,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {EqualizerGraph,GainSlider} from './EqualizerGraph.tsx';
import {builtInEQ} from '../domain/equalizer.ts';

export function EqualizerSettings({services}:{services:Services}){
  const theme=useTheme(),styles=useThemedStyles(makeStyles),value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),spectrum=useSyncExternalStore(services.playback.spectrum.subscribe,services.playback.spectrum.getSnapshot);
  const [name,setName]=useState(''),[error,setError]=useState('');
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{void services.preferences.update(patch).then(()=>setError('')).catch(reason=>setError(reason instanceof Error?reason.message:'保存失败'));};
  return <View style={styles.card}>
    <Text style={styles.title}>图形均衡器</Text>
    <Text style={styles.caption}>原生 PCM 处理；不支持处理的媒体会保持原始声音。</Text>
    <View style={styles.row}><Text style={styles.text}>启用均衡器</Text><Switch accessibilityLabel="启用均衡器" value={value.eqEnabled} onValueChange={eqEnabled=>update({eqEnabled})}/></View>
    <Text style={styles.caption}>{spectrum.supported?`当前音频可处理 · 前级余量 ${spectrum.headroomDB.toFixed(1)} dB`:'播放后检测 PCM 支持；不支持处理的媒体会明确提示。'}</Text>
    <GainSlider testID="eq-preamp-slider" label="整体增益 · 前置放大器" value={value.preampDB} onChange={preampDB=>update({preampDB})}/>
    <Pressable accessibilityRole="button" style={styles.button} onPress={()=>update({preampDB:0})}><Text style={styles.text}>前级归零</Text></Pressable>
    <EqualizerGraph gains={value.gains} onChange={gains=>update({gains})}/>
    <Text style={styles.title}>声音预设</Text>
    <View style={styles.wrap}>{builtInEQ.map(preset=><Pressable key={preset.name} accessibilityRole="button" style={styles.button} onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})}><Text style={styles.text}>{preset.name}</Text></Pressable>)}</View>
    <TextInput testID="eq-preset-name" accessibilityLabel="自定义声音预设名称" placeholder="预设名称（同名覆盖）" placeholderTextColor={theme.palette.secondary} maxLength={32} value={name} onChangeText={setName} style={[styles.button,{color:theme.palette.text}]}/>
    <Pressable testID="eq-save-preset" accessibilityRole="button" style={styles.button} onPress={()=>{void services.preferences.saveEQPreset(name).then(()=>{setName('');setError('');}).catch(reason=>setError(reason instanceof Error?reason.message:'保存失败'));}}><Text style={styles.text}>保存当前声音预设</Text></Pressable>
    {value.eqPresets.map(preset=><View key={preset.name} style={styles.row}><Pressable accessibilityRole="button" onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})} style={[styles.button,{flex:1}]}><Text style={styles.text}>{preset.name}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`删除预设${preset.name}`} onPress={()=>{void services.preferences.deleteEQPreset(preset.name).catch(()=>setError('删除失败'));}}><Text style={styles.caption}>删除</Text></Pressable></View>)}
    {error?<Text accessibilityRole="alert" style={{color:theme.palette.accent}}>{error}</Text>:null}
    <Text style={styles.caption}>自动余量与用户前级叠加；正增益可能削波。关闭均衡器后前级和频段全部旁路。</Text>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({card:{padding:18,marginTop:24,borderRadius:20,backgroundColor:theme.color('#1D222B'),gap:12},title:{color:theme.color('#ECEBF3'),fontSize:18,fontWeight:'600'},caption:{color:theme.color('#9296A2'),fontSize:11,lineHeight:20},text:{color:theme.color('#D9E1CE'),fontSize:12},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},button:{backgroundColor:theme.color('#303A32'),paddingHorizontal:12,paddingVertical:9,borderRadius:9}});
