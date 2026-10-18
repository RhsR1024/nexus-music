import {flowThemeGradient} from '../domain/appearance.ts';
import type {CoverTheme} from '../appearance/coverTheme.ts';
import type {Services} from '../app/services.ts';
import {AmbientSoftLights,MotionImage,useVisualAssets,useVisualImage} from './VisualBackground.tsx';
import type {PropsWithChildren} from 'react';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,Image,StyleSheet,View,type StyleProp,type ViewStyle,type ViewProps} from 'react-native';
import {requireNativeView} from 'expo';
import {LinearGradient} from 'expo-linear-gradient';
import {useTheme} from './theme.tsx';
const NativeMaterial=requireNativeView<ViewProps&{dark:boolean}>('NexusNative');
const noSubscribe=()=>()=>{},noCover:CoverTheme={},noCoverSnapshot=()=>noCover;
export function AmbientBackground({services,visible=true}:{services?:Services;visible?:boolean}){
  const theme=useTheme(),assets=useVisualAssets(services),uri=useVisualImage(services,assets.background);
  const cover=useSyncExternalStore(services?.coverTheme.subscribe??noSubscribe,services?.coverTheme.getSnapshot??noCoverSnapshot);
  const [moving,setMoving]=useState(false);
  useEffect(()=>{
    if(!services)return;
    const update=()=>{
      const state=services.playback.controller.getSnapshot();
      const next=visible&&theme.appearance.globalBackgroundMotion&&state.phase==='ready'&&state.intent==='playing'&&!state.buffering;
      setMoving(previous=>previous===next?previous:next);
    };
    update();
    return services.playback.controller.subscribe(update);
  },[services,visible,theme.appearance.globalBackgroundMotion]);
  const flowColors=theme.appearance.globalBackgroundMotion&&cover.flowPalette?flowThemeGradient(cover.flowPalette,theme.mode):undefined;
  if((theme.appearance.globalBackgroundMotion&&cover.uri)||(theme.appearance.coverColor&&cover.color))return <View testID="ambient-cover-background" pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient testID={flowColors?'ambient-three-color':undefined} colors={flowColors??theme.palette.background} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    {visible&&cover.uri&&(flowColors?<AmbientSoftLights colors={flowColors} identity={cover.uri} moving={moving}/>:<MotionImage testID="ambient-motion" uri={cover.uri} blur={55} opacity={theme.mode==='dark'?.08:.045} moving={moving} onError={()=>services?.coverTheme.rejectImage(cover.uri!)} />)}
  </View>;
  if(theme.appearance.backgroundStyle==='image'&&uri)return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.palette.background[0]}]}><Image source={{uri}} resizeMode="cover" style={[StyleSheet.absoluteFill,{opacity:theme.appearance.backgroundOpacity}]}/><View style={[StyleSheet.absoluteFill,{backgroundColor:theme.palette.background[0],opacity:.78}]}/></View>;
  return theme.appearance.backgroundStyle==='gradient'?<LinearGradient pointerEvents="none" colors={theme.palette.background} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>:<View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.palette.background[0]}]}/>;
}
export function GlassSurface({children,style}:PropsWithChildren<{style?:StyleProp<ViewStyle>}>){
  const theme=useTheme(),[reduce,setReduce]=useState(true);
  useEffect(()=>{let active=true;void AccessibilityInfo.isReduceTransparencyEnabled().then(value=>{if(active)setReduce(value);});const subscription=AccessibilityInfo.addEventListener('reduceTransparencyChanged',setReduce);return()=>{active=false;subscription.remove();};},[]);
  return <View style={[{borderRadius:30,overflow:'hidden',borderWidth:1,borderColor:theme.palette.border},style]}>
    {theme.appearance.glassNavigation&&!reduce&&<NativeMaterial pointerEvents="none" dark={theme.mode==='dark'} style={StyleSheet.absoluteFill}/>}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:reduce||!theme.appearance.glassNavigation?theme.palette.surface:theme.palette.glass}]}/>
    {children}
  </View>;
}
