import {useState,useSyncExternalStore,type ReactNode} from 'react';
import {Pressable,ScrollView,StyleSheet,Switch,View,useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {StageStyle} from '../app/preferences.ts';
import type {Track} from '../domain/track.ts';
import {Lyrics} from './Lyrics.tsx';
import {Text} from './Typography.tsx';

export const stageStyles=[['classic','经典'],['neon','霓虹'],['cyberpunk','赛博'],['aurora','炫彩']] as const;
const backgrounds:Record<StageStyle,readonly [string,string,string]>={classic:['#09131F','#09131F','#09131F'],neon:['#132938','#251C39','#0A1723'],cyberpunk:['#062C39','#30182E','#0A1723'],aurora:['#202955','#362444','#10372D']};
export function StagePlayer({services,track,lyricTrack,font,controls,onMore,onStyle}:{services:Services;track:Track;lyricTrack:Track;font?:string;controls:ReactNode;onMore:()=>void;onStyle:()=>void}){
  const prefs=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const [choosing,setChoosing]=useState(false),[error,setError]=useState('');
  const {width,height,fontScale}=useWindowDimensions(),columns=width>height&&width>=600&&fontScale<1.8;
  const save=(patch:{stageStyle?:StageStyle;stageBackdrop?:boolean})=>{void services.preferences.update(patch).then(()=>setError('')).catch(()=>setError('舞台设置未保存，原设置保留'));};
  const tool=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{minWidth:48,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={24} color="#FFFFFF"/></Pressable>;
  return <View testID="stage-player" style={{flex:1,minHeight:0,gap:8}}>
    {prefs.stageBackdrop&&prefs.stageStyle!=='classic'&&<LinearGradient testID="stage-backdrop" pointerEvents="none" colors={backgrounds[prefs.stageStyle]} style={[StyleSheet.absoluteFill,{borderRadius:20}]}/>}
    <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={{color:'#FFFFFF',fontSize:22,fontWeight:'700'}}>{track.title}</Text><Text numberOfLines={1} style={{color:'#D5D5DA',fontSize:14}}>{track.artist}</Text></View>{tool('ellipsis-horizontal','更多播放控制',onMore)}</View>
    <View testID={columns?"stage-horizontal":"stage-vertical"} style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:12}}>
    <View testID="stage-lyric-viewport" collapsable={false} style={{flex:1,minHeight:0,overflow:'hidden'}}><Lyrics services={services} track={lyricTrack} font={font} presentation="stage"/></View>
    <ScrollView style={columns?{width:'38%',flexGrow:0}:{flexGrow:0,maxHeight:Math.max(90,height*.32)}} contentContainerStyle={{paddingHorizontal:8,paddingBottom:4}}>{(playback.error||playback.phase==='resolving'||playback.buffering)&&<Text accessibilityLiveRegion="polite" style={{color:'#FFFFFF'}}>{playback.error??(playback.phase==='resolving'?'正在选择可用音源…':'正在缓冲…')}</Text>}{controls}
      {choosing?<View testID="stage-style-panel" style={{gap:10,paddingTop:4}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <Text style={{color:'#FFFFFF',fontSize:15,fontWeight:'600'}}>舞台样式</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="收起舞台样式" onPress={()=>setChoosing(false)} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="close" size={20} color="#FFFFFF"/></Pressable>
        </View>
        {/* IMG_4872: four pill chips in one row, selection inverts to white. */}
        <View style={{flexDirection:'row',gap:8}}>{stageStyles.map(([id,title])=>{
          const selected=prefs.stageStyle===id;
          return <Pressable key={id} testID={`stage-style-${id}`} accessibilityRole="radio" accessibilityState={{selected}} onPress={()=>save({stageStyle:id})} style={{flex:1,minHeight:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:selected?'#FFFFFF':'rgba(255,255,255,0.08)',borderWidth:1,borderColor:selected?'#FFFFFF':'rgba(255,255,255,0.16)'}}><Text numberOfLines={1} style={{color:selected?'#111111':'#FFFFFF',fontSize:13,fontWeight:selected?'600':'400'}}>{title}</Text></Pressable>;
        })}</View>
        <View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Text style={{color:'#FFFFFF',flex:1,fontSize:14}}>动态背景</Text><Switch accessibilityLabel="舞台背景" value={prefs.stageBackdrop} onValueChange={value=>save({stageBackdrop:value})} trackColor={{true:'#FFFFFF',false:'rgba(255,255,255,0.25)'}}/></View>
        {!!error&&<Text accessibilityRole="alert" style={{color:'#FFD7BA'}}>{error}</Text>}
      </View>:<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Pressable testID="stage-style-selector" accessibilityRole="button" accessibilityLabel="舞台样式" accessibilityValue={{text:stageStyles.find(([id])=>id===prefs.stageStyle)![1]}} onPress={()=>setChoosing(true)} style={{minHeight:48,justifyContent:'center',flex:1}}><Text style={{color:'#FFFFFF'}}>舞台样式 · {stageStyles.find(([id])=>id===prefs.stageStyle)![1]}</Text></Pressable>{tool('options-outline','调整播放界面',onStyle)}</View>}
    </ScrollView></View>
  </View>;
}
