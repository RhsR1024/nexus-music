import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useState,useSyncExternalStore} from 'react';
import {Pressable,StyleSheet,Switch,View,useWindowDimensions} from 'react-native';
import type {Services} from '../app/services.ts';
import {EqualizerGraph,GainSlider} from './EqualizerGraph.tsx';
import {EQPresetCard} from './EQPresetCard.tsx';
import {builtInEQ} from '../domain/equalizer.ts';

export function EqualizerSettings({services}:{services:Services}){
  const theme=useTheme(),styles=useThemedStyles(makeStyles),value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),spectrum=useSyncExternalStore(services.playback.spectrum.subscribe,services.playback.spectrum.getSnapshot);
  const [name,setName]=useState(''),[error,setError]=useState(''),[gridWidth,setGridWidth]=useState(0);
  const {fontScale}=useWindowDimensions(),cardWidth=gridWidth>=300&&fontScale<=1.4?(gridWidth-10)/2:gridWidth;
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{void services.preferences.update(patch).then(()=>setError('')).catch(reason=>setError(reason instanceof Error?reason.message:'保存失败'));};
  const reset=()=>update({preampDB:0,gains:Array(10).fill(0)});
  return <View style={styles.root}>
    <View style={styles.enableRow}><View style={styles.enableCopy}><Text style={styles.heroTitle}>均衡器</Text><Text style={styles.caption}>开启后应用当前曲线</Text></View><Switch accessibilityLabel="启用均衡器" value={value.eqEnabled} onValueChange={eqEnabled=>update({eqEnabled})}/></View>
    <Text style={styles.caption}>{spectrum.supported?`当前音频可处理 · 前级余量 ${spectrum.headroomDB.toFixed(1)} dB`:'播放后检测 PCM 支持；不支持处理的媒体会明确提示。'}</Text>
    <View style={styles.panel}>
      <View style={styles.panelHeader}><Text style={styles.panelTitle}>整体增益 · 前置放大器</Text><Pressable accessibilityRole="button" accessibilityLabel="前级归零" style={styles.textAction} onPress={()=>update({preampDB:0})}><Text style={styles.link}>归零</Text></Pressable></View>
      <GainSlider testID="eq-preamp-slider" label="" accessibilityLabel="整体增益 · 前置放大器" value={value.preampDB} onChange={preampDB=>update({preampDB})} showBounds/>
      <Text style={styles.panelCaption}>在频段调节前统一调整输入电平。提升频段时可降低此增益，留出余量；正增益可能引起削波。</Text>
    </View>
    <View style={styles.panel}>
      <View style={styles.panelHeader}><Text style={styles.panelTitle}>频率 · 增益</Text><Pressable accessibilityRole="button" accessibilityLabel="重置均衡器曲线" style={styles.textAction} onPress={reset}><Text style={styles.link}>重置</Text></Pressable></View>
      <EqualizerGraph gains={value.gains} onChange={gains=>update({gains})}/>
      <Text style={styles.panelCaption}>拖动曲线上的控制点调音，下方滑杆可精细调整当前频段。</Text>
    </View>
    <Text style={styles.sectionTitle}>声音预设</Text>
    <View testID="eq-preset-grid" onLayout={event=>setGridWidth(event.nativeEvent.layout.width)} style={styles.wrap}>{builtInEQ.map((preset,index)=><View key={preset.name} style={{width:cardWidth||'100%'}}><EQPresetCard testID={`eq-builtin-${index}`} preset={preset} gains={value.gains} preampDB={value.preampDB} onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})}/></View>)}</View>
    <View style={styles.customHeader}><View style={styles.panelHeader}><Text style={styles.panelTitle}>自定义预设</Text><Text style={styles.caption}>{value.eqPresets.length} / 24</Text></View><Text style={styles.caption}>保存当前曲线与前级</Text></View>
    {!value.eqPresets.length&&<Text testID="eq-custom-empty" style={styles.panelCaption}>还没有自定义预设。调好曲线后，为当前声音起个名字。</Text>}
    <TextInput testID="eq-preset-name" accessibilityLabel="自定义声音预设名称" placeholder="预设名称（同名覆盖）" placeholderTextColor={theme.palette.secondary} maxLength={32} value={name} onChangeText={setName} style={styles.input}/>
    <Pressable testID="eq-save-preset" accessibilityRole="button" style={styles.preset} onPress={()=>{void services.preferences.saveEQPreset(name).then(()=>{setName('');setError('');}).catch(reason=>setError(reason instanceof Error?reason.message:'保存失败'));}}><Text style={styles.text}>保存当前声音预设</Text></Pressable>
    {value.eqPresets.map(preset=><View key={preset.name} style={styles.savedRow}><View style={{flex:1}}><EQPresetCard preset={preset} gains={value.gains} preampDB={value.preampDB} onPress={()=>update({gains:preset.gains,preampDB:preset.preampDB})}/></View><Pressable accessibilityRole="button" accessibilityLabel={`删除预设${preset.name}`} style={styles.deletePreset} onPress={()=>{void services.preferences.deleteEQPreset(preset.name).catch(()=>setError('删除失败'));}}><Text style={styles.caption}>删除</Text></Pressable></View>)}
    {error?<Text accessibilityRole="alert" style={{color:theme.palette.accent}}>{error}</Text>:null}
    <Text style={styles.caption}>关闭均衡器后前级和频段全部旁路，播放队列和播放意图不受影响。</Text>
  </View>;
}
const makeStyles=({palette}:Theme)=>StyleSheet.create({
  root:{gap:14,paddingVertical:18},enableRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:8},enableCopy:{gap:4},
  heroTitle:{color:palette.text,fontSize:30,fontWeight:'700'},sectionTitle:{color:palette.text,fontSize:24,fontWeight:'700',marginTop:8},
  panel:{padding:18,borderRadius:22,backgroundColor:palette.surface,gap:14},panelHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  panelTitle:{color:palette.text,fontSize:16,fontWeight:'700'},link:{color:palette.accent,fontSize:15,fontWeight:'600'},textAction:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  panelCaption:{color:palette.secondary,fontSize:12,lineHeight:20},caption:{color:palette.secondary,fontSize:11,lineHeight:20},text:{color:palette.text,fontSize:12},
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:10},deletePreset:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  preset:{backgroundColor:palette.selected,minHeight:44,justifyContent:'center',paddingHorizontal:12,paddingVertical:11,borderRadius:12},
  input:{color:palette.text,borderWidth:1,borderColor:palette.border,padding:13,borderRadius:12,backgroundColor:palette.surface},customHeader:{gap:3,marginTop:4},savedRow:{flexDirection:'row',alignItems:'center',gap:12},
});
