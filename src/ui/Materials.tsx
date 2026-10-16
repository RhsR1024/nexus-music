import type {Services} from '../app/services.ts';
import {useVisualAssets,useVisualImage} from './VisualBackground.tsx';
import type {PropsWithChildren} from 'react';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,Image,StyleSheet,View,type StyleProp,type ViewStyle,type ViewProps} from 'react-native';
import {requireNativeView} from 'expo';
import {LinearGradient} from 'expo-linear-gradient';
import {useTheme} from './theme.tsx';
const NativeMaterial=requireNativeView<ViewProps&{dark:boolean}>('NexusNative');
const noSubscribe=()=>()=>{},noCover={color:undefined,uri:undefined},noCoverSnapshot=()=>noCover;
export function AmbientBackground({services}:{services?:Services}){
  const theme=useTheme(),assets=useVisualAssets(services),uri=useVisualImage(services,assets.background);
  const cover=useSyncExternalStore(services?.coverTheme.subscribe??noSubscribe,services?.coverTheme.getSnapshot??noCoverSnapshot);
  if(theme.appearance.coverColor&&cover.color)return <View testID="ambient-cover-background" pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={theme.palette.background} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    {cover.uri&&<Image source={{uri:cover.uri}} blurRadius={55} resizeMode="cover" onError={()=>services?.coverTheme.rejectImage(cover.uri!)} style={[StyleSheet.absoluteFill,{opacity:theme.mode==='dark'?.06:.035,transform:[{scale:1.12}]}]}/>}
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
