import {useSongShare} from './useSongShare.ts';
import {SimilarSongs} from './SimilarSongs.tsx';
import {supportsSimilarSongs} from '../providers/similarSongs.ts';
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
import type {QQFavoriteStatus} from '../providers/qqFavorite.ts';
import type {NeteaseFavoriteStatus} from '../providers/neteaseFavorite.ts';

// The sheet stays owned by the page that supplied the original track identity.
// Playlist selection replaces its content instead of presenting a sibling modal.
const qqFavoriteCopy=(status:QQFavoriteStatus)=>{
  if(status==='unconfirmed'||status==='unknown')return '已提交，但未确认收藏结果，请稍后在 QQ 音乐查看';
  if(status==='rejected')return 'QQ 音乐拒绝收藏，请检查账号权限';
  if(status==='login_required')return 'QQ 音乐登录已失效，请在设置中重新登录';
  if(status==='account_changed')return 'QQ 音乐账号已更改，请重试';
  if(status==='unsupported')return '这首歌暂不支持收藏到 QQ 音乐';
  if(status==='unavailable')return '暂时无法收藏到 QQ 音乐，请重试';
  return '';
};
const neteaseFavoriteCopy=(status:NeteaseFavoriteStatus)=>{
  if(status==='unconfirmed'||status==='unknown')return '已提交，但未确认收藏结果，请稍后在网易云音乐查看';
  if(status==='rejected')return '网易云音乐拒绝收藏，请检查账号权限';
  if(status==='login_required')return '网易云音乐登录已失效，请在设置中重新登录';
  if(status==='account_changed')return '网易云音乐账号已更改，请重试';
  if(status==='unsupported')return '这首歌暂不支持收藏到网易云音乐';
  if(status==='unavailable')return '暂时无法收藏到网易云音乐，请重试';
  return '';
};
export function TrackActions({services,track,onClose,prefix,extras=false}:{
  services:Services;track:Track|null;onClose:()=>void;prefix:string;
  extras?:boolean;
}){
  const theme=useTheme(),{share,sharing,error:shareError}=useSongShare(track);
  useSyncExternalStore(services.songFavorites.subscribe,services.songFavorites.getSnapshot);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const [commenting,setCommenting]=useState(false),[matching,setMatching]=useState(false);
  const [adding,setAdding]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [choosingDownload,setChoosingDownload]=useState(false),[similar,setSimilar]=useState(false);
  const [downloadReport,setDownloadReport]=useState<DownloadSubmission|null>(null);
  const [qqFavoriteState,setQQFavoriteState]=useState<'idle'|'pending'|'added'>('idle');
  const [qqFavoriteMessage,setQQFavoriteMessage]=useState('');
  const qqFavoriteController=useRef<AbortController|null>(null);
  const [wyFavoriteState,setWYFavoriteState]=useState<'idle'|'pending'|'added'>('idle');
  const [wyFavoriteMessage,setWYFavoriteMessage]=useState('');
  const wyFavoriteController=useRef<AbortController|null>(null);
  useEffect(()=>{
    setSimilar(false);setAdding(false);setCommenting(false);setMatching(false);setError('');setDownloadReport(null);setChoosingDownload(false);setBusy(false);
    setQQFavoriteState('idle');setQQFavoriteMessage('');qqFavoriteController.current?.abort();qqFavoriteController.current=null;
    setWYFavoriteState('idle');setWYFavoriteMessage('');wyFavoriteController.current?.abort();wyFavoriteController.current=null;
  },[track]);
  const current=useRef(track);current.current=track;
  useEffect(()=>()=>{current.current=null;qqFavoriteController.current?.abort();qqFavoriteController.current=null;wyFavoriteController.current?.abort();wyFavoriteController.current=null;},[]);
  const favorite=track?services.songFavorites.isFavorite(track):false;
  const qqTrack=track?.origin.kind==='online'&&track.origin.platform==='tx'?track:null;
  const qqAccounts=accounts.filter(account=>account.platform==='tx');
  const qqAccount=qqAccounts.length===1?qqAccounts[0]:undefined;
  const wyTrack=track?.origin.kind==='online'&&track.origin.platform==='wy'?track:null;
  const wyAccounts=accounts.filter(account=>account.platform==='wy');
  const wyAccount=wyAccounts.length===1?wyAccounts[0]:undefined;
  async function saveFavorite(){
    if(!track||busy)return;setBusy(true);setError('');
    try{await services.songFavorites.toggle(track);if(current.current===track)onClose();}
    catch{if(current.current===track)setError('收藏未保存，原数据保留；请重试');}
    finally{if(current.current===track)setBusy(false);}
  }
  async function saveQQFavorite(){
    if(!qqTrack||!qqAccount||busy)return;
    const owner=qqTrack,account=qqAccount,controller=new AbortController();
    qqFavoriteController.current?.abort();qqFavoriteController.current=controller;
    setBusy(true);setError('');setQQFavoriteState('pending');setQQFavoriteMessage('正在确认 QQ 音乐收藏…');
    try{
      const session=await services.musicAccounts.session(account.id);
      if(controller.signal.aborted||current.current!==owner)return;
      const result=await services.qqFavorite.add(account,session,owner.origin.kind==='online'?owner.origin.id:'',controller.signal);
      if(controller.signal.aborted||current.current!==owner)return;
      if(result.status==='added'||result.status==='already'){
        setQQFavoriteState('added');setQQFavoriteMessage('已收藏到 QQ 音乐');
      }else{
        setQQFavoriteState('idle');setQQFavoriteMessage(qqFavoriteCopy(result.status));
      }
    }catch{
      if(!controller.signal.aborted&&current.current===owner){setQQFavoriteState('idle');setQQFavoriteMessage('QQ 音乐收藏未完成，请重试');}
    }finally{
      if(qqFavoriteController.current===controller){qqFavoriteController.current=null;if(current.current===owner)setBusy(false);}
    }
  }
  async function saveNeteaseFavorite(){
    if(!wyTrack||!wyAccount||busy)return;
    const owner=wyTrack,account=wyAccount,controller=new AbortController();
    wyFavoriteController.current?.abort();wyFavoriteController.current=controller;
    setBusy(true);setError('');setWYFavoriteState('pending');setWYFavoriteMessage('正在确认网易云音乐收藏…');
    try{
      const session=await services.musicAccounts.session(account.id);
      if(controller.signal.aborted||current.current!==owner)return;
      const result=await services.neteaseFavorite.add(account,session,owner.origin.kind==='online'?owner.origin.id:'',controller.signal);
      if(controller.signal.aborted||current.current!==owner)return;
      if(result.status==='added'||result.status==='already'){
        setWYFavoriteState('added');setWYFavoriteMessage('已收藏到网易云音乐');
      }else{
        setWYFavoriteState('idle');setWYFavoriteMessage(neteaseFavoriteCopy(result.status));
      }
    }catch{
      if(!controller.signal.aborted&&current.current===owner){setWYFavoriteState('idle');setWYFavoriteMessage('网易云音乐收藏未完成，请重试');}
    }finally{
      if(wyFavoriteController.current===controller){wyFavoriteController.current=null;if(current.current===owner)setBusy(false);}
    }
  }
  async function download(preferredQuality?:Quality){
    if(!track||busy)return;if(!preferredQuality&&track.origin.kind==='online'&&!services.offlineDownloads.find(track)){setChoosingDownload(true);return;}setBusy(true);setError('');const owner=track;
    try{const report=await services.submitDownloads([owner],preferredQuality?{preferredQuality}:undefined);if(current.current===owner){setChoosingDownload(false);setDownloadReport(report);}}
    finally{if(current.current===owner)setBusy(false);}
  }
  const action=(label:string,icon:React.ComponentProps<typeof Ionicons>['name'],run:()=>void,id=label)=><Pressable key={id} testID={`${prefix}-action-${id}`} accessibilityRole="button" accessibilityLabel={label} disabled={busy||sharing} onPress={run} style={[styles.action,{backgroundColor:theme.palette.surface,opacity:busy||sharing?.5:1}]}><Ionicons name={icon} size={controls.icon} color={theme.palette.accent}/><Text style={[typography.body,{color:theme.palette.text,flex:1}]}>{label}</Text><Ionicons name="chevron-forward" size={18} color={theme.palette.secondary}/></Pressable>;
  return <SheetModal visible={!!track} animationType="slide" onRequestClose={onClose}>
    {track&&similar?<SimilarSongs services={services} track={track} renderSongActions={(song,close)=><TrackActions services={services} track={song} prefix="similar" extras onClose={close}/>} onBack={()=>setSimilar(false)} onSelect={(tracks,index)=>{onClose();services.playTracks(tracks,index);}}/>:track&&choosingDownload?<DownloadQualityChoice services={services} track={track} busy={busy} onBack={()=>setChoosingDownload(false)} onConfirm={q=>{void download(q);}}/>:track&&downloadReport?<DownloadSubmissionView services={services} report={downloadReport} backLabel="返回歌曲操作" onClose={()=>setDownloadReport(null)}/>:track&&commenting?<CommentsModal embedded services={services} track={track} onClose={()=>setCommenting(false)}/>:track&&adding?<PlaylistPicker inline services={services} tracks={[track]} visible onClose={onClose}/>:<ScrollView testID={`${prefix}-actions`} style={{backgroundColor:theme.palette.background[0]}} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="收起歌曲更多操作" onPress={onClose} style={styles.close}><Ionicons name="chevron-down" size={26} color={theme.palette.text}/></Pressable>
      <Text accessibilityRole="header" style={[typography.title,{color:theme.palette.text}]}>{track?.title??'歌曲操作'}</Text>
      <Text style={[typography.caption,{color:theme.palette.secondary}]}>{track?.artist}{track?.album?` · ${track.album}`:''}</Text>
      {track&&<View style={styles.actions}>
        {action('下一首','play-skip-forward',()=>{services.addToQueue(track,true);onClose();})}
        {action('加入队列','list',()=>{services.addToQueue(track);onClose();})}
        {action(favorite?'取消本地收藏':'本地收藏',favorite?'heart':'heart-outline',()=>{void saveFavorite();})}
        {qqTrack&&qqAccount&&action('收藏到 QQ 音乐',qqFavoriteState==='added'?'star':'star-outline',()=>{void saveQQFavorite();},'qq-favorite')}
        {wyTrack&&wyAccount&&action('收藏到网易云音乐',wyFavoriteState==='added'?'star':'star-outline',()=>{void saveNeteaseFavorite();},'wy-favorite')}
        {action('加入歌单','albums-outline',()=>setAdding(true))}
        {action('分享歌曲','share-outline',()=>{setError('');void share();})}
        {downloadableTrack(track)&&action('下载','download-outline',()=>{void download();})}
        {supportsSimilarSongs(track)&&action('相似歌曲','radio-outline',()=>setSimilar(true))}
        {extras&&action('歌曲评论','chatbubble-outline',()=>setCommenting(true))}
        {extras&&action('匹配歌曲','search-outline',()=>setMatching(true))}
      </View>}
      {qqTrack&&qqAccounts.length>1&&<Text style={[typography.caption,{color:theme.palette.secondary}]}>已登录多个 QQ 音乐账号，请在设置中只保留一个后再收藏到平台。</Text>}
      {!!qqFavoriteMessage&&<Text testID={`${prefix}-qq-favorite-status`} accessibilityLiveRegion="polite" style={{color:qqFavoriteState==='added'?theme.palette.secondary:theme.palette.accent}}>{qqFavoriteMessage}</Text>}
      {wyTrack&&wyAccounts.length>1&&<Text style={[typography.caption,{color:theme.palette.secondary}]}>已登录多个网易云音乐账号，请在设置中只保留一个后再收藏到平台。</Text>}
      {!!wyFavoriteMessage&&<Text testID={`${prefix}-wy-favorite-status`} accessibilityLiveRegion="polite" style={{color:wyFavoriteState==='added'?theme.palette.secondary:theme.palette.accent}}>{wyFavoriteMessage}</Text>}
      {!!(error||shareError)&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.accent}}>{error||shareError}</Text>}
    </ScrollView>}
    <MatchModal services={services} track={matching?track:null} onClose={()=>setMatching(false)}/>
  </SheetModal>;
}
const styles=StyleSheet.create({content:{padding:space.xxl,paddingTop:space.section,gap:space.lg},close:{minHeight:controls.hit,justifyContent:'center'},actions:{gap:space.md},action:{minHeight:56,paddingHorizontal:space.lg,borderRadius:radius.lg,flexDirection:'row',alignItems:'center',gap:space.md}});
