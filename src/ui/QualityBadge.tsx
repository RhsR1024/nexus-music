import {View} from 'react-native';
import {Text} from './Typography.tsx';
import {normalizeQuality,qualityOrder,type Quality} from '../domain/quality.ts';
import type {Track} from '../domain/track.ts';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

const labels:Record<Quality,string>={master:'Master',atmos_plus:'Atmos+',atmos:'Atmos',hires:'Hi-Res',flac24bit:'Hi-Res',flac:'FLAC','320k':'HQ','192k':'HQ','128k':'STD'};

export function bestQualityLabel(track:Track):string|undefined {
  if(track.origin.kind==='local'){
    const fmt=typeof track.metadata.localFormat==='string'?track.metadata.localFormat.toUpperCase():'';
    return fmt==='FLAC'||fmt==='WAV'||fmt==='ALAC'?'FLAC':fmt||'本地';
  }
  const list=(track.qualities??[]).map(item=>normalizeQuality(item.id)).filter((q):q is Quality=>!!q);
  if(!list.length)return undefined;
  let best:Quality=list[0]!;
  for(const q of list){
    if(qualityOrder.indexOf(q)<qualityOrder.indexOf(best))best=q;
  }
  return labels[best];
}

export function QualityBadge({track,label,dark=false}:{track?:Track;label?:string;dark?:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const text=label??(track?bestQualityLabel(track):undefined);
  if(!text)return null;
  const isDark=dark||s.dark;
  return <View accessible={false} style={{paddingHorizontal:5.5,paddingVertical:0.8,borderRadius:4.5,borderWidth:0.8,borderColor:isDark?'rgba(255,136,154,0.48)':'rgba(185,78,94,0.42)',backgroundColor:isDark?'rgba(232,61,86,0.14)':'rgba(232,61,86,0.06)',alignSelf:'center'}}>
    <Text style={{color:isDark?'#FF9AA8':'#A84253',fontSize:9.5,lineHeight:12.5,fontWeight:'700',letterSpacing:0.2}}>{text}</Text>
  </View>;
}
