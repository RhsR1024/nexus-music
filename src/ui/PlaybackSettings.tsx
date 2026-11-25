import {Text,TextInput} from './Typography.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {Pressable, StyleSheet, Switch, View, type ViewProps} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {requireNativeView} from 'expo';
import type {Services} from '../app/services.ts';
import type {LyricChineseMode} from '../app/preferences.ts';
import {GainSlider} from './EqualizerGraph.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,sollinTokens,space} from './tokens.ts';
import {sleepCountdown} from '../playback/sleep.ts';
const NativeRoutePicker=requireNativeView<ViewProps&{tint:string;activeTint:string}>('NexusNative','RoutePicker');
const NativeDeviceVolume=requireNativeView<ViewProps&{tint:string}>('NexusNative','DeviceVolume');
const chineseModes:readonly [LyricChineseMode,string][]=[['original','保持原文'],['simplified','转为简体'],['traditional','转为繁体']];
export function PlaybackSettings({services}:{services:Services}) {
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance),settings=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const [minutes,setMinutes]=useState('30'),[now,setNow]=useState(Date.now()),[error,setError]=useState('');
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  useEffect(()=>{if(sleep.mode!=='duration')return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[sleep]);
  const set=(seconds:number,finish=false)=>{void services.playback.sleep.set(seconds,finish).then(()=>setError('')).catch(()=>setError('定时设置未保存，请重试'));};
  const update=(patch:Parameters<typeof services.preferences.update>[0],msg='设置未保存，请重试')=>{setError('');void services.preferences.update(patch).catch(()=>setError(msg));};
  const button=(title:string,action:()=>void,disabled=false,testID?:string,primary=false)=><Pressable testID={testID} accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={action} style={{backgroundColor:primary?s.control:s.chip,borderWidth:primary?0:1,borderColor:s.chipBorder,minHeight:40,paddingHorizontal:14,paddingVertical:9,borderRadius:20,justifyContent:'center',alignItems:'center',opacity:disabled?.4:1}}><Text style={{color:primary?'#FFFFFF':s.ink,fontSize:13,fontWeight:'600'}}>{title}</Text></Pressable>;
  const toggleRow=(id:string,icon:React.ComponentProps<typeof Ionicons>['name'],title:string,subtitle:string,value:boolean,onChange:(v:boolean)=>void,last=false)=><View key={id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:14,borderBottomWidth:last?0:StyleSheet.hairlineWidth,borderBottomColor:s.hairline}}>
    <View style={{width:26,alignItems:'center'}}><Ionicons name={icon} size={20} color={s.ink}/></View>
    <View style={{flex:1,gap:2}}><Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{title}</Text><Text style={{color:s.muted,fontSize:12,lineHeight:17}}>{subtitle}</Text></View>
    <Switch testID={id} accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={s.switchTrack} thumbColor={s.switchThumb(value)}/>
  </View>;
  return <View style={{gap:14,marginTop:14}}>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,marginLeft:6}}>播放偏好</Text>
    <View style={{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'}}>
      {toggleRow('playback-autoplay','power-outline','启动自动播放','打开应用且队列有歌曲时自动恢复播放',settings.autoPlayOnLaunch,autoPlayOnLaunch=>update({autoPlayOnLaunch}))}
      {toggleRow('playback-open-player','open-outline','启动进入播放界面','启动 App 后自动展开完整播放界面，没有歌曲时保持首页',settings.openPlayerOnLaunch,openPlayerOnLaunch=>update({openPlayerOnLaunch}))}
      {toggleRow('playback-mix-audio','volume-high-outline','和其他 App 同时播放','允许与系统内其他音频混合播放，不打断对方',settings.mixWithOtherAudio,mixWithOtherAudio=>update({mixWithOtherAudio}))}
      {toggleRow('playback-preload-next','link-outline','播放链接预加载','在当前歌曲接近结束前优先准备下一首音源地址',settings.preloadNextTrack,preloadNextTrack=>update({preloadNextTrack}),true)}
    </View>
    <View style={{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12}}>
      <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>歌词与在线匹配</Text>
      <View style={{gap:6}}>
        <Text style={{color:s.muted,fontSize:12}}>简繁歌词转换</Text>
        <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{chineseModes.map(([mode,label])=>{
          const active=settings.lyricChineseMode===mode;
          return <Pressable key={mode} testID={`lyric-chinese-${mode}`} accessibilityRole="radio" accessibilityState={{selected:active}} onPress={()=>update({lyricChineseMode:mode})} style={{paddingHorizontal:13,paddingVertical:8,borderRadius:18,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder}}><Text style={{color:active?'#FFFFFF':s.ink,fontSize:13,fontWeight:active?'600':'500'}}>{label}</Text></Pressable>;
        })}</View>
      </View>
      {button(`普通在线歌曲自动匹配：${settings.autoMatch?'开启':'关闭'}`,()=>update({autoMatch:!settings.autoMatch},'自动匹配设置未保存'),false,'automatic-online-matching')}
      <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>原曲当前音质不可用时，先尝试其他平台的可靠同版本，再降音质。手动指定的版本优先，原始收藏和歌单保留。</Text>
    </View>
    <View style={{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12}}>
      <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>音量与音频输出</Text>
      <GainSlider testID="app-volume" label="App 音量" format={value=>`${Math.round((value+12)/24*100)}%`} value={settings.volume*24-12} onChange={value=>update({volume:(value+12)/24},'音量未保存')}/>
      <Text style={{color:s.muted,fontSize:12}}>只调整音枢播放器的相对音量，不修改系统输出音量。</Text>
      <View testID="device-volume-control" style={{minHeight:84,padding:12,borderRadius:16,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,gap:4}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.md}}>
          <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>设备音量</Text>
          <Text style={{color:s.muted,fontSize:12}}>系统输出</Text>
        </View>
        <NativeDeviceVolume tint={s.control} style={{width:'100%',height:40}}/>
      </View>
      <View testID="system-audio-output" style={{minHeight:64,padding:12,borderRadius:16,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',gap:space.md}}>
        <View style={{flex:1,gap:2}}>
          <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>系统音频输出</Text>
          <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>AirPlay、蓝牙和耳机设备由 iOS 提供。</Text>
        </View>
        <View style={{width:Math.max(controls.hit,44),height:Math.max(controls.hit,44),borderRadius:radius.full,backgroundColor:s.cardElevated,borderWidth:1,borderColor:s.cardBorder,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
          <NativeRoutePicker tint={s.ink} activeTint={s.accent} pointerEvents="auto" style={{width:44,height:44}}/>
        </View>
      </View>
    </View>
    <View style={{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>睡眠定时</Text>
        <Text testID="sleep-status" style={{color:sleep.mode==='off'?s.muted:s.control,fontSize:13,fontWeight:'600'}}>{sleep.mode==='off'?'未开启':sleep.mode==='track'?'本曲播放结束后停止':`剩余 ${sleepCountdown(sleep.deadline,now)}`}</Text>
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[15,30,60,90].map(value=><View key={value}>{button(`${value}分钟`,()=>set(value*60))}</View>)}</View>
      <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
        <TextInput accessibilityLabel="睡眠定时分钟" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} placeholder="1–1440 分钟" placeholderTextColor={s.subtle} maxLength={4} style={{flex:1,paddingHorizontal:14,paddingVertical:10,color:s.ink,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,borderRadius:16}}/>
        {button('开始自定义定时',()=>{const value=Number(minutes);if(!/^\d+$/.test(minutes)||value<1||value>1440){setError('请输入1到1440分钟');return;}set(value*60);},false,undefined,true)}
      </View>
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
        {button('本曲结束后停止',()=>set(0,true),!state.queue.currentId||state.phase!=='ready')}
        {sleep.mode!=='off'&&button('取消睡眠定时',()=>set(0))}
      </View>
      <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>定时由原生播放器执行，重启后取消。本曲后停止绑定当前队列条目，手动切换歌曲后取消。</Text>
    </View>
    {!!error&&<Text accessibilityRole="alert" style={{color:s.accent,marginLeft:6}}>{error}</Text>}
  </View>;
}
