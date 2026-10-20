import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,Alert,Animated,AppState,Pressable,ScrollView,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {PhotoActions} from '../domain/photoPlayer.ts';
import {Lyrics} from './Lyrics.tsx';
import {PlaybackProgress} from './PlaybackProgress.tsx';
import {Text} from './Typography.tsx';

export function PhotoPlayer({services,track,favoriteTrack,lyricTrack,font,visible,onMore,onStyle}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;visible:boolean;onMore:()=>void;onStyle:()=>void}){
  const {width,height,fontScale}=useWindowDimensions(),columns=width>height&&width>=600&&fontScale<1.8;
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot),controller=services.playback.controller;
  const prefs=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [presentation]=useState(()=>new PhotoActions()),shown=useSyncExternalStore(presentation.subscribe,presentation.getSnapshot);
  const [foreground,setForeground]=useState(AppState.currentState==='active'),[reduce,setReduce]=useState(true);
  const identity=JSON.stringify([state.queue.currentId,lyricTrack.origin]);
  useEffect(()=>{const subscription=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>subscription.remove();},[]);
  useEffect(()=>{presentation.configure(identity,visible&&foreground);},[presentation,identity,visible,foreground]);
  useEffect(()=>()=>presentation.dispose(),[presentation]);
  useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduce(value);});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>{active=false;sub.remove();};},[]);
  const opacity=useRef(new Animated.Value(0)).current,scale=useRef(new Animated.Value(.96)).current;
  useEffect(()=>{
    opacity.setValue(shown?reduce?1:0:0);scale.setValue(shown?reduce?1:.96:.96);
    if(!shown||reduce)return;
    const animation=Animated.parallel([Animated.timing(opacity,{toValue:1,duration:120,useNativeDriver:true,isInteraction:false}),Animated.timing(scale,{toValue:1,duration:140,useNativeDriver:true,isInteraction:false})]);animation.start();return()=>animation.stop();
  },[shown,reduce,opacity,scale]);
  const favorite=services.library.isFavorite(favoriteTrack);
  const tool=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=24,id?:string,value?:string)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value?{text:value}:undefined} onPress={()=>{presentation.interact();action();}} style={{minWidth:44,minHeight:48,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color="#FFFFFF"/></Pressable>;
  const favoriteButton=tool(favorite?'heart':'heart-outline','收藏歌曲',()=>{void services.library.favorite(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));},24,undefined,favorite?'已收藏':'未收藏');
  return <View testID="photo-player" style={{flex:1,minHeight:0,gap:6}}>
    /* IMG_4868: the artwork fades into a dark foundation so lyrics stay legible */
    <LinearGradient testID="photo-bottom-scrim" pointerEvents="none" colors={['transparent','rgba(0,0,0,0.72)']} locations={[0,1]} style={{position:'absolute',left:0,right:0,bottom:0,height:'42%'}}/>
    <View testID={columns?'photo-horizontal':'photo-vertical'} style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:12}}>
      <Pressable testID="photo-artwork-region" accessibilityRole="button" accessibilityLabel="切换写真操作" onPress={()=>presentation.toggle()} style={{...(columns?{width:'42%'}:{height:Math.max(0,Math.min(height*(height<720?.46:.48)-100,height*(fontScale>1.8?.12:.38)))}),justifyContent:'flex-end'}}>
      </Pressable>
      <View style={{flex:1,minHeight:0,gap:12}}>
        <View testID="photo-song-info" style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <View style={{flex:1,minWidth:0,gap:4}}><Text numberOfLines={1} style={{fontSize:22,fontWeight:'700',color:'#FFFFFF'}}>{track.title}</Text><Text numberOfLines={1} style={{fontSize:14,color:'rgba(255,255,255,0.66)'}}>{track.artist}</Text></View>
          {tool(state.intent==='playing'?'pause':'play',state.intent==='playing'?'暂停':'播放',()=>{if(state.intent==='playing')controller.pause();else void controller.play();},30)}
          {favoriteButton}{tool('ellipsis-horizontal','更多播放控制',onMore)}
        </View>
        {(state.error||state.phase==='resolving'||state.buffering)&&<Text accessibilityLiveRegion="polite" style={{color:'#FFFFFF'}}>{state.error??(state.phase==='resolving'?'正在选择可用音源…':'正在缓冲…')}</Text>}
        <View testID="photo-lyric-viewport" collapsable={false} style={{flex:1,minHeight:0,overflow:'hidden'}}><Lyrics services={services} track={lyricTrack} font={font} presentation="photo" chrome={columns}/></View>
      </View>
    </View>
    {shown&&<Animated.View testID="photo-quick-actions" onTouchStart={()=>presentation.touch(true)} onTouchEnd={()=>presentation.touch(false)} onTouchCancel={()=>presentation.touch(false)} style={{opacity,transform:[{scale}],borderRadius:24,backgroundColor:'rgba(15,19,26,.94)',paddingHorizontal:12}}>
      <ScrollView style={{maxHeight:Math.max(90,height*.27)}} contentContainerStyle={{paddingBottom:4}}>
        <PlaybackProgress services={services} adaptive/>
        <View style={{flexDirection:'row',justifyContent:'space-around'}}>{tool('play-back','上一首',()=>services.playback.next(-1))}{tool('play-forward','下一首',()=>services.playback.next())}{favoriteButton}{tool('list','队列与播放选项',onMore)}{tool('repeat',`循环：${prefs.repeat}`,()=>{void services.preferences.update({repeat:prefs.repeat==='off'?'all':prefs.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));})}{tool('options-outline','调整播放界面',onStyle)}</View>
      </ScrollView>
    </Animated.View>}
    <View style={{alignItems:'center'}}>{tool(shown?'chevron-down':'ellipsis-horizontal',shown?'隐藏写真操作':'显示写真操作',()=>presentation.toggle(),22,'photo-actions-toggle')}</View>
  </View>;
}
