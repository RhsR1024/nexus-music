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
  const reset=()=>update({preampDB:0,gains:Array(10).fill(0)});
  return <View style={styles.root}>
    <View style={styles.enableRow}><View style={styles.enableCopy}><Text style={styles.heroTitle}>均衡器</Text><Text style={styles.caption}>开启后应用当前曲线</Text></View><Switch accessibilityLabel="启用均衡器" value={value.eqEnabled} onValueChange={eqEnabled=>update({eqEnabled})}/></View>
    <Text style={styles.caption}>{spectrum.supported?`当前音频可处理 · 前级余量 ${spectrum.headroomDB.toFixed(1)} dB`:'播放后检测 PCM 支持；不支持处理的媒体会明确提示。'}</Text>
    <View style={styles.panel}>
      <View style={styles.panelHeader}><Text style={styles.panelTitle}>整体增益 · 前置放大器</Text><Pressable accessibilityRole="button" accessibilityLabel="前级归零" onPress={()=>update({preampDB:0})}><Text style={styles.link}>归零</Text></Pressable></View>
      <GainSlider testID="eq-preamp-slider" label="" accessibilityLabel="整体增益 · 前置放大器" value={value.preampDB} onChange={preampDB=>update({preampDB})} showBounds/>
      <Text style={styles.panelCaption}>在频段调节前统一调整输入电平。提升频段时可降低此增益，留出余量；正增益可能引起削波。</Text>
    </View>
    <View style={styles.panel}>
      <View style={styles.panelHeader}><Text style={styles.panelTitle}>频率 · 增益</Text><Pressable accessibilityRole="button" accessibilityLabel="重置均衡器曲线" onPress={reset}><Text style={styles.link}>重置</Text></Pressable></View>
      <EqualizerGraph gains={value.gains} onChange={gains=>update({gains})}/>
      <Text style={styles.panelCaption}>拖动曲线上的控制点调音，下方滑杆可精细调整当前频段。</Text>
    </View>
    <Text style={styles.sectionTitle}>声音预设</Text>
    <View style={styles.wrap}>{builtInEQ.map(preset=><Pressable key={preset.name} accessibilityRole="button" style={styles.preset} onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})}><Text style={styles.text}>{preset.name}</Text></Pressable>)}</View>
    <View style={styles.customHeader}><Text style={styles.panelTitle}>自定义预设</Text><Text style={styles.caption}>保存当前曲线与前级</Text></View>
    <TextInput testID="eq-preset-name" accessibilityLabel="自定义声音预设名称" placeholder="预设名称（同名覆盖）" placeholderTextColor={theme.palette.secondary} maxLength={32} value={name} onChangeText={setName} style={styles.input}/>
    <Pressable testID="eq-save-preset" accessibilityRole="button" style={styles.preset} onPress={()=>{void services.preferences.saveEQPreset(name).then(()=>{setName('');setError('');}).catch(reason=>setError(reason instanceof Error?reason.message:'保存失败'));}}><Text style={styles.text}>保存当前声音预设</Text></Pressable>
    {value.eqPresets.map(preset=><View key={preset.name} style={styles.savedRow}><Pressable accessibilityRole="button" onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})} style={[styles.preset,{flex:1}]}><Text style={styles.text}>{preset.name}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`删除预设${preset.name}`} onPress={()=>{void services.preferences.deleteEQPreset(preset.name).catch(()=>setError('删除失败'));}}><Text style={styles.caption}>删除</Text></Pressable></View>)}
    {error?<Text accessibilityRole="alert" style={{color:theme.palette.accent}}>{error}</Text>:null}
    <Text style={styles.caption}>关闭均衡器后前级和频段全部旁路，播放队列和播放意图不受影响。</Text>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({root:{gap:14,paddingVertical:18},enableRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:8},enableCopy:{gap:4},heroTitle:{color:theme.color('#F1EDE7'),fontSize:30,fontWeight:'700'},sectionTitle:{color:theme.color('#F1EDE7'),fontSize:24,fontWeight:'700',marginTop:8},panel:{padding:18,borderRadius:22,backgroundColor:theme.color('#262D38'),gap:14},panelHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},panelTitle:{color:theme.color('#F1EDE7'),fontSize:16,fontWeight:'700'},link:{color:theme.palette.accent,fontSize:15,fontWeight:'600'},panelCaption:{color:theme.color('#B8BFCA'),fontSize:12,lineHeight:20},caption:{color:theme.color('#9296A2'),fontSize:11,lineHeight:20},text:{color:theme.color('#D9E1CE'),fontSize:12},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},preset:{backgroundColor:theme.color('#303A32'),paddingHorizontal:12,paddingVertical:11,borderRadius:12},input:{color:theme.color('#EEECE7'),borderWidth:1,borderColor:theme.color('#414754'),padding:13,borderRadius:12,backgroundColor:theme.color('#202630')},customHeader:{gap:3,marginTop:4},savedRow:{flexDirection:'row',alignItems:'center',gap:12}});
