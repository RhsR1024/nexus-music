import {useRef,useState,useSyncExternalStore} from 'react';
import {View,StyleSheet,useWindowDimensions,type GestureResponderEvent} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
import {paper} from './tokens.ts';
const time=(value:number)=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}`;
export function PlaybackProgress({services,adaptive=false,variant='default'}:{services:Services;adaptive?:boolean;variant?:'default'|'paper'|'stage'|'am'}){
  const controller=services.playback.controller,state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const largeText=useWindowDimensions().fontScale>1.4&&adaptive;
  const paperTone=variant==='paper',stageTone=variant==='stage',amTone=variant==='am';
  const trackHeight=amTone?8:stageTone?5:4;
  const stageTimes=stageTone&&!largeText;
  const timeStyle=amTone&&!largeText?styles.amTime:stageTone?styles.stageTime:paperTone?styles.paper:styles.small;
  const gestureToken=useRef<string|undefined>(undefined);
  const width=useRef(1),[preview,setPreview]=useState<number>();
  const fraction=(event:GestureResponderEvent)=>Math.min(1,Math.max(0,event.nativeEvent.locationX/width.current));
  const position=preview??state.position,percent=state.duration>0?Math.min(100,Math.max(0,position/state.duration*100)):0;
  return <View style={{gap:2,...(stageTone?{marginLeft:16,marginRight:8}:{}),...(amTone?{marginTop:-5}:{})}}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="播放进度" accessibilityValue={{min:0,max:Math.floor(state.duration),now:Math.floor(position),text:`${time(position)} / ${time(state.duration)}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>controller.seek(state.position+(event.nativeEvent.actionName==='increment'?10:-10))}
      onLayout={event=>{width.current=Math.max(1,event.nativeEvent.layout.width);}} onStartShouldSetResponder={()=>state.duration>0} onMoveShouldSetResponder={()=>state.duration>0}
      onResponderGrant={event=>{gestureToken.current=JSON.stringify(state.token);setPreview(fraction(event)*state.duration);}} onResponderMove={event=>setPreview(fraction(event)*state.duration)} onResponderRelease={event=>{if(gestureToken.current===JSON.stringify(controller.getSnapshot().token))controller.seek(fraction(event)*state.duration);gestureToken.current=undefined;setPreview(undefined);}} onResponderTerminate={()=>{gestureToken.current=undefined;setPreview(undefined);}} style={{height:44,justifyContent:'center',...(amTone?{marginTop:4}:{})}}>
      {/* IMG_4866 AM: 8pt track at 14% white with a 50% white fill and no knob; IMG_4872 stage: 5pt rose track with a 12pt knob. */}
      <View pointerEvents="none" style={{height:trackHeight,borderRadius:trackHeight/2,backgroundColor:paperTone?paper.track:stageTone?'rgba(255,255,255,0.02)':amTone?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.25)'}}><View style={{height:trackHeight,width:`${percent}%`,borderRadius:trackHeight/2,backgroundColor:paperTone?paper.accent:stageTone?'#8F4A4E':amTone?'rgba(255,255,255,0.50)':'#FFFFFF'}}/></View>
      {(paperTone||stageTone||preview!==undefined)&&<View pointerEvents="none" style={{position:'absolute',left:`${percent}%`,marginLeft:paperTone?-7.5:-6,width:paperTone?15:12,height:paperTone?15:12,borderRadius:paperTone?7.5:6,backgroundColor:paperTone?paper.accent:stageTone?'#8F4A4E':'#FFFFFF'}}/>}
    </View>
    <View style={{flexDirection:largeText&&!paperTone?'column':'row',justifyContent:'space-between',alignItems:largeText&&!paperTone?'stretch':'center',gap:largeText&&!paperTone?6:0,...(stageTimes?{marginTop:-8,marginLeft:-8}:{}),...(amTone?{marginTop:-5.3}:{})}}>
      {largeText&&!paperTone?<View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}><Text numberOfLines={1} style={[styles.small,{flexShrink:1}]}>{time(position)}</Text><Text numberOfLines={1} style={[styles.small,{flexShrink:1}]}>−{time(state.duration-position)}</Text></View>:<Text numberOfLines={1} style={timeStyle}>{time(position)}</Text>}
      {!paperTone&&!stageTone&&(amTone?<View style={{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:'rgba(255,255,255,0.32)',borderRadius:10,paddingHorizontal:10,paddingVertical:1}}><Ionicons name="pulse" size={12} color="rgba(255,255,255,0.8)"/><Text numberOfLines={1} style={[styles.amTime,{color:'rgba(255,255,255,0.8)',fontWeight:'600'}]}>{state.media?.quality?state.media.quality.toUpperCase():'等待音源'}</Text></View>:<Text numberOfLines={1} style={[styles.small,{flexShrink:1,borderRadius:8,paddingHorizontal:9,paddingVertical:3,backgroundColor:'rgba(0,0,0,0.28)'}]}>{state.media?.quality?`◆ ${state.media.quality.toUpperCase()}`:'等待音源'}</Text>)}
      {paperTone?<Text numberOfLines={1} style={styles.paper}>{time(state.duration)}</Text>:!largeText&&<Text style={timeStyle}>−{time(state.duration-position)}</Text>}
    </View>
  </View>;
}
const styles=StyleSheet.create({small:{color:'rgba(255,255,255,0.64)',fontSize:13,lineHeight:20},stageTime:{color:'rgba(255,255,255,0.62)',fontSize:13,lineHeight:16},amTime:{color:'rgba(255,255,255,0.72)',fontSize:12,lineHeight:15},paper:{color:paper.secondary,fontSize:11,lineHeight:16}});
