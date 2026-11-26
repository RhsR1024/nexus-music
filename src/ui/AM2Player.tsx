import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {AppState,Pressable,ScrollView,View,type GestureResponderEvent,useWindowDimensions} from 'react-native';
import {Ionicons,MaterialCommunityIcons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {AM2Presentation,am2Columns,type AM2Content} from '../domain/am2.ts';
import {Cover} from './Cover.tsx';
import {PlayerCover} from './TapeCover.tsx';
import {Lyrics} from './Lyrics.tsx';
import {QueuePanel} from './QueueView.tsx';
import {CommentsModal} from './CommentsModal.tsx';
import {Text} from './Typography.tsx';

function AM2VolumeBar({value,onChange}:{value:number;onChange:(next:number)=>void}){
  const width=useRef(1),[preview,setPreview]=useState<number|null>(null),pending=useRef<number|null>(null);
  const shown=preview??value;
  const move=(event:GestureResponderEvent)=>{
    const next=Math.round(Math.max(0,Math.min(1,event.nativeEvent.locationX/Math.max(1,width.current)))*100)/100;
    pending.current=next;setPreview(next);
  };
  return <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:2}}>
    <Ionicons name="volume-low" size={16} color="rgba(255,255,255,0.58)"/>
    <View testID="am2-volume" accessible accessibilityRole="adjustable" accessibilityLabel="App 音量" accessibilityValue={{min:0,max:100,now:Math.round(shown*100),text:`${Math.round(shown*100)}%`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>onChange(Math.max(0,Math.min(1,value+(event.nativeEvent.actionName==='increment'?.05:-.05))))}
      onLayout={event=>{width.current=Math.max(1,event.nativeEvent.layout.width);}} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true}
      onResponderGrant={move} onResponderMove={move} onResponderTerminationRequest={()=>false}
      onResponderRelease={event=>{move(event);if(pending.current!==null)onChange(pending.current);pending.current=null;setPreview(null);}}
      onResponderTerminate={()=>{pending.current=null;setPreview(null);}} style={{flex:1,height:32,justifyContent:'center'}}>
      <View pointerEvents="none" style={{height:5,borderRadius:2.5,backgroundColor:'rgba(255,255,255,0.22)',overflow:'hidden'}}>
        <View style={{width:`${shown*100}%`,height:5,borderRadius:2.5,backgroundColor:'#FFFFFF'}}/>
      </View>
      <View pointerEvents="none" style={{position:'absolute',left:`${shown*100}%`,marginLeft:-5.5,width:11,height:11,borderRadius:5.5,backgroundColor:'#FFFFFF'}}/>
    </View>
    <Ionicons name="volume-high" size={18} color="rgba(255,255,255,0.58)"/>
    <Text testID="am2-volume-value" style={{color:'rgba(255,255,255,0.62)',fontSize:11,fontVariant:['tabular-nums'],minWidth:32,textAlign:'right'}}>{Math.round(shown*100)}%</Text>
  </View>;
}

