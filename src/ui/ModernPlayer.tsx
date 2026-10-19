import {PlaybackProgress} from './PlaybackProgress.tsx';
import {StagePlayer} from './StagePlayer.tsx';
import {PhotoPlayer} from './PhotoPlayer.tsx';
import {requireNativeView} from 'expo';
import {Image,type ViewProps} from 'react-native';
import {AMPlayer} from './AMPlayer.tsx';
import {AM2Player} from './AM2Player.tsx';
import {useVisualAssets,useVisualImage,MotionImage} from './VisualBackground.tsx';
import {darkenCoverColor,playerBackgroundImage} from '../domain/appearance.ts';
import {Text} from './Typography.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {FrequencyHalo} from './PlayerVisuals.tsx';
import {VinylPlayer} from './VinylPlayer.tsx';
import type {PlayerLayout} from '../app/preferences.ts';
import {Cover} from './Cover.tsx';
import {Lyrics} from './Lyrics.tsx';
const PhotoMask=requireNativeView<ViewProps>('NexusNative','PhotoMask');
export function ArtworkBackdrop({services,track,photo=false}:{services:Services;track:Track;photo?:boolean}){
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const assets=useVisualAssets(services),custom=useVisualImage(services,assets.photo);
  const [artwork,setArtwork]=useState<{key:string;uri:string}>(),[failedImages,setFailedImages]=useState<readonly string[]>([]),[tint,setTint]=useState('#183647');
  const key=JSON.stringify([track.origin,track.artwork,track.metadata.davVersion,track.metadata.coverArtId]);
  useEffect(()=>{const abort=new AbortController();setArtwork(undefined);setFailedImages([]);services.covers.loadTrack(track,abort.signal).then(value=>{if(!abort.signal.aborted&&value)setArtwork({key,uri:value});}).catch(()=>{});return()=>abort.abort();},[services,key]);
  const file=artwork?.key===key?artwork.uri:undefined;
  const uri=playerBackgroundImage(preferences.playerBackground,photo,custom,file,failedImages);
  useEffect(()=>{let valid=true;setTint('#183647');if(uri&&preferences.coverColor)void services.visualColors.color(uri).then(color=>{if(valid)setTint(darkenCoverColor(color));}).catch(()=>{});return()=>{valid=false;};},[services,uri,preferences.coverColor]);
  const blur=preferences.playerBlur;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:tint}]}>
    {uri&&<MotionImage uri={uri} blur={blur} opacity={preferences.coverColor?.45:1} moving={preferences.dynamicBackground&&playback.phase==='ready'&&playback.intent==='playing'&&!playback.buffering} onError={()=>setFailedImages(previous=>previous.includes(uri)?previous:[...previous.slice(-3),uri])}/>}
    <LinearGradient colors={[`rgba(7,14,24,${preferences.playerDarkness})`,`rgba(7,14,24,${Math.min(.96,preferences.playerDarkness+.15)})`,'rgba(7,14,24,0.94)']} style={StyleSheet.absoluteFill}/>
    {photo&&uri&&<PhotoMask testID="photo-hero-mask" pointerEvents="none" style={StyleSheet.absoluteFill}><Image testID="photo-hero-image" source={{uri}} resizeMode="cover" onError={()=>setFailedImages(previous=>previous.includes(uri)?previous:[...previous.slice(-3),uri])} style={StyleSheet.absoluteFill}/></PhotoMask>}
    {photo&&uri&&<LinearGradient colors={[`rgba(7,14,24,${preferences.playerDarkness*.35})`,`rgba(7,14,24,${Math.min(.85,preferences.playerDarkness+.05)})`,'rgba(7,14,24,0)']} locations={[0,.5,1]} style={StyleSheet.absoluteFill}/>}

  </View>;
}
export function ModernPlayer({services,track,favoriteTrack,lyricTrack,font,layout,onMore,onStyle,onLyricsSettings,onQueue,visible=true}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;layout:Exclude<PlayerLayout,'classic'>;onMore:()=>void;onStyle:()=>void;onLyricsSettings?:()=>void;onQueue?:()=>void;visible?:boolean}){
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const {width,height}=useWindowDimensions(),controller=services.playback.controller;
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=25)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color="#FFFFFF"/></Pressable>;
  const isFavorite=services.library.isFavorite(favoriteTrack);
  const toggleFavorite=()=>{void services.library.favorite(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));};
  const favoriteButton=<Pressable accessibilityRole="button" accessibilityLabel="收藏歌曲" accessibilityValue={{text:isFavorite?'已收藏':'未收藏'}} onPress={toggleFavorite} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><Ionicons name={isFavorite?'heart':'heart-outline'} size={25} color="#FFFFFF"/></Pressable>;
  const transport=icon(state.intent==='playing'?'pause':'play',state.intent==='playing'?'暂停':'播放',()=>{if(state.intent==='playing')controller.pause();else void controller.play();},64);
  if(layout==='vinyl')return <VinylPlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} onMore={onMore} onStyle={onStyle} onLyricsSettings={onLyricsSettings??onMore} onQueue={onQueue??onMore}/>;
  if(layout==='stage')return <StagePlayer services={services} track={track} lyricTrack={lyricTrack} font={font} onMore={onMore} onStyle={onStyle} controls={<><PlaybackProgress services={services} adaptive/><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>{icon('play-back','上一首',()=>services.playback.next(-1),32)}{icon(state.intent==='playing'?'pause':'play',state.intent==='playing'?'暂停':'播放',()=>{if(state.intent==='playing')controller.pause();else void controller.play();},46)}{icon('play-forward','下一首',()=>services.playback.next(),32)}{favoriteButton}</View></>}/>;
  if(layout==='photo')return <PhotoPlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} visible={visible} onMore={onMore} onStyle={onStyle}/>;
  if(layout==='am')return <AMPlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} onMore={onMore} onStyle={onStyle} controls={<>
    {(state.error||state.phase==='resolving'||state.buffering)&&<Text accessibilityLiveRegion="polite" style={styles.small}>{state.error??(state.phase==='resolving'?'正在选择可用音源…':'正在缓冲…')}</Text>}
    <PlaybackProgress services={services} adaptive/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>{icon('play-back','上一首',()=>services.playback.next(-1),42)}{transport}{icon('play-forward','下一首',()=>services.playback.next(),42)}</View>
  </>}/>;
  if(layout==='am2')return <AM2Player services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} identity={JSON.stringify([state.queue.currentId,lyricTrack.origin])} visible={visible} onMore={onMore} controls={<>
    {(state.error||state.buffering)&&<Text style={styles.small}>{state.error??'正在缓冲…'}</Text>}
    <PlaybackProgress services={services} adaptive/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>{icon('play-back','上一首',()=>services.playback.next(-1),32)}{icon(state.intent==='playing'?'pause':'play',state.intent==='playing'?'暂停':'播放',()=>{if(state.intent==='playing')controller.pause();else void controller.play();},46)}{icon('play-forward','下一首',()=>services.playback.next(),32)}{icon('options-outline','调整播放界面',onStyle)}</View>
  </>}/>;
  // Keep artwork square inside its measured viewport. The remaining vertical
  // budget belongs to lyrics/controls, not a crop of the album artwork.
  const artworkSide=Math.max(1,Math.min(width-48,430,height*(layout==='wave'?.30:.34)));
  // IMG_4867 centres the title under the artwork and moves every action into the
  // bottom row; the immersive skin keeps the left-aligned header.
  const centered=layout==='wave';
  return <View style={{gap:16}}>
    {<><View testID="player-artwork-viewport" collapsable={false} style={{width:artworkSide,height:artworkSide,alignSelf:'center',overflow:'hidden',borderRadius:preferences.coverRadius}}><View testID="player-artwork-square" collapsable={false}><Cover services={services} track={track} size={artworkSide}/></View></View><View style={{flexDirection:'row',alignItems:'center',gap:12,justifyContent:centered?'center':undefined}}><View style={{flex:centered?0:1,gap:8,alignItems:centered?'center':'flex-start'}}><Text style={{fontSize:centered?22:27,fontWeight:'700',color:'#FFFFFF'}}>{track.title}</Text><Text style={styles.small}>{track.artist}</Text></View>{!centered&&favoriteButton}{!centered&&icon('ellipsis-horizontal','更多播放控制',onMore)}</View></>}
    <View testID="player-lyric-viewport" collapsable={false} style={{height:centered?96:150,overflow:'hidden',justifyContent:'center'}}><Lyrics services={services} track={lyricTrack} font={font} visibleLines={layout==='wave'||layout==='immersive'?1:undefined} presentation="immersive"/></View>
    {(state.error||state.phase==='resolving'||state.buffering)&&<Text accessibilityLiveRegion="polite" style={styles.small}>{state.error??(state.phase==='resolving'?'正在选择可用音源…':'正在缓冲…')}</Text>}
    <PlaybackProgress services={services}/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingVertical:12}}>{icon('play-back','上一首',()=>services.playback.next(-1),42)}{layout==='wave'?<FrequencyHalo services={services} playing={state.intent==='playing'&&!state.buffering}>{transport}</FrequencyHalo>:transport}{icon('play-forward','下一首',()=>services.playback.next(),42)}</View>
    {centered?<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>
      {icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));},22)}
      {favoriteButton}
      {icon('text-outline','歌词显示设置',onLyricsSettings??onMore,22)}
      {icon('list','播放队列',onQueue??onMore,22)}
      {icon('ellipsis-horizontal','更多播放控制',onMore,22)}
    </View>:<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>{icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));})}{icon('shuffle',`随机：${preferences.shuffle?'开':'关'}`,()=>{void services.preferences.update({shuffle:!preferences.shuffle}).catch(()=>Alert.alert('设置未保存'));})}{icon('list','队列与播放选项',onMore)}{icon('options-outline','调整播放界面',onStyle)}</View>}
  </View>;
}
const styles=StyleSheet.create({small:{color:'rgba(255,255,255,0.64)',fontSize:13,lineHeight:20}});
