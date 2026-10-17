import {useEffect,useMemo,useState,useSyncExternalStore,type ReactNode} from 'react';
import {AppState,Pressable,ScrollView,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {AM2Presentation,am2Columns,type AM2Content} from '../domain/am2.ts';
import {Cover} from './Cover.tsx';
import {Lyrics} from './Lyrics.tsx';
import {QueuePanel} from './QueueView.tsx';
import {CommentsModal} from './CommentsModal.tsx';
import {GainSlider} from './EqualizerGraph.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
export function AM2Player({services,track,favoriteTrack,lyricTrack,font,identity,visible,controls,onMore}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;identity:string;visible:boolean;controls:ReactNode;onMore:()=>void}){
  const theme=useTheme();
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const model=useMemo(()=>new AM2Presentation(),[]),view=useSyncExternalStore(model.subscribe,model.getSnapshot);
  const [foreground,setForeground]=useState(AppState.currentState==='active'),[error,setError]=useState(''),[settings,setSettings]=useState(false);
  const {width,height,fontScale}=useWindowDimensions(),columns=am2Columns(width-120,height-120,fontScale);
  useEffect(()=>{const subscription=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>subscription.remove();},[]);
  useEffect(()=>{model.configure({identity,active:visible&&foreground&&!settings,automatic:preferences.am2AutoLyrics,delaySeconds:preferences.am2DelaySeconds});},[model,identity,visible,foreground,settings,preferences.am2AutoLyrics,preferences.am2DelaySeconds]);
  useEffect(()=>()=>model.dispose(),[model]);
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{void services.preferences.update(patch).then(()=>setError('')).catch(()=>setError('设置未保存，之前的设置保留。'));};
  const favorite=services.library.isFavorite(favoriteTrack);
  const button=(title:string,action:()=>void,id?:string)=><Pressable testID={id} accessibilityRole="button" onPress={action} style={{minHeight:44,paddingHorizontal:12,justifyContent:'center'}}><Text style={{color:'#FFFFFF'}}>{title}</Text></Pressable>;
  const tabs=(['lyrics','comments','queue'] as const).map((content:AM2Content)=>{
    const selected=view.content===content,label={cover:'封面',lyrics:'歌词',comments:'评论',queue:'队列'}[content];
    return <Pressable key={content} testID={`am2-content-${content}`} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={()=>model.select(content)} style={{minWidth:60,minHeight:44,justifyContent:'center',alignItems:'center',borderRadius:14,backgroundColor:selected?'rgba(255,255,255,.2)':'transparent'}}><Text style={{color:'#FFFFFF',fontWeight:selected?'700':'400'}}>{label}</Text></Pressable>;
  });
  const content=view.content==='queue'?<QueuePanel services={services}/>:view.content==='comments'?<CommentsModal services={services} track={favoriteTrack} embedded onClose={()=>model.select('cover')}/>:view.content==='lyrics'?<Lyrics services={services} track={lyricTrack} font={font} presentation="am2"/>:null;
  const artwork=<Cover services={services} track={track} size={Math.min(columns?(width-96)*.42:width-64,height*.3,340)}/>;
  const transport=<View style={{gap:6}}>{controls}{preferences.am2ShowVolume&&<View style={{backgroundColor:theme.palette.surface,borderRadius:12,padding:10}}><GainSlider testID="am2-volume" label="App 音量" value={preferences.volume*24-12} format={value=>`${Math.round((value+12)/24*100)}%`} onChange={value=>update({volume:(value+12)/24})}/></View>}</View>;
  return <View testID={columns?'am2-horizontal':'am2-vertical'} style={{flex:1,gap:10}} onTouchStart={()=>model.setTouching(true)} onTouchEnd={event=>model.setTouching(event.nativeEvent.touches.length>0)} onTouchCancel={()=>model.setTouching(false)}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      {view.content!=='cover'&&<Cover services={services} track={track} size={48}/>}
      <View style={{flex:1}}><Text numberOfLines={1} style={{fontSize:22,fontWeight:'700',color:'#FFFFFF'}}>{track.title}</Text><Text numberOfLines={1} style={{fontSize:13,color:'#D5D5DA'}}>{track.artist}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="收藏歌曲" accessibilityValue={{text:favorite?'已收藏':'未收藏'}} onPress={()=>{void services.library.favorite(favoriteTrack).catch(()=>setError('收藏未保存，之前的数据保留。'));}} style={{minHeight:48,minWidth:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={favorite?'heart':'heart-outline'} color="#FFFFFF" size={24}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="更多播放控制" onPress={onMore} style={{minHeight:48,minWidth:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="ellipsis-horizontal" color="#FFFFFF" size={24}/></Pressable>
    </View>
    <ScrollView horizontal style={{flexGrow:0,flexShrink:0}} contentContainerStyle={{alignItems:'center'}}>{tabs}{view.content!=='cover'&&button('返回封面',()=>model.select('cover'),'am2-return-cover')}{button(settings?'收起 AM2 设置':'AM2 设置',()=>setSettings(!settings),'am2-settings')}{!settings&&view.content==='lyrics'&&button(view.fullscreen?'还原歌词区域':'展开歌词区域',()=>model.toggleFullscreen(),'am2-expand-lyrics')}</ScrollView>
    {settings?<ScrollView style={{flex:1}} contentContainerStyle={{gap:12}}>
      {button(`自动展开歌词：${preferences.am2AutoLyrics?'开':'关'}`,()=>update({am2AutoLyrics:!preferences.am2AutoLyrics}),'am2-auto')}
      <Text style={{color:'#D5D5DA'}}>在歌词页停止操作后，展开歌词区域。</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center'}}>{button('缩短等待',()=>update({am2DelaySeconds:Math.max(1,preferences.am2DelaySeconds-1)}),'am2-delay-minus')}<Text testID="am2-delay" style={{color:'#FFFFFF'}}>等待 {preferences.am2DelaySeconds} 秒</Text>{button('延长等待',()=>update({am2DelaySeconds:Math.min(60,preferences.am2DelaySeconds+1)}),'am2-delay-plus')}</View>
      {button(`音量控件：${preferences.am2ShowVolume?'显示':'隐藏'}`,()=>update({am2ShowVolume:!preferences.am2ShowVolume}),'am2-show-volume')}
    </ScrollView>:<View style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:16}}>
      {columns?<ScrollView style={{flex:.85}} contentContainerStyle={{gap:12}}>{transport}{!view.fullscreen&&<View style={{alignItems:'center'}}>{artwork}</View>}</ScrollView>:view.content==='cover'?<View style={{flex:1,alignItems:'center',justifyContent:'center'}}>{artwork}</View>:view.content==='lyrics'&&!view.fullscreen&&fontScale<1.8?<View style={{alignItems:'center'}}><Cover services={services} track={track} size={80}/></View>:null}
      {view.content!=='cover'&&<View testID="am2-content-panel" style={{flex:1,minHeight:0,overflow:'hidden',borderRadius:16}}>{content}</View>}
    </View>}
    {!!error&&<Text accessibilityRole="alert" style={{color:'#FFD7BA'}}>{error}</Text>}
    {(!columns||settings)&&<ScrollView style={{flexGrow:0,flexShrink:0,maxHeight:height*.38}}>{transport}</ScrollView>}
  </View>;
}
