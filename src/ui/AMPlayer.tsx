import {useState,useSyncExternalStore,type ReactNode} from 'react';
import {Pressable,ScrollView,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {Cover} from './Cover.tsx';
import {Lyrics} from './Lyrics.tsx';
import {QueuePanel} from './QueueView.tsx';
import {Text} from './Typography.tsx';

type Content='cover'|'lyrics'|'queue';
export function AMPlayer({services,track,favoriteTrack,lyricTrack,font,controls,onMore,onStyle}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;controls:ReactNode;onMore:()=>void;onStyle:()=>void}){
  const {width,height,fontScale}=useWindowDimensions(),columns=width>height&&width>=600&&fontScale<1.8;
  const [content,setContent]=useState<Content>('cover'),[bounds,setBounds]=useState({width:1,height:1});
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const favorite=services.library.isFavorite(favoriteTrack),side=Math.max(1,Math.min(bounds.width,bounds.height,560));
  const [error,setError]=useState('');
  const select=(next:Content)=>setContent(previous=>previous===next?'cover':next);
  // IMG_4861/4866 keep the tool row as four plain outline glyphs; the active
  // content is conveyed by the panel itself rather than a filled pill.
  const tool=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,id?:string,selected?:boolean)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={action} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={25} color={selected?'#FFFFFF':'rgba(255,255,255,0.72)'}/></Pressable>;
  const info=<View testID="am-song-info" style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:64}}>
    {content!=='cover'&&<Pressable accessibilityRole="button" accessibilityLabel="返回封面" testID="am-return-cover" onPress={()=>setContent('cover')}><Cover services={services} track={track} size={52}/></Pressable>}
    <View style={{flex:1,minWidth:0,gap:5}}><Text numberOfLines={1} style={{color:'#FFFFFF',fontSize:22,fontWeight:'700'}}>{track.title}</Text><Text numberOfLines={1} style={{color:'#D5D5DA',fontSize:15}}>{track.artist}{track.album?` · ${track.album}`:''}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="收藏歌曲" accessibilityValue={{text:favorite?'已收藏':'未收藏'}} onPress={()=>{void services.library.favorite(favoriteTrack).then(()=>setError('')).catch(()=>setError('收藏未保存，已有数据保留。'));}} style={{minWidth:44,minHeight:48,alignItems:'center',justifyContent:'center'}}><Ionicons name={favorite?'heart':'heart-outline'} size={24} color="#FFFFFF"/></Pressable>
    {tool('ellipsis-horizontal','更多播放控制',onMore)}
  </View>;
  return <View testID="am-player" style={{flex:1,minHeight:0,gap:8}}>
    {content!=='cover'&&!columns&&info}
    <View testID={columns?'am-horizontal':'am-vertical'} style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:12}}>
    <View testID="am-body" collapsable={false} onLayout={event=>{const {width,height}=event.nativeEvent.layout;setBounds(previous=>previous.width===width&&previous.height===height?previous:{width,height});}} style={{flex:1,minHeight:0,overflow:'hidden'}}>
      {content==='cover'?<View testID="am-cover-panel" style={{flex:1,alignItems:'center',justifyContent:'center'}}><View testID="am-artwork-square" collapsable={false} style={{width:side,height:side}}><Cover services={services} track={track} size={side}/></View></View>:content==='lyrics'?<View testID="am-lyrics-panel" style={{flex:1}}><Lyrics services={services} track={lyricTrack} font={font} presentation="am"/></View>:<View testID="am-queue-panel" style={{flex:1}}><QueuePanel services={services} tone="dark"/></View>}
    </View>
    <ScrollView testID="am-controls" style={{flexGrow:0,flexShrink:0,maxHeight:columns?'100%':'48%',width:columns?Math.min(360,width*.42):undefined}} contentContainerStyle={{gap:6}}>
      {(columns||content==='cover')&&info}{!!error&&<Text accessibilityRole="alert" style={{color:'#FFD7BA'}}>{error}</Text>}{controls}
    </ScrollView>
    </View>
    <View testID="am-tools" style={{flexDirection:'row',justifyContent:'space-around'}}>
      {tool('text-outline','歌词',()=>select('lyrics'),'am-content-lyrics',content==='lyrics')}
      {tool('list','播放队列',()=>select('queue'),'am-content-queue',content==='queue')}
      {tool('options-outline','调整播放界面',onStyle)}
    </View>
  </View>;
}
