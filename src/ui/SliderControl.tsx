import {useRef,useState} from 'react';
import {PanResponder,Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';

// Thin reference slider (IMG_4856): a 3pt track with a 14pt thumb, dragging maps
// the horizontal offset to the value. The -/+ buttons stay because they are the
// accessible stepping path the UI tests and VoiceOver rely on.
export function SliderControl({testID,label,value,min,max,step,format,onChange,disabled,stacked=false}:{
  testID:string;label:string;value:number;min:number;max:number;step:number;
  format?:(value:number)=>string;onChange:(value:number)=>void;disabled?:boolean;stacked?:boolean;
}){
  const theme=useTheme();
  const [width,setWidth]=useState(0),[dragging,setDragging]=useState(false);
  const widthRef=useRef(0),valueRef=useRef(value);valueRef.current=value;
  const clamp=(next:number)=>Math.min(max,Math.max(min,next));
  const commit=(next:number)=>{const bounded=clamp(min+Math.round((next-min)/step)*step);if(Math.abs(bounded-valueRef.current)>step/2)onChange(Number(bounded.toFixed(4)));};
  const position=width>0?Math.min(1,Math.max(0,(value-min)/(max-min))):0;
  const current=useRef({disabled,min,max,commit});current.current={disabled,min,max,commit};
  const responder=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>!current.current.disabled,
    onMoveShouldSetPanResponder:()=>!current.current.disabled,
    onPanResponderGrant:event=>{if(current.current.disabled)return;setDragging(true);const w=widthRef.current,{min,max,commit}=current.current;if(w>0)commit(min+(event.nativeEvent.locationX/w)*(max-min));},
    onPanResponderMove:event=>{if(current.current.disabled)return;const w=widthRef.current,{min,max,commit}=current.current;if(w>0)commit(min+(event.nativeEvent.locationX/w)*(max-min));},
    onPanResponderRelease:()=>setDragging(false),
    onPanResponderTerminate:()=>setDragging(false),
  })).current;
  const display=format?format(value):String(value);
  const step_=(direction:1|-1)=>onChange(Number(clamp(value+direction*step).toFixed(4)));
  return <View style={{gap:8,opacity:disabled?.5:1}}>
    <View style={{flexDirection:stacked?'column':'row',alignItems:stacked?'flex-start':'center',justifyContent:'space-between',gap:stacked?8:0}}>
      <Text style={{color:theme.palette.text,fontSize:15}}>{label}</Text>
      <Text testID={`visual-value-${testID}`} style={{color:theme.palette.secondary,fontSize:14,fontVariant:['tabular-nums']}}>{display}</Text>
    </View>
    <View style={{flexDirection:stacked?'column':'row',alignItems:stacked?'stretch':'center',gap:10}}>
      <Pressable testID={`visual-${testID}-down`} accessibilityRole="button" accessibilityLabel={`减少${label}`} disabled={disabled} onPress={()=>step_(-1)} hitSlop={stacked?undefined:8} style={{width:stacked?undefined:28,height:stacked?44:32,alignItems:'center',justifyContent:'center'}}><Ionicons name="remove" size={16} color={theme.palette.secondary}/></Pressable>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{min,max,now:value,text:display}}
        accessibilityActions={[{name:'increment'},{name:'decrement'}]}
        accessibilityState={{disabled:!!disabled}}
        onAccessibilityAction={event=>{if(!disabled)step_(event.nativeEvent.actionName==='increment'?1:-1);}}
        onLayout={event=>{widthRef.current=event.nativeEvent.layout.width;setWidth(event.nativeEvent.layout.width);}}
        style={{flex:stacked?undefined:1,height:32,justifyContent:'center'}}
        {...responder.panHandlers}>
        <View style={{height:3,borderRadius:2,backgroundColor:theme.palette.border}}/>
        <View style={{position:'absolute',left:0,top:14.5,height:3,borderRadius:2,width:Math.max(0,position*width),backgroundColor:theme.palette.accent}}/>
        <View style={{position:'absolute',top:9,left:Math.max(0,Math.min(width-14,position*width-7)),width:14,height:14,borderRadius:7,backgroundColor:theme.palette.accent,transform:[{scale:dragging?1.15:1}]}}/>
      </View>
      <Pressable testID={`visual-${testID}-up`} accessibilityRole="button" accessibilityLabel={`增加${label}`} disabled={disabled} onPress={()=>step_(1)} hitSlop={stacked?undefined:8} style={{width:stacked?undefined:28,height:stacked?44:32,alignItems:'center',justifyContent:'center'}}><Ionicons name="add" size={16} color={theme.palette.secondary}/></Pressable>
    </View>
  </View>;
}
