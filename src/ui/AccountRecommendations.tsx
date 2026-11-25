import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {type DailyRecommendationKind} from '../providers/accountDaily.ts';
import type {AccountRecommendedPlaylist} from '../providers/accountRecommendedPlaylists.ts';
import {accountRecommendationFailure as failure,ACCOUNT_LOGIN_REQUIRED as LOGIN} from './accountRecommendationFailure.ts';
import type {MusicAccount} from '../providers/musicAccounts.ts';
import {Cover} from './Cover.tsx';
import {Discovery} from './Discovery.tsx';
import {AccountTrackListModal} from './AccountTrackListModal.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

interface Panel {phase:'idle'|'loading'|'ready'|'empty'|'error';tracks:readonly Track[];message:string;login:boolean;kind?:DailyRecommendationKind}
interface PlaylistPanel {phase:'idle'|'loading'|'ready'|'empty'|'error';items:readonly AccountRecommendedPlaylist[];message:string;login:boolean}
type StatusPanel=Pick<Panel,'phase'|'message'|'login'>;
const idle:Panel={phase:'idle',tracks:[],message:'',login:false};
const idlePlaylists:PlaylistPanel={phase:'idle',items:[],message:'',login:false};
/** Platform daily / QQ radar and NetEase personal FM. Legacy accounts saved without the
 * newer capabilities still load; no local or public list is shown in their
 * place when the platform call fails. */
