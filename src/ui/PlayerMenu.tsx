import {useSyncExternalStore} from 'react';
import {Alert, Pressable, Share, StyleSheet, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useTheme, type Theme} from './theme.tsx';
import {radius, space, typography} from './tokens.ts';

const platformName:Record<string,string>={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕',qishui:'汽水'};

export function PlayerMenu({services,track,favoriteTrack,layoutLabel,queueCount,onStyle,onLyricsSettings,onQueue,onRate,onSleep,onComments,onPlaylist,onClose,onDownload,downloadLabel='下载'}:{
  services:Services;track:Track;favoriteTrack:Track;layoutLabel:string;queueCount:number;
  onStyle:()=>void;onLyricsSettings:()=>void;onQueue:()=>void;onRate:()=>void;onSleep:()=>void;onComments:()=>void;onPlaylist:()=>void;onClose:()=>void;onDownload?:()=>void;downloadLabel?:string;
}){
  const theme=useTheme(),styles=makeStyles(theme);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const sleep=useSyncExternalStore(services.playback.sleep.subscribe,services.playback.sleep.getSnapshot);
  const sleepLabel=sleep.mode==='off'?'已关闭':sleep.mode==='track'?'本曲结束后':`剩余 ${Math.max(0,Math.ceil((sleep.deadline-Date.now())/60000))} 分钟`;
  const favorite=services.library.isFavorite(favoriteTrack);
  const platform=track.origin.kind==='online'?platformName[track.origin.platform]:track.origin.kind==='imported'?'汽水':'本地';
  const subtitle=[track.artist,track.album,platform].filter(Boolean).join(' · ');
  const toggleFavorite=()=>{void services.library.favorite(favoriteTrack).catch(()=>Alert.alert('收藏未保存','已有数据保留，请重试。'));};
  const share=()=>{void Share.share({message:`${track.title} — ${track.artist}`}).catch(()=>{});};
  const card=(icon:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,active=false)=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={active?{text:'已收藏'}:undefined} onPress={action} style={styles.card}>
      <View style={[styles.tile,{width:40,height:40,borderRadius:12}]}><Ionicons name={icon} size={22} color={theme.palette.accent}/></View>
      <Text style={styles.cardLabel}>{label}</Text>
    </Pressable>);
  const row=(icon:React.ComponentProps<typeof Ionicons>['name'],label:string,value:string,action:()=>void,last=false)=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={[styles.row,last?null:styles.rowBorder]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color={theme.palette.accent}/></View>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.palette.secondary}/>
    </Pressable>);
  return <View style={styles.root}>
    <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="收起播放选项" onPress={onClose} style={styles.close}><Text style={styles.closeText}>收起</Text></Pressable></View>
    <View style={styles.header}>
      <Cover services={services} track={track} size={56}/>
      <View style={{flex:1,minWidth:0}}>
        <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
        <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
    <View style={styles.cards}>
      {card(favorite?'heart':'heart-outline','收藏',toggleFavorite,favorite)}
      {card('play-skip-forward-outline','下一首',()=>services.playback.next())}
      {card('add','歌单',onPlaylist)}
      {onDownload?card('download-outline',downloadLabel,onDownload):card('share-outline','分享',share)}
    </View>
    <Text style={styles.section}>播放设置</Text>
    <View style={styles.group}>
      {row('options-outline','播放界面样式',layoutLabel,onStyle)}
      {row('text-outline','歌词显示设置','字体与颜色',onLyricsSettings)}
      {row('speedometer-outline','播放倍速',`${preferences.rate}x`,onRate)}
      {row('moon-outline','睡眠定时器',sleepLabel,onSleep)}
      {row('list-outline','队列与播放选项',`${queueCount} 首`,onQueue,true)}
    </View>
    <Text style={styles.section}>歌曲操作</Text>
    <View style={styles.group}>
      {row('share-outline','分享歌曲','分享',share)}
      {row('add-circle-outline','添加到歌单','选择歌单',onPlaylist,true)}
    </View>
    {track.origin.kind==='online'&&<><Text style={styles.section}>发现</Text>
    <View style={styles.group}>{row('chatbubble-outline','热门评论','查看',onComments,true)}</View></>}
  </View>;
}

const makeStyles=(theme:Theme)=>StyleSheet.create({
  root:{flexGrow:1,backgroundColor:theme.palette.background[0],paddingHorizontal:space.lg,paddingBottom:space.xxl,gap:space.lg},
  topBar:{flexDirection:'row',justifyContent:'flex-end',marginTop:space.sm},
  close:{minWidth:44,minHeight:44,alignItems:'flex-end',justifyContent:'center'},
  closeText:{...typography.caption,color:theme.palette.secondary},
  header:{flexDirection:'row',alignItems:'center',gap:space.md},
  title:{...typography.title,fontSize:20,lineHeight:26,color:theme.palette.text},
  subtitle:{...typography.micro,fontSize:12,color:theme.palette.secondary,marginTop:space.xxs},
  cards:{flexDirection:'row',alignItems:'stretch',justifyContent:'space-between',backgroundColor:theme.palette.surface,borderRadius:radius.lg,paddingHorizontal:space.sm,paddingVertical:space.md},
  card:{flex:1,alignItems:'center',gap:space.sm,minHeight:68,justifyContent:'center'},
  tile:{alignItems:'center',justifyContent:'center',backgroundColor:theme.palette.background[0]},
  cardLabel:{...typography.micro,fontSize:12,color:theme.palette.text},
  section:{...typography.micro,fontSize:12,color:theme.palette.secondary,marginBottom:-space.sm,paddingLeft:space.xs},
  group:{backgroundColor:theme.palette.surface,borderRadius:radius.lg,overflow:'hidden'},
  row:{minHeight:56,flexDirection:'row',alignItems:'center',gap:space.md,paddingHorizontal:space.md},
  rowBorder:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.palette.border},
  rowIcon:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:theme.palette.background[0]},
  rowTitle:{...typography.body,fontSize:15,color:theme.palette.text,flex:1},
  rowValue:{...typography.micro,fontSize:12,color:theme.palette.secondary,maxWidth:'40%'},
});
