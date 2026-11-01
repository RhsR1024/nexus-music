import {useEffect,useRef,useState} from 'react';
import {Share} from 'react-native';
import type {Track} from '../domain/track.ts';
import {songShareText} from '../domain/songShare.ts';

export function useSongShare(track:Track|null){
 const current=useRef(track),mounted=useRef(true);current.current=track;
 const [sharing,setSharing]=useState(false),[error,setError]=useState('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{setSharing(false);setError('');},[track]);
 const share=async()=>{
  const owner=track;if(!owner||sharing)return;
  setSharing(true);setError('');
  try{await Share.share({message:songShareText(owner)});}
  catch{if(mounted.current&&current.current===owner)setError('未能打开系统分享，请重试。');}
  finally{if(mounted.current&&current.current===owner)setSharing(false);}
 };
 return{share,sharing,error};
}
