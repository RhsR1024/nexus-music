import {useEffect,useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,ScrollView,StyleSheet,View,useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {coverThemeGradient} from '../domain/appearance.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {Cover} from './Cover.tsx';
import {Lyrics} from './Lyrics.tsx';
import {PlaybackProgress} from './PlaybackProgress.tsx';
import {Vinyl} from './PlayerVisuals.tsx';
import {Text} from './Typography.tsx';
import {paper,space,typography} from './tokens.ts';

function PaperBackdrop({services,track}:{services:Services;track:Track}){
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [tint,setTint]=useState('#E7D7CB');
  const key=JSON.stringify([track.origin,track.artwork,track.metadata.davVersion,track.metadata.coverArtId]);
  useEffect(()=>{const abort=new AbortController();let active=true;setTint('#E7D7CB');
    services.covers.loadTrack(track,abort.signal).then(uri=>uri?services.visualColors.color(uri):undefined).then(color=>{if(active&&color)setTint(color);}).catch(()=>{});
    return()=>{active=false;abort.abort();};},[services,key]);
  // The paper surface always mixes toward white, so the fixed dark text color
  // stays readable even when the cover is dark.
  const gradient=preferences.coverColor?coverThemeGradient(tint,'light'):[paper.background,'#F3E7DC',paper.background] as const;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:paper.background}]}>
    <LinearGradient colors={gradient} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
  </View>;
}

export function VinylPlayer({services,track,favoriteTrack,lyricTrack,font,onMore,onStyle,onLyricsSettings,onQueue}:{
  services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;
  onMore:()=>void;onStyle:()=>void;onLyricsSettings:()=>void;onQueue:()=>void;
}){
  const {width,height}=useWindowDimensions();
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [lyricsOpen,setLyricsOpen]=useState(false);
  const deck=Math.max(1,Math.min(width-space.page*2,368,height*.44));
  const isFavorite=services.library.isFavorite(favoriteTrack);
  const playing=state.intent==='playing';
  const controller=services.playback.controller;
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=24)=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={[styles.hit,{width:space.section}]}>
      <Ionicons name={name} size={size} color={paper.icon}/>
    </Pressable>);
  const toggleFavorite=()=>{void services.library.favorite(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));};
  return <View style={styles.root}>
    <PaperBackdrop services={services} track={track}/>
    <View style={[styles.content,{paddingTop:Math.max(96,height*.16)}]}>
      <View style={{width:deck,height:deck,alignSelf:'center'}}>
        <Vinyl services={services} track={track} playing={state.phase==='ready'&&playing&&!state.buffering} size={deck}/>
      </View>
      <View style={styles.titleRow}>
        <View style={{flex:1,minWidth:0,gap:space.xxs}}>
          <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{track.artist}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="收藏歌曲" accessibilityValue={{text:isFavorite?'已收藏':'未收藏'}} onPress={toggleFavorite} style={styles.hit}>
          <Ionicons name={isFavorite?'heart':'heart-outline'} size={23} color={paper.icon}/>
        </Pressable>
      </View>
      <View style={{flex:1,minHeight:space.lg}}/>
      {(state.error||state.phase==='resolving'||state.buffering)&&<Text accessibilityLiveRegion="polite" style={styles.status}>{state.error??(state.phase==='resolving'?'正在选择可用音源…':'正在缓冲…')}</Text>}
      <PlaybackProgress services={services} variant="paper"/>
      <View style={styles.transport}>
        {icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));})}
        {icon('play-skip-back-outline','上一首',()=>services.playback.next(-1),25)}
        <Pressable accessibilityRole="button" accessibilityLabel={playing?'暂停':'播放'} onPress={()=>{if(playing)controller.pause();else void controller.play();}} style={styles.play}>
          <Ionicons name={playing?'pause':'play'} size={22} color="#FFFFFF" style={playing?undefined:{marginLeft:2}}/>
        </Pressable>
        {icon('play-skip-forward-outline','下一首',()=>services.playback.next(),25)}
        {icon('list-outline','播放队列',()=>{onQueue();},24)}
      </View>
      <View style={styles.tools}>
        {icon('chatbubble-ellipses-outline','歌词与来源',()=>setLyricsOpen(true),22)}
        {icon('image-outline','调整播放界面',onStyle,22)}
        {icon('text-outline','歌词显示设置',onLyricsSettings,22)}
        {icon('albums-outline','查看播放队列',onQueue,22)}
        {icon('ellipsis-horizontal','更多播放控制',onMore,22)}
      </View>
      <Text numberOfLines={1} style={styles.caption}>{state.media?.quality?`${state.media.quality.toUpperCase()} 音源`:'等待音源'}</Text>
    </View>
    <SheetModal visible={lyricsOpen} onRequestClose={()=>setLyricsOpen(false)}>
      <ScrollView style={{backgroundColor:paper.background}} contentContainerStyle={{padding:space.xxl,gap:space.lg}}>
        <Pressable accessibilityRole="button" accessibilityLabel="收起黑胶歌词" onPress={()=>setLyricsOpen(false)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:paper.secondary}}>收起歌词</Text></Pressable>
        {lyricsOpen&&<Lyrics services={services} track={lyricTrack} font={font}/>}
      </ScrollView>
    </SheetModal>
  </View>;
}

const styles=StyleSheet.create({
  root:{flex:1},
  content:{flex:1,paddingHorizontal:space.page,paddingBottom:space.xxl},
  hit:{minWidth:space.section,minHeight:space.section,alignItems:'center',justifyContent:'center'},
  titleRow:{flexDirection:'row',alignItems:'center',gap:space.sm,marginTop:space.section},
  title:{...typography.title,color:paper.text},
  artist:{...typography.body,fontSize:14,color:paper.secondary},
  status:{...typography.micro,color:paper.secondary,marginBottom:space.sm},
  transport:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:space.md},
  play:{width:46,height:46,borderRadius:23,backgroundColor:paper.text,alignItems:'center',justifyContent:'center'},
  tools:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:space.xl},
  caption:{...typography.micro,color:paper.secondary,textAlign:'center',marginTop:space.md},
});
