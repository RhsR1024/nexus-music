import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Linking,Pressable,View,type ViewProps} from 'react-native';
import {requireNativeView} from 'expo';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import type {OnlinePlatform} from '../domain/track.ts';
import type {VideoItem} from '../providers/videos.ts';
import {PublicMVPageUnavailableError} from '../providers/videos.ts';
import {Modal,usePresentationVisible} from './AdaptiveModal.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,space,radius,typography} from './tokens.ts';

type Phase='loading'|'ready'|'error'|'blocked';
const NativePage=requireNativeView<ViewProps&{source:string;active:boolean;onState:(event:{nativeEvent:{phase?:Phase;notice?:string}})=>void}>('NexusNative','PublicMV');
const names={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'};
export function videoDuration(seconds?:number){if(seconds===undefined)return'';const n=Math.floor(seconds);return`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
function Page({services,platform,video}:{services:Services;platform:OnlinePlatform;video:VideoItem}){
 const theme=useTheme(),visible=usePresentationVisible(),playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
 const [url,setURL]=useState<string>(),[phase,setPhase]=useState<Phase>('loading'),[unavailable,setUnavailable]=useState(''),[notice,setNotice]=useState(''),alive=useRef(true);
 useEffect(()=>{const pending=new AbortController();alive.current=true;void services.videos.publicPage(platform,video,pending.signal).then(value=>{if(!pending.signal.aborted)setURL(value);}).catch(error=>{if(!pending.signal.aborted){if(error instanceof PublicMVPageUnavailableError)setUnavailable(error.message);setPhase('error');}});return()=>{alive.current=false;pending.abort();};},[services,platform,video]);
 const message=unavailable|| (phase==='loading'?'正在加载MV页面…':phase==='ready'?'页面已载入':phase==='blocked'?'此跳转无法在应用内打开':'此平台MV页面暂时无法读取，请刷新或在浏览器打开');
 return <View style={{flex:1,gap:space.sm}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:space.sm}}>{phase==='loading'&&<ActivityIndicator color={theme.palette.accent}/>}<Text testID="mv-page-status" accessibilityLiveRegion="polite" style={{flex:1,color:theme.palette.secondary}}>{message}</Text></View>
  {!!notice&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.secondary}}>{notice}</Text>}
  {url&&playback.intent==='playing'&&<Pressable accessibilityRole="button" accessibilityLabel="暂停音乐以播放MV" onPress={()=>services.playback.controller.pause()} style={{minHeight:controls.hit,padding:space.sm,backgroundColor:theme.palette.selected,borderRadius:radius.md}}><Text style={{color:theme.palette.accent}}>暂停音乐以播放MV</Text></Pressable>}
  {url&&<NativePage testID="mv-native-page" source={url} active={visible&&playback.intent!=='playing'} onState={event=>{if(!alive.current)return;const {phase,notice}=event.nativeEvent;if(phase){setPhase(phase);if(phase==='loading')setNotice('');}if(notice)setNotice('此链接无法在应用内打开，可继续查看当前页面。');}} style={{flex:1}}/>}
  {url&&(phase==='error'||phase==='blocked')&&<Pressable accessibilityRole="button" onPress={()=>{void Linking.openURL(url).catch(()=>setPhase('error'));}} style={{minHeight:controls.hit,justifyContent:'center'}}><Text style={{color:theme.palette.accent}}>在浏览器打开官方MV页面</Text></Pressable>}
 </View>;
}
export function MVDetail({services,platform,video,onClose}:{services:Services;platform:OnlinePlatform;video:VideoItem;onClose:()=>void}){
 const theme=useTheme(),insets=useSafeAreaInsets(),[revision,setRevision]=useState(0);
 const button={minHeight:controls.hit,paddingHorizontal:space.md,justifyContent:'center' as const,borderRadius:radius.md,backgroundColor:theme.palette.selected};
 return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}><View style={{flex:1,paddingTop:insets.top+space.sm,paddingBottom:insets.bottom,paddingLeft:insets.left+space.lg,paddingRight:insets.right+space.lg,gap:space.sm,backgroundColor:theme.palette.background[0]}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm}}><Pressable testID="mv-back" accessibilityRole="button" accessibilityLabel="返回MV搜索结果" onPress={onClose} style={button}><Text style={{color:theme.palette.accent}}>返回搜索结果</Text></Pressable>{platform!=='mg'&&<Pressable testID="mv-refresh" accessibilityRole="button" accessibilityLabel="刷新MV页面" onPress={()=>setRevision(value=>value+1)} style={button}><Text style={{color:theme.palette.accent}}>刷新</Text></Pressable>}</View>
  <Text testID="mv-title" numberOfLines={2} style={{...typography.title,color:theme.palette.text}}>{video.title}</Text><Text testID="mv-source" style={{color:theme.palette.secondary}}>{names[platform]}{video.author?` · ${video.author}`:''}{video.durationSeconds!==undefined?` · ${videoDuration(video.durationSeconds)}`:''}</Text>
  <Page key={`${platform}:${video.id}:${revision}`} services={services} platform={platform} video={video}/>
 </View></Modal>;
}
