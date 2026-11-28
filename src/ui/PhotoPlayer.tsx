import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,Alert,Animated,AppState,Pressable,View,useWindowDimensions} from 'react-native';
import {Ionicons,MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {PhotoActions} from '../domain/photoPlayer.ts';
import {Lyrics} from './Lyrics.tsx';
import {PlayModeButton} from './PlayModeButton.tsx';
import {PlaybackProgress} from './PlaybackProgress.tsx';
import {SkipGlyph} from './SkipGlyph.tsx';
import {Text} from './Typography.tsx';
import {useStablePlaybackStatus} from './usePlaybackStatus.ts';

export function PhotoPlayer({services,track,favoriteTrack,lyricTrack,font,visible,onMore,onStyle,onQueue,onArtistPress,onNotify}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;visible:boolean;onMore:()=>void;onStyle:()=>void;onQueue?:()=>void;onArtistPress?:(artist:string)=>void;onNotify?:(msg:string)=>void}){
  const {width,height,fontScale}=useWindowDimensions(),insets=useSafeAreaInsets(),columns=width>height&&width>=600&&fontScale<1.8;
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot),controller=services.playback.controller;
  const status=useStablePlaybackStatus(state,{resolving:'正在选择可用音源…',buffering:'正在缓冲…'});
  const prefs=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
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
    const animation=Animated.parallel([Animated.timing(opacity,{toValue:1,duration:140,useNativeDriver:true,isInteraction:false}),Animated.timing(scale,{toValue:1,duration:160,useNativeDriver:true,isInteraction:false})]);animation.start();return()=>animation.stop();
  },[shown,reduce,opacity,scale]);
  const favorite=services.songFavorites.isFavorite(favoriteTrack);
  const tool=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=23,id?:string,value?:string)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value?{text:value}:undefined} onPress={()=>{presentation.interact();action();}} style={{minWidth:42,minHeight:42,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color="#FFFFFF"/></Pressable>;
  const favoriteButton=tool(favorite?'heart':'heart-outline','收藏歌曲',()=>{void services.songFavorites.toggle(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));},23,undefined,favorite?'已收藏':'未收藏');
  const togglePlay=()=>{presentation.interact();if(state.intent==='playing')controller.pause();else void controller.play();};
  // Align song info cleanly along the lower edge of the crisp upper-half portrait/cover.
  const photoHeroHeight=Math.max(260,Math.min(Math.round(width*1.08),Math.round(height*0.54)));
  const topRegionHeight=columns?undefined:Math.max(88,photoHeroHeight-128);
  return <View testID="photo-player" style={{flex:1,minHeight:0}}>
    {/* Lower-half dark gradient scrim keeps left-aligned lyrics luminous & readable */}
    <LinearGradient testID="photo-bottom-scrim" pointerEvents="none" colors={['transparent','rgba(0,0,0,0.68)']} locations={[0,1]} style={{position:'absolute',left:-24,right:-24,bottom:-20,height:'50%'}}/>
    <View testID={columns?'photo-horizontal':'photo-vertical'} style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:10}}>
      <Pressable testID="photo-artwork-region" accessibilityRole="button" accessibilityLabel="切换写真操作" onPress={()=>presentation.toggle()} style={{...(columns?{width:'42%'}:{height:fontScale>1.8?Math.min(110,topRegionHeight??110):topRegionHeight}),justifyContent:'flex-end'}}/>
      <View style={{flex:1,minHeight:0,gap:8}}>
        <View testID="photo-song-info" style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <View style={{flex:1,minWidth:0,gap:2}}>
            <Text numberOfLines={1} style={{fontSize:23,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.2}}>{track.title}</Text>
            <Pressable disabled={!onArtistPress} onPress={()=>onArtistPress?.(track.artist)} style={{alignSelf:'flex-start'}}><Text numberOfLines={1} style={{fontSize:13.5,color:'rgba(255,255,255,0.74)'}}>{track.artist}{track.album?` · ${track.album}`:''}</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={togglePlay} style={{minWidth:42,minHeight:42,alignItems:'center',justifyContent:'center'}}>
            {state.intent==='playing'?<View style={{flexDirection:'row',gap:5}}><View style={{width:5.5,height:21,borderRadius:2.75,backgroundColor:'#FFFFFF'}}/><View style={{width:5.5,height:21,borderRadius:2.75,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={26} color="#FFFFFF" style={{marginLeft:2}}/>}
          </Pressable>
          {favoriteButton}{tool('ellipsis-horizontal','更多播放控制',onMore,23)}
        </View>
        {!!status.text&&<Text accessibilityLiveRegion="polite" style={{color:'rgba(255,255,255,0.82)',fontSize:13}}>{status.text}</Text>}
        <Pressable testID="photo-lyric-viewport" collapsable={false} onPress={()=>presentation.toggle()} style={{flex:1,minHeight:0,overflow:'hidden'}}>
          <Lyrics services={services} track={lyricTrack} font={font} presentation="photo" chrome={columns}/>
        </Pressable>
      </View>
    </View>
    {/* Floating auto-hide dark pill dock matching reference: overlays bottom cleanly without shifting lyrics */}
    {shown&&<Animated.View testID="photo-quick-actions" onTouchStart={()=>presentation.touch(true)} onTouchEnd={()=>presentation.touch(false)} onTouchCancel={()=>presentation.touch(false)} style={{position:'absolute',left:0,right:0,bottom:Math.max(insets.bottom-8,4),opacity,transform:[{scale}],borderRadius:32,backgroundColor:'rgba(8,10,14,0.88)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)',paddingHorizontal:14,paddingTop:4,paddingBottom:6}}>
      <PlaybackProgress services={services} adaptive variant="compact"/>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>{presentation.interact();services.playback.next(-1);}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="back" width={15} height={19} gap={2.5} color="#FFFFFF"/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>{presentation.interact();services.playback.next();}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="forward" width={15} height={19} gap={2.5} color="#FFFFFF"/></Pressable>
        {favoriteButton}
        <Pressable accessibilityRole="button" accessibilityLabel="队列与播放选项" onPress={()=>{presentation.interact();(onQueue??onMore)();}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><MaterialCommunityIcons name="playlist-music" size={22} color="#FFFFFF"/></Pressable>
        <View style={{width:38,height:38,borderRadius:19,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'}}>
          <PlayModeButton repeat={prefs.repeat} shuffle={prefs.shuffle} color="#FFFFFF" activeColor="#F5A6B8" mutedColor="#FFFFFF" size={19} style={{minWidth:38,minHeight:38}} onCycle={next=>{presentation.interact();void services.preferences.update({repeat:next.repeat,shuffle:next.shuffle}).then(()=>onNotify?.(next.label)).catch(()=>Alert.alert('设置未保存'));}}/>
        </View>
      </View>
    </Animated.View>}
  </View>;
}
