import {useEffect,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {AccessibilityInfo,Animated,AppState,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {Cover} from './Cover.tsx';
export function Vinyl({services,track,size,playing}:{services:Services;track:Track;size:number;playing:boolean}){
  const rotation=useRef(new Animated.Value(0)).current,[reduce,setReduce]=useState(true),[foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduce(value);});const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce),app=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>{active=false;motion.remove();app.remove();};},[]);
  useEffect(()=>{let active=true,animation:Animated.CompositeAnimation|undefined;
    const turn=(value:number)=>{if(!active)return;animation=Animated.timing(rotation,{toValue:value+1,duration:22000,useNativeDriver:true,isInteraction:false});animation.start(({finished})=>{if(finished&&active)turn(value+1);});};
    if(playing&&!reduce&&foreground)rotation.stopAnimation(turn);else rotation.stopAnimation();
    return()=>{active=false;animation?.stop();rotation.stopAnimation();};
  },[playing,reduce,foreground,rotation]);
  return <View accessible={false} style={{height:size+12,alignItems:'center',justifyContent:'center'}}>
    <Animated.View style={{width:size,height:size,borderRadius:size/2,backgroundColor:'#111214',borderWidth:2,borderColor:'#333638',alignItems:'center',justifyContent:'center',transform:[{rotate:rotation.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}>
      {Array.from({length:14},(_,i)=><View key={i} style={{position:'absolute',width:size-i*size*.035,height:size-i*size*.035,borderWidth:1,borderColor:i%2?'#252729':'#1A1C1E',borderRadius:size/2}}/>)}
      <View style={{width:size*.4,height:size*.4,borderRadius:size,overflow:'hidden'}}><Cover services={services} track={track} size={size*.4}/></View><View style={{position:'absolute',width:10,height:10,borderRadius:5,backgroundColor:'#BCC2C4',borderWidth:2,borderColor:'#53585B'}}/>
    </Animated.View>
    <View style={{position:'absolute',width:10,height:size*.62,borderRadius:5,backgroundColor:'#A6ADB1',right:size*.09,top:8,transform:[{rotate:playing? '24deg':'4deg'}],transformOrigin:'top'}}/>
  </View>;
}
export function FrequencyHalo({services,playing,children}:PropsWithChildren<{services:Services;playing:boolean}>){
  const spectrum=useSyncExternalStore(services.playback.spectrum.subscribe,services.playback.spectrum.getSnapshot);
  return <View style={{width:148,height:148,alignItems:'center',justifyContent:'center'}}>
    {Array.from({length:32},(_,i)=>{const angle=(i/32)*Math.PI*2,length=3+(playing&&spectrum.supported?Math.min(1,Math.max(0,spectrum.bands[i]??0))*13:0);return <View key={i} accessible={false} style={{position:'absolute',width:3,height:length,borderRadius:2,backgroundColor:'rgba(255,255,255,0.66)',left:72+Math.cos(angle)*64,top:72+Math.sin(angle)*64-length/2,transform:[{rotate:`${angle+Math.PI/2}rad`}]}}/>;})}
    <View style={{width:104,height:104,borderRadius:52,borderWidth:3,borderColor:'rgba(255,255,255,0.5)',alignItems:'center',justifyContent:'center'}}>{children}</View>
  </View>;
}
