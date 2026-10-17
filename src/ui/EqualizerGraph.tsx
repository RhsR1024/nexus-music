import {Text} from './Typography.tsx';
import {useRef,useState} from 'react';
import {StyleSheet, View, type GestureResponderEvent} from 'react-native';
import {dbAtY,eqFrequencies} from '../domain/equalizer.ts';
import {useTheme} from './theme.tsx';
const db = (value:number)=>`${value>0?'+':''}${value.toFixed(1)} dB`;
export function GainSlider({value,onChange,label,testID,format=db,showBounds=false,accessibilityLabel}:{value:number;onChange:(value:number)=>void;label:string;testID?:string;format?:(value:number)=>string;showBounds?:boolean;accessibilityLabel?:string}) {
  const {palette}=useTheme(),width=useRef(1),pending=useRef<number|null>(null),[preview,setPreview]=useState<number|null>(null);
  const move=(event:GestureResponderEvent)=>{const next=Math.round(Math.max(-12,Math.min(12,event.nativeEvent.locationX/width.current*24-12))*10)/10;pending.current=next;setPreview(next);};
  const shown=preview??value;
  return <View style={{gap:8}}><View style={styles.label}>{label?<Text style={{color:palette.text}}>{label}</Text>:<View/>}<Text testID={testID?`${testID}-value`:undefined} style={{color:palette.accent,fontWeight:'700'}}>{format(shown)}</Text></View>
    <View style={showBounds?styles.bounds:undefined}>{showBounds&&<Text style={styles.boundLabel}>−12</Text>}<View testID={testID} accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel??label} accessibilityValue={{min:-12,max:12,now:shown,text:format(shown)}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>onChange(Math.max(-12,Math.min(12,value+(event.nativeEvent.actionName==='increment'?.1:-.1))))}
      onLayout={event=>{width.current=event.nativeEvent.layout.width;}} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true}
      onResponderGrant={move} onResponderMove={move} onResponderTerminationRequest={()=>false}
      onResponderRelease={event=>{move(event);if(pending.current!==null)onChange(pending.current);pending.current=null;setPreview(null);}}
      onResponderTerminate={()=>{pending.current=null;setPreview(null);}} style={{height:44,justifyContent:'center',flex:1}}>
      <View pointerEvents="none" style={{height:5,borderRadius:3,backgroundColor:palette.border}}/>
      <View pointerEvents="none" style={{position:'absolute',left:`${(shown+12)/24*100}%`,marginLeft:-10,width:20,height:20,borderRadius:10,backgroundColor:palette.accent}}/>
    </View>{showBounds&&<Text style={styles.boundLabel}>+12</Text>}</View></View>;
}
export function EqualizerGraph({gains,onChange}:{gains:readonly number[];onChange:(gains:readonly number[])=>void}) {
  const {palette}=useTheme(),[width,setWidth]=useState(1),[selected,setSelected]=useState(0),[draft,setDraft]=useState<readonly number[]|null>(null),pending=useRef<readonly number[]|null>(null),band=useRef(0);
  const height=168,shown=draft??gains,x=(i:number)=>i*(width-20)/9+10,y=(gain:number)=>(12-gain)/24*height;
  const preview=(event:GestureResponderEvent,choose=false)=>{
    if(choose){band.current=Math.max(0,Math.min(9,Math.round((event.nativeEvent.locationX-10)/(Math.max(1,width-20))*9)));setSelected(band.current);}
    const next=[...(pending.current??gains)];next[band.current]=dbAtY(event.nativeEvent.locationY,height);pending.current=next;setDraft(next);
  };
  return <View style={{gap:10}}><View style={{flexDirection:'row',gap:10}}><View style={{height,justifyContent:'space-between'}}>{['+12','+6','0','−6','−12'].map(label=><Text key={label} style={{fontSize:11,color:palette.secondary}}>{label}</Text>)}</View>
    <View testID="eq-curve" accessible accessibilityLabel="均衡器频段曲线，可在下方精调" accessibilityValue={{text:shown.map((gain,i)=>`${eqFrequencies[i]} Hz ${db(gain)}`).join('，')}} style={{height,flex:1}} onLayout={event=>setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={event=>{const i=Math.max(0,Math.min(9,Math.round((event.nativeEvent.locationX-10)/Math.max(1,width-20)*9)));return Math.abs(event.nativeEvent.locationX-x(i))<22&&Math.abs(event.nativeEvent.locationY-y(gains[i]!))<24;}} onMoveShouldSetResponder={()=>false} onResponderGrant={event=>preview(event,true)} onResponderMove={event=>preview(event)} onResponderTerminationRequest={()=>false}
      onResponderRelease={event=>{preview(event);if(pending.current)onChange(pending.current);pending.current=null;setDraft(null);}} onResponderTerminate={()=>{pending.current=null;setDraft(null);}}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {[0,1,2,3,4].map(i=><View key={`h${i}`} style={{position:'absolute',top:i*height/4,width:'100%',height:1,backgroundColor:palette.border}}/>)}
        {shown.slice(0,9).map((gain,i)=>{const dx=x(i+1)-x(i),dy=y(shown[i+1]!)-y(gain),length=Math.hypot(dx,dy);return <View key={`l${i}`} style={{position:'absolute',left:(x(i)+x(i+1))/2-length/2,top:(y(gain)+y(shown[i+1]!))/2-1,height:2,width:length,backgroundColor:palette.accent,transform:[{rotate:`${Math.atan2(dy,dx)}rad`}]}}/>;})}
        {shown.map((gain,i)=><View key={i} style={{position:'absolute',left:x(i)-5,top:y(gain)-5,width:10,height:10,borderRadius:5,backgroundColor:palette.accent,...(selected===i?{borderWidth:2,borderColor:palette.text}:{} )}}/>)}
      </View>
    </View></View>
    <View style={{flexDirection:'row',justifyContent:'space-between',marginLeft:30}}>{['31','125','500','2k','8k','16k'].map(label=><Text key={label} style={{fontSize:11,color:palette.secondary}}>{label}</Text>)}</View>
    <Text style={{fontSize:12,color:palette.secondary}}>拖动控制点选择频段；曲线表示频段设置值。</Text>
    <GainSlider testID="eq-band-slider" label={`${eqFrequencies[selected]} Hz 精调`} value={gains[selected]!} onChange={gain=>onChange(gains.map((value,i)=>i===selected?gain:value))}/>
  </View>;
}
const styles=StyleSheet.create({label:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},bounds:{flexDirection:'row',alignItems:'center',gap:10},boundLabel:{fontSize:12,color:'#9296A2',minWidth:24,textAlign:'center'}});
