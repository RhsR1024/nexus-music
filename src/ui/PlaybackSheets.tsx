import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, View, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {lyricOffset} from '../lyrics/settings.ts';
import {Text} from './Typography.tsx';
import {useTheme, type Theme} from './theme.tsx';
import {sollinTokens, space} from './tokens.ts';
import {customSleepSeconds,sleepCountdown} from '../playback/sleep.ts';

const rates=[0.5,0.75,1,1.25,1.5,2,3] as const;
const presets=[15,30,45,60,90] as const;

function chipStyle(selected:boolean,theme:Theme,wide=false){
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return [stylesChip.base,wide&&stylesChip.wide,{backgroundColor:selected?(s.dark?'rgba(232,61,86,0.22)':'#F7DFE2'):s.cardElevated,borderColor:selected?s.accent:s.cardBorder}];
}
const stylesChip=StyleSheet.create({
  base:{minWidth:74,minHeight:44,paddingHorizontal:12,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:5},
  wide:{flexBasis:'31%',flexGrow:1,minWidth:92},
});

export function RatePanel({services,onBack}:{services:Services;onBack:()=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=makeStyles(theme);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [error,setError]=useState('');
  const apply=(rate:number)=>{void services.playback.setRate(rate).then(()=>setError('')).catch(()=>setError('倍速未保存，请重试'));};
  return <View style={styles.root}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={18} color={s.muted}/><Text style={styles.backText}>返回</Text></Pressable>
      <Text style={styles.badgeText}>{Number.isInteger(preferences.rate)?`${preferences.rate}.0x`:`${preferences.rate}x`}</Text>
    </View>
    <Text accessibilityRole="header" style={styles.title}>播放倍速</Text>
    <View style={styles.chips}>{rates.map(rate=>{
      const selected=Math.abs(preferences.rate-rate)<0.001;
      const display=Number.isInteger(rate)?`${rate}.0x`:`${rate}x`;
      return <Pressable key={rate} accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={`倍速 ${rate}x`} onPress={()=>apply(rate)} style={chipStyle(selected,theme)}>
        {selected&&<Ionicons name="checkmark" size={15} color={s.accent}/>}
        <Text style={[styles.chipText,selected&&{color:s.accent,fontWeight:'700'}]}>{display}</Text>
      </Pressable>;
    })}</View>
    {!!error&&<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <Text style={styles.hint}>倍速按音源实际播放生效，切换歌曲后保持。</Text>
  </View>;
}

function Wheel({values,index,onChange,label,theme}:{values:number[];index:number;onChange:(value:number)=>void;label:string;theme:Theme}){
  const ref=useRef<ScrollView>(null),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=makeStyles(theme),item=36;
  useEffect(()=>{ref.current?.scrollTo({y:index*item,animated:false});},[index]);
  const select=(next:number)=>onChange(values[Math.max(0,Math.min(values.length-1,next))]??0);
  const settle=(event:NativeSyntheticEvent<NativeScrollEvent>)=>select(Math.round(event.nativeEvent.contentOffset.y/item));
  return <View style={{height:item*3,width:96}} testID={`sleep-wheel-${label}`} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{min:0,max:values.length-1,now:index,text:String(values[index]??0)}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='increment')select(index+1);else if(event.nativeEvent.actionName==='decrement')select(index-1);}}>
    <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={item} decelerationRate="fast" contentContainerStyle={{paddingVertical:item}}
      onScrollEndDrag={event=>{if(Math.abs(event.nativeEvent.velocity?.y??0)<.01)settle(event);}} onMomentumScrollEnd={settle}>
      {values.map((value,i)=><View key={value} style={{height:item,alignItems:'center',justifyContent:'center'}}><Text style={[styles.wheelText,i===index?{color:s.ink,fontSize:20,fontWeight:'700'}:{color:s.muted,opacity:0.48,fontSize:16}]}>{String(value).padStart(2,'0')}</Text></View>)}
    </ScrollView>
  </View>;
}

