import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Switch, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
import {useTheme, type Theme} from './theme.tsx';
import {radius, space, typography} from './tokens.ts';

const rates=[0.5,0.75,1,1.25,1.5,2,3] as const;
const presets=[15,30,45,60,90] as const;

function chipStyle(selected:boolean,theme:Theme){
  return [stylesChip.base,{backgroundColor:selected?theme.palette.selected:theme.palette.surface,borderColor:selected?theme.palette.accent:theme.palette.border}];
}
const stylesChip=StyleSheet.create({base:{minWidth:70,minHeight:44,paddingHorizontal:8,borderRadius:radius.md,borderWidth:1,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6}});

export function RatePanel({services,onBack}:{services:Services;onBack:()=>void}){
  const theme=useTheme(),styles=makeStyles(theme);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [error,setError]=useState('');
  const apply=(rate:number)=>{void services.playback.setRate(rate).then(()=>setError('')).catch(()=>setError('倍速未保存，请重试'));};
  return <View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={18} color={theme.palette.secondary}/><Text style={styles.backText}>返回</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>播放倍速</Text>
    <View style={styles.chips}>{rates.map(rate=>{
      const selected=Math.abs(preferences.rate-rate)<0.001;
      return <Pressable key={rate} accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={`倍速 ${rate}x`} onPress={()=>apply(rate)} style={chipStyle(selected,theme)}>
        {selected&&<Ionicons name="checkmark" size={16} color={theme.palette.accent}/>}
        <Text style={[styles.chipText,selected&&{color:theme.palette.accent}]}>{rate}x</Text>
      </Pressable>;
    })}</View>
    {!!error&&<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <Text style={styles.hint}>倍速按音源实际播放生效，切换歌曲后保持。</Text>
  </View>;
}

function Wheel({values,index,onChange,label,theme}:{values:number[];index:number;onChange:(value:number)=>void;label:string;theme:Theme}){
  const ref=useRef<ScrollView>(null),styles=makeStyles(theme),item=36;
  useEffect(()=>{ref.current?.scrollTo({y:index*item,animated:false});},[]);
  return <View style={{height:item*3,width:110}} accessibilityLabel={label}>
    <View pointerEvents="none" style={{position:'absolute',top:item,left:0,right:0,height:item,borderRadius:10,backgroundColor:theme.palette.selected,opacity:.55}}/>
    <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={item} decelerationRate="fast" contentContainerStyle={{paddingVertical:item}}
      onMomentumScrollEnd={event=>{const next=Math.round(event.nativeEvent.contentOffset.y/item);onChange(values[Math.max(0,Math.min(values.length-1,next))]??0);}}>
      {values.map(value=><View key={value} style={{height:item,alignItems:'center',justifyContent:'center'}}><Text style={styles.wheelText}>{value}</Text></View>)}
    </ScrollView>
  </View>;
}

export function SleepPanel({services,onBack}:{services:Services;onBack:()=>void}){
  const theme=useTheme(),styles=makeStyles(theme);
  const sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const [custom,setCustom]=useState(false),[hours,setHours]=useState(0),[minutes,setMinutes]=useState(30),[now,setNow]=useState(Date.now()),[error,setError]=useState('');
  useEffect(()=>{if(sleep.mode!=='duration')return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[sleep]);
  const apply=(seconds:number,finish=false)=>{void services.playback.sleep.set(seconds,finish).then(()=>setError('')).catch(()=>setError('定时设置未保存，请重试'));};
  const status=sleep.mode==='off'?'未开启':sleep.mode==='track'?'本曲播放结束后停止':`剩余 ${Math.max(0,Math.ceil((sleep.deadline-now)/60000))} 分钟`;
  return <View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="返回播放选项" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={18} color={theme.palette.secondary}/><Text style={styles.backText}>返回</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>睡眠定时器</Text>
    <Text testID="sleep-status" style={styles.status}>{status}</Text>
    <View style={styles.chips}>
      {presets.map(minutes=><Pressable key={minutes} accessibilityRole="button" accessibilityLabel={`${minutes} 分钟`} onPress={()=>apply(minutes*60)} style={chipStyle(false,theme)}><Text style={styles.chipText}>{minutes} 分钟</Text></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="自定义" onPress={()=>setCustom(value=>!value)} style={chipStyle(custom,theme)}><Ionicons name="options-outline" size={16} color={theme.palette.accent}/><Text style={styles.chipText}>自定义</Text></Pressable>
    </View>
    {custom&&<>
      <View style={styles.wheels}>
        <Wheel values={Array.from({length:13},(_,i)=>i)} index={hours} onChange={setHours} label="小时" theme={theme}/>
        <Text style={styles.wheelUnit}>小时</Text>
        <Wheel values={Array.from({length:60},(_,i)=>i)} index={minutes} onChange={setMinutes} label="分钟" theme={theme}/>
        <Text style={styles.wheelUnit}>分钟</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="开始定时" onPress={()=>apply(hours*3600+minutes*60)} style={styles.start}><Ionicons name="timer-outline" size={18} color="#FFFFFF"/><Text style={styles.startText}>开始定时</Text></Pressable>
    </>}
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>播完当前歌曲再停止</Text>
      <Switch accessibilityLabel="播完当前歌曲再停止" value={sleep.mode==='track'} onValueChange={value=>{if(value)apply(0,true);else apply(0);}} trackColor={{true:theme.palette.accent,false:theme.palette.border}} thumbColor="#FFFFFF"/>
    </View>
    {sleep.mode!=='off'&&<Pressable accessibilityRole="button" accessibilityLabel="取消睡眠定时" onPress={()=>apply(0)} style={styles.cancel}><Text style={[styles.chipText,{color:theme.palette.accent}]}>取消睡眠定时</Text></Pressable>}
    {!!error&&<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
  </View>;
}

const makeStyles=(theme:Theme)=>StyleSheet.create({
  root:{flexGrow:1,backgroundColor:theme.palette.background[0],paddingHorizontal:space.lg,paddingBottom:space.xxl,gap:space.md},
  back:{flexDirection:'row',alignItems:'center',gap:2,minHeight:44,marginTop:space.sm},
  backText:{...typography.caption,color:theme.palette.secondary},
  title:{...typography.title,color:theme.palette.text},
  status:{...typography.caption,color:theme.palette.secondary},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:space.sm,marginTop:space.xs},
  chipText:{...typography.body,fontSize:15,color:theme.palette.text},
  hint:{...typography.micro,color:theme.palette.secondary},
  wheels:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.sm},
  wheelText:{...typography.body,fontSize:17,color:theme.palette.text},
  wheelUnit:{...typography.caption,color:theme.palette.secondary},
  start:{minHeight:52,borderRadius:radius.xl,backgroundColor:theme.palette.accent,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.sm},
  startText:{...typography.body,fontSize:16,fontWeight:'600',color:'#FFFFFF'},
  switchRow:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.md},
  switchLabel:{...typography.body,fontSize:16,color:theme.palette.text},
  cancel:{minHeight:44,alignItems:'center',justifyContent:'center'},
  error:{...typography.micro,color:'#B3261E'},
});
