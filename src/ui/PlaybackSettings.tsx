import {useEffect,useState,useSyncExternalStore} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {GainSlider} from './EqualizerGraph.tsx';
import {useTheme} from './theme.tsx';
export function PlaybackSettings({services}:{services:Services}) {
  const {palette:p}=useTheme(),settings=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const [minutes,setMinutes]=useState('30'),[now,setNow]=useState(Date.now()),[error,setError]=useState('');
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  useEffect(()=>{if(sleep.mode!=='duration')return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[sleep]);
  const set=(seconds:number,finish=false)=>{void services.playback.sleep.set(seconds,finish).then(()=>setError('')).catch(()=>setError('定时设置未保存，请重试'));};
  const button=(title:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={action} style={{backgroundColor:p.selected,padding:12,borderRadius:16,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{title}</Text></Pressable>;
  return <View style={{padding:18,borderRadius:24,backgroundColor:p.surface,gap:14,marginTop:24}}>
    <Text style={{color:p.text,fontSize:20,fontWeight:'700'}}>播放控制</Text>
    {button(`普通在线歌曲自动匹配：${settings.autoMatch?'开启':'关闭'}`,()=>{void services.preferences.update({autoMatch:!settings.autoMatch}).catch(()=>setError('自动匹配设置未保存'));})}
    <Text style={{color:p.secondary,fontSize:12,lineHeight:19}}>原曲当前音质不可用时，先尝试其他平台的可靠同版本，再降音质。手动指定的版本优先，原始收藏和歌单保留。</Text>
    <GainSlider testID="app-volume" label="App 音量" format={value=>`${Math.round((value+12)/24*100)}%`} value={settings.volume*24-12} onChange={value=>{void services.preferences.update({volume:(value+12)/24}).catch(()=>setError('音量未保存'));}}/>
    <Text style={{color:p.secondary,fontSize:12}}>App 内相对音量；设备音量使用 iPhone 音量键调整。</Text>
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
