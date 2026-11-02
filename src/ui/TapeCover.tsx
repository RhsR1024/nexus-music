import {useSyncExternalStore} from 'react';
import {View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {tapeCoverLayout} from '../domain/appearance.ts';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';

const tapeIncident={position:'absolute' as const,borderRadius:99,backgroundColor:'rgba(255,255,255,0.52)'};

export function TapeCover({services,track,size}:{services:Services;track:Track;size:number}){
  const theme=useTheme(),{side,shellRadius,inset,artSize,artRadius,reelBandHeight,reelDiameter}=tapeCoverLayout(size,theme.appearance.coverRadius);
  const reel=Array.from({length:2},(_,index)=><View key={index} testID={`tape-reel-${index}`} accessible={false} style={{width:reelDiameter,height:reelDiameter,borderRadius:reelDiameter/2,backgroundColor:'#F7E8ED',alignItems:'center',justifyContent:'center'}}>
    <View style={{width:Math.max(4,Math.round(reelDiameter*.38)),height:Math.max(4,Math.round(reelDiameter*.38)),borderRadius:reelDiameter/2,backgroundColor:theme.palette.accent}}/>
    <View style={{position:'absolute',width:reelDiameter*.72,height:1,backgroundColor:'rgba(43,32,38,0.42)',transform:[{rotate:'35deg'}]}}/>
    <View style={{position:'absolute',width:reelDiameter*.72,height:1,backgroundColor:'rgba(43,32,38,0.42)',transform:[{rotate:'-35deg'}]}}/>
  </View>);
  return <View testID="player-tape-cover" accessible={false} style={{width:side,height:side,borderRadius:shellRadius,backgroundColor:theme.palette.accent,borderWidth:Math.max(1,Math.round(side*.008)),borderColor:'rgba(255,255,255,0.48)',overflow:'hidden'}}>
    <View style={{position:'absolute',left:inset,top:inset,width:artSize,height:artSize,borderRadius:artRadius,overflow:'hidden'}}>
      <Cover services={services} track={track} size={artSize} radius={artRadius}/>
    </View>
    <View pointerEvents="none" style={{position:'absolute',left:inset,right:inset,bottom:inset,height:reelBandHeight,borderRadius:Math.max(6,Math.round(reelBandHeight*.2)),backgroundColor:'rgba(31,25,31,0.94)',borderWidth:1,borderColor:'rgba(255,255,255,0.22)',flexDirection:'row',alignItems:'center',justifyContent:'space-evenly'}}>
      {reel}
      <View style={{position:'absolute',left:'50%',top:Math.max(4,Math.round(reelBandHeight*.18)),height:Math.max(8,Math.round(reelBandHeight*.64)),width:Math.max(1,Math.round(side*.006)),borderRadius:1,backgroundColor:'rgba(247,232,237,0.58)'}}/>
    </View>
    <View pointerEvents="none" style={{position:'absolute',left:inset+4,top:inset+4,minWidth:Math.max(24,Math.round(side*.11)),height:Math.max(14,Math.round(side*.055)),borderRadius:4,paddingHorizontal:4,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(31,25,31,0.82)'}}>
      <Text allowFontScaling={false} style={{color:'#F7E8ED',fontSize:Math.max(7,Math.round(side*.026)),lineHeight:Math.max(9,Math.round(side*.032)),fontWeight:'700',letterSpacing:.5}}>SIDE A</Text>
    </View>
    {[
      {left:inset*.42,top:inset*.42},
      {right:inset*.42,top:inset*.42},
      {left:inset*.42,bottom:inset*.42},
      {right:inset*.42,bottom:inset*.42},
    ].map((position,index)=><View key={index} testID={`tape-pin-${index}`} pointerEvents="none" style={[tapeIncident,position,{width:Math.max(4,Math.round(side*.017)),height:Math.max(4,Math.round(side*.017))}]}/>)}
  </View>;
}

export function PlayerCover({services,track,size}:{services:Services;track:Track;size:number}){
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  return preferences.tapeStyle&&size>=112?<TapeCover services={services} track={track} size={size}/>:<Cover services={services} track={track} size={size}/>;
}
