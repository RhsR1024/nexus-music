import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {CommentsModal} from './CommentsModal.tsx';
import {MatchModal} from './MatchModal.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';
import {downloadableTrack,type DownloadSubmission} from '../app/downloadSubmission.ts';
import {DownloadSubmissionView} from './DownloadSubmission.tsx';
import {DownloadQualityChoice} from './DownloadQualityChoice.tsx';
import type {Quality} from '../domain/quality.ts';

// The sheet stays owned by the page that supplied the original track identity.
// Playlist selection replaces its content instead of presenting a sibling modal.
export function TrackActions({services,track,onClose,prefix,extras=false}:{
  services:Services;track:Track|null;onClose:()=>void;prefix:string;
  extras?:boolean;
}){
  const theme=useTheme();
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
  const [commenting,setCommenting]=useState(false),[matching,setMatching]=useState(false);
  const [adding,setAdding]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [choosingDownload,setChoosingDownload]=useState(false);
  const [downloadReport,setDownloadReport]=useState<DownloadSubmission|null>(null);
  useEffect(()=>{setAdding(false);setCommenting(false);setMatching(false);setError('');setDownloadReport(null);setChoosingDownload(false);setBusy(false);},[track]);
  const current=useRef(track);current.current=track;
  useEffect(()=>()=>{current.current=null;},[]);
  const favorite=track?services.songFavorites.isFavorite(track):false;
  async function saveFavorite(){
    if(!track||busy)return;setBusy(true);setError('');
    try{await services.songFavorites.toggle(track);if(current.current===track)onClose();}
    catch{if(current.current===track)setError('收藏未保存，原数据保留；请重试');}
    finally{if(current.current===track)setBusy(false);}
  }
  async function download(preferredQuality?:Quality){
    if(!track||busy)return;if(!preferredQuality&&track.origin.kind==='online'&&!services.offlineDownloads.find(track)){setChoosingDownload(true);return;}setBusy(true);setError('');const owner=track;
    try{const report=await services.submitDownloads([owner],preferredQuality?{preferredQuality}:undefined);if(current.current===owner){setChoosingDownload(false);setDownloadReport(report);}}
    finally{if(current.current===owner)setBusy(false);}
  }
  const action=(label:string,icon:React.ComponentProps<typeof Ionicons>['name'],run:()=>void)=><Pressable key={label} testID={`${prefix}-action-${label}`} accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={run} style={[styles.action,{backgroundColor:theme.palette.surface,opacity:busy?.5:1}]}><Ionicons name={icon} size={controls.icon} color={theme.palette.accent}/><Text style={[typography.body,{color:theme.palette.text,flex:1}]}>{label}</Text><Ionicons name="chevron-forward" size={18} color={theme.palette.secondary}/></Pressable>;
  return <SheetModal visible={!!track} animationType="slide" onRequestClose={onClose}>
    {track&&choosingDownload?<DownloadQualityChoice services={services} track={track} busy={busy} onBack={()=>setChoosingDownload(false)} onConfirm={q=>{void download(q);}}/>:track&&downloadReport?<DownloadSubmissionView services={services} report={downloadReport} backLabel="返回歌曲操作" onClose={()=>setDownloadReport(null)}/>:track&&commenting?<CommentsModal embedded services={services} track={track} onClose={()=>setCommenting(false)}/>:track&&adding?<PlaylistPicker inline services={services} tracks={[track]} visible onClose={onClose}/>:<ScrollView testID={`${prefix}-actions`} style={{backgroundColor:theme.palette.background[0]}} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="收起歌曲更多操作" onPress={onClose} style={styles.close}><Ionicons name="chevron-down" size={26} color={theme.palette.text}/></Pressable>
      <Text accessibilityRole="header" style={[typography.title,{color:theme.palette.text}]}>{track?.title??'歌曲操作'}</Text>
      <Text style={[typography.caption,{color:theme.palette.secondary}]}>{track?.artist}{track?.album?` · ${track.album}`:''}</Text>
      {track&&<View style={styles.actions}>
        {action('下一首','play-skip-forward',()=>{services.addToQueue(track,true);onClose();})}
        {action('加入队列','list',()=>{services.addToQueue(track);onClose();})}
        {action(favorite?'取消本地收藏':'本地收藏',favorite?'heart':'heart-outline',()=>{void saveFavorite();})}
        {action('加入歌单','albums-outline',()=>setAdding(true))}
        {downloadableTrack(track)&&action('下载','download-outline',()=>{void download();})}
        {extras&&action('歌曲评论','chatbubble-outline',()=>setCommenting(true))}
        {extras&&action('匹配歌曲','search-outline',()=>setMatching(true))}
      </View>}
      {!!error&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.accent}}>{error}</Text>}
    </ScrollView>}
    <MatchModal services={services} track={matching?track:null} onClose={()=>setMatching(false)}/>
  </SheetModal>;
}
const styles=StyleSheet.create({content:{padding:space.xxl,paddingTop:space.section,gap:space.lg},close:{minHeight:controls.hit,justifyContent:'center'},actions:{gap:space.md},action:{minHeight:56,paddingHorizontal:space.lg,borderRadius:radius.lg,flexDirection:'row',alignItems:'center',gap:space.md}});
