import {useEffect,useState} from 'react';
import {Image,Text,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {useTheme} from './theme.tsx';
export function Cover({services,track,url,privateCover,size=56}:{services:Services;track?:Track;url?:string;privateCover?:{accountId:string;id:string};size?:number}){
  const theme=useTheme(),[file,setFile]=useState<string>();
  const key=JSON.stringify([track?.origin,track?.artwork,track?.metadata.coverArtId,track?.metadata.davVersion,url,privateCover]);
  useEffect(()=>{const abort=new AbortController();setFile(undefined);
    const pending=track?services.covers.loadTrack(track,abort.signal):privateCover?services.covers.loadPrivate(privateCover.accountId,privateCover.id,abort.signal):url?services.covers.loadURL(url,abort.signal):Promise.resolve(undefined);
    pending.then(value=>{if(!abort.signal.aborted)setFile(value);}).catch(()=>{});return()=>abort.abort();
  },[services,key]);
  return <View accessible={false} style={{width:size,height:size,borderRadius:Math.min(22,size/5),backgroundColor:theme.color('#25283A'),overflow:'hidden',alignItems:'center',justifyContent:'center'}}>{file?<Image source={{uri:file}} onError={()=>setFile(undefined)} style={{width:size,height:size}} resizeMode="cover"/>:<Text style={{color:theme.color('#959EAC'),fontSize:Math.max(20,size/4)}}>♫</Text>}</View>;
}
