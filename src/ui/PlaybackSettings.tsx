import {Text,TextInput} from './Typography.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {Platform, Pressable, StyleSheet, Switch, View, type ViewProps} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {requireNativeView,requireOptionalNativeModule} from 'expo';
import type {Services} from '../app/services.ts';
import type {AutoPlaySource,BluetoothLyricsOrder,LyricChineseMode,SystemLyricsPosition} from '../app/preferences.ts';
import {GainSlider} from './EqualizerGraph.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,sollinTokens,space} from './tokens.ts';
import {sleepCountdown} from '../playback/sleep.ts';
const NativeRoutePicker=requireNativeView<ViewProps&{tint:string;activeTint:string}>('NexusNative','RoutePicker');
const NativeDeviceVolume=requireNativeView<ViewProps&{tint:string}>('NexusNative','DeviceVolume');
const chineseModes:readonly [LyricChineseMode,string][]=[['original','保持原文'],['simplified','转为简体'],['traditional','转为繁体']];
const autoPlaySources:readonly [AutoPlaySource,string][]=[['last','上次播放'],['favorites','收藏列表']];
const preloadCounts=[1,2,3] as const;
const fadeDurations=[300,500,1000,1500,2500] as const;
const systemLyricPositions:readonly [SystemLyricsPosition,string][]=[['artist','歌手栏'],['title','标题栏']];
const bluetoothLyricOrders:readonly [BluetoothLyricsOrder,string][]=[['lyric-first','仅歌词'],['artist-first','原信息 · 歌词']];
export function PlaybackSettings({services}:{services:Services}) {
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance),settings=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const [minutes,setMinutes]=useState('30'),[now,setNow]=useState(Date.now()),[error,setError]=useState('');
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  useEffect(()=>{if(sleep.mode!=='duration')return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[sleep]);
  const set=(seconds:number,finish=false)=>{void services.playback.sleep.set(seconds,finish).then(()=>setError('')).catch(()=>setError('定时设置未保存，请重试'));};
  const update=(patch:Parameters<typeof services.preferences.update>[0],msg='设置未保存，请重试')=>{setError('');void services.preferences.update(patch).catch(()=>setError(msg));};
  const button=(title:string,action:()=>void,disabled=false,testID?:string,primary=false)=><Pressable testID={testID} accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={action} style={{backgroundColor:primary?s.control:s.chip,borderWidth:primary?0:1,borderColor:s.chipBorder,minHeight:40,paddingHorizontal:14,paddingVertical:9,borderRadius:20,justifyContent:'center',alignItems:'center',opacity:disabled?.4:1}}><Text style={{color:primary?'#FFFFFF':s.ink,fontSize:13,fontWeight:'600'}}>{title}</Text></Pressable>;
  const pill=(id:string,label:string,active:boolean,onPress:()=>void,disabled=false)=><Pressable key={id} testID={id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected:active,disabled}} disabled={disabled} onPress={onPress} style={{paddingHorizontal:13,paddingVertical:7,minHeight:34,borderRadius:17,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder,justifyContent:'center',opacity:disabled?0.45:1}}><Text style={{color:active?'#FFFFFF':s.ink,fontSize:12.5,fontWeight:active?'700':'500'}}>{label}</Text></Pressable>;
  const divider=<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:54,backgroundColor:s.hairline}}/>;
  const toggleRow=(id:string,icon:React.ComponentProps<typeof Ionicons>['name'],title:string,subtitle:string,value:boolean,onChange:(v:boolean)=>void,extra?:React.ReactNode)=><View key={id} style={{paddingHorizontal:16,paddingVertical:13,gap:extra?10:0}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{width:26,alignItems:'center'}}><Ionicons name={icon} size={20} color={s.ink}/></View>
      <View style={{flex:1,gap:2}}><Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>{title}</Text><Text style={{color:s.muted,fontSize:12,lineHeight:17}}>{subtitle}</Text></View>
      <Switch testID={id} accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={s.switchTrack} thumbColor={s.switchThumb(value)}/>
    </View>
    {extra&&<View style={{paddingLeft:38,gap:6}}>{extra}</View>}
  </View>;
  return <View style={{gap:14,marginTop:14}}>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6,marginBottom:-6}}>播放偏好</Text>
    <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
      {toggleRow('playback-prefer-account','key-outline','优先使用账号权限播放','已登录平台账号时优先用账号自身权益直连播放，无权限、仅试听或失败时自动回退自定义 LX 音源',settings.preferAccountPlayback,preferAccountPlayback=>update({preferAccountPlayback}))}
      {divider}
      {toggleRow('playback-autoplay','power-outline','启动自动播放','打开应用且队列有歌曲时自动恢复播放',settings.autoPlayOnLaunch,autoPlayOnLaunch=>update({autoPlayOnLaunch}),
        <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <Text style={{color:s.muted,fontSize:12}}>来源</Text>
          {autoPlaySources.map(([source,label])=>pill(`playback-autoplay-source-${source}`,label,settings.autoPlaySource===source,()=>update({autoPlaySource:source})))}
        </View>
      )}
      {divider}
      {toggleRow('playback-open-player','open-outline','启动进入播放界面','启动 App 后自动展开完整播放界面，没有歌曲时保持首页',settings.openPlayerOnLaunch,openPlayerOnLaunch=>update({openPlayerOnLaunch}))}
      {divider}
      {toggleRow('playback-mix-audio','volume-high-outline','和其他 App 同时播放','允许与系统内其他音频混合播放，不打断对方',settings.mixWithOtherAudio,mixWithOtherAudio=>update({mixWithOtherAudio}))}
      {divider}
      {toggleRow('playback-fade-enabled','pulse-outline','淡入淡出','播放、暂停与切歌时平滑渐变音量',settings.playbackFadeEnabled,playbackFadeEnabled=>update({playbackFadeEnabled}),
        <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <Text style={{color:s.muted,fontSize:12}}>时长</Text>
          {fadeDurations.map(ms=>pill(`playback-fade-duration-${ms}`,`${ms}ms`,settings.playbackFadeDurationMs===ms,()=>update({playbackFadeDurationMs:ms})))}
        </View>
      )}
      {divider}
      {toggleRow('playback-system-lyrics','car-outline','蓝牙车载与锁屏实时歌词','将当前播放歌词同步推送至系统锁屏、灵动岛与蓝牙车机',settings.systemLyricsEnabled,systemLyricsEnabled=>update({systemLyricsEnabled}),
        <View style={{gap:8}}>
          <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <Text style={{color:s.muted,fontSize:12}}>显示位置</Text>
            {systemLyricPositions.map(([pos,label])=>pill(`playback-system-lyrics-pos-${pos}`,label,settings.systemLyricsPosition===pos,()=>update({systemLyricsPosition:pos})))}
          </View>
          <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <Text style={{color:s.muted,fontSize:12}}>车机格式</Text>
            {bluetoothLyricOrders.map(([ord,label])=>pill(`playback-bt-lyrics-order-${ord}`,label,settings.bluetoothLyricsOrder===ord,()=>update({bluetoothLyricsOrder:ord})))}
          </View>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <Text style={{color:s.muted,fontSize:12}}>暂停时立即恢复原歌名/歌手</Text>
            <Switch testID="playback-bt-lyrics-restore" accessibilityLabel="暂停时恢复原歌名和歌手" value={settings.bluetoothLyricsRestoreOnPause} onValueChange={bluetoothLyricsRestoreOnPause=>update({bluetoothLyricsRestoreOnPause})} trackColor={s.switchTrack} thumbColor={s.switchThumb(settings.bluetoothLyricsRestoreOnPause)}/>
          </View>
        </View>
      )}
      {divider}
      {toggleRow('playback-floating-lyrics','layers-outline','桌面悬浮歌词',Platform.OS==='android'?'在其他应用上方显示可拖拽歌词条（需系统悬浮窗权限）':'iOS 系统限制第三方悬浮窗，请开启上方「蓝牙车载与锁屏实时歌词」',settings.floatingLyricsEnabled,floatingLyricsEnabled=>{
        if(Platform.OS==='android'&&floatingLyricsEnabled){
          const mod=requireOptionalNativeModule<{canDrawFloatingLyrics?:()=>boolean;requestFloatingLyricsPermission?:()=>Promise<boolean>}>('NexusLyrics');
          if(mod?.canDrawFloatingLyrics&&!mod.canDrawFloatingLyrics()){
            void mod.requestFloatingLyricsPermission?.();
          }
        }
        update({floatingLyricsEnabled});
      },
        Platform.OS==='android'?<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <Text style={{color:s.muted,fontSize:12}}>锁定悬浮窗位置（防止误触）</Text>
          <Switch testID="playback-floating-lyrics-locked" accessibilityLabel="锁定桌面悬浮歌词" value={settings.floatingLyricsLocked} onValueChange={floatingLyricsLocked=>update({floatingLyricsLocked})} trackColor={s.switchTrack} thumbColor={s.switchThumb(settings.floatingLyricsLocked)}/>
        </View>:undefined
      )}
      {divider}
      {toggleRow('playback-preload-next','link-outline','播放链接预加载','在播放当前在线歌曲时提前解析后续歌曲链接',settings.preloadNextTrack,preloadNextTrack=>update({preloadNextTrack}),
        <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <Text style={{color:s.muted,fontSize:12}}>预加载曲数</Text>
          {preloadCounts.map(count=>pill(`playback-preload-count-${count}`,`${count} 首`,settings.preloadCount===count,()=>update({preloadCount:count})))}
        </View>
      )}
    </View>
    <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
      <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>歌词与在线匹配</Text>
      <View style={{gap:6}}>
        <Text style={{color:s.muted,fontSize:12}}>简繁歌词转换</Text>
        <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{chineseModes.map(([mode,label])=>{
          const active=settings.lyricChineseMode===mode;
          return <Pressable key={mode} testID={`lyric-chinese-${mode}`} accessibilityRole="radio" accessibilityState={{selected:active}} onPress={()=>update({lyricChineseMode:mode})} style={{paddingHorizontal:13,paddingVertical:8,borderRadius:18,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder}}><Text style={{color:active?'#FFFFFF':s.ink,fontSize:13,fontWeight:active?'700':'500'}}>{label}</Text></Pressable>;
        })}</View>
      </View>
      {button(`普通在线歌曲自动匹配：${settings.autoMatch?'开启':'关闭'}`,()=>update({autoMatch:!settings.autoMatch},'自动匹配设置未保存'),false,'automatic-online-matching')}
      <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>原曲当前音质不可用时，先尝试其他平台的可靠同版本，再降音质。手动指定的版本优先，原始收藏和歌单保留。</Text>
    </View>
    <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
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
    <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
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
