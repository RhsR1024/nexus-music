import {CatalogFavoriteButton} from './CatalogFavoriteButton.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Linking,Pressable,View,type ViewProps} from 'react-native';
import {requireNativeView} from 'expo';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import type {OnlinePlatform} from '../domain/track.ts';
import type {VideoItem,VideoResolution} from '../providers/videos.ts';
import {Modal,usePresentationVisible} from './AdaptiveModal.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,space,radius,sollinTokens,typography} from './tokens.ts';

type Phase='loading'|'ready'|'error'|'blocked';
type MediaState='none'|'playing'|'paused'|'suspended'|'unknown';
type FullscreenState='inline'|'entering'|'fullscreen'|'exiting'|'unknown';
type NativeVideoPhase='loading'|'ready'|'ended'|'error';

const NativePage=requireNativeView<ViewProps&{source:string;active:boolean;onState:(event:{nativeEvent:{phase?:Phase;notice?:string;media?:MediaState;fullscreen?:FullscreenState}})=>void}>('NexusNative','PublicMV');
const NativeVideo=requireNativeView<ViewProps&{source:string;active:boolean;paused?:boolean;seekTo?:number;onState:(event:{nativeEvent:{phase?:NativeVideoPhase;playing?:boolean;position?:number;duration?:number;error?:string}})=>void}>('NexusNative','NativeVideo');

