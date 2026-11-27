import {flowThemeGradient} from '../domain/appearance.ts';
import type {CoverTheme} from '../appearance/coverTheme.ts';
import type {Services} from '../app/services.ts';
import {AmbientSoftLights,MotionImage,useVisualAssets,useVisualImage} from './VisualBackground.tsx';
import type {PropsWithChildren} from 'react';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,Image,Platform,StyleSheet,View,type StyleProp,type ViewStyle,type ViewProps} from 'react-native';
import {requireNativeView} from 'expo';
import {LinearGradient} from 'expo-linear-gradient';
import {useTheme} from './theme.tsx';
import {usePresentationVisible} from './AdaptiveModal.tsx';
const NativeMaterial=requireNativeView<ViewProps&{dark:boolean;variant?:string;radius?:number;intensity?:number}>('NexusNative');
const noSubscribe=()=>()=>{},noCover:CoverTheme={},noCoverSnapshot=()=>noCover;
export function AmbientBackground({services,visible=true,gradient}:{services?:Services;visible?:boolean;gradient?:{colors:readonly [string,string,...string[]];locations:readonly [number,number,...number[]]}}){
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
  const useExplicitGradient=!!gradient&&!theme.appearance.globalBackgroundMotion&&theme.appearance.backgroundStyle==='gradient';
  const base=useExplicitGradient?<LinearGradient colors={gradient.colors} locations={gradient.locations} start={{x:.5,y:0}} end={{x:.5,y:1}} style={StyleSheet.absoluteFill}/>
    :hasCover?<LinearGradient colors={fallback} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    :theme.appearance.backgroundStyle==='image'&&uri?<View style={StyleSheet.absoluteFill}><Image source={{uri}} resizeMode="cover" style={[StyleSheet.absoluteFill,{opacity:theme.appearance.backgroundOpacity}]}/><View style={[StyleSheet.absoluteFill,{backgroundColor:theme.palette.background[0],opacity:.78}]}/></View>
    :theme.appearance.backgroundStyle==='gradient'?<LinearGradient colors={gradient?.colors??theme.palette.background} locations={gradient?.locations} start={gradient?{x:.5,y:0}:{x:0,y:0}} end={gradient?{x:.5,y:1}:{x:1,y:1}} style={StyleSheet.absoluteFill}/>:null;
  const maskOpacity=Math.max(0,Math.min(1,theme.appearance.backgroundMask));
  return <View testID={hasCover?'ambient-cover-background':undefined} pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.palette.background[0]}]}>
    {base}
    {maskOpacity>0&&<View testID="ambient-mask" style={[StyleSheet.absoluteFill,{backgroundColor:theme.appearance.maskColor,opacity:maskOpacity}]}/>}
    {shown&&hasCover&&!useExplicitGradient&&cover.uri&&!flowColors&&<MotionImage testID="ambient-motion" uri={cover.uri} blur={55} opacity={theme.mode==='dark'?.08:.045} moving={moving} onError={()=>services?.coverTheme.rejectImage(cover.uri!)} />}
    {shown&&theme.appearance.globalBackgroundMotion&&<View testID={flowColors?'ambient-three-color':undefined} pointerEvents="none" style={StyleSheet.absoluteFill}><AmbientSoftLights colors={flowColors??[]} identity={cover.uri??''} moving={moving} pending={!!cover.pending} dark={theme.mode==='dark'}/></View>}
  </View>;
}
let cachedReduceTransparency:boolean|undefined;
export function GlassSurface({children,style,variant='liquid',radius=30}:PropsWithChildren<{style?:StyleProp<ViewStyle>;variant?:'liquid'|'frosted'|'acrylic';radius?:number}>){
  const theme=useTheme(),[reduce,setReduce]=useState(cachedReduceTransparency??(Platform.OS==='ios'));
  useEffect(()=>{if(Platform.OS!=='ios')return;let active=true;void AccessibilityInfo.isReduceTransparencyEnabled().then(value=>{cachedReduceTransparency=value;if(active)setReduce(value);});const subscription=AccessibilityInfo.addEventListener('reduceTransparencyChanged',value=>{cachedReduceTransparency=value;setReduce(value);});return()=>{active=false;subscription.remove();};},[]);
  const dark=theme.mode==='dark';
  const useBlur=theme.appearance.glassNavigation&&!reduce;
  const level=Math.max(1,Math.min(5,theme.appearance.glassLevel??2));
  const idx=level-1;
  const iosAlphas={
    liquid:dark?[0.03,0.06,0.11,0.20,0.32]:[0.02,0.05,0.10,0.19,0.32],
    acrylic:dark?[0.06,0.11,0.18,0.28,0.40]:[0.05,0.10,0.17,0.27,0.40],
    frosted:dark?[0.12,0.19,0.28,0.40,0.52]:[0.10,0.18,0.28,0.40,0.52],
  } as const;
  const androidAlphas={
    liquid:dark?[0.14,0.26,0.42,0.58,0.74]:[0.12,0.24,0.40,0.56,0.72],
    acrylic:dark?[0.12,0.22,0.36,0.52,0.68]:[0.10,0.20,0.34,0.50,0.66],
    frosted:dark?[0.24,0.38,0.54,0.68,0.82]:[0.22,0.36,0.52,0.68,0.82],
  } as const;
  const fillAlpha=Platform.OS==='ios'?iosAlphas[variant][idx]!:androidAlphas[variant][idx]!;
  const fill=useBlur
    ?(dark?`rgba(28,22,34,${fillAlpha})`:`rgba(255,252,253,${fillAlpha})`)
    :(dark?'rgba(42,34,48,0.96)':'rgba(255,251,249,0.96)');
  const borderAlpha=dark?(0.12+idx*0.03):(0.52+idx*0.07);
  const borderColor=dark?`rgba(255,255,255,${borderAlpha.toFixed(2)})`:`rgba(255,255,255,${borderAlpha.toFixed(2)})`;
  return <View style={[{borderRadius:radius,shadowColor:'#2B181C',shadowOpacity:dark?0.26:0.06,shadowRadius:18,shadowOffset:{width:0,height:4},elevation:Platform.OS==='android'?4:0},style]}>
    <View style={{flexGrow:1,borderRadius:radius,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth*1.5,borderColor}}>
      {useBlur&&<NativeMaterial pointerEvents="none" dark={dark} variant={variant} radius={radius} intensity={level} style={StyleSheet.absoluteFill}/>}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:fill}]}/>
      {children}
    </View>
  </View>;
}