export function AccountRecommendations({services,openAccounts}:{services:Services;openAccounts:()=>void}){
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const supported=accounts.filter(item=>item.platform==='wy'||item.platform==='kg'||item.platform==='tx');
  const [selectedId,setSelectedId]=useState<string|undefined>();
  const account=supported.find(item=>item.id===selectedId)??supported[0];
  const [daily,setDaily]=useState<Panel>(idle),[fm,setFm]=useState<Panel>(idle);
  const [heartbeat,setHeartbeat]=useState<Panel>(idle);
  const [playlists,setPlaylists]=useState<PlaylistPanel>(idlePlaylists);
  const [playlistOpen,setPlaylistOpen]=useState<AccountRecommendedPlaylist|null>(null);
  const [dailyOpen,setDailyOpen]=useState(false);
  const dailyAbort=useRef<AbortController|null>(null),fmAbort=useRef<AbortController|null>(null),playlistAbort=useRef<AbortController|null>(null),heartbeatAbort=useRef<AbortController|null>(null);
  const dailyOp=useRef(0),fmOp=useRef(0),playlistOp=useRef(0),heartbeatOp=useRef(0);
  const dailyName=account?.platform==='tx'&&daily.kind!=='tx_official_daily'?'私人雷达':'每日推荐';
  const playlistSupported=account?.platform==='wy'||account?.platform==='tx';
  const currentTrack=playback.queue.entries.find(entry=>entry.id===playback.queue.currentId)?.track;

  async function loadDaily(target:MusicAccount,force:boolean){
    const op=++dailyOp.current,controller=new AbortController();
    dailyAbort.current?.abort();dailyAbort.current=controller;
    setDaily(previous=>({...previous,phase:'loading',message:'',login:false}));
    try{
      const session=await services.musicAccounts.session(target.id);
      const result=await services.accountDaily.fetch(target,session,controller.signal,force);
      if(op!==dailyOp.current||controller.signal.aborted)return;
      setDaily(result.tracks.length?{phase:'ready',tracks:result.tracks,message:result.reason==='official_unavailable'?'官方每日推荐暂时不可用，当前显示私人雷达':'',login:false,kind:result.kind}:{phase:'empty',tracks:[],message:result.kind==='tx_radar'?`${result.reason==='official_unavailable'?'官方每日推荐暂时不可用；':''}私人雷达暂时没有返回歌曲`:'今天暂无每日推荐',login:false,kind:result.kind});
    }catch(error){
      if(op!==dailyOp.current||controller.signal.aborted)return;
      const message=failure(error,'每日推荐暂时不可用，请稍后重试');
      if(!message)return;
      setDaily(previous=>({...previous,phase:'error',tracks:message===LOGIN?[]:previous.tracks,message,login:message===LOGIN}));
    }
  }

  async function loadPlaylists(target:MusicAccount,force:boolean){
    if(target.platform!=='wy'&&target.platform!=='tx')return;
    const op=++playlistOp.current,controller=new AbortController();
    playlistAbort.current?.abort();playlistAbort.current=controller;
    setPlaylists(previous=>({...previous,phase:'loading',message:'',login:false}));
    try{
      const session=await services.musicAccounts.session(target.id);
      const items=await services.accountRecommendedPlaylists.list(target,session,controller.signal,force);
      if(op!==playlistOp.current||controller.signal.aborted)return;
      setPlaylists(items.length?{phase:'ready',items,message:'',login:false}:{phase:'empty',items:[],message:'暂无推荐歌单',login:false});
    }catch(error){
      if(op!==playlistOp.current||controller.signal.aborted)return;
      const message=failure(error,'推荐歌单暂时不可用，请稍后重试');
      if(!message)return;
      setPlaylists(previous=>({...previous,phase:'error',items:message===LOGIN?[]:previous.items,message,login:message===LOGIN}));
    }
  }

  async function loadFm(target:MusicAccount,force:boolean,play:boolean){
    const op=++fmOp.current,controller=new AbortController();
    fmAbort.current?.abort();fmAbort.current=controller;
    setFm(previous=>({...previous,phase:'loading',message:'',login:false}));
    try{
      const session=await services.musicAccounts.session(target.id);
      const tracks=await services.accountFm.load(target,session,controller.signal,force);
      if(op!==fmOp.current||controller.signal.aborted)return;
      if(!tracks.length){setFm({phase:'empty',tracks:[],message:'私人FM暂时没有返回歌曲，请稍后重试',login:false});return;}
      setFm({phase:'ready',tracks,message:'',login:false});
      if(play)await services.accountFmStation.start(target,session,tracks,0,controller.signal);
    }catch(error){
      if(op!==fmOp.current||controller.signal.aborted)return;
      const message=failure(error,'私人FM暂时不可用，请稍后重试');
      if(!message)return;
      setFm(previous=>({phase:'error',tracks:message===LOGIN?[]:previous.tracks,message,login:message===LOGIN}));
    }
  }

  async function playFm(target:MusicAccount,index:number){
    const op=++fmOp.current,controller=new AbortController();
    fmAbort.current?.abort();fmAbort.current=controller;
    try{
      const session=await services.musicAccounts.session(target.id);
      if(op!==fmOp.current||controller.signal.aborted)return;
      await services.accountFmStation.start(target,session,fm.tracks,index,controller.signal);
    }catch(error){
      if(op!==fmOp.current||controller.signal.aborted)return;
      const message=failure(error,'私人FM暂时不可用，请稍后重试');
      if(message)setFm(previous=>({...previous,message,login:message===LOGIN}));
    }
  }

  async function discardFm(target:MusicAccount,track:Track){
    if(track.origin.kind!=='online')return;
    const op=++fmOp.current,controller=new AbortController();
    fmAbort.current?.abort();fmAbort.current=controller;
    setFm(previous=>({...previous,message:'正在提交不喜欢…'}));
    try{
      const session=await services.musicAccounts.session(target.id);
      await services.accountFm.discard(target,session,track.origin.id,controller.signal);
      if(op!==fmOp.current||controller.signal.aborted)return;
      setFm(previous=>{
        const tracks=previous.tracks.filter(item=>item.origin.id!==track.origin.id);
        return tracks.length?{...previous,tracks,phase:'ready',message:'已提交不喜欢'}:{...previous,tracks,phase:'empty',message:'已提交不喜欢；当前批次已空，可换一批'};
      });
    }catch(error){
      if(op!==fmOp.current||controller.signal.aborted)return;
      const message=failure(error,'未能提交不喜欢，请稍后重试');
      if(message)setFm(previous=>({...previous,message,login:message===LOGIN}));
    }
  }

  async function startHeartbeat(target:MusicAccount){
    if(target.platform!=='wy')return;
    const op=++heartbeatOp.current,controller=new AbortController();
    heartbeatAbort.current?.abort();heartbeatAbort.current=controller;
    setHeartbeat(previous=>({...previous,phase:'loading',message:'',login:false}));
    try{
      const session=await services.musicAccounts.session(target.id);
      const state=services.playback.controller.getSnapshot();
      const current=state.queue.entries.find(entry=>entry.id===state.queue.currentId)?.track;
      const result=await services.accountHeartbeat.start(target,session,current,controller.signal);
      if(op!==heartbeatOp.current||controller.signal.aborted)return;
      services.playTracks(result.tracks,0);
      setHeartbeat({phase:'ready',tracks:result.tracks,message:result.source==='current'?'已从当前歌曲开启心动模式':'已使用“我喜欢的音乐”开启心动模式',login:false});
    }catch(error){
      if(op!==heartbeatOp.current||controller.signal.aborted)return;
      const message=failure(error,'心动模式暂时不可用，请稍后重试');
      if(!message)return;
      setHeartbeat(previous=>({...previous,phase:'error',tracks:message===LOGIN?[]:previous.tracks,message:message===LOGIN?message:`心动模式开启失败：${message}`,login:message===LOGIN}));
    }
  }

  useLayoutEffect(()=>{
    dailyOp.current++;fmOp.current++;playlistOp.current++;heartbeatOp.current++;
    dailyAbort.current?.abort();fmAbort.current?.abort();playlistAbort.current?.abort();heartbeatAbort.current?.abort();
    setDaily(idle);setFm(idle);setHeartbeat(idle);setPlaylists(idlePlaylists);setDailyOpen(false);setPlaylistOpen(null);
    if(account){void loadDaily(account,false);if(account.platform==='wy'||account.platform==='tx')void loadPlaylists(account,false);}
    return()=>{dailyOp.current++;fmOp.current++;playlistOp.current++;heartbeatOp.current++;dailyAbort.current?.abort();fmAbort.current?.abort();playlistAbort.current?.abort();heartbeatAbort.current?.abort();};
  },[account]);
  useEffect(()=>{
    if(daily.phase==='idle'||daily.phase==='empty'||!daily.tracks.length)setDailyOpen(false);
  },[daily.phase,daily.tracks.length]);

  const action=(label:string,onPress:()=>void,testID:string,disabled=false)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={{minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:s.accentSoft,borderWidth:1,borderColor:s.cardBorder,alignItems:'center',justifyContent:'center',opacity:disabled?.45:1}}><Text style={{fontSize:13,fontWeight:'600',color:s.control}}>{label}</Text></Pressable>;
  const refresh=(testID:string,label:string,onPress:()=>void,busy:boolean)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={{width:38,height:38,borderRadius:19,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:busy?.45:1}}><Ionicons name="refresh" size={18} color={s.control}/></Pressable>;
  const row=(prefix:string,index:number,track:Track,play:()=>void,extra?:React.ReactNode)=><View key={`${prefix}-${index}`} testID={`${prefix}-track-${index}`} style={{minHeight:54,paddingVertical:7,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline,flexDirection:'row',alignItems:'center',gap:10}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`播放：${track.title}`} onPress={play} style={{flex:1,minHeight:46,flexDirection:'row',alignItems:'center',gap:11}}><Cover services={services} track={track} size={42} radius={9}/><View style={{flex:1}}><Text numberOfLines={1} style={{fontSize:14,fontWeight:'600',color:s.ink}}>{track.title}</Text><Text numberOfLines={1} style={{fontSize:12,color:s.muted,marginTop:2}}>{track.artist}{track.album?` · ${track.album}`:''}</Text></View></Pressable>
    {extra}
  </View>;
  const status=(panel:StatusPanel,prefix:string)=><>
    {panel.phase==='loading'&&<View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8}}><ActivityIndicator size="small" color={s.accent}/><Text style={{fontSize:12,color:s.muted}}>正在读取平台数据…</Text></View>}
    {panel.phase==='error'&&<View style={{gap:8}}><Text testID={`${prefix}-error`} accessibilityRole="alert" style={{fontSize:12,lineHeight:19,color:s.accent}}>{panel.message}</Text>{panel.login&&action('去登录',openAccounts,`${prefix}-login`)}</View>}
    {panel.phase==='empty'&&<Text testID={`${prefix}-empty`} accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:19,color:s.muted}}>{panel.message}</Text>}
    {panel.message&&panel.phase!=='error'&&panel.phase!=='empty'&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,color:s.muted}}>{panel.message}</Text>}
  </>;

  return <View testID="account-recommendations" style={{padding:14,borderWidth:1,borderColor:s.cardBorder,borderRadius:20,backgroundColor:s.card,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <View style={{flex:1}}>
        <Text style={{fontSize:17,fontWeight:'700',color:s.ink}}>平台推荐</Text>
        <Text style={{fontSize:12,lineHeight:18,color:s.muted,marginTop:2}}>{account?`${account.displayName??account.label} · ${account.platform==='kg'?'酷狗':account.platform==='tx'?'QQ 音乐':'网易云'}账号`:'登录网易云、QQ 音乐或酷狗获取每日推荐、推荐歌单与私人 FM。'}</Text>
      </View>
      {account&&refresh('account-daily-refresh',`刷新${dailyName}`,()=>{void loadDaily(account,true);},daily.phase==='loading')}
    </View>
    {supported.length>1&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{supported.map((item,index)=>{const active=item.id===account?.id;return <Pressable key={item.id} testID={`account-recommendations-account-${index}`} accessibilityRole="button" accessibilityState={{selected:active}} accessibilityLabel={`选择${item.platform==='kg'?'酷狗':item.platform==='tx'?'QQ 音乐':'网易云'}账号：${item.displayName??item.label}`} onPress={()=>setSelectedId(item.id)} style={{minHeight:38,paddingHorizontal:13,borderRadius:19,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder,justifyContent:'center'}}><Text style={{fontSize:13,fontWeight:'600',color:active?'#FFFFFF':s.muted}}>{item.platform==='tx'?'QQ':item.platform==='kg'?'酷狗':'网易云'} · {item.displayName??item.label}</Text></Pressable>;})}</View>}
    {!account&&<View style={{alignSelf:'flex-start'}}><Pressable testID="account-recommendations-login" accessibilityRole="button" accessibilityLabel="登录音乐账号" onPress={openAccounts} style={{minHeight:42,paddingHorizontal:20,borderRadius:21,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6}}><Ionicons name="person-add-outline" size={16} color="#FFFFFF"/><Text style={{fontSize:14,fontWeight:'600',color:'#FFFFFF'}}>去登录</Text></Pressable></View>}
    {account&&<View style={{gap:4}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4}}><Text style={{fontSize:15,fontWeight:'700',color:s.ink}}>{dailyName}</Text>{daily.phase==='ready'&&<Text style={{fontSize:11,color:s.muted}}>共 {daily.tracks.length} 首</Text>}</View>
      {daily.tracks.slice(0,5).map((track,index)=>row('account-daily',index,track,()=>services.playTracks(daily.tracks,index)))}
      {status(daily,'account-daily')}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4}}>
        {daily.tracks.length>0&&action(`播放全部 ${daily.tracks.length} 首`,()=>services.playTracks(daily.tracks,0),'account-daily-play')}
        {daily.tracks.length>5&&action(`查看全部 ${daily.tracks.length} 首`,()=>setDailyOpen(true),'account-daily-open')}
        {daily.phase==='error'&&!daily.login&&action('重试',()=>{void loadDaily(account!,true);},'account-daily-retry')}
      </View>
    </View>}
    {account&&playlistSupported&&<View testID="account-playlists" style={{gap:8,marginTop:6,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View style={{flex:1}}><Text style={{fontSize:15,fontWeight:'700',color:s.ink}}>推荐歌单</Text><Text testID="account-playlists-account" style={{fontSize:11,lineHeight:17,color:s.muted,marginTop:2}}>{account.platform==='tx'?'来自当前 QQ 音乐账号':'来自当前网易云账号'}</Text></View>
        {refresh('account-playlists-refresh','刷新推荐歌单',()=>{void loadPlaylists(account,true);},playlists.phase==='loading')}
      </View>
      {playlists.phase==='ready'&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,paddingVertical:4}}>
        {playlists.items.map((item,index)=><Pressable key={`${item.platform}:${item.id}`} testID={`account-playlist-${index}`} accessibilityRole="button" accessibilityLabel={`打开推荐歌单：${item.title}${item.author?`，${item.author}`:''}`} onPress={()=>setPlaylistOpen(item)} style={{width:124,gap:6}}>
          <Cover services={services} url={item.artwork} size={124} radius={13}/>
          <Text numberOfLines={2} style={{fontSize:13,lineHeight:17,fontWeight:'600',color:s.ink}}>{item.title}</Text>
          <Text numberOfLines={1} style={{fontSize:11,color:s.muted}}>{item.count!==undefined?`${item.count} 首`:'平台推荐'} {item.author?`· ${item.author}`:''}</Text>
        </Pressable>)}
      </ScrollView>}
      {status(playlists,'account-playlists')}
      {playlists.phase==='error'&&!playlists.login&&action('重试',()=>{void loadPlaylists(account,true);},'account-playlists-retry')}
    </View>}
    {account?.platform==='wy'&&<View style={{gap:4,marginTop:6,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{flex:1}}><Text style={{fontSize:15,fontWeight:'700',color:s.ink}}>私人FM</Text><Text style={{fontSize:11,lineHeight:17,color:s.muted,marginTop:2}}>按账号偏好取一批歌曲；不喜欢会提交到网易云。</Text></View>{fm.phase==='ready'&&refresh('account-fm-refresh','换一批私人FM',()=>{void loadFm(account!,true,false);},false)}</View>
      {fm.tracks.slice(0,5).map((track,index)=>row('account-fm',index,track,()=>{void playFm(account!,index);},<Pressable key={`${track.origin.id}-discard`} testID={`account-fm-discard-${index}`} accessibilityRole="button" accessibilityLabel={`不喜欢：${track.title}`} onPress={()=>{void discardFm(account!,track);}} style={{width:40,height:40,alignItems:'center',justifyContent:'center'}}><Ionicons name="thumbs-down-outline" size={18} color={s.muted}/></Pressable>))}
      {status(fm,'account-fm')}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4}}>
        <Pressable testID="account-fm-start" accessibilityRole="button" accessibilityLabel="播放私人FM" onPress={()=>{void loadFm(account!,false,true);}} disabled={fm.phase==='loading'} style={{minHeight:42,paddingHorizontal:16,borderRadius:21,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:fm.phase==='loading'?.65:1}}>{fm.phase==='loading'?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="radio-outline" size={18} color="#FFFFFF"/>}<Text style={{fontSize:14,fontWeight:'600',color:'#FFFFFF'}}>{fm.tracks.length?'播放本批私人FM':'播放私人FM'}</Text></Pressable>
        {(fm.phase==='error'||fm.phase==='empty')&&action(fm.phase==='empty'?'换一批':'重试',()=>{void loadFm(account!,true,fm.phase==='empty');},'account-fm-retry')}
      </View>
    </View>}
    {account?.platform==='wy'&&<View testID="account-heartbeat" style={{gap:8,marginTop:6,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
      <View><Text style={{fontSize:15,fontWeight:'700',color:s.ink}}>心动模式</Text><Text style={{fontSize:11,lineHeight:17,color:s.muted,marginTop:2}}>智能推荐队列 · {currentTrack?`当前歌曲：${currentTrack.title}`:'从“我喜欢的音乐”随机选择种子。'}</Text></View>
      {heartbeat.phase==='loading'&&<View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4}}><ActivityIndicator size="small" color={s.accent}/><Text style={{fontSize:12,color:s.muted}}>正在根据喜欢歌曲构建心动队列…</Text></View>}
      {heartbeat.phase==='error'&&<Text testID="account-heartbeat-error" accessibilityRole="alert" style={{fontSize:12,lineHeight:19,color:s.accent}}>{heartbeat.message}</Text>}
      {heartbeat.phase==='ready'&&<><Text testID="account-heartbeat-message" accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:19,color:s.muted}}>{heartbeat.message}</Text><Text testID="account-heartbeat-summary" style={{fontSize:11,lineHeight:17,color:s.muted}}>已加入 {heartbeat.tracks.length} 首，种子：{heartbeat.tracks[0]?.title??'未知歌曲'}</Text></>}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        <Pressable testID="account-heartbeat-start" accessibilityRole="button" accessibilityLabel="开启心动模式" onPress={()=>{void startHeartbeat(account!);}} disabled={heartbeat.phase==='loading'} style={{minHeight:42,paddingHorizontal:16,borderRadius:21,backgroundColor:s.accent,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:heartbeat.phase==='loading'?.65:1}}>{heartbeat.phase==='loading'?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="heart" size={17} color="#FFFFFF"/>}<Text style={{fontSize:14,fontWeight:'600',color:'#FFFFFF'}}>{heartbeat.phase==='ready'?'重新开启心动模式':'开启心动模式'}</Text></Pressable>
        {heartbeat.phase==='error'&&!heartbeat.login&&action('重试',()=>{void startHeartbeat(account!);},'account-heartbeat-retry')}
        {heartbeat.phase==='error'&&heartbeat.login&&action('去登录',openAccounts,'account-heartbeat-login')}
      </View>
    </View>}
    {account&&<AccountTrackListModal services={services} tracks={daily.tracks} title={dailyName} subtitle={`${account.displayName??account.label} · ${daily.kind==='tx_official_daily'?'QQ 音乐官方每日推荐':daily.kind==='tx_radar'?'QQ 音乐私人雷达':daily.kind==='kugou_daily'?'酷狗每日推荐':'网易云每日推荐'} · 按平台返回顺序`} note={daily.message} visible={dailyOpen} onClose={()=>setDailyOpen(false)} prefix="account-daily" selectionEnabled={daily.kind==='tx_radar'}/>}
    {playlistOpen&&<Discovery key={`${playlistOpen.platform}:${playlistOpen.id}`} services={services} initialCollection={{platform:playlistOpen.platform,collection:playlistOpen,returnLabel:'返回平台推荐'}} onClose={()=>setPlaylistOpen(null)}/>}
  </View>;
}
