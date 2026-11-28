import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Pressable,View,useWindowDimensions} from 'react-native';
import {Ionicons,MaterialCommunityIcons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import type {TrackArtistRef} from '../domain/artistNames.ts';
import {ClickableArtistLine} from './ClickableArtistLine.tsx';
import {Cover} from './Cover.tsx';
import {Lyrics} from './Lyrics.tsx';
import {QueuePanel} from './QueueView.tsx';
import {CommentsModal} from './CommentsModal.tsx';
import {Text} from './Typography.tsx';

type Content='cover'|'lyrics'|'comments'|'queue';
export function AMPlayer({services,track,favoriteTrack,lyricTrack,font,controls,onMore,onStyle,onComments,onArtistPress,onChromeHiddenChange}:{services:Services;track:Track;favoriteTrack:Track;lyricTrack:Track;font?:string;controls:ReactNode;onMore:()=>void;onStyle:()=>void;onComments?:()=>void;onArtistPress?:(artist:TrackArtistRef)=>void;onChromeHiddenChange?:(hidden:boolean)=>void}){
  const {width,height,fontScale}=useWindowDimensions(),columns=width>height&&width>=600&&fontScale<1.8;
  const [content,setContent]=useState<Content>('cover');
  const swipeStart=useRef<{x:number;y:number}|null>(null);
  const didSwipe=useRef(false);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
  useEffect(()=>{onChromeHiddenChange?.(!columns&&content!=='cover');return()=>{onChromeHiddenChange?.(false);};},[columns,content,onChromeHiddenChange]);
  const favorite=services.songFavorites.isFavorite(favoriteTrack);
  // IMG_4866: 382pt square artwork (24pt side margins) starting 110pt down,
  // then a 60pt gap before the 20pt title block.
  const side=Math.max(1,Math.min(columns?width*.42:width-48,430,height*(columns?.62:fontScale>1.4?.26:.41)));
  const [error,setError]=useState('');
  const select=(next:Content)=>setContent(previous=>previous===next?'cover':next);
  // IMG_4861 tool row: filled subtitles card, mirrored chat bubble, style options
  // and playlist-note at 55% white; measured pitch is 85.33pt.
  const tool=(glyph:(color:string)=>ReactNode,label:string,action:()=>void,id?:string,selected?:boolean)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={action} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}>{glyph(selected?'#FFFFFF':'rgba(255,255,255,0.55)')}</Pressable>;
  // IMG_4866 keeps the cover actions as 30pt quiet discs beside the title block; bodyInfo uses 34pt discs with hitSlop for 44pt target.
  const circle=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,value?:string,size=30)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={value?{text:value}:undefined} hitSlop={size<44?Math.ceil((44-size)/2):0} onPress={action} style={{width:size,height:size,borderRadius:size/2,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.12)'}}><Ionicons name={name} size={size<=30?18:20} color="#FFFFFF"/></Pressable>;
  const albumSuffix=track.album?` — ${track.album}`:undefined;
  const coverInfo=<View testID="am-song-info" style={{flexDirection:'row',alignItems:'center',gap:6,minHeight:56,marginTop:fontScale>1.4?20:32}}>
    <View style={{flex:1,minWidth:0,gap:5}}>
      <Text numberOfLines={1} style={{color:'#FFFFFF',fontSize:20,fontWeight:'600'}}>{track.title}</Text>
      <ClickableArtistLine track={track} onArtistPress={onArtistPress} suffix={albumSuffix} textStyle={{color:'rgba(255,255,255,0.66)',fontSize:17}}/>
    </View>
    {/* IMG_4866 heart/dots ink centre stays at 583pt while the text block
        sits 2pt higher, so the icon pair keeps the old offset. */}
    <View style={{flexDirection:'row',gap:6,marginTop:2}}>
      {circle(favorite?'heart':'heart-outline','收藏歌曲',()=>{void services.songFavorites.toggle(favoriteTrack).then(()=>setError('')).catch(()=>setError('收藏未保存，已有数据保留。'));},favorite?'已收藏':'未收藏')}
      {circle('ellipsis-horizontal','更多播放控制',onMore)}
    </View>
  </View>;
  const bodyInfo=<View testID="am-song-info" style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:50,marginTop:0}}>
    <Pressable accessibilityRole="button" accessibilityLabel="返回封面" testID="am-return-cover" onPress={()=>setContent('cover')} style={{borderRadius:10,overflow:'hidden'}}><Cover services={services} track={track} size={46} radius={10}/></Pressable>
    <View style={{flex:1,minWidth:0,gap:3}}>
      <Text numberOfLines={1} style={{color:'#FFFFFF',fontSize:16,fontWeight:'600'}}>{track.title}</Text>
      <ClickableArtistLine track={track} onArtistPress={onArtistPress} suffix={albumSuffix} textStyle={{color:'rgba(255,255,255,0.66)',fontSize:14}}/>
    </View>
    <View style={{flexDirection:'row',gap:10}}>
      {circle(favorite?'heart':'heart-outline','收藏歌曲',()=>{void services.songFavorites.toggle(favoriteTrack).then(()=>setError('')).catch(()=>setError('收藏未保存，已有数据保留。'));},favorite?'已收藏':'未收藏',34)}
      {circle('ellipsis-horizontal','更多播放控制',onMore,undefined,34)}
    </View>
  </View>;
  // IMG_4861 puts the transport 15pt higher above the tool row than the cover
  // body does; the tool row itself stays anchored to the bottom margin.
  const tools=<View testID="am-tools" style={{flexDirection:'row',justifyContent:'space-around',paddingTop:6,paddingHorizontal:20.3,marginBottom:39,marginTop:content==='cover'?28:45.1}}>
    {tool(color=><MaterialCommunityIcons name="subtitles" size={21} color={color}/>,'歌词',()=>select('lyrics'),'am-content-lyrics',content==='lyrics')}
    {tool(color=><View style={{transform:[{scaleX:-1}]}}><Ionicons name={content==='comments'?'chatbox':'chatbox-outline'} size={23} color={color}/></View>,'评论',()=>select('comments'),'am-content-comments',content==='comments')}
    {tool(color=><Ionicons name="options-outline" size={24} color={color}/>,'调整播放界面',onStyle)}
    {tool(color=><MaterialCommunityIcons name="playlist-music" size={22} color={color}/>,'播放队列',()=>select('queue'),'am-content-queue',content==='queue')}
  </View>;
  return <View testID="am-player" style={{flex:1,minHeight:0}}>
    {content==='cover'?<View style={{flex:1,minHeight:0,gap:0}}>
      <View testID={columns?'am-horizontal':'am-vertical'} style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:12}}>
        <Pressable testID="am-body" collapsable={false}
          accessibilityRole="button" accessibilityLabel="点击封面切换全屏歌词"
          onTouchStart={e=>{didSwipe.current=false;swipeStart.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY};}}
          onTouchEnd={e=>{const s=swipeStart.current;swipeStart.current=null;if(!s)return;const dx=e.nativeEvent.pageX-s.x,dy=e.nativeEvent.pageY-s.y;if(Math.abs(dx)>56&&Math.abs(dx)>Math.abs(dy)*1.4){didSwipe.current=true;services.playback.next(dx<0?1:-1);}}}
          onPress={()=>{if(!didSwipe.current)setContent('lyrics');}}
          style={{width:'100%',height:side,alignItems:'center',marginTop:columns?0:fontScale>1.4?16:72,overflow:'hidden'}}>
          <View testID="am-artwork-square" collapsable={false} style={{width:side,height:side,borderRadius:Math.min(18,preferences.coverRadius),overflow:'hidden'}}><Cover services={services} track={track} size={side} radius={Math.min(18,preferences.coverRadius)}/></View>
        </Pressable>
        <View testID="am-controls" style={{flexShrink:0,width:columns?Math.min(360,width*.42):undefined}}>
          {coverInfo}
          {!!error&&<Text accessibilityRole="alert" style={{color:'#FFD7BA'}}>{error}</Text>}
          <View style={{marginTop:fontScale>1.4?4:5}}>{controls}</View>
        </View>
      </View>
      {tools}
    </View>:<View style={{flex:1,minHeight:0}}>
      <View testID={columns?'am-horizontal':'am-vertical'} style={{flex:1,minHeight:0,flexDirection:columns?'row':'column',gap:12}}>
        <View style={{flex:1,minHeight:0,gap:8}}>
          {bodyInfo}
          <View testID="am-body" collapsable={false} style={{flex:1,minHeight:0,overflow:'hidden',marginHorizontal:content==='queue'?-4:0}}>
            {content==='lyrics'?<View testID="am-lyrics-panel" style={{flex:1}}><Lyrics services={services} track={lyricTrack} font={font} presentation="am" chrome={columns}/></View>:content==='comments'?<View testID="am-comments-panel" style={{flex:1}}><CommentsModal services={services} track={favoriteTrack} embedded tone="dark" onClose={()=>setContent('cover')}/></View>:<View testID="am-queue-panel" style={{flex:1}}><QueuePanel services={services} tone="dark"/></View>}
          </View>
        </View>
        <View testID="am-controls" style={{flexShrink:0,width:columns?Math.min(360,width*.42):undefined}}>
          {!!error&&<Text accessibilityRole="alert" style={{color:'#FFD7BA'}}>{error}</Text>}
          {controls}
        </View>
      </View>
      {tools}
    </View>}
  </View>;
}
