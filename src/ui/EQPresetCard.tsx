import {useState} from 'react';
import {Pressable,View} from 'react-native';
import type {EQPreset} from '../domain/equalizer.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

// A diagram of the ten control values, not a measured filter response.
function PresetCurve({gains,compact}:{gains:readonly number[];compact:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),width=compact?38:46,height=22;
  const x=(i:number)=>i*width/9,y=(gain:number)=>(12-gain)/24*height;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width,height}}>
    {gains.slice(0,9).map((gain,i)=>{
      const dx=x(i+1)-x(i),dy=y(gains[i+1]!)-y(gain),length=Math.hypot(dx,dy);
      return <View key={i} style={{position:'absolute',left:(x(i)+x(i+1))/2-length/2,top:(y(gain)+y(gains[i+1]!))/2-.9,height:1.8,width:length,backgroundColor:s.control,transform:[{rotate:`${Math.atan2(dy,dx)}rad`}]}}/>;
    })}
  </View>;
}

export function EQPresetCard({preset,gains,preampDB,onPress,testID}:{preset:EQPreset;gains:readonly number[];preampDB:number;onPress:()=>void;testID?:string}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),[width,setWidth]=useState(0);
  const selected=preset.preampDB===preampDB&&preset.gains.length===gains.length&&preset.gains.every((gain,i)=>gain===gains[i]);
  return <Pressable testID={testID} accessible accessibilityRole="button" accessibilityLabel={preset.name} accessibilityState={{selected}} accessibilityHint="应用频段曲线与前级增益" onPress={onPress} onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{minHeight:54,paddingHorizontal:13,paddingVertical:12,borderRadius:18,borderWidth:1,borderColor:selected?`${s.control}7A`:s.cardBorder,backgroundColor:selected?s.accentSoft:s.card,flexDirection:'row',alignItems:'center',gap:10}}>
    {width>=115&&<PresetCurve gains={preset.gains} compact={width<145}/>}
    <Text numberOfLines={2} style={{color:selected?s.control:s.ink,fontSize:14.5,fontWeight:selected?'700':'600',flex:1,flexShrink:1}}>{preset.name}</Text>
    {selected&&<Text accessible={false} style={{color:s.control,fontSize:14,fontWeight:'700'}}>✓</Text>}
  </Pressable>;
}
