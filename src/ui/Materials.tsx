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
import {usePresentationVisible} from './AdaptiveModal.tsx';
const NativeMaterial=requireNativeView<ViewProps&{dark:boolean}>('NexusNative');
const noSubscribe=()=>()=>{},noCover:CoverTheme={},noCoverSnapshot=()=>noCover;
export function AmbientBackground({services,visible=true}:{services?:Services;visible?:boolean}){
  const presented=usePresentationVisible(),shown=visible&&presented;
  const theme=useTheme(),assets=useVisualAssets(services),uri=useVisualImage(services,assets.background);
  const cover=useSyncExternalStore(services?.coverTheme.subscribe??noSubscribe,services?.coverTheme.getSnapshot??noCoverSnapshot);
  const [moving,setMoving]=useState(false);
  useEffect(()=>{
    if(!services)return;
    const update=()=>{
      const state=services.playback.controller.getSnapshot();
      const next=shown&&theme.appearance.globalBackgroundMotion&&state.phase==='ready'&&state.intent==='playing'&&!state.buffering;
      setMoving(previous=>previous===next?previous:next);
    };
    update();
    return services.playback.controller.subscribe(update);
  },[services,shown,theme.appearance.globalBackgroundMotion]);
  const flowColors=theme.appearance.globalBackgroundMotion?cover.flowPalette:undefined;
  const fallback=flowColors?flowThemeGradient(flowColors,theme.mode):theme.palette.background;
  const hasCover=!!((theme.appearance.globalBackgroundMotion&&cover.uri)||(theme.appearance.coverColor&&cover.color));
  const base=hasCover?<LinearGradient colors={fallback} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    :theme.appearance.backgroundStyle==='image'&&uri?<View style={StyleSheet.absoluteFill}><Image source={{uri}} resizeMode="cover" style={[StyleSheet.absoluteFill,{opacity:theme.appearance.backgroundOpacity}]}/><View style={[StyleSheet.absoluteFill,{backgroundColor:theme.palette.background[0],opacity:.78}]}/></View>
    :theme.appearance.backgroundStyle==='gradient'?<LinearGradient colors={theme.palette.background} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>:null;
  return <View testID={hasCover?'ambient-cover-background':undefined} pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.palette.background[0]}]}>
    {base}
    {shown&&hasCover&&cover.uri&&!flowColors&&<MotionImage testID="ambient-motion" uri={cover.uri} blur={55} opacity={theme.mode==='dark'?.08:.045} moving={moving} onError={()=>services?.coverTheme.rejectImage(cover.uri!)} />}
    {shown&&theme.appearance.globalBackgroundMotion&&<View testID={flowColors?'ambient-three-color':undefined} pointerEvents="none" style={StyleSheet.absoluteFill}><AmbientSoftLights colors={flowColors??[]} identity={cover.uri??''} moving={moving} pending={!!cover.pending} dark={theme.mode==='dark'}/></View>}
  </View>;
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
