import {PlaybackProgress} from './PlaybackProgress.tsx';
import {StagePlayer} from './StagePlayer.tsx';
import {PhotoPlayer} from './PhotoPlayer.tsx';
import {requireNativeView} from 'expo';
import {Image,type ViewProps} from 'react-native';
import {AMPlayer} from './AMPlayer.tsx';
import {AM2Player} from './AM2Player.tsx';
import {useVisualAssets,useVisualImage,MotionImage,AmbientMeshGradient} from './VisualBackground.tsx';
import {darkenCoverColor,meshPalette,playerBackgroundImage} from '../domain/appearance.ts';
import {playbackTimeline} from '../playback/timeline.ts';
import {Text} from './Typography.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons,MaterialCommunityIcons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {FrequencyHalo} from './PlayerVisuals.tsx';
import {VinylPlayer} from './VinylPlayer.tsx';
import {GroovePlayer} from './GroovePlayer.tsx';
import {TeletypePlayer} from './TeletypePlayer.tsx';
import {SkipGlyph} from './SkipGlyph.tsx';
import type {PlayerLayout} from '../app/preferences.ts';
import {Cover} from './Cover.tsx';
import {PlayerCover} from './TapeCover.tsx';
import {Lyrics} from './Lyrics.tsx';
import {useStablePlaybackStatus} from './usePlaybackStatus.ts';
const PhotoMask=requireNativeView<ViewProps>('NexusNative','PhotoMask');
const clock=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;

export function ArtworkBackdrop({services,track,photo=false}:{services:Services;track:Track;photo?:boolean}){
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const assets=useVisualAssets(services),custom=useVisualImage(services,assets.photo);
  const [artwork,setArtwork]=useState<{key:string;uri:string}>(),[failedImages,setFailedImages]=useState<readonly string[]>([]),[tint,setTint]=useState('#183647'),[mesh,setMesh]=useState<readonly string[]>();
  const key=JSON.stringify([track.origin,track.artwork,track.metadata.davVersion,track.metadata.coverArtId]);
  useEffect(()=>{const abort=new AbortController();setArtwork(undefined);setFailedImages([]);services.covers.loadTrack(track,abort.signal).then(value=>{if(!abort.signal.aborted&&value)setArtwork({key,uri:value});}).catch(()=>{});return()=>abort.abort();},[services,key]);
  const file=artwork?.key===key?artwork.uri:undefined;
  const uri=playerBackgroundImage(preferences.playerBackground,photo,custom,file,failedImages);
  useEffect(()=>{let valid=true;setTint('#183647');if(uri&&preferences.coverColor)void services.visualColors.color(uri).then(color=>{if(valid)setTint(darkenCoverColor(color));}).catch(()=>{});return()=>{valid=false;};},[services,uri,preferences.coverColor]);
  // Decision 0081: the mesh rides on the extracted cover palette; the photo
  // skin is its own full-bleed composition and keeps the plain backdrop.
  useEffect(()=>{let valid=true;setMesh(undefined);if(uri&&!photo&&preferences.coverColor)void services.visualColors.flowPalette(uri).then(palette=>{if(valid)setMesh(meshPalette(undefined,palette));}).catch(()=>{});return()=>{valid=false;};},[services,uri,photo,preferences.coverColor]);
  const blur=preferences.playerBlur;
  const d=preferences.playerDarkness;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:tint}]}>
    {uri&&<MotionImage uri={uri} blur={blur} opacity={preferences.coverColor?.48:1} moving={preferences.dynamicBackground&&playback.phase==='ready'&&playback.intent==='playing'&&!playback.buffering} onError={()=>setFailedImages(previous=>previous.includes(uri)?previous:[...previous.slice(-3),uri])}/>}
    {mesh&&<AmbientMeshGradient colors={mesh} identity={key} moving={preferences.dynamicBackground&&playback.phase==='ready'&&playback.intent==='playing'&&!playback.buffering} pending={false} dark/>}
    <LinearGradient colors={photo?[`rgba(7,14,24,${d})`,`rgba(7,14,24,${Math.min(.96,d+.15)})`,'rgba(7,14,24,0.94)']:[`rgba(10,14,22,${Math.max(.18,d*.52)})`,`rgba(10,14,22,${Math.min(.62,d*.74)})`,`rgba(10,14,22,${Math.min(.72,d+.12)})`]} style={StyleSheet.absoluteFill}/>
    {photo&&uri&&<PhotoMask testID="photo-hero-mask" pointerEvents="none" style={StyleSheet.absoluteFill}><Image testID="photo-hero-image" source={{uri}} resizeMode="cover" onError={()=>setFailedImages(previous=>previous.includes(uri)?previous:[...previous.slice(-3),uri])} style={StyleSheet.absoluteFill}/></PhotoMask>}
    {photo&&uri&&<LinearGradient colors={[`rgba(7,14,24,${d*.35})`,`rgba(7,14,24,${Math.min(.85,d+.05)})`,'rgba(7,14,24,0)']} locations={[0,.5,1]} style={StyleSheet.absoluteFill}/>}
  </View>;
}