const names={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'};
const resolutions:readonly VideoResolution[]=[1080,720,480,240];

export function videoDuration(seconds?:number){
  if(seconds===undefined||!Number.isFinite(seconds))return'';
  const n=Math.max(0,Math.floor(seconds));
  return`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
}

function Page({services,platform,video}:{services:Services;platform:OnlinePlatform;video:VideoItem}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),visible=usePresentationVisible();
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);

  // Mode: prefer native direct video stream when available (e.g. NetEase MP4), smoothly fall back to official PublicMV web page.
  const [mode,setMode]=useState<'resolving'|'native'|'web'>(platform==='wy'?'resolving':'web');
  const [resolution,setResolution]=useState<VideoResolution>(1080);
  const [availableRes,setAvailableRes]=useState<readonly VideoResolution[]>([]);
  const [streamUrl,setStreamUrl]=useState<string>('');
  const [streamReason,setStreamReason]=useState<string>('');
  const [videoPhase,setVideoPhase]=useState<NativeVideoPhase>('loading');
  const [videoPlaying,setVideoPlaying]=useState(false);
  const [videoPaused,setVideoPaused]=useState(false);
  const [videoPos,setVideoPos]=useState(0);
  const [videoDur,setVideoDur]=useState(video.durationSeconds??0);

  const [url,setURL]=useState<string>(),[phase,setPhase]=useState<Phase>('loading'),[notice,setNotice]=useState(''),[media,setMedia]=useState<MediaState>('none'),[fullscreen,setFullscreen]=useState<FullscreenState>('inline'),alive=useRef(true);

  // Auto-pause background music so MV audio never clashes with song playback.
  useEffect(()=>{
    if(services.playback.controller.getSnapshot().intent==='playing'){
      services.playback.controller.pause();
    }
  },[services]);

  useEffect(()=>{
    const pending=new AbortController();
    alive.current=true;
    void services.videos.publicPage(platform,video,pending.signal).then(value=>{
      if(!pending.signal.aborted)setURL(value);
    }).catch(()=>{
      if(!pending.signal.aborted)setPhase('error');
    });
    return()=>{alive.current=false;pending.abort();};
  },[services,platform,video]);

  useEffect(()=>{
    if(platform!=='wy'){setMode('web');return;}
    const pending=new AbortController();
    setMode('resolving');setVideoPhase('loading');setStreamReason('');
    void (async()=>{
      let cookieHeader:string|undefined;
      try{
        const wyAcc=services.musicAccounts.getSnapshot().find(a=>a.platform==='wy');
        if(wyAcc){
          const sess=await services.musicAccounts.session(wyAcc.id);
          const c=(sess.cookies??{}) as Record<string,string>;
          const parts=Object.entries(c).filter(([k,v])=>['MUSIC_U','__csrf','NMTID'].includes(k)&&typeof v==='string'&&v).map(([k,v])=>`${k}=${v}`);
          if(parts.length)cookieHeader=parts.join('; ');
        }
      }catch{}
      const resolved=await services.videos.resolveStream(platform,video,resolution,pending.signal,cookieHeader);
      if(pending.signal.aborted)return;
      if(resolved.url){
        setStreamUrl(resolved.url);
        setAvailableRes(resolved.availableResolutions);
        if(resolved.resolution!==resolution)setResolution(resolved.resolution);
        setMode('native');
      }else{
        setStreamReason(resolved.reason??'');
        setMode('web');
      }
    })().catch(()=>{
      if(!pending.signal.aborted)setMode('web');
    });
    return()=>pending.abort();
  },[services,platform,video,resolution]);

  const message=phase==='loading'?'正在加载MV页面…':phase==='ready'?'页面已载入':phase==='blocked'?'此跳转无法在应用内打开':'此平台MV页面暂时无法读取，请刷新或在浏览器打开';

  if(mode==='resolving'){
    return <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:12}}>
      <ActivityIndicator color={s.accent}/>
      <Text style={{color:s.muted,fontSize:13}}>正在解析 MV 视频流…</Text>
    </View>;
  }

  if(mode==='native'&&streamUrl){
    return <View style={{flex:1,gap:12}}>
      <View style={{width:'100%',aspectRatio:16/9,borderRadius:16,overflow:'hidden',backgroundColor:'#000000'}}>
        <NativeVideo
          testID="mv-native-video"
          source={streamUrl}
          active={visible&&playback.intent!=='playing'}
          paused={videoPaused}
          onState={event=>{
            if(!alive.current)return;
            const e=event.nativeEvent;
            if(e.phase)setVideoPhase(e.phase);
            if(typeof e.playing==='boolean')setVideoPlaying(e.playing);
            if(typeof e.position==='number')setVideoPos(e.position);
            if(typeof e.duration==='number'&&e.duration>0)setVideoDur(e.duration);
            if(e.phase==='error'){
              setStreamReason(e.error??'视频直链播放失败，已切换官方页面');
              setMode('web');
            }
          }}
          style={{flex:1}}
        />
        {videoPhase==='loading'&&<View pointerEvents="none" style={{position:'absolute',inset:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.35)'}}>
          <ActivityIndicator color="#FFFFFF"/>
        </View>}
      </View>

      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <Pressable accessibilityRole="button" accessibilityLabel={videoPlaying?'暂停MV':'播放MV'} onPress={()=>setVideoPaused(p=>!p)} style={{minHeight:38,paddingHorizontal:14,borderRadius:19,backgroundColor:s.accentSoft,flexDirection:'row',alignItems:'center',gap:6}}>
          <Ionicons name={videoPlaying?'pause':'play'} size={15} color={s.accent}/>
          <Text style={{color:s.accent,fontSize:13,fontWeight:'600'}}>{videoPlaying?'暂停':'继续播放'}</Text>
        </Pressable>
        <Text style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>{videoDuration(videoPos)} / {videoDuration(videoDur)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="切换官方网页播放" onPress={()=>setMode('web')} style={{minHeight:34,paddingHorizontal:11,borderRadius:17,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,justifyContent:'center'}}>
          <Text style={{color:s.muted,fontSize:12,fontWeight:'600'}}>官方网页</Text>
        </Pressable>
      </View>

      {availableRes.length>0&&<View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <Text style={{color:s.muted,fontSize:12}}>清晰度</Text>
        {resolutions.filter(r=>availableRes.includes(r)).map(r=>{
          const active=resolution===r;
          return <Pressable key={r} accessibilityRole="radio" accessibilityState={{selected:active}} onPress={()=>setResolution(r)} style={{paddingHorizontal:12,paddingVertical:6,borderRadius:14,backgroundColor:active?s.accent:s.card,borderWidth:1,borderColor:active?s.accent:s.cardBorder}}>
            <Text style={{color:active?'#FFFFFF':s.ink,fontSize:12,fontWeight:'600'}}>{r}P</Text>
          </Pressable>;
        })}
      </View>}
      <Text style={{color:s.subtle,fontSize:11.5}}>点击播放器内置控件可全屏或画中画播放；退出 MV 时会自动停止视频流。</Text>
    </View>;
  }

  return <View style={{flex:1,gap:space.sm}}>
    {!!streamReason&&<Text style={{color:s.muted,fontSize:12}}>{streamReason}</Text>}
    <View style={{flexDirection:'row',alignItems:'center',gap:space.sm}}>{phase==='loading'&&<ActivityIndicator color={theme.palette.accent}/>}<Text testID="mv-page-status" accessibilityLiveRegion="polite" style={{flex:1,color:theme.palette.secondary}}>{message}</Text></View>
    {phase==='ready'&&<Text testID="mv-media-status" accessibilityLiveRegion="polite" accessibilityValue={{text:`media:${media},fullscreen:${fullscreen}`}} style={{color:theme.palette.secondary}}>{media==='playing'?'MV 播放中':media==='suspended'?'MV 已在后台暂停':media==='paused'?'MV 已暂停':'点击页面内控件开始 MV'}{fullscreen==='entering'?' · 正在进入全屏':fullscreen==='fullscreen'?' · 全屏':fullscreen==='exiting'?' · 正在退出全屏':''}</Text>}
    {!!notice&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.secondary}}>{notice}</Text>}
    {url&&playback.intent==='playing'&&<Pressable accessibilityRole="button" accessibilityLabel="暂停音乐以播放MV" onPress={()=>services.playback.controller.pause()} style={{minHeight:controls.hit,padding:space.sm,backgroundColor:theme.palette.selected,borderRadius:radius.md}}><Text style={{color:theme.palette.accent}}>暂停音乐以播放MV</Text></Pressable>}
    {url&&<NativePage testID="mv-native-page" source={url} active={visible&&playback.intent!=='playing'} onState={event=>{if(!alive.current)return;const {phase,notice,media,fullscreen}=event.nativeEvent;if(phase){setPhase(phase);if(phase==='loading')setNotice('');}if(media)setMedia(media);if(fullscreen)setFullscreen(fullscreen);if(notice)setNotice('此链接无法在应用内打开，可继续查看当前页面。');}} style={{flex:1}}/>}
    {url&&(phase==='error'||phase==='blocked')&&<Pressable accessibilityRole="button" onPress={()=>{void Linking.openURL(url).catch(()=>setPhase('error'));}} style={{minHeight:controls.hit,justifyContent:'center'}}><Text style={{color:theme.palette.accent}}>在浏览器打开官方MV页面</Text></Pressable>}
  </View>;
}

export function MVDetail({services,platform,video,onClose}:{services:Services;platform:OnlinePlatform;video:VideoItem;onClose:()=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets(),[revision,setRevision]=useState(0);
  const button={minHeight:controls.hit,paddingHorizontal:space.md,justifyContent:'center' as const,borderRadius:radius.md,backgroundColor:theme.palette.selected};
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}><View style={{flex:1,paddingTop:insets.top+space.sm,paddingBottom:insets.bottom,paddingLeft:insets.left+space.lg,paddingRight:insets.right+space.lg,gap:space.sm,backgroundColor:theme.palette.background[0]}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm}}>
      <Pressable testID="mv-back" accessibilityRole="button" accessibilityLabel="返回" onPress={onClose} style={[button,{flexDirection:'row',alignItems:'center',gap:4}]}>
        <Ionicons name="chevron-back" size={17} color={s.accent}/>
        <Text style={{color:theme.palette.accent,fontWeight:'600'}}>返回</Text>
      </Pressable>
      <Pressable testID="mv-refresh" accessibilityRole="button" accessibilityLabel="刷新MV" onPress={()=>setRevision(value=>value+1)} style={button}>
        <Text style={{color:theme.palette.accent,fontWeight:'600'}}>刷新</Text>
      </Pressable>
    </View>
    <Text testID="mv-title" numberOfLines={2} style={{...typography.title,color:theme.palette.text}}>{video.title}</Text>
    <Text testID="mv-source" style={{color:theme.palette.secondary}}>{names[platform]}{video.author?` · ${video.author}`:''}{video.durationSeconds!==undefined?` · ${videoDuration(video.durationSeconds)}`:''}</Text>
    <CatalogFavoriteButton services={services} target={{...video,kind:'mv',platform}}/>
    <Page key={`${platform}:${video.id}:${revision}`} services={services} platform={platform} video={video}/>
  </View></Modal>;
}
