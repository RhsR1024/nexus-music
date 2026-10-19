import {useRef,useState,useSyncExternalStore} from 'react';
import {View,StyleSheet,useWindowDimensions,type GestureResponderEvent} from 'react-native';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
const time=(value:number)=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}`;
export function PlaybackProgress({services,adaptive=false}:{services:Services;adaptive?:boolean}){
  const controller=services.playback.controller,state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const largeText=useWindowDimensions().fontScale>1.4&&adaptive;
  const gestureToken=useRef<string|undefined>(undefined);
  const width=useRef(1),[preview,setPreview]=useState<number>();
  const fraction=(event:GestureResponderEvent)=>Math.min(1,Math.max(0,event.nativeEvent.locationX/width.current));
  const position=preview??state.position,percent=state.duration>0?Math.min(100,Math.max(0,position/state.duration*100)):0;
  return <View style={{gap:2}}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="播放进度" accessibilityValue={{min:0,max:Math.floor(state.duration),now:Math.floor(position),text:`${time(position)} / ${time(state.duration)}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>controller.seek(state.position+(event.nativeEvent.actionName==='increment'?10:-10))}
      onLayout={event=>{width.current=Math.max(1,event.nativeEvent.layout.width);}} onStartShouldSetResponder={()=>state.duration>0} onMoveShouldSetResponder={()=>state.duration>0}
      onResponderGrant={event=>{gestureToken.current=JSON.stringify(state.token);setPreview(fraction(event)*state.duration);}} onResponderMove={event=>setPreview(fraction(event)*state.duration)} onResponderRelease={event=>{if(gestureToken.current===JSON.stringify(controller.getSnapshot().token))controller.seek(fraction(event)*state.duration);gestureToken.current=undefined;setPreview(undefined);}} onResponderTerminate={()=>{gestureToken.current=undefined;setPreview(undefined);}} style={{height:44,justifyContent:'center'}}>
      <View pointerEvents="none" style={{height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,0.22)'}}><View style={{height:5,width:`${percent}%`,borderRadius:3,backgroundColor:'#FFFFFF'}}/></View>
      {preview!==undefined&&<View pointerEvents="none" style={{position:'absolute',left:`${percent}%`,marginLeft:-7,width:14,height:14,borderRadius:7,backgroundColor:'#FFFFFF'}}/>}
    </View>
    <View style={{flexDirection:largeText?'column':'row',justifyContent:'space-between',alignItems:largeText?'stretch':'center',gap:largeText?6:0}}>
      {largeText?<View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}><Text numberOfLines={1} style={[styles.small,{flexShrink:1}]}>{time(position)}</Text><Text numberOfLines={1} style={[styles.small,{flexShrink:1}]}>−{time(state.duration-position)}</Text></View>:<Text style={styles.small}>{time(position)}</Text>}
      <Text numberOfLines={1} style={[styles.small,{flexShrink:1,borderWidth:1,borderColor:'rgba(255,255,255,0.28)',borderRadius:10,paddingHorizontal:9,paddingVertical:3}]}>{state.media?.quality?`${state.media.quality.toUpperCase()} 档`:'等待音源'}</Text>
      {!largeText&&<Text style={styles.small}>−{time(state.duration-position)}</Text>}
    </View>
  </View>;
}
const styles=StyleSheet.create({small:{color:'rgba(255,255,255,0.64)',fontSize:13,lineHeight:20}});