export function AM2Player({services,track,favoriteTrack,lyricTrack,font,identity,visible,controls,onMore,onStyle,onLyricSource,onArtistPress}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;identity:string;visible:boolean;controls:ReactNode;onMore:()=>void;onStyle?:()=>void;onLyricSource?:()=>void;onArtistPress?:(artist:string)=>void}){
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
  const model=useMemo(()=>new AM2Presentation(),[]),view=useSyncExternalStore(model.subscribe,model.getSnapshot);
  const [foreground,setForeground]=useState(AppState.currentState==='active'),[error,setError]=useState(''),[settings,setSettings]=useState(false);
  const {width,height,fontScale}=useWindowDimensions(),columns=am2Columns(width-120,height-120,fontScale);
  const swipeStart=useRef<{x:number;y:number}|null>(null);
  useEffect(()=>{const subscription=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>subscription.remove();},[]);
  useEffect(()=>{model.configure({identity,active:visible&&foreground&&!settings,automatic:preferences.am2AutoLyrics,delaySeconds:preferences.am2DelaySeconds});},[model,identity,visible,foreground,settings,preferences.am2AutoLyrics,preferences.am2DelaySeconds]);
  useEffect(()=>()=>model.dispose(),[model]);
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{void services.preferences.update(patch).then(()=>setError('')).catch(()=>setError('设置未保存，之前的设置保留。'));};
  const favorite=services.songFavorites.isFavorite(favoriteTrack);
  const button=(title:string,action:()=>void,id?:string)=><Pressable testID={id} accessibilityRole="button" onPress={action} style={{minHeight:42,paddingHorizontal:12,borderRadius:12,backgroundColor:'rgba(255,255,255,0.12)',justifyContent:'center'}}><Text style={{color:'#FFFFFF',fontSize:14}}>{title}</Text></Pressable>;
  const circle=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,value?:string)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value?{text:value}:undefined} onPress={action} style={{width:34,height:34,borderRadius:17,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center',justifyContent:'center'}}><Ionicons name={name} color="#FFFFFF" size={19}/></Pressable>;
  const content=view.content==='queue'?<QueuePanel services={services} tone="dark"/>:view.content==='comments'?<CommentsModal services={services} track={favoriteTrack} embedded tone="dark" onClose={()=>model.select('cover')}/>:view.content==='lyrics'?<Lyrics services={services} track={lyricTrack} font={font} presentation="am2" chrome={columns}/>:null;
  const coverSide=Math.max(100,Math.min(columns?Math.min((width-96)*.34,126):width-48,height*(columns?.31:fontScale>1.4?.28:.42),382));
  const artwork=<Pressable onTouchStart={e=>{swipeStart.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY};}} onTouchEnd={e=>{const s=swipeStart.current;swipeStart.current=null;if(!s)return;const dx=e.nativeEvent.pageX-s.x,dy=e.nativeEvent.pageY-s.y;if(Math.abs(dx)>56&&Math.abs(dx)>Math.abs(dy)*1.4)services.playback.next(dx<0?1:-1);}} onPress={()=>model.select('lyrics')} style={{borderRadius:14,overflow:'hidden',shadowColor:'#000000',shadowOpacity:0.35,shadowRadius:22,shadowOffset:{width:0,height:12}}}>
    <PlayerCover services={services} track={track} size={coverSide}/>
  </Pressable>;
  const transport=<View style={{gap:columns?4:10}}>{controls}{preferences.am2ShowVolume&&<AM2VolumeBar value={preferences.volume} onChange={volume=>update({volume})}/>}</View>;
  const coverMeta=<View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:columns?2:fontScale>1.4?10:18}}>
    <View style={{flex:1,minWidth:0,gap:columns?1:3}}>
      <Text numberOfLines={1} style={{fontSize:columns?17:23,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.2}}>{track.title}</Text>
      <Pressable disabled={!onArtistPress} onPress={()=>onArtistPress?.(track.artist)} style={{alignSelf:'flex-start'}}><Text numberOfLines={1} style={{fontSize:columns?13:16,color:'rgba(255,255,255,0.68)'}}>{track.artist}{track.album?` — ${track.album}`:''}</Text></Pressable>
    </View>
    {circle(favorite?'heart':'heart-outline','收藏歌曲',()=>{void services.songFavorites.toggle(favoriteTrack).catch(()=>setError('收藏未保存，之前的数据保留。'));},favorite?'已收藏':'未收藏')}
    {circle('ellipsis-horizontal','更多播放控制',onMore)}
  </View>;
  const compactHeader=<View style={{flexDirection:'row',alignItems:'center',gap:12,paddingLeft:2,marginTop:54}}>
    <Pressable testID="am2-return-cover" accessibilityRole="button" accessibilityLabel="返回封面" onPress={()=>model.select('cover')} style={{borderRadius:10,overflow:'hidden'}}><Cover services={services} track={track} size={52} radius={10}/></Pressable>
    <View style={{flex:1,minWidth:0,gap:2}}>
      <Text numberOfLines={1} style={{fontSize:17,fontWeight:'700',color:'#FFFFFF'}}>{track.title}</Text>
      <Pressable disabled={!onArtistPress} onPress={()=>onArtistPress?.(track.artist)} style={{alignSelf:'flex-start'}}><Text numberOfLines={1} style={{fontSize:13,color:'rgba(255,255,255,0.66)'}}>{track.artist}</Text></Pressable>
    </View>
    {!settings&&view.content==='lyrics'&&<Pressable testID="am2-expand-lyrics" accessibilityRole="button" accessibilityLabel={view.fullscreen?'还原歌词区域':'展开歌词区域'} onPress={()=>model.toggleFullscreen()} style={{paddingHorizontal:10,minHeight:34,borderRadius:17,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#FFFFFF',fontSize:12,fontWeight:'600'}}>{view.fullscreen?'还原歌词区域':'展开歌词区域'}</Text></Pressable>}
    {circle(favorite?'heart':'heart-outline','收藏歌曲',()=>{void services.songFavorites.toggle(favoriteTrack).catch(()=>setError('收藏未保存，之前的数据保留。'));},favorite?'已收藏':'未收藏')}
    {circle('ellipsis-horizontal','更多播放控制',onMore)}
  </View>;
  const tool=(glyph:(color:string)=>ReactNode,label:string,action:()=>void,id:string,selected:boolean)=>(
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={action} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}>{glyph(selected?'#FFFFFF':'rgba(255,255,255,0.55)')}</Pressable>
  );
  const bottomTools=<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingTop:4,marginBottom:8}}>
    {tool(color=><MaterialCommunityIcons name="subtitles" size={21} color={color}/>,'歌词',()=>{setSettings(false);model.select('lyrics');},'am2-content-lyrics',!settings&&view.content==='lyrics')}
    {tool(color=><View style={{transform:[{scaleX:-1}]}}><Ionicons name={view.content==='comments'&&!settings?'chatbox':'chatbox-outline'} size={22} color={color}/></View>,'评论',()=>{setSettings(false);model.select('comments');},'am2-content-comments',!settings&&view.content==='comments')}
    {tool(color=><Ionicons name="options-outline" size={23} color={color}/>,settings?'收起 AM2 设置':'AM2 设置',()=>setSettings(v=>!v),'am2-settings',settings)}
    {tool(color=><MaterialCommunityIcons name="playlist-music" size={22} color={color}/>,'队列',()=>{setSettings(false);model.select('queue');},'am2-content-queue',!settings&&view.content==='queue')}
  </View>;
  return <View testID={columns?'am2-horizontal':'am2-vertical'} style={{flex:1,gap:columns?4:10}} onTouchStart={()=>model.setTouching(true)} onTouchEnd={event=>model.setTouching(event.nativeEvent.touches.length>0)} onTouchCancel={()=>model.setTouching(false)}>
    {!columns&&(view.content!=='cover'||settings)&&compactHeader}
    {settings?<ScrollView style={{flex:1}} contentContainerStyle={{gap:12,paddingVertical:8}}>
      {button(`自动展开歌词：${preferences.am2AutoLyrics?'开':'关'}`,()=>update({am2AutoLyrics:!preferences.am2AutoLyrics}),'am2-auto')}
      <Text style={{color:'rgba(255,255,255,0.68)',fontSize:13}}>在歌词页停止操作后，自动展开歌词区域。</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8}}>{button('缩短等待',()=>update({am2DelaySeconds:Math.max(1,preferences.am2DelaySeconds-1)}),'am2-delay-minus')}<Text testID="am2-delay" style={{color:'#FFFFFF',fontSize:15,fontWeight:'600',paddingHorizontal:6}}>等待 {preferences.am2DelaySeconds} 秒</Text>{button('延长等待',()=>update({am2DelaySeconds:Math.min(60,preferences.am2DelaySeconds+1)}),'am2-delay-plus')}</View>
      {button(`音量控件：${preferences.am2ShowVolume?'显示':'隐藏'}`,()=>update({am2ShowVolume:!preferences.am2ShowVolume}),'am2-show-volume')}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {onLyricSource&&button('选择歌词来源',onLyricSource)}
        {onStyle&&button('调整播放界面',onStyle)}
      </View>
    </ScrollView>:<View style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:columns?18:0}}>
      {columns?<ScrollView style={{flex:.85}} contentContainerStyle={{gap:6}}>{!view.fullscreen&&<View style={{alignItems:'center'}}>{artwork}</View>}{coverMeta}{transport}</ScrollView>:view.content==='cover'?<View style={{flex:1,justifyContent:'space-between',paddingTop:fontScale>1.4?8:28}}>
        <View style={{alignItems:'center'}}>{artwork}</View>
        {coverMeta}
      </View>:null}
      {view.content!=='cover'&&<View testID="am2-content-panel" style={{flex:1,minHeight:0,overflow:'hidden',borderRadius:16}}>{content}</View>}
    </View>}
    {!!error&&<Text accessibilityRole="alert" style={{color:'#FFD7BA'}}>{error}</Text>}
    {(!columns||settings)&&<View style={{flexShrink:0}}>{transport}</View>}
    {bottomTools}
  </View>;
}
