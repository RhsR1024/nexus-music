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
import {SkipGlyph} from './SkipGlyph.tsx';
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

export function VinylPlayer({services,track,favoriteTrack,lyricTrack,font,onMore,onStyle,onLyricsSettings,onQueue,onSleep}:{
  services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;
  onMore:()=>void;onStyle:()=>void;onLyricsSettings:()=>void;onQueue:()=>void;onSleep:()=>void;
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
      <View style={styles.progress}><PlaybackProgress services={services} variant="paper"/></View>
      {/* IMG_4851 transport: 64pt play at screen centre, outer tools 68pt from
          the screen edges, 9.5x12.7pt triangles with a 2pt gap. */}
      <View style={styles.transport}>
        {icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));})}
        <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>services.playback.next(-1)} style={[styles.hit,{width:space.section}]}><SkipGlyph direction="back" width={9.5} height={12.7} gap={2} color={paper.icon}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={playing?'暂停':'播放'} onPress={()=>{if(playing)controller.pause();else void controller.play();}} style={styles.play}>
          {playing?<View style={{flexDirection:'row',gap:2.7}}><View style={{width:4.7,height:16,borderRadius:1,backgroundColor:'#FFFFFF'}}/><View style={{width:4.7,height:16,borderRadius:1,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={26} color="#FFFFFF" style={{marginLeft:3}}/>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={[styles.hit,{width:space.section}]}><SkipGlyph direction="forward" width={9.5} height={12.7} gap={2} color={paper.icon}/></Pressable>
        {icon('list','播放队列',()=>{onQueue();},24)}
      </View>
      <View style={styles.tools}>
        {icon('chatbubbles-outline','歌词与来源',()=>setLyricsOpen(true),22)}
        {icon('image-outline','调整播放界面',onStyle,22)}
        <Pressable accessibilityRole="button" accessibilityLabel="睡眠定时" onPress={onSleep} style={[styles.hit,{width:space.section}]}>
          <View style={styles.moon}>
            <Ionicons name="moon-outline" size={19} color={paper.icon}/>
            <View style={styles.zzz}>
              <Text style={styles.zLarge}>z</Text>
              <Text style={styles.zSmall}>z</Text>
            </View>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="歌词显示设置" onPress={onLyricsSettings} style={[styles.hit,{width:space.section}]}>
          <View style={styles.aa}>
            <Text style={styles.aaSmall}>A</Text>
            <Text style={styles.aaLarge}>A</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="查看播放队列" onPress={onQueue} style={[styles.hit,{width:space.section}]}>
          <View style={styles.queue}>
            <View style={[styles.queueLine,{width:18.7}]}/>
            <View style={[styles.queueLine,{width:11.7}]}/>
            <View style={[styles.queueLine,{width:18.7}]}/>
            <View style={[styles.queueLine,{width:11.7}]}/>
          </View>
        </Pressable>
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
  content:{flex:1,paddingHorizontal:space.page,paddingBottom:26.7},
  hit:{minWidth:space.section,minHeight:space.section,alignItems:'center',justifyContent:'center'},
  titleRow:{flexDirection:'row',alignItems:'center',gap:space.sm,marginTop:25},
  title:{...typography.title,color:paper.text},
  artist:{...typography.body,fontSize:14,color:paper.secondary},
  status:{...typography.micro,color:paper.secondary,marginBottom:space.sm},
  progress:{marginHorizontal:11},
  transport:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:23.7,marginHorizontal:15},
  play:{width:64,height:64,borderRadius:32,backgroundColor:paper.text,alignItems:'center',justifyContent:'center'},
  tools:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:13.7,marginHorizontal:10},
  moon:{width:25,height:23,justifyContent:'flex-end'},
  zzz:{position:'absolute',right:-1,top:-1,alignItems:'center'},
  zLarge:{fontSize:8,lineHeight:9,fontWeight:'700',color:paper.icon},
  zSmall:{fontSize:6.5,lineHeight:7,fontWeight:'700',color:paper.icon},
  aa:{flexDirection:'row',alignItems:'baseline',gap:1.5},
  aaSmall:{fontSize:13,lineHeight:20,fontWeight:'300',color:paper.toolMuted},
  aaLarge:{fontSize:19,lineHeight:20,fontWeight:'300',color:paper.toolMuted},
  queue:{gap:3.5},
  queueLine:{height:1.5,borderRadius:0.75,backgroundColor:paper.icon},
  caption:{...typography.micro,color:paper.secondary,textAlign:'center',marginTop:13.7},
});
