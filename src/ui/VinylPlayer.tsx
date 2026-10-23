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
  // stays readable even when the cover is dark. The default blush wash follows
  // IMG_4851's vertical ramp: near-white top, peach through the deck, pink foot.
  const gradient=preferences.coverColor?coverThemeGradient(tint,'light'):['#FAF6F3','#F6EEE9','#F3DED4','#F0CFC3','#F4D6CB','#F5D7CD','#FBE5E3','#FDEAEA'] as const;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:paper.background}]}>
    <LinearGradient colors={gradient} locations={preferences.coverColor?undefined:[0,.06,.17,.35,.55,.74,.96,1]} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFill}/>
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
  // IMG_4851 deck: 370.33x351pt at x29.67/y155.67 on the 430x932 reference.
  const deck=Math.max(1,Math.min(width-59.34,370.33));
  const isFavorite=services.library.isFavorite(favoriteTrack);
  const playing=state.intent==='playing';
  const controller=services.playback.controller;
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,size=24)=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={[styles.hit,{width:space.section}]}>
      <Ionicons name={name} size={size} color={paper.vinylIcon}/>
    </Pressable>);
  const toggleFavorite=()=>{void services.library.favorite(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));};
  return <View style={styles.root}>
    <PaperBackdrop services={services} track={track}/>
    <View style={[styles.content,{paddingTop:Math.max(96,height*(155.67/932))}]}>
      <View style={{alignSelf:'center'}}>
        <Vinyl services={services} track={track} playing={state.phase==='ready'&&playing&&!state.buffering} width={deck}/>
      </View>
      <View style={styles.titleRow}>
        <View style={{flex:1,minWidth:0,gap:4,marginLeft:-7.5}}>
          <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{track.artist}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="收藏歌曲" accessibilityValue={{text:isFavorite?'已收藏':'未收藏'}} onPress={toggleFavorite} style={[styles.hit,{marginRight:-5}]}>
          <Ionicons name={isFavorite?'heart':'heart-outline'} size={24} color={paper.heartInk}/>
        </Pressable>
      </View>
      <View style={{flex:1,minHeight:space.lg}}/>
      {(state.error||state.phase==='resolving'||state.buffering)&&<Text accessibilityLiveRegion="polite" style={styles.status}>{state.error??(state.phase==='resolving'?'正在选择可用音源…':'正在缓冲…')}</Text>}
      <View style={styles.progress}><PlaybackProgress services={services} variant="paper"/></View>
      {/* IMG_4851 transport: 64pt play at screen centre, outer tools 68pt from
          the screen edges, 9.5x12.7pt triangles with a 2pt gap. */}
      <View style={styles.transport}>
        {icon('repeat',`循环：${preferences.repeat}`,()=>{void services.preferences.update({repeat:preferences.repeat==='off'?'all':preferences.repeat==='all'?'one':'off'}).catch(()=>Alert.alert('设置未保存'));})}
        <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={()=>services.playback.next(-1)} style={[styles.hit,{width:space.section}]}><SkipGlyph direction="back" width={9.5} height={12.7} gap={2} color={paper.skipInk}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={playing?'暂停':'播放'} onPress={()=>{if(playing)controller.pause();else void controller.play();}} style={styles.play}>
          {playing?<View style={{flexDirection:'row',gap:2.7}}><View style={{width:4.7,height:16,borderRadius:1,backgroundColor:'#FFFFFF'}}/><View style={{width:4.7,height:16,borderRadius:1,backgroundColor:'#FFFFFF'}}/></View>:<Ionicons name="play" size={26} color="#FFFFFF" style={{marginLeft:3}}/>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={()=>services.playback.next()} style={[styles.hit,{width:space.section}]}><SkipGlyph direction="forward" width={9.5} height={12.7} gap={2} color={paper.skipInk}/></Pressable>
        {icon('list','播放队列',()=>{onQueue();},24)}
      </View>
      <View style={styles.tools}>
        <Pressable accessibilityRole="button" accessibilityLabel="歌词与来源" onPress={()=>setLyricsOpen(true)} style={[styles.hit,{width:space.section}]}>
          {/* Reference bubble pair is mirrored against Ionicons: big bubble left. */}
          <Ionicons name="chatbubbles-outline" size={22} color={paper.vinylIcon} style={{transform:[{scaleX:-1},{scaleY:.84}]}}/>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="调整播放界面" onPress={onStyle} style={[styles.hit,{width:space.section}]}>
          {/* Chromecast glyph: open frame, solid screen, wifi fan from lower-left. */}
          <View style={{width:20.5,height:16.5}}>
            <View style={{position:'absolute',left:0,top:0,right:0,bottom:0,borderWidth:2,borderColor:paper.vinylIcon,borderRadius:3.5}}/>
            <View style={{position:'absolute',left:6.2,top:4.1,width:10.3,height:7.2,backgroundColor:paper.vinylIcon,borderRadius:1,transform:[{skewX:'-18deg'}]}}/>
            <Ionicons name="wifi" size={12.5} color={paper.vinylIcon} style={{position:'absolute',left:-1.8,top:3.4,transform:[{rotate:'-45deg'}]}}/>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="睡眠定时" onPress={onSleep} style={[styles.hit,{width:space.section}]}>
          <View style={styles.moon}>
            <Ionicons name="moon-outline" size={18} color={paper.vinylIcon} style={{position:'absolute',left:0,bottom:0,transform:[{rotate:'-15deg'}]}}/>
            <Text style={[styles.z,{left:11,top:0,fontSize:7.5,lineHeight:8}]}>z</Text>
            <Text style={[styles.z,{left:14,top:7,fontSize:6.5,lineHeight:7}]}>z</Text>
            <Text style={[styles.z,{left:10,top:13.5,fontSize:5.5,lineHeight:6}]}>z</Text>
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
  titleRow:{flexDirection:'row',alignItems:'center',gap:space.sm,marginTop:26.33},
  title:{...typography.title,fontSize:24,lineHeight:30,color:paper.titleInk},
  artist:{...typography.body,fontSize:16,lineHeight:22,color:paper.artistInk},
  status:{...typography.micro,color:paper.secondary,marginBottom:space.sm},
  progress:{marginHorizontal:11},
  transport:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:23.7,marginHorizontal:15},
  play:{width:64,height:64,borderRadius:32,backgroundColor:paper.text,alignItems:'center',justifyContent:'center'},
  tools:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:13.7,marginHorizontal:10},
  moon:{width:19,height:22},
  z:{position:'absolute',fontWeight:'800',color:paper.vinylIcon},
  aa:{flexDirection:'row',alignItems:'baseline',gap:1.5,marginTop:1.3},
  aaSmall:{fontSize:12.5,lineHeight:20,fontWeight:'300',color:paper.toolMuted},
  aaLarge:{fontSize:18.2,lineHeight:20,fontWeight:'300',color:paper.toolMuted},
  queue:{gap:3.5},
  queueLine:{height:1.5,borderRadius:0.75,backgroundColor:paper.vinylIcon},
  caption:{...typography.micro,color:paper.captionInk,textAlign:'center',marginTop:13.7},
});