export function SleepPanel({services,onBack}:{services:Services;onBack:()=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=makeStyles(theme);
  const sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const [custom,setCustom]=useState(false),[hours,setHours]=useState(0),[minutes,setMinutes]=useState(30),[now,setNow]=useState(Date.now()),[error,setError]=useState('');
  useEffect(()=>{if(sleep.mode!=='duration')return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[sleep]);
  const apply=(seconds:number,finish=false)=>{void services.playback.sleep.set(seconds,finish).then(()=>setError('')).catch(()=>setError('定时设置未保存，请重试'));};
  const startCustom=()=>{const seconds=customSleepSeconds(hours,minutes);if(seconds===undefined){setError('请选择至少1分钟');return;}apply(seconds);};
  const stopNow=()=>{void services.playback.sleep.stopNow().then(()=>setError('')).catch(()=>setError('未能立即停止播放，请重试'));};
  const status=sleep.mode==='off'?'未开启':sleep.mode==='track'?'本曲播放结束后停止':`剩余 ${sleepCountdown(sleep.deadline,now)}`;
  return <View style={styles.root}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={18} color={s.muted}/><Text style={styles.backText}>返回</Text></Pressable>
      <Text testID="sleep-status" style={styles.statusPill}>{status}</Text>
    </View>
    <Text accessibilityRole="header" style={styles.title}>睡眠定时器</Text>
    <View style={styles.grid}>
      {presets.map(mins=><Pressable key={mins} accessibilityRole="button" accessibilityLabel={`${mins} 分钟`} onPress={()=>apply(mins*60)} style={chipStyle(false,theme,true)}><Text style={styles.chipText}>{mins} 分钟</Text></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="自定义" onPress={()=>setCustom(value=>!value)} style={chipStyle(custom,theme,true)}><Ionicons name="options-outline" size={15} color={s.accent}/><Text style={[styles.chipText,custom&&{color:s.accent,fontWeight:'700'}]}>自定义</Text></Pressable>
    </View>
    {custom&&<View style={styles.wheelCard}>
      <View style={styles.wheels}>
        <View pointerEvents="none" style={[styles.wheelBand,{backgroundColor:s.accentSoft}]}/>
        <Wheel values={Array.from({length:13},(_,i)=>i)} index={hours} onChange={setHours} label="小时" theme={theme}/>
        <Text style={styles.wheelUnit}>小时</Text>
        <Wheel values={Array.from({length:60},(_,i)=>i)} index={minutes} onChange={setMinutes} label="分钟" theme={theme}/>
        <Text style={styles.wheelUnit}>分钟</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="开始定时" onPress={startCustom} style={styles.start}><Ionicons name="timer-outline" size={18} color="#FFFFFF"/><Text style={styles.startText}>开始定时</Text></Pressable>
    </View>}
    <View style={[styles.switchRow,{backgroundColor:s.cardElevated,borderColor:s.cardBorder}]}>
      <Text style={styles.switchLabel}>播完当前歌曲再停止</Text>
      <Switch accessibilityLabel="播完当前歌曲再停止" value={sleep.mode==='track'} onValueChange={value=>{if(value)apply(0,true);else apply(0);}} trackColor={s.switchTrack} thumbColor={s.switchThumb(sleep.mode==='track')}/>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="立即停止播放" disabled={!playback.queue.currentId} onPress={stopNow} style={[styles.immediate,!playback.queue.currentId&&{opacity:.4}]}><Ionicons name="stop-circle-outline" size={18} color={s.accent}/><Text style={[styles.chipText,{color:s.accent,fontWeight:'600'}]}>立即停止播放</Text></Pressable>
    {sleep.mode!=='off'&&<Pressable accessibilityRole="button" accessibilityLabel="取消睡眠定时" onPress={()=>apply(0)} style={styles.cancel}><Text style={[styles.chipText,{color:s.muted,fontWeight:'600'}]}>取消睡眠定时</Text></Pressable>}
    {!!error&&<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
  </View>;
}

export function LyricOffsetPanel({services,track,onBack}:{services:Services;track:Track;onBack:()=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=makeStyles(theme);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [scope,setScope]=useState<'track'|'global'>('track'),[error,setError]=useState('');
  const key=trackKey(track.origin),effective=lyricOffset(preferences.lyricOffsetMs,preferences.lyricOffsets,key);
  const current=scope==='global'?preferences.lyricOffsetMs:preferences.lyricOffsets[key]??0;
  const apply=(delta:number)=>{
    const next=delta===0?0:Math.max(-600000,Math.min(600000,current+delta));
    void (scope==='global'?services.preferences.update({lyricOffsetMs:next}):services.preferences.setLyricOffset(key,next))
      .then(()=>setError('')).catch(()=>setError('歌词偏移未保存，请重试'));
  };
  return <View style={styles.root}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={18} color={s.muted}/><Text style={styles.backText}>返回</Text></Pressable>
      <Text style={styles.statusPill}>生效 {effective>=0?`+${effective}`:effective} ms</Text>
    </View>
    <Text accessibilityRole="header" style={styles.title}>歌词时间偏移</Text>
    <View style={{flexDirection:'row',gap:8}}>
      {(['track','global'] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{selected:scope===value}} onPress={()=>setScope(value)} style={chipStyle(scope===value,theme)}><Text style={[styles.chipText,scope===value&&{color:s.accent,fontWeight:'700'}]}>{value==='track'?'调整本曲':'调整全局'}</Text></Pressable>)}
    </View>
    <View style={[styles.switchRow,{backgroundColor:s.cardElevated,borderColor:s.cardBorder,flexDirection:'column',alignItems:'stretch',paddingVertical:14,gap:12}]}>
      <Text style={{color:s.ink,fontSize:15,fontWeight:'600',textAlign:'center',fontVariant:['tabular-nums']}}>
        {scope==='track'?'本曲偏移':'全局偏移'}：{current>=0?`+${current}`:current} ms（正值延后，负值提前）
      </Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
        {[-1000,-500,-100,0,100,500,1000].map(delta=><Pressable key={delta} accessibilityRole="button" onPress={()=>apply(delta)} style={{minWidth:64,minHeight:40,paddingHorizontal:12,borderRadius:12,backgroundColor:delta===0?s.accentSoft:s.chip,borderWidth:1,borderColor:delta===0?s.accent:s.cardBorder,alignItems:'center',justifyContent:'center'}}><Text style={{color:delta===0?s.accent:s.ink,fontSize:13,fontWeight:'600',fontVariant:['tabular-nums']}}>{delta===0?'重置':`${delta>0?'+':''}${delta}ms`}</Text></Pressable>)}
      </View>
    </View>
    {!!error&&<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
  </View>;
}

const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return StyleSheet.create({
  root:{flexGrow:1,backgroundColor:'transparent',paddingHorizontal:20,paddingBottom:space.xxl,gap:14},
  topRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4},
  back:{flexDirection:'row',alignItems:'center',gap:2,minHeight:40},
  backText:{fontSize:14,color:s.muted},
  badgeText:{fontSize:14,fontWeight:'700',color:s.accent,fontVariant:['tabular-nums']},
  statusPill:{fontSize:12,fontWeight:'600',color:s.accent,backgroundColor:s.accentSoft,paddingHorizontal:10,paddingVertical:4,borderRadius:999,overflow:'hidden',fontVariant:['tabular-nums']},
  title:{fontSize:22,fontWeight:'800',color:s.ink},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:2},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:2},
  chipText:{fontSize:14,fontWeight:'500',color:s.ink,fontVariant:['tabular-nums']},
  hint:{fontSize:12,color:s.muted},
  wheelCard:{backgroundColor:s.cardElevated,borderWidth:1,borderColor:s.cardBorder,borderRadius:18,padding:14,gap:14},
  wheels:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.sm,position:'relative'},
  wheelBand:{position:'absolute',left:6,right:6,top:36,height:36,borderRadius:12},
  wheelText:{fontSize:17,fontWeight:'600',color:s.ink,fontVariant:['tabular-nums']},
  wheelUnit:{fontSize:13,color:s.muted,fontWeight:'500'},
  start:{minHeight:48,borderRadius:24,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  startText:{fontSize:15,fontWeight:'600',color:'#FFFFFF'},
  switchRow:{minHeight:54,paddingHorizontal:16,borderRadius:16,borderWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.md},
  switchLabel:{fontSize:15,fontWeight:'500',color:s.ink},
  immediate:{minHeight:48,borderWidth:1,borderColor:s.accent,backgroundColor:s.cardElevated,borderRadius:24,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  cancel:{minHeight:44,alignItems:'center',justifyContent:'center'},
  error:{fontSize:12,color:'#B3261E'},
  });
};
