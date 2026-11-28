import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Animated,Pressable,StyleSheet} from 'react-native';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {radius,space,typography} from './tokens.ts';

// Minimal inline toast for batch action receipts (已收藏 N 首 …) and mode notices.
// Keeps `onDismiss` in a ref so parent re-renders (e.g. playback progress ticks)
// never restart the fade-in animation or cancel the auto-dismiss timeout.
export function Toast({message,toastKey,onDismiss,action}:{message:string;toastKey?:number;onDismiss:()=>void;action?:{label:string;onRun:()=>void}}){
  const theme=useTheme(),opacity=useRef(new Animated.Value(0)).current,visible=message!=='';
  const latest=useRef(action);latest.current=action;
  const dismissRef=useRef(onDismiss);dismissRef.current=onDismiss;
  useEffect(()=>{
    if(!visible)return;
    let cancelled=false;
    opacity.stopAnimation();
    opacity.setValue(0);
    const showAnim=Animated.timing(opacity,{toValue:1,duration:140,useNativeDriver:true,isInteraction:false});
    showAnim.start();
    let hideAnim:Animated.CompositeAnimation|undefined;
    const timer=setTimeout(()=>{
      if(cancelled)return;
      hideAnim=Animated.timing(opacity,{toValue:0,duration:180,useNativeDriver:true,isInteraction:false});
      hideAnim.start(({finished})=>{if(finished&&!cancelled)dismissRef.current();});
    },latest.current?5200:1800);
    return()=>{
      cancelled=true;
      clearTimeout(timer);
      showAnim.stop();
      hideAnim?.stop();
    };
  },[message,toastKey,opacity,visible]);
  if(!visible)return null;
  return <Animated.View testID="batch-toast" accessibilityLiveRegion="polite" pointerEvents={action?'box-none':'none'} style={[styles.host,{opacity,backgroundColor:theme.palette.glass,borderColor:theme.palette.border}]}>
    <Text style={[typography.body,{color:theme.palette.text,flexShrink:1}]}>{message}</Text>
    {action&&<Pressable testID="toast-action" accessibilityRole="button" accessibilityLabel={action.label} onPress={()=>{action.onRun();dismissRef.current();}} style={styles.action}><Text style={[typography.body,{color:theme.palette.accent}]}>{action.label}</Text></Pressable>}
  </Animated.View>;
}
export function useToast(){
  const [state,setState]=useState<{message:string;key:number}>({message:'',key:0});
  const show=useCallback((message:string)=>{setState(prev=>({message,key:prev.key+1}));},[]);
  const clear=useCallback(()=>{setState(prev=>prev.message===''?prev:{message:'',key:prev.key});},[]);
  return useMemo(()=>({message:state.message,key:state.key,show,clear}),[state.message,state.key,show,clear]);
}
const styles=StyleSheet.create({host:{position:'absolute',bottom:space.xxl,left:space.xxl,right:space.xxl,paddingVertical:space.md,paddingHorizontal:space.lg,borderRadius:radius.lg,borderWidth:StyleSheet.hairlineWidth,alignItems:'center',flexDirection:'row',gap:space.lg},action:{paddingHorizontal:space.md,paddingVertical:space.xs}});
