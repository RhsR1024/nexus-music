import {useRef,useState} from 'react';
import {PanResponder,Pressable,View} from 'react-native';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controlColor} from '../domain/appearance.ts';
import {settingsInk} from './tokens.ts';

// Reference slider (IMG_4856): a 6pt track with a 14pt thumb, dragging maps
// the horizontal offset to the value. The reference draws no -/+ chrome; the
// transparent endpoint targets keep a non-drag path for touch and VoiceOver
// without adding marks that do not exist in the measured UI.
export function SliderControl({testID,label,value,min,max,step,format,onChange,disabled,stacked=false,tickCount=41}:{
  testID:string;label:string;value:number;min:number;max:number;step:number;
  format?:(value:number)=>string;onChange:(value:number)=>void;disabled?:boolean;stacked?:boolean;tickCount?:number;
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
  // The reference track carries 41 dots over 40 intervals (24.45px pitch at 3x)
  // and a neutral, translucent empty rail that follows whatever sheet tint sits
  // behind it; the fill and thumb use the muted control tone, not the accent swatch.
  const divisions=Math.max(2,Math.round(tickCount));
  const ticks=Array.from({length:divisions},(_,index)=>index/(divisions-1));
  const dark=theme.mode==='dark',textInk=settingsInk[theme.mode],rail=dark?'rgba(255,255,255,0.24)':'rgba(0,0,0,0.14)',control=controlColor(theme.palette.accent,dark);
  // IMG_4856 samples filled dots at #B98F91 over the #8F4A4E bar (38% white)
  // and empty dots at #95969C over the #C1CAD3 rail (25% black). The value ink
  // is #6F747A at semibold, darker than the section labels.
  const tickFilled=dark?'rgba(255,255,255,0.38)':'rgba(255,255,255,0.38)',tickEmpty=dark?'rgba(255,255,255,0.38)':'rgba(0,0,0,0.25)',valueInk=dark?'#B9BBC4':'#6F747A';
  // IMG_4856 puts the track 31.7pt below the label ink; the 32pt control box
  // already supplies that gap, so the extra 10pt moves below the track to keep
  // the 95pt row pitch that the lower sheet anchors were measured against.
  return <View style={{gap:0,paddingBottom:10,opacity:disabled?.5:1}}>
    <View style={{flexDirection:stacked?'column':'row',alignItems:stacked?'flex-start':'center',justifyContent:'space-between',gap:stacked?8:0}}>
      {/* IMG_4856 label ink measures 40x210px at 3x against 42x220px at 15pt;
          the reference slider labels sit at 14.3pt. */}
      <Text style={{color:textInk,fontSize:14.3,fontWeight:'600',lineHeight:18,transform:[{translateY:-1.3}]}}>{label}</Text>
      {/* SF Pro digits sit ~1.5pt lower than the PingFang label in the same
          18pt line box; IMG_4856 aligns both caps at the same top. */}
      <Text testID={`visual-value-${testID}`} style={{color:valueInk,fontSize:15,fontWeight:'600',fontVariant:['tabular-nums'],lineHeight:18,transform:[{translateY:-1.5}]}}>{display}</Text>
    </View>
    {/* The 15pt label shrinks the header line box ~2pt; this offset keeps the
        6pt track on the same measured anchor as the 17pt version. */}
    <View style={{marginTop:2.7,flexDirection:stacked?'column':'row',alignItems:stacked?'stretch':'center',gap:stacked?10:1}}>
      <Pressable testID={`visual-${testID}-down`} accessibilityRole="button" accessibilityLabel={`减少${label}`} disabled={disabled} onPress={()=>step_(-1)} hitSlop={stacked?undefined:10} style={{width:stacked?undefined:18,height:stacked?44:32,alignItems:'center',justifyContent:'center'}}/>
      <View
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{min,max,now:value,text:display}}
        accessibilityActions={[{name:'increment'},{name:'decrement'}]}
        accessibilityState={{disabled:!!disabled}}
        onAccessibilityAction={event=>{if(!disabled)step_(event.nativeEvent.actionName==='increment'?1:-1);}}
        onLayout={event=>{widthRef.current=event.nativeEvent.layout.width;setWidth(event.nativeEvent.layout.width);}}
        style={{flex:stacked?undefined:1,height:32,justifyContent:'center',marginLeft:stacked?0:-1,marginRight:stacked?0:1}}
        {...responder.panHandlers}>
        {/* IMG_4856 centers the rail, dots and thumb on one line; as an in-flow
            child the rail centred 1.3pt below the absolute fill/thumb layer. */}
        <View style={{position:'absolute',left:0,right:0,top:11.7,height:6,borderRadius:3,backgroundColor:rail}}/>
        <View style={{position:'absolute',left:0,top:11.7,height:6,borderRadius:3,width:Math.max(0,position*width),backgroundColor:control}}/>
        {ticks.map(tick=><View key={tick} pointerEvents="none" style={{position:'absolute',top:13.7,left:`${tick*100}%`,width:2,height:2,borderRadius:1,marginLeft:-1,backgroundColor:tick<=position+0.001?tickFilled:tickEmpty}}/>)}
        <View style={{position:'absolute',top:7.7,left:position*width-7,width:14,height:14,borderRadius:7,backgroundColor:control,transform:[{scale:dragging?1.15:1}]}}/>
      </View>
      <Pressable testID={`visual-${testID}-up`} accessibilityRole="button" accessibilityLabel={`增加${label}`} disabled={disabled} onPress={()=>step_(1)} hitSlop={stacked?undefined:10} style={{width:stacked?undefined:18,height:stacked?44:32,alignItems:'center',justifyContent:'center'}}/>
    </View>
  </View>;
}
