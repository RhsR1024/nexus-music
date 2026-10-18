import {useEffect,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {AccessibilityInfo,Animated,AppState,Image,StyleSheet,View,type ViewProps} from 'react-native';
import {requireNativeView} from 'expo';
import type {Services} from '../app/services.ts';
import type {VisualAsset} from '../storage/visualAssets.ts';
export function useVisualImage(services:Services|undefined,image:VisualAsset|null|undefined){
  const [resolved,setResolved]=useState<{id:string;uri:string}>();
  useEffect(()=>{let valid=true;setResolved(undefined);if(services&&image)void services.visualAssets.resolve(image).then(uri=>{if(valid&&uri)setResolved({id:image.id,uri});});return()=>{valid=false;};},[services,image?.id]);
  return resolved?.id===image?.id?resolved?.uri:undefined;
}
function useMotionGate(moving:boolean){
  const [reduce,setReduce]=useState(true),[active,setActive]=useState(AppState.currentState==='active');
  useEffect(()=>{let valid=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(valid)setReduce(value);});const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce),app=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>{valid=false;motion.remove();app.remove();};},[]);
  return moving&&!reduce&&active;
}
const NativeAmbient=requireNativeView<ViewProps&{colors:readonly string[];identity:string;moving:boolean;pending:boolean;dark:boolean}>('NexusNative','Ambient');
export function AmbientSoftLights({colors,identity,moving,pending,dark}:{colors:readonly string[];identity:string;moving:boolean;pending:boolean;dark:boolean}){
  const running=useMotionGate(moving);
  return <View testID={`ambient-motion-${running?'active':'still'}`} pointerEvents="none" style={StyleSheet.absoluteFill}><NativeAmbient testID="ambient-soft-lights" colors={colors} identity={identity} moving={running} pending={pending} dark={dark} pointerEvents="none" style={StyleSheet.absoluteFill}/></View>;
}
export function MotionImage({uri,blur=0,opacity=1,moving=false,onError,testID}:{testID?:string;uri:string;blur?:number;opacity?:number;moving?:boolean;onError?:()=>void}){
  const phase=useRef(new Animated.Value(0)).current,running=useMotionGate(moving);
  useEffect(()=>{let alive=true,animation:Animated.CompositeAnimation|undefined;
    const step=(next:number)=>{if(!alive)return;animation=Animated.timing(phase,{toValue:next,duration:18000,useNativeDriver:true,isInteraction:false});animation.start(({finished})=>{if(finished&&alive)step(next===1?0:1);});};
    if(running)step(1);else{phase.stopAnimation();phase.setValue(0);}
    return()=>{alive=false;animation?.stop();phase.stopAnimation();};
  },[uri,running,phase]);
  return <Animated.View testID={testID?`${testID}-${running?'active':'still'}`:undefined} pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity,transform:[{scale:1.12},{translateX:phase.interpolate({inputRange:[0,1],outputRange:[-9,9]})},{translateY:phase.interpolate({inputRange:[0,1],outputRange:[7,-7]})}]}]}><Image source={{uri}} blurRadius={blur} resizeMode="cover" onError={onError} style={StyleSheet.absoluteFill}/></Animated.View>;
}
export function VisualPreview({uri,blur,opacity,children,testID}:PropsWithChildren<{uri?:string;blur:number;opacity:number;testID?:string}>){return <View testID={testID} style={{minHeight:144,borderRadius:20,overflow:'hidden',backgroundColor:'#183647',padding:20,justifyContent:'center'}}>{uri&&<MotionImage uri={uri} blur={blur} opacity={opacity}/>}<View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.65)'}]}/>{children}</View>;}
const emptySubscribe=()=>()=>{};
const noVisual={version:1 as const,background:null,photo:null};const noVisualSnapshot=()=>noVisual;
export function useVisualAssets(services?:Services){return useSyncExternalStore(services?.visualAssets.subscribe??emptySubscribe,services?.visualAssets.getSnapshot??noVisualSnapshot);}
