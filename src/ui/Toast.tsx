import {useEffect,useRef,useState} from 'react';
import {Animated,Pressable,StyleSheet} from 'react-native';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {radius,space,typography} from './tokens.ts';

// Minimal inline toast for batch action receipts (已收藏 N 首 …). The page
// owns the message; the toast only fades in and auto-dismisses. An optional
// action (撤销 …) keeps the toast tappable and extends its lifetime.
export function Toast({message,onDismiss,action}:{message:string;onDismiss:()=>void;action?:{label:string;onRun:()=>void}}){
  const theme=useTheme(),opacity=useRef(new Animated.Value(0)).current,visible=message!=='';
  const latest=useRef(action);latest.current=action;
  useEffect(()=>{
    if(!visible)return;
    opacity.setValue(0);
    Animated.timing(opacity,{toValue:1,duration:140,useNativeDriver:true,isInteraction:false}).start();
    const timer=setTimeout(()=>{Animated.timing(opacity,{toValue:0,duration:200,useNativeDriver:true,isInteraction:false}).start(({finished})=>{if(finished)onDismiss();});},latest.current?5200:2200);
    return()=>{clearTimeout(timer);};
  },[message,opacity,onDismiss,visible]);
  if(!visible)return null;
  return <Animated.View testID="batch-toast" accessibilityLiveRegion="polite" pointerEvents={action?'box-none':'none'} style={[styles.host,{opacity,backgroundColor:theme.palette.glass,borderColor:theme.palette.border}]}>
    <Text style={[typography.body,{color:theme.palette.text,flexShrink:1}]}>{message}</Text>
    {action&&<Pressable testID="toast-action" accessibilityRole="button" accessibilityLabel={action.label} onPress={()=>{action.onRun();onDismiss();}} style={styles.action}><Text style={[typography.body,{color:theme.palette.accent}]}>{action.label}</Text></Pressable>}
  </Animated.View>;
}
export function useToast(){const [message,setMessage]=useState('');return {message,show:setMessage,clear:()=>setMessage('')};}
const styles=StyleSheet.create({host:{position:'absolute',bottom:space.xxl,left:space.xxl,right:space.xxl,paddingVertical:space.md,paddingHorizontal:space.lg,borderRadius:radius.lg,borderWidth:StyleSheet.hairlineWidth,alignItems:'center',flexDirection:'row',gap:space.lg},action:{paddingHorizontal:space.md,paddingVertical:space.xs}});
