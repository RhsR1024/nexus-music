import {useSongShare} from './useSongShare.ts';
import {SimilarSongs} from './SimilarSongs.tsx';
import {supportsSimilarSongs} from '../providers/similarSongs.ts';
import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {Cover} from './Cover.tsx';
import {CommentsModal} from './CommentsModal.tsx';
import {MatchModal} from './MatchModal.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {PlatformPlaylistUpdate,type PlatformPlaylistOperation} from './PlatformPlaylistUpdate.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,sollinTokens,space,typography} from './tokens.ts';
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
export interface AdditionalTrackAction {id:string;label:string;icon:React.ComponentProps<typeof Ionicons>['name'];run:()=>void|Promise<void>}
export function TrackActions({services,track,onClose,prefix,extras=false,additionalActions=[],favoriteScope='song',closeLabel='收起歌曲更多操作'}:{
  services:Services;track:Track|null;onClose:()=>void;prefix:string;
  extras?:boolean;additionalActions?:readonly AdditionalTrackAction[];favoriteScope?:'song'|'library';closeLabel?:string;
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),{share,sharing,error:shareError}=useSongShare(track);
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
  const [platformEditing,setPlatformEditing]=useState<PlatformPlaylistOperation|null>(null);
  const [wyPlaylistMessage,setWYPlaylistMessage]=useState('');
  const wyFavoriteController=useRef<AbortController|null>(null);
  useEffect(()=>{
    setSimilar(false);setAdding(false);setCommenting(false);setMatching(false);setError('');setDownloadReport(null);setChoosingDownload(false);setBusy(false);
    setQQFavoriteState('idle');setQQFavoriteMessage('');qqFavoriteController.current?.abort();qqFavoriteController.current=null;
    setWYFavoriteState('idle');setWYFavoriteMessage('');wyFavoriteController.current?.abort();wyFavoriteController.current=null;
    setPlatformEditing(null);setWYPlaylistMessage('');
  },[track]);
  const current=useRef(track);current.current=track;
  const session=useRef(0);
  useLayoutEffect(()=>{session.current++;return()=>{session.current++;};},[track]);
  const owns=(owner:Track|null,epoch:number)=>current.current===owner&&session.current===epoch;
  function close(){session.current++;qqFavoriteController.current?.abort();wyFavoriteController.current?.abort();setPlatformEditing(null);onClose();}
  useEffect(()=>()=>{current.current=null;qqFavoriteController.current?.abort();qqFavoriteController.current=null;wyFavoriteController.current?.abort();wyFavoriteController.current=null;},[]);
  const favorite=track?(favoriteScope==='library'?services.library.isFavorite(track):services.songFavorites.isFavorite(track)):false;
  const qqTrack=track?.origin.kind==='online'&&track.origin.platform==='tx'?track:null;
  const qqAccounts=accounts.filter(account=>account.platform==='tx');
  const qqAccount=qqAccounts.length===1?qqAccounts[0]:undefined;
  const wyTrack=track?.origin.kind==='online'&&track.origin.platform==='wy'?track:null;
  const wyAccounts=accounts.filter(account=>account.platform==='wy');
  const wyAccount=wyAccounts.length===1?wyAccounts[0]:undefined;
  async function saveFavorite(){
    if(!track||busy)return;const epoch=session.current;setBusy(true);setError('');
    try{await (favoriteScope==='library'?services.library.favorite(track):services.songFavorites.toggle(track));if(owns(track,epoch))close();}
    catch{if(owns(track,epoch))setError('收藏未保存，原数据保留；请重试');}
    finally{if(owns(track,epoch))setBusy(false);}
  }
  async function saveQQFavorite(){
    if(!qqTrack||!qqAccount||busy)return;
    const owner=qqTrack,account=qqAccount,controller=new AbortController(),epoch=session.current;
    qqFavoriteController.current?.abort();qqFavoriteController.current=controller;
    setBusy(true);setError('');setQQFavoriteState('pending');setQQFavoriteMessage('正在确认 QQ 音乐收藏…');
    try{
      const session=await services.musicAccounts.session(account.id);
      if(controller.signal.aborted||!owns(owner,epoch))return;
      const result=await services.qqFavorite.add(account,session,owner.origin.kind==='online'?owner.origin.id:'',controller.signal);
      if(controller.signal.aborted||!owns(owner,epoch))return;
      if(result.status==='added'||result.status==='already'){
        setQQFavoriteState('added');setQQFavoriteMessage('已收藏到 QQ 音乐');
      }else{
        setQQFavoriteState('idle');setQQFavoriteMessage(qqFavoriteCopy(result.status));
      }
    }catch{
      if(!controller.signal.aborted&&owns(owner,epoch)){setQQFavoriteState('idle');setQQFavoriteMessage('QQ 音乐收藏未完成，请重试');}
    }finally{
      if(qqFavoriteController.current===controller){qqFavoriteController.current=null;if(owns(owner,epoch))setBusy(false);}
    }
  }
  async function saveNeteaseFavorite(){
    if(!wyTrack||!wyAccount||busy)return;
    const owner=wyTrack,account=wyAccount,controller=new AbortController(),epoch=session.current;
    wyFavoriteController.current?.abort();wyFavoriteController.current=controller;
    setBusy(true);setError('');setWYFavoriteState('pending');setWYFavoriteMessage('正在确认网易云音乐收藏…');
    try{
      const session=await services.musicAccounts.session(account.id);
      if(controller.signal.aborted||!owns(owner,epoch))return;
      const result=await services.neteaseFavorite.add(account,session,owner.origin.kind==='online'?owner.origin.id:'',controller.signal);
      if(controller.signal.aborted||!owns(owner,epoch))return;
      if(result.status==='added'||result.status==='already'){
        setWYFavoriteState('added');setWYFavoriteMessage('已收藏到网易云音乐');
      }else{
        setWYFavoriteState('idle');setWYFavoriteMessage(neteaseFavoriteCopy(result.status));
      }
    }catch{
      if(!controller.signal.aborted&&owns(owner,epoch)){setWYFavoriteState('idle');setWYFavoriteMessage('网易云音乐收藏未完成，请重试');}
    }finally{
      if(wyFavoriteController.current===controller){wyFavoriteController.current=null;if(owns(owner,epoch))setBusy(false);}
    }
  }
  async function download(preferredQuality?:Quality){
    if(!track||busy)return;if(!preferredQuality&&track.origin.kind==='online'&&!services.offlineDownloads.find(track)){setChoosingDownload(true);return;}setBusy(true);setError('');const owner=track,epoch=session.current;
    try{const report=await services.submitDownloads([owner],preferredQuality?{preferredQuality}:undefined);if(owns(owner,epoch)){setChoosingDownload(false);setDownloadReport(report);}}
    catch{if(owns(owner,epoch))setError('下载提交未完成，请查看下载管理中的已有任务');}
    finally{if(owns(owner,epoch))setBusy(false);}
  }
  async function runAdditional(item:AdditionalTrackAction){
    if(!track||busy)return;const owner=track,epoch=session.current;setBusy(true);setError('');
    try{await item.run();if(owns(owner,epoch))close();}
    catch{if(owns(owner,epoch))setError('操作未保存，原数据保留；请重试');}
    finally{if(owns(owner,epoch))setBusy(false);}
  }
  const action=(label:string,icon:React.ComponentProps<typeof Ionicons>['name'],run:()=>void,id=label)=><Pressable key={id} testID={`${prefix}-action-${id}`} accessibilityRole="button" accessibilityLabel={label} disabled={busy||sharing} onPress={run} style={[styles.action,{borderBottomColor:s.hairline,opacity:busy||sharing?.5:1}]}><View style={[styles.iconBadge,{backgroundColor:s.accentSoft}]}><Ionicons name={icon} size={18} color={s.accent}/></View><Text style={{color:s.ink,fontSize:15,fontWeight:'500',flex:1}}>{label}</Text><Ionicons name="chevron-forward" size={16} color={s.subtle}/></Pressable>;
  return <SheetModal visible={!!track} animationType="slide" onRequestClose={close}>
    {track&&similar?<SimilarSongs services={services} track={track} renderSongActions={(song,close)=><TrackActions services={services} track={song} prefix="similar" extras onClose={close}/>} onBack={()=>setSimilar(false)} onSelect={(tracks,index)=>{close();services.playTracks(tracks,index);}}/>:track&&choosingDownload?<DownloadQualityChoice services={services} track={track} busy={busy} onBack={()=>setChoosingDownload(false)} onConfirm={q=>{void download(q);}}/>:track&&downloadReport?<DownloadSubmissionView services={services} report={downloadReport} backLabel="返回歌曲操作" onClose={()=>setDownloadReport(null)}/>:track&&commenting?<CommentsModal embedded services={services} track={track} onClose={()=>setCommenting(false)}/>:track&&platformEditing&&wyAccount?<PlatformPlaylistUpdate services={services} track={track} account={wyAccount} operation={platformEditing} onBack={()=>setPlatformEditing(null)} onUpdated={(title,unchanged,operation)=>{setWYPlaylistMessage(operation==='add'?(unchanged?`这首歌已在「${title}」中`:`已添加到「${title}」`):(unchanged?`这首歌不在「${title}」中`:`已从「${title}」移除`));setPlatformEditing(null);}}/>:track&&adding?<PlaylistPicker inline services={services} tracks={[track]} visible onClose={close}/>:<View style={{flex:1,backgroundColor:s.sheetGradient[0]}}>
      <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
      <ScrollView testID={`${prefix}-actions`} contentContainerStyle={styles.content}>
      <View style={{alignItems:'center'}}><Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={close} style={styles.close}><View style={{width:36,height:4,borderRadius:2,backgroundColor:s.subtle+'66'}}/></Pressable></View>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        {track&&<Cover services={services} track={track} size={52} radius={11}/>}
        <View style={{flex:1,gap:2}}>
          <Text accessibilityRole="header" numberOfLines={2} style={{fontSize:19,fontWeight:'700',color:s.ink}}>{track?.title??'歌曲操作'}</Text>
          <Text numberOfLines={1} style={{fontSize:13,color:s.muted}}>{track?.artist}{track?.album?` · ${track.album}`:''}</Text>
        </View>
      </View>
      {track&&<View style={[styles.actions,{backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}]}>
        {action('下一首','play-skip-forward',()=>{services.addToQueue(track,true);close();})}
        {action('加入队列','list',()=>{services.addToQueue(track);close();})}
        {action(favorite?'取消本地收藏':'本地收藏',favorite?'heart':'heart-outline',()=>{void saveFavorite();})}
        {qqTrack&&qqAccount&&action('收藏到 QQ 音乐',qqFavoriteState==='added'?'star':'star-outline',()=>{void saveQQFavorite();},'qq-favorite')}
        {wyTrack&&wyAccount&&action('收藏到网易云音乐',wyFavoriteState==='added'?'star':'star-outline',()=>{void saveNeteaseFavorite();},'wy-favorite')}
        {wyTrack&&wyAccount&&action('添加到网易云歌单','add-circle-outline',()=>{setWYPlaylistMessage('');setPlatformEditing('add');},'wy-playlist')}
        {wyTrack&&wyAccount&&action('从网易云歌单移除','remove-circle-outline',()=>{setWYPlaylistMessage('');setPlatformEditing('remove');},'wy-playlist-remove')}
        {action('加入歌单','albums-outline',()=>setAdding(true))}
        {action('分享歌曲','share-outline',()=>{setError('');void share();})}
        {downloadableTrack(track)&&action('下载','download-outline',()=>{void download();})}
        {supportsSimilarSongs(track)&&action('相似歌曲','radio-outline',()=>setSimilar(true))}
        {extras&&action('歌曲评论','chatbubble-outline',()=>setCommenting(true))}
        {extras&&(track.origin.kind==='online'||track.origin.kind==='imported')&&action('匹配歌曲','search-outline',()=>setMatching(true))}
        {additionalActions.map(item=>action(item.label,item.icon,()=>{void runAdditional(item);},item.id))}
      </View>}
      {qqTrack&&qqAccounts.length>1&&<Text style={[typography.caption,{color:s.muted}]}>已登录多个 QQ 音乐账号，请在设置中只保留一个后再收藏到平台。</Text>}
      {!!qqFavoriteMessage&&<Text testID={`${prefix}-qq-favorite-status`} accessibilityLiveRegion="polite" style={{color:qqFavoriteState==='added'?s.muted:s.accent}}>{qqFavoriteMessage}</Text>}
      {wyTrack&&wyAccounts.length>1&&<Text style={[typography.caption,{color:s.muted}]}>已登录多个网易云音乐账号，请在设置中只保留一个后再收藏或添加平台歌单。</Text>}
      {!!wyFavoriteMessage&&<Text testID={`${prefix}-wy-favorite-status`} accessibilityLiveRegion="polite" style={{color:wyFavoriteState==='added'?s.muted:s.accent}}>{wyFavoriteMessage}</Text>}
      {!!wyPlaylistMessage&&<Text testID={`${prefix}-wy-playlist-status`} accessibilityLiveRegion="polite" style={{color:s.muted}}>{wyPlaylistMessage}</Text>}
      {!!(error||shareError)&&<Text accessibilityLiveRegion="polite" style={{color:s.accent}}>{error||shareError}</Text>}
    </ScrollView></View>}
    <MatchModal services={services} track={matching?track:null} onClose={()=>setMatching(false)}/>
  </SheetModal>;
}
const styles=StyleSheet.create({content:{paddingHorizontal:18,paddingTop:10,paddingBottom:36,gap:14},close:{minWidth:80,minHeight:28,alignItems:'center',justifyContent:'center'},actions:{borderRadius:20,overflow:'hidden'},action:{minHeight:54,paddingHorizontal:14,borderBottomWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',gap:12},iconBadge:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'}});
