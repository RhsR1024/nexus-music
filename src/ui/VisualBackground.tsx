import {useEffect,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {AccessibilityInfo,Animated,AppState,Image,StyleSheet,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {VisualAsset} from '../storage/visualAssets.ts';
export function useVisualImage(services:Services|undefined,image:VisualAsset|null|undefined){
  const [resolved,setResolved]=useState<{id:string;uri:string}>();
  useEffect(()=>{let valid=true;setResolved(undefined);if(services&&image)void services.visualAssets.resolve(image).then(uri=>{if(valid&&uri)setResolved({id:image.id,uri});});return()=>{valid=false;};},[services,image?.id]);
  return resolved?.id===image?.id?resolved?.uri:undefined;
}
export function MotionImage({uri,blur=0,opacity=1,moving=false,onError}:{uri:string;blur?:number;opacity?:number;moving?:boolean;onError?:()=>void}){
  const phase=useRef(new Animated.Value(0)).current,[reduce,setReduce]=useState(true),[active,setActive]=useState(AppState.currentState==='active');
  useEffect(()=>{let valid=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(valid)setReduce(value);});const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce),app=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>{valid=false;motion.remove();app.remove();};},[]);
  useEffect(()=>{let alive=true,animation:Animated.CompositeAnimation|undefined;
    const step=(next:number)=>{if(!alive)return;animation=Animated.timing(phase,{toValue:next,duration:18000,useNativeDriver:true,isInteraction:false});animation.start(({finished})=>{if(finished&&alive)step(next===1?0:1);});};
    if(moving&&!reduce&&active)step(1);else{phase.stopAnimation();phase.setValue(0);}
    return()=>{alive=false;animation?.stop();phase.stopAnimation();};
  },[uri,moving,reduce,active,phase]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity,transform:[{scale:1.12},{translateX:phase.interpolate({inputRange:[0,1],outputRange:[-9,9]})},{translateY:phase.interpolate({inputRange:[0,1],outputRange:[7,-7]})}]}]}><Image source={{uri}} blurRadius={blur} resizeMode="cover" onError={onError} style={StyleSheet.absoluteFill}/></Animated.View>;
}
export function VisualPreview({uri,blur,opacity,children,testID}:PropsWithChildren<{uri?:string;blur:number;opacity:number;testID?:string}>){return <View testID={testID} style={{minHeight:144,borderRadius:20,overflow:'hidden',backgroundColor:'#183647',padding:20,justifyContent:'center'}}>{uri&&<MotionImage uri={uri} blur={blur} opacity={opacity}/>}<View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.65)'}]}/>{children}</View>;}
const emptySubscribe=()=>()=>{};
const noVisual={version:1 as const,background:null,photo:null};const noVisualSnapshot=()=>noVisual;
export function useVisualAssets(services?:Services){return useSyncExternalStore(services?.visualAssets.subscribe??emptySubscribe,services?.visualAssets.getSnapshot??noVisualSnapshot);}
