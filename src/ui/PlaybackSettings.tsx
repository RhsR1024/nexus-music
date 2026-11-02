import {Text,TextInput} from './Typography.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {Pressable, View, type ViewProps} from 'react-native';
import {requireNativeView} from 'expo';
import type {Services} from '../app/services.ts';
import {GainSlider} from './EqualizerGraph.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space} from './tokens.ts';
const NativeRoutePicker=requireNativeView<ViewProps&{tint:string;activeTint:string}>('NexusNative','RoutePicker');
const NativeDeviceVolume=requireNativeView<ViewProps&{tint:string}>('NexusNative','DeviceVolume');
export function PlaybackSettings({services}:{services:Services}) {
  const {palette:p}=useTheme(),settings=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const [minutes,setMinutes]=useState('30'),[now,setNow]=useState(Date.now()),[error,setError]=useState('');
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  useEffect(()=>{if(sleep.mode!=='duration')return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[sleep]);
  const set=(seconds:number,finish=false)=>{void services.playback.sleep.set(seconds,finish).then(()=>setError('')).catch(()=>setError('定时设置未保存，请重试'));};
  const button=(title:string,action:()=>void,disabled=false,testID?:string)=><Pressable testID={testID} accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={action} style={{backgroundColor:p.selected,padding:12,borderRadius:16,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{title}</Text></Pressable>;
  return <View style={{padding:18,borderRadius:24,backgroundColor:p.surface,gap:14,marginTop:24}}>
    <Text style={{color:p.text,fontSize:20,fontWeight:'700'}}>播放控制</Text>
    {button(`普通在线歌曲自动匹配：${settings.autoMatch?'开启':'关闭'}`,()=>{void services.preferences.update({autoMatch:!settings.autoMatch}).catch(()=>setError('自动匹配设置未保存'));},false,'automatic-online-matching')}
    <Text style={{color:p.secondary,fontSize:12,lineHeight:19}}>原曲当前音质不可用时，先尝试其他平台的可靠同版本，再降音质。手动指定的版本优先，原始收藏和歌单保留。</Text>
    <GainSlider testID="app-volume" label="App 音量" format={value=>`${Math.round((value+12)/24*100)}%`} value={settings.volume*24-12} onChange={value=>{void services.preferences.update({volume:(value+12)/24}).catch(()=>setError('音量未保存'));}}/>
    <Text style={{color:p.secondary,fontSize:12}}>只调整音枢播放器的相对音量，不修改系统输出音量。</Text>
    <View testID="device-volume-control" style={{minHeight:92,padding:space.md,borderRadius:radius.lg,backgroundColor:p.selected,gap:space.xs}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.md}}>
        <Text style={{color:p.text,fontSize:18,fontWeight:'600'}}>设备音量</Text>
        <Text style={{color:p.secondary,fontSize:12}}>系统输出</Text>
      </View>
      <NativeDeviceVolume tint={p.accent} style={{width:'100%',height:44}}/>
      <Text style={{color:p.secondary,fontSize:12,lineHeight:19}}>调整当前 iPhone 扬声器或耳机、蓝牙、AirPlay 输出设备的系统音量。</Text>
    </View>
    <View testID="system-audio-output" style={{minHeight:72,padding:space.md,borderRadius:radius.lg,backgroundColor:p.selected,flexDirection:'row',alignItems:'center',gap:space.md}}>
      <View style={{flex:1,gap:space.xs}}>
        <Text style={{color:p.text,fontSize:18,fontWeight:'600'}}>系统音频输出</Text>
        <Text style={{color:p.secondary,fontSize:12,lineHeight:19}}>AirPlay、蓝牙和耳机设备由 iOS 提供。</Text>
      </View>
      <View style={{width:Math.max(controls.hit,48),height:Math.max(controls.hit,48),borderRadius:radius.full,backgroundColor:p.surface,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
        <NativeRoutePicker tint={p.text} activeTint={p.accent} pointerEvents="auto" style={{width:48,height:48}}/>
      </View>
    </View>
    <Text style={{color:p.text,fontSize:18,fontWeight:'600'}}>睡眠定时</Text>
    <Text testID="sleep-status" style={{color:p.secondary}}>{sleep.mode==='off'?'未开启':sleep.mode==='track'?'本曲播放结束后停止':`剩余 ${Math.max(0,Math.ceil((sleep.deadline-now)/60000))} 分钟`}</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{[15,30,60,90].map(value=><View key={value}>{button(`${value}分钟`,()=>set(value*60))}</View>)}</View>
    <TextInput accessibilityLabel="睡眠定时分钟" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} placeholder="1–1440 分钟" placeholderTextColor={p.secondary} maxLength={4} style={{padding:12,color:p.text,borderWidth:1,borderColor:p.border,borderRadius:12}}/>
    {button('开始自定义定时',()=>{const value=Number(minutes);if(!/^\d+$/.test(minutes)||value<1||value>1440){setError('请输入1到1440分钟');return;}set(value*60);})}
    {button('本曲结束后停止',()=>set(0,true),!state.queue.currentId||state.phase!=='ready')}
    {sleep.mode!=='off'&&button('取消睡眠定时',()=>set(0))}
    <Text style={{color:p.secondary,fontSize:12,lineHeight:19}}>定时由原生播放器执行，重启后取消。本曲后停止绑定当前队列条目，手动切换歌曲后取消。</Text>
    {!!error&&<Text accessibilityRole="alert" style={{color:p.accent}}>{error}</Text>}
  </View>;
}
