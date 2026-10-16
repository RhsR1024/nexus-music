import {useVisualAssets,useVisualImage,MotionImage} from './VisualBackground.tsx';
import {darkenCoverColor,playerBackgroundImage} from '../domain/appearance.ts';
import {Text} from './Typography.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {FrequencyHalo,Vinyl} from './PlayerVisuals.tsx';
import type {PlayerLayout} from '../app/preferences.ts';
import {Cover} from './Cover.tsx';
import {Lyrics} from './Lyrics.tsx';
const time=(value:number)=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}`;
export function ArtworkBackdrop({services,track,photo=false}:{services:Services;track:Track;photo?:boolean}){
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const assets=useVisualAssets(services),custom=useVisualImage(services,assets.photo);
  const [artwork,setArtwork]=useState<{key:string;uri:string}>(),[failedImages,setFailedImages]=useState<readonly string[]>([]),[tint,setTint]=useState('#183647');
  const key=JSON.stringify([track.origin,track.artwork,track.metadata.davVersion,track.metadata.coverArtId]);
  useEffect(()=>{const abort=new AbortController();setArtwork(undefined);services.covers.loadTrack(track,abort.signal).then(value=>{if(!abort.signal.aborted&&value)setArtwork({key,uri:value});}).catch(()=>{});return()=>abort.abort();},[services,key]);
  const file=artwork?.key===key?artwork.uri:undefined;
  const uri=playerBackgroundImage(preferences.playerBackground,photo,custom,file,failedImages);
  useEffect(()=>{let valid=true;setTint('#183647');if(uri&&preferences.coverColor)void services.visualColors.color(uri).then(color=>{if(valid)setTint(darkenCoverColor(color));}).catch(()=>{});return()=>{valid=false;};},[services,uri,preferences.coverColor]);
  const blur=preferences.playerBlur;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:tint}]}>
    {uri&&<MotionImage uri={uri} blur={blur} opacity={preferences.coverColor?.45:1} moving={preferences.dynamicBackground&&playback.phase==='ready'&&playback.intent==='playing'&&!playback.buffering} onError={()=>setFailedImages(previous=>previous.includes(uri)?previous:[...previous.slice(-3),uri])}/>}
    <LinearGradient colors={[`rgba(7,14,24,${preferences.playerDarkness})`,`rgba(7,14,24,${Math.min(.96,preferences.playerDarkness+.15)})`,'rgba(7,14,24,0.94)']} style={StyleSheet.absoluteFill}/>
  </View>;
}
export function PlaybackProgress({services}:{services:Services}){
  const controller=services.playback.controller,state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const gestureToken=useRef<string|undefined>(undefined);
  const width=useRef(1),[preview,setPreview]=useState<number>();
  const fraction=(event:GestureResponderEvent)=>Math.min(1,Math.max(0,event.nativeEvent.locationX/width.current));
  const position=preview??state.position,percent=state.duration>0?Math.min(100,Math.max(0,position/state.duration*100)):0;
  return <View style={{gap:2}}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="播放进度" accessibilityValue={{min:0,max:Math.floor(state.duration),now:Math.floor(position),text:`${time(position)} / ${time(state.duration)}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>controller.seek(state.position+(event.nativeEvent.actionName==='increment'?10:-10))}
      onLayout={event=>{width.current=Math.max(1,event.nativeEvent.layout.width);}} onStartShouldSetResponder={()=>state.duration>0} onMoveShouldSetResponder={()=>state.duration>0}
      onResponderGrant={event=>{gestureToken.current=JSON.stringify(state.token);setPreview(fraction(event)*state.duration);}} onResponderMove={event=>setPreview(fraction(event)*state.duration)} onResponderRelease={event=>{if(gestureToken.current===JSON.stringify(controller.getSnapshot().token))controller.seek(fraction(event)*state.duration);gestureToken.current=undefined;setPreview(undefined);}} onResponderTerminate={()=>{gestureToken.current=undefined;setPreview(undefined);}} style={{height:44,justifyContent:'center'}}>
      <View pointerEvents="none" style={{height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,0.22)'}}><View style={{height:5,width:`${percent}%`,borderRadius:3,backgroundColor:'#FFFFFF'}}/></View>
      {preview!==undefined&&<View pointerEvents="none" style={{position:'absolute',left:`${percent}%`,marginLeft:-7,width:14,height:14,borderRadius:7,backgroundColor:'#FFFFFF'}}/>}
    </View>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.small}>{time(position)}</Text><Text style={[styles.small,{borderWidth:1,borderColor:'rgba(255,255,255,0.28)',borderRadius:10,paddingHorizontal:9,paddingVertical:3}]}>{state.media?.quality?`${state.media.quality.toUpperCase()} 档`:'等待音源'}</Text><Text style={styles.small}>−{time(state.duration-position)}</Text></View>
  </View>;
}
export function ModernPlayer({services,track,lyricTrack,font,layout,onMore}:{services:Services;track:Track;lyricTrack:Track;font?:string;layout:Exclude<PlayerLayout,'classic'>;onMore:()=>void}){
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const {width,height}=useWindowDimensions(),controller=services.playback.controller;
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=25)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color="#FFFFFF"/></Pressable>;
  const favorite=()=>{void services.library.favorite(track).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));};
  const transport=icon(state.intent==='playing'?'pause':'play',state.intent==='playing'?'暂停':'播放',()=>{if(state.intent==='playing')controller.pause();else void controller.play();},64);
  return <View style={{gap:layout==='am'?20:16}}>
    {layout==='am'?<View style={{flexDirection:'row',alignItems:'center',gap:14}}><Cover services={services} track={track} size={66}/><View style={{flex:1,gap:7}}><Text numberOfLines={1} style={{fontSize:21,color:'#FFFFFF',fontWeight:'600'}}>{track.title}</Text><Text numberOfLines={1} style={styles.small}>{track.artist}{track.album?` · ${track.album}`:''}</Text></View>{icon(services.library.isFavorite(track)?'heart':'heart-outline','收藏歌曲',favorite)}{icon('ellipsis-horizontal','更多播放控制',onMore)}</View>:<>{layout==='vinyl'?<Vinyl services={services} track={track} playing={state.intent==='playing'&&!state.buffering} size={Math.min(width-80,height*.27)}/>:layout==='photo'?<View style={{height:height*.24}}/>:<View style={{height:Math.max(160,height*.27),overflow:'hidden',borderRadius:preferences.coverRadius}}><Cover services={services} track={track} size={Math.min(width-48,430)}/></View>}<View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{flex:1,gap:8}}><Text style={{fontSize:27,fontWeight:'700',color:'#FFFFFF'}}>{track.title}</Text><Text style={styles.small}>{track.artist}</Text></View>{icon(services.library.isFavorite(track)?'heart':'heart-outline','收藏歌曲',favorite)}{icon('ellipsis-horizontal','更多播放控制',onMore)}</View></>}
    <View style={{height:layout==='am'?Math.min(430,Math.max(270,height*.39)):layout==='wave'?110:Math.min(170,Math.max(110,height*.18)),overflow:'hidden',justifyContent:'center'}}><Lyrics services={services} track={lyricTrack} font={font} visibleLines={layout==='wave'?1:undefined} presentation={layout==='am'?'am':layout==='photo'?'photo':'immersive'}/></View>
    {(state.error||state.phase==='resolving'||state.buffering)&&<Text accessibilityLiveRegion="polite" style={styles.small}>{state.error??(state.phase==='resolving'?'正在选择可用音源…':'正在缓冲…')}</Text>}
    <PlaybackProgress services={services}/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingVertical:12}}>{icon('play-back','上一首',()=>services.playback.next(-1),42)}{layout==='wave'?<FrequencyHalo services={services} playing={state.intent==='playing'&&!state.buffering}>{transport}</FrequencyHalo>:transport}{icon('play-forward','下一首',()=>services.playback.next(),42)}</View>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>{icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));})}{icon('shuffle',`随机：${preferences.shuffle?'开':'关'}`,()=>{void services.preferences.update({shuffle:!preferences.shuffle}).catch(()=>Alert.alert('设置未保存'));})}{icon('list','队列与播放选项',onMore)}{icon('options-outline','调整播放界面',onMore)}</View>
  </View>;
}
const styles=StyleSheet.create({small:{color:'rgba(255,255,255,0.64)',fontSize:13,lineHeight:20}});