export function ModernPlayer({services,track,favoriteTrack,lyricTrack,font,layout,onMore,onStyle,onLyricsSettings,onLyricSource,onQueue,onComments,onSleep,onPlaylist,onArtistPress,visible=true}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;layout:Exclude<PlayerLayout,'classic'>;onMore:()=>void;onStyle:()=>void;onLyricsSettings?:()=>void;onLyricSource?:()=>void;onQueue?:()=>void;onComments?:()=>void;onSleep?:()=>void;onPlaylist?:()=>void;onArtistPress?:(artist:string)=>void;visible?:boolean}){
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const status=useStablePlaybackStatus(state,{resolving:'正在选择可用音源…',buffering:'正在缓冲…'});
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
  const {width,height}=useWindowDimensions(),controller=services.playback.controller;
  const swipeStart=useRef<{x:number;y:number}|null>(null);
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=24)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{minWidth:46,minHeight:46,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color="#FFFFFF"/></Pressable>;
  const isFavorite=services.songFavorites.isFavorite(favoriteTrack);
  const toggleFavorite=()=>{void services.songFavorites.toggle(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));};
  const favoriteButton=<Pressable accessibilityRole="button" accessibilityLabel="收藏歌曲" accessibilityValue={{text:isFavorite?'已收藏':'未收藏'}} onPress={toggleFavorite} style={{minWidth:46,minHeight:46,alignItems:'center',justifyContent:'center'}}><Ionicons name={isFavorite?'heart':'heart-outline'} size={24} color="#FFFFFF"/></Pressable>;
  const doublePillTransport=<Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={()=>{if(state.intent==='playing')controller.pause();else void controller.play();}} style={{width:68,height:68,alignItems:'center',justifyContent:'center'}}>{state.intent==='playing'?<View style={{flexDirection:'row',gap:9}}><View style={{width:9,height:32,borderRadius:4.5,backgroundColor:'#FFFFFF'}}/><View style={{width:9,height:32,borderRadius:4.5,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={44} color="#FFFFFF" style={{marginLeft:4}}/>}</Pressable>;
  if(layout==='vinyl')return <VinylPlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} onMore={onMore} onStyle={onStyle} onLyricsSettings={onLyricsSettings??onMore} onQueue={onQueue??onMore} onSleep={onSleep??onMore}/>;
  if(layout==='groove')return <GroovePlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} onMore={onMore} onStyle={onStyle} onQueue={onQueue??onMore} onComments={onComments}/>;
  if(layout==='teletype')return <TeletypePlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} onMore={onMore} onStyle={onStyle} onQueue={onQueue??onMore} onComments={onComments}/>;
  if(layout==='stage')return <StagePlayer services={services} track={track} lyricTrack={lyricTrack} font={font} onMore={onMore} onStyle={onStyle} onLyricSource={onLyricSource} controls={<><PlaybackProgress services={services} adaptive variant="stage"/><View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:34,marginTop:6}}><Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>services.playback.next(-1)} style={{minWidth:44,minHeight:56,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="back" width={20} height={26} gap={3.5} color="#FFFFFF"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={()=>{if(state.intent==='playing')controller.pause();else void controller.play();}} style={{width:72,height:72,borderRadius:36,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}}>{state.intent==='playing'?<View style={{flexDirection:'row',gap:6}}><View style={{width:6.5,height:22,borderRadius:3.25,backgroundColor:'#101010'}}/><View style={{width:6.5,height:22,borderRadius:3.25,backgroundColor:'#101010'}}/></View>:<Ionicons name="play" size={32} color="#101010" style={{marginLeft:3}}/>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={{minWidth:44,minHeight:56,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="forward" width={20} height={26} gap={3.5} color="#FFFFFF"/></Pressable></View></>}/>;
  if(layout==='photo')return <PhotoPlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} visible={visible} onMore={onMore} onStyle={onStyle} onQueue={onQueue} onArtistPress={onArtistPress}/>;
  if(layout==='am')return <AMPlayer services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} onMore={onMore} onStyle={onStyle} onComments={onComments} onArtistPress={onArtistPress} controls={<>
    {!!status.text&&<Text accessibilityLiveRegion="polite" style={styles.small}>{status.text}</Text>}
    <PlaybackProgress services={services} adaptive variant="am"/>
    {/* IMG_4861: pill-capped pause bars (14x48.7pt, 7pt caps) sit 2pt higher than
        the first render, so the whole row lifts with a 46.6pt top margin. */}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',marginTop:46.6}}><Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>services.playback.next(-1)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="back" width={22.3} height={29.3} gap={4} color="#FFFFFF"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={()=>{if(state.intent==='playing')controller.pause();else void controller.play();}} style={{width:68,height:68,alignItems:'center',justifyContent:'center'}}>{state.intent==='playing'?<View style={{flexDirection:'row',gap:14.4}}><View style={{width:14,height:48.7,borderRadius:7,backgroundColor:'#FFFFFF'}}/><View style={{width:14,height:48.7,borderRadius:7,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={68} color="#FFFFFF" style={{marginLeft:4}}/>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="forward" width={22.3} height={29.3} gap={4} color="#FFFFFF"/></Pressable></View>
  </>}/>;
  if(layout==='am2')return <AM2Player services={services} track={track} favoriteTrack={favoriteTrack} lyricTrack={lyricTrack} font={font} identity={JSON.stringify([state.queue.currentId,lyricTrack.origin])} visible={visible} onMore={onMore} onStyle={onStyle} onLyricSource={onLyricSource} onArtistPress={onArtistPress} controls={<>
    {!!status.text&&status.kind!=='resolving'&&<Text style={styles.small}>{status.text}</Text>}
    <PlaybackProgress services={services} adaptive variant="am2"/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingVertical:4}}>
      <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>services.playback.next(-1)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="back" width={21} height={27} gap={3.5} color="#FFFFFF"/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={()=>{if(state.intent==='playing')controller.pause();else void controller.play();}} style={{width:64,height:64,alignItems:'center',justifyContent:'center'}}>{state.intent==='playing'?<View style={{flexDirection:'row',gap:12}}><View style={{width:12,height:42,borderRadius:6,backgroundColor:'#FFFFFF'}}/><View style={{width:12,height:42,borderRadius:6,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={54} color="#FFFFFF" style={{marginLeft:4}}/>}</Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="forward" width={21} height={27} gap={3.5} color="#FFFFFF"/></Pressable>
    </View>
  </>}/>;
  const swipeHandlers={
    onTouchStart:(e:{nativeEvent:{pageX:number;pageY:number}})=>{swipeStart.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY};},
    onTouchEnd:(e:{nativeEvent:{pageX:number;pageY:number}})=>{const s=swipeStart.current;swipeStart.current=null;if(!s)return;const dx=e.nativeEvent.pageX-s.x,dy=e.nativeEvent.pageY-s.y;if(Math.abs(dx)>56&&Math.abs(dx)>Math.abs(dy)*1.4)services.playback.next(dx<0?1:-1);},
  };
  if(layout==='immersive'){
    // Sollin 05-immersive.png: full-bleed top width x width square artwork feathering smoothly into backdrop.
    const fullSide=Math.max(1,Math.min(width,height*.52));
    return <View style={{flex:1,minHeight:0}}>
      <View {...swipeHandlers} testID="player-artwork-viewport" collapsable={false} style={{width:fullSide,height:fullSide,alignSelf:'center',overflow:'hidden'}}>
        <View testID="player-artwork-square" collapsable={false}>{preferences.tapeStyle?<PlayerCover services={services} track={track} size={fullSide}/>:<Cover services={services} track={track} size={fullSide} radius={0}/>}</View>
        <LinearGradient pointerEvents="none" colors={['rgba(10,14,22,0.18)','transparent','transparent','rgba(10,14,22,0.82)']} locations={[0,0.18,0.58,1]} style={StyleSheet.absoluteFill}/>
      </View>
      <View style={{flex:1,minHeight:0,paddingHorizontal:24,paddingBottom:20,justifyContent:'space-between',marginTop:-24}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={{flex:1,gap:3}}>
            <Text numberOfLines={1} style={{fontSize:24,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.2}}>{track.title}</Text>
            <Pressable disabled={!onArtistPress} onPress={()=>onArtistPress?.(track.artist)} style={{alignSelf:'flex-start'}}><Text numberOfLines={1} style={styles.small}>{track.artist}{track.album?` · ${track.album}`:''}</Text></Pressable>
          </View>
          {favoriteButton}{icon('ellipsis-horizontal','更多播放控制',onMore,23)}
        </View>
        <View testID="player-lyric-viewport" collapsable={false} style={{flex:1,minHeight:92,overflow:'hidden',justifyContent:'center',marginVertical:4}}><Lyrics services={services} track={lyricTrack} font={font} visibleLines={5} presentation="immersive" chrome={false}/></View>
        <View style={{minHeight:19,justifyContent:'center'}}>{!!status.text&&<Text accessibilityLiveRegion="polite" style={styles.small}>{status.text}</Text>}</View>
        <PlaybackProgress services={services} adaptive variant="immersive"/>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingVertical:4}}>
          <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>services.playback.next(-1)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="back" width={20} height={26} gap={3.5} color="#FFFFFF"/></Pressable>
          {doublePillTransport}
          <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="forward" width={20} height={26} gap={3.5} color="#FFFFFF"/></Pressable>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingTop:2}}>
          {icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));},21)}
          {icon('albums-outline','加入歌单',onPlaylist??onMore,21)}
          <Pressable accessibilityRole="button" accessibilityLabel="队列与播放选项" onPress={onQueue??onMore} style={{minWidth:46,minHeight:46,alignItems:'center',justifyContent:'center'}}><MaterialCommunityIcons name="playlist-music" size={22} color="#FFFFFF"/></Pressable>
          {icon('chatbubble-ellipses-outline','歌曲评论',onComments??onMore,21)}
          {icon('options-outline','调整播放界面',onStyle,21)}
        </View>
      </View>
    </View>;
  }
  // Wave skin (IMG_4867 / 08-wave.png): square artwork, centered metadata & lyrics, time+FLAC row (no duplicate progress bar), FrequencyHalo, 5-icon footer.
  const timeline=playbackTimeline(state);
  const waveSide=Math.max(1,Math.min(width-56,410,height*.38));
  const waveTransport=<Pressable accessibilityRole="button" accessibilityLabel={state.intent==='playing'?'暂停':'播放'} onPress={()=>{if(state.intent==='playing')controller.pause();else void controller.play();}} style={{width:72,height:72,alignItems:'center',justifyContent:'center'}}>{state.intent==='playing'?<View style={{flexDirection:'row',gap:7.5}}><View style={{width:7.5,height:27,borderRadius:3.75,backgroundColor:'#FFFFFF'}}/><View style={{width:7.5,height:27,borderRadius:3.75,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={38} color="#FFFFFF" style={{marginLeft:4}}/>}</Pressable>;
  return <View style={{flex:1,minHeight:0,justifyContent:'space-between',gap:8}}>
    <View {...swipeHandlers} testID="player-artwork-viewport" collapsable={false} style={{width:waveSide,height:waveSide,alignSelf:'center',overflow:'hidden',borderRadius:Math.max(20,preferences.coverRadius),shadowColor:'#000000',shadowOpacity:0.35,shadowRadius:22,shadowOffset:{width:0,height:10}}}><View testID="player-artwork-square" collapsable={false}><PlayerCover services={services} track={track} size={waveSide}/></View></View>
    <View style={{alignItems:'center',gap:3,paddingHorizontal:8}}>
      <Text numberOfLines={1} style={{fontSize:21,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.2}}>{track.title}</Text>
      <Pressable disabled={!onArtistPress} onPress={()=>onArtistPress?.(track.artist)}><Text numberOfLines={1} style={styles.small}>{track.artist}{track.album?` · ${track.album}`:''}</Text></Pressable>
    </View>
    <View testID="player-lyric-viewport" collapsable={false} style={{height:106,overflow:'hidden',justifyContent:'center'}}><Lyrics services={services} track={lyricTrack} font={font} visibleLines={3} presentation="wave" chrome={false}/></View>
    <View style={{minHeight:19,justifyContent:'center'}}>{!!status.text&&<Text accessibilityLiveRegion="polite" style={[styles.small,{textAlign:'center'}]}>{status.text}</Text>}</View>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="播放进度" accessibilityState={{disabled:!timeline.seekable}} accessibilityValue={{min:0,max:Math.floor(timeline.duration),now:Math.floor(timeline.position),text:`${clock(timeline.position)} / ${clock(timeline.duration)}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>{if(timeline.seekable)controller.seek(state.position+(event.nativeEvent.actionName==='increment'?10:-10));}} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:2}}>
      <Text style={styles.waveTime}>{clock(timeline.position)}</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:'rgba(255,255,255,0.32)',borderRadius:10,paddingHorizontal:10,paddingVertical:1.5}}><Ionicons name="pulse" size={12} color="rgba(255,255,255,0.82)"/><Text style={[styles.waveTime,{color:'rgba(255,255,255,0.84)',fontWeight:'600'}]}>{state.media?.quality?state.media.quality.toUpperCase():'等待音源'}</Text></View>
      <Text style={styles.waveTime}>−{clock(Math.max(0,timeline.duration-timeline.position))}</Text>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}>
      <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>services.playback.next(-1)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="back" width={19} height={24} gap={3.5} color="#FFFFFF"/></Pressable>
      <FrequencyHalo services={services} playing={state.intent==='playing'&&!state.buffering}>{waveTransport}</FrequencyHalo>
      <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><SkipGlyph direction="forward" width={19} height={24} gap={3.5} color="#FFFFFF"/></Pressable>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingBottom:2}}>
      {icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));},21)}
      {favoriteButton}
      <Pressable accessibilityRole="button" accessibilityLabel="播放队列" onPress={onQueue??onMore} style={{minWidth:46,minHeight:46,alignItems:'center',justifyContent:'center'}}><MaterialCommunityIcons name="playlist-music" size={22} color="#FFFFFF"/></Pressable>
      {icon('chatbubble-ellipses-outline','歌曲评论',onComments??onLyricsSettings??onMore,21)}
      {icon('ellipsis-vertical','更多播放控制',onMore,21)}
    </View>
  </View>;
}
const styles=StyleSheet.create({small:{color:'rgba(255,255,255,0.68)',fontSize:13,lineHeight:19},waveTime:{color:'rgba(255,255,255,0.72)',fontSize:12,lineHeight:15,fontVariant:['tabular-nums']}});
