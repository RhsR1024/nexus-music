import {useSongShare} from './useSongShare.ts';
import {useSyncExternalStore} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {lyricOffset} from '../lyrics/settings.ts';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useTheme, type Theme} from './theme.tsx';
import {sollinTokens, space, typography} from './tokens.ts';

const platformName:Record<string,string>={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕',qishui:'汽水'};

export function PlayerMenu({services,track,favoriteTrack,layoutLabel,queueCount,onStyle,onLyricsSettings,onLyricSource,onAllLyrics,onLyricOffset,onEQ,onAudioOutput,onQueue,onMatch,onRate,onSleep,onComments,onPlaylist,onClose,onDownload,onSimilar,onDiagnostics,downloadLabel='下载'}:{
  services:Services;track:Track;favoriteTrack:Track;layoutLabel:string;queueCount:number;
  onStyle:()=>void;onLyricsSettings:()=>void;onLyricSource?:()=>void;onAllLyrics?:()=>void;onLyricOffset?:()=>void;onEQ?:()=>void;onAudioOutput?:()=>void;onQueue:()=>void;onMatch?:()=>void;onRate:()=>void;onSleep:()=>void;onComments:()=>void;onPlaylist:()=>void;onClose:()=>void;onDownload?:()=>void;onSimilar?:()=>void;onDiagnostics:()=>void;downloadLabel?:string;
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=makeStyles(theme),{share,sharing,error:shareError}=useSongShare(track);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
  const sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const sleepLabel=sleep.mode==='off'?'已关闭':sleep.mode==='track'?'本曲结束后':`剩余 ${Math.max(0,Math.ceil((sleep.deadline-Date.now())/60000))} 分钟`;
  const effectiveOffset=lyricOffset(preferences.lyricOffsetMs,preferences.lyricOffsets,trackKey(track.origin));
  const favorite=services.songFavorites.isFavorite(favoriteTrack);
  const platform=track.origin.kind==='online'?platformName[track.origin.platform]:track.origin.kind==='imported'?'汽水':track.origin.kind==='radio'?'全球电台':'本地';
  const subtitle=[track.artist,track.album,platform].filter(Boolean).join(' · ');
  const toggleFavorite=()=>{void services.songFavorites.toggle(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));};
  const card=(icon:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,active=false)=>(
    <Pressable disabled={sharing} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={active?{text:'已收藏'}:undefined} onPress={action} style={styles.card}>
      <View style={styles.tile}><Ionicons name={icon} size={22} color={s.accent}/></View>
      <Text style={styles.cardLabel}>{label}</Text>
    </Pressable>);
  const row=(icon:React.ComponentProps<typeof Ionicons>['name'],label:string,value:string,action:()=>void,last=false)=>(
    <Pressable disabled={sharing} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{text:value}} onPress={action} style={[styles.row,last?null:styles.rowBorder]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={s.accent}/></View>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
    </Pressable>);
  return <View style={styles.root}>
    <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View style={styles.topBar}><Pressable disabled={sharing} accessibilityRole="button" accessibilityLabel="收起播放选项" onPress={onClose} style={styles.close}><View style={styles.grabber}/></Pressable></View>
    <View style={styles.header}>
      <Cover services={services} track={track} size={56} radius={12}/>
      <View style={{flex:1,minWidth:0}}>
        <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
        <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
    <View style={styles.cards}>
      {card(favorite?'heart':'heart-outline','收藏',toggleFavorite,favorite)}
      {card('play-skip-forward-outline','下一首',()=>services.playback.next())}
      {card('albums-outline','歌单',onPlaylist)}
      {onDownload?card('cloud-download-outline',downloadLabel,onDownload):card('share-outline','分享',()=>{void share();})}
    </View>
    <Text style={styles.section}>播放设置</Text>
    <View style={styles.group}>
      {row('options-outline','播放界面样式',layoutLabel,onStyle)}
      {row('text-outline','歌词显示设置','字体与颜色',onLyricsSettings)}
      {onLyricSource&&row('language-outline','选择歌词来源','切换或搜索',onLyricSource)}
      {onAllLyrics&&row('document-text-outline','全部歌词','定位与偏移',onAllLyrics)}
      {onLyricOffset&&row('time-outline','歌词时间偏移',effectiveOffset===0?'默认':`${effectiveOffset>0?'+':''}${effectiveOffset}ms`,onLyricOffset)}
      {row('speedometer-outline','播放倍速',`${preferences.rate}x`,onRate)}
      {row('moon-outline','睡眠定时器',sleepLabel,onSleep)}
      {onEQ&&row('stats-chart-outline','均衡器',preferences.eqEnabled?'已开启':'已关闭',onEQ)}
      {onAudioOutput&&row('volume-medium-outline','音频输出设备','AirPlay / 蓝牙',onAudioOutput)}
      {row('pulse-outline','播放链路诊断','查看过程',onDiagnostics)}
      {row('list-outline','队列与播放选项',`${queueCount} 首`,onQueue,true)}
    </View>
    <Text style={styles.section}>歌曲操作</Text>
    <View style={styles.group}>
      {onMatch&&row('git-compare-outline','匹配歌曲','切换音源版本',onMatch)}
      {row('share-outline','分享歌曲',sharing?'正在打开':'分享',()=>{void share();})}
      {row('add-circle-outline','添加到歌单','选择歌单',onPlaylist,true)}
    </View>
    {track.origin.kind==='online'&&<><Text style={styles.section}>发现</Text>
    <View style={styles.group}>{onSimilar&&row('pulse','相似歌曲','',onSimilar)}{row('chatbubbles-outline','热门评论','',onComments,true)}</View></>}
    {!!shareError&&<Text accessibilityRole="alert" style={{color:s.accent}}>{shareError}</Text>}
  </View>;
}

const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return StyleSheet.create({
  root:{flexGrow:1,backgroundColor:s.sheetGradient[0],paddingHorizontal:18,paddingBottom:space.xxl,gap:14},
  topBar:{alignItems:'center',paddingTop:6},
  close:{minWidth:80,minHeight:28,alignItems:'center',justifyContent:'center'},
  grabber:{width:36,height:4,borderRadius:2,backgroundColor:s.subtle+'66'},
  header:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:2},
  title:{...typography.title,fontSize:20,lineHeight:26,color:s.ink},
  subtitle:{...typography.micro,fontSize:13,color:s.muted,marginTop:2},
  cards:{flexDirection:'row',alignItems:'stretch',justifyContent:'space-between',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,borderRadius:20,paddingHorizontal:8,paddingVertical:14},
  card:{flex:1,alignItems:'center',gap:7,minHeight:64,justifyContent:'center'},
  tile:{width:44,height:44,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:s.accentSoft},
  cardLabel:{fontSize:12,fontWeight:'500',color:s.ink},
  section:{fontSize:12,fontWeight:'500',color:s.muted,marginBottom:-6,paddingLeft:6},
  group:{backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,borderRadius:20,overflow:'hidden'},
  row:{minHeight:54,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14},
  rowBorder:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:s.hairline},
  rowIcon:{width:32,height:32,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:s.accentSoft},
  rowTitle:{fontSize:15,fontWeight:'500',color:s.ink,flex:1},
  rowValue:{fontSize:13,color:s.muted,maxWidth:'38%'},
  });
};
