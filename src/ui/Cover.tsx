import {Text} from './Typography.tsx';
import {useEffect,useState} from 'react';
import {Image, View,useWindowDimensions} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {useTheme} from './theme.tsx';
export function Cover({services,track,url,privateCover,size=56,radius,aspectRatio=1}:{services:Services;track?:Track;url?:string;privateCover?:{accountId:string;id:string};size?:number;radius?:number;aspectRatio?:number}){
  const theme=useTheme(),[file,setFile]=useState<string>();
  const pixels=size*useWindowDimensions().scale,coverSize=pixels>512?1024:512;
  const key=JSON.stringify([coverSize,track?.origin,track?.artwork,track?.metadata.coverArtId,track?.metadata.davVersion,url,privateCover]);
  useEffect(()=>{const abort=new AbortController();setFile(undefined);
    const pending=track?services.covers.loadTrack(track,abort.signal,coverSize):privateCover?services.covers.loadPrivate(privateCover.accountId,privateCover.id,abort.signal,coverSize):url?services.covers.loadURL(url,abort.signal,coverSize):Promise.resolve(undefined);
    pending.then(value=>{if(!abort.signal.aborted)setFile(value);}).catch(()=>{});return()=>abort.abort();
  },[services,key]);
  const height=size/aspectRatio;
  return <View accessible={false} style={{width:size,height,borderRadius:radius??Math.min(theme.appearance.coverRadius,size/2,height/2),backgroundColor:theme.color('#25283A'),overflow:'hidden',alignItems:'center',justifyContent:'center'}}>{file?<Image testID="cover-image" source={{uri:file}} onError={()=>setFile(undefined)} style={{width:size,height}} resizeMode="cover"/>:<Text style={{color:theme.color('#959EAC'),fontSize:Math.max(20,size/4)}}>♫</Text>}</View>;
}
