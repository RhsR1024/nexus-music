import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {AccountDailyError} from '../providers/accountDaily.ts';
import {AccountFmError} from '../providers/accountFm.ts';
import type {MusicAccount} from '../providers/musicAccounts.ts';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';

interface Panel {phase:'idle'|'loading'|'ready'|'empty'|'error';tracks:readonly Track[];message:string;login:boolean}
const idle:Panel={phase:'idle',tracks:[],message:'',login:false};
const LOGIN='登录已失效，请重新登录';

function failure(error:unknown,fallback:string):string {
  if(error instanceof AccountDailyError||error instanceof AccountFmError){
    if(error.kind==='login_required')return LOGIN;
    if(error.kind==='account_changed')return '平台账号已更改，请重试';
    if(error.kind==='cancelled')return '';
    return fallback;
  }
  return error instanceof Error&&/会话|登录/.test(error.message)?LOGIN:fallback;
}

/** NetEase account daily and personal FM. Legacy accounts saved without the
 * newer capabilities still load; no local or public list is shown in their
 * place when the platform call fails. */
export function AccountRecommendations({services,openAccounts}:{services:Services;openAccounts:()=>void}){
  const {palette:p}=useTheme();
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const netease=accounts.filter(item=>item.platform==='wy');
  const [selectedId,setSelectedId]=useState<string|undefined>();
  const account=netease.find(item=>item.id===selectedId)??netease[0];
  const [daily,setDaily]=useState<Panel>(idle),[fm,setFm]=useState<Panel>(idle);
  const dailyAbort=useRef<AbortController|null>(null),fmAbort=useRef<AbortController|null>(null);
  const dailyOp=useRef(0),fmOp=useRef(0);

  async function loadDaily(target:MusicAccount,force:boolean){
    const op=++dailyOp.current,controller=new AbortController();
    dailyAbort.current?.abort();dailyAbort.current=controller;
    setDaily(previous=>({...previous,phase:'loading',message:'',login:false}));
    try{
      const session=await services.musicAccounts.session(target.id);
      const result=await services.accountDaily.fetch(target,session,controller.signal,force);
      if(op!==dailyOp.current||controller.signal.aborted)return;
      setDaily(result.tracks.length?{phase:'ready',tracks:result.tracks,message:'',login:false}:{phase:'empty',tracks:[],message:'今天暂无每日推荐',login:false});
    }catch(error){
      if(op!==dailyOp.current||controller.signal.aborted)return;
      const message=failure(error,'每日推荐暂时不可用，请稍后重试');
      if(!message)return;
      setDaily(previous=>({phase:'error',tracks:message===LOGIN?[]:previous.tracks,message,login:message===LOGIN}));
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

  useEffect(()=>{
    dailyOp.current++;fmOp.current++;
    dailyAbort.current?.abort();fmAbort.current?.abort();
    setDaily(idle);setFm(idle);
    if(account)void loadDaily(account,false);
    return()=>{dailyOp.current++;fmOp.current++;dailyAbort.current?.abort();fmAbort.current?.abort();};
  },[account?.id,account?.updatedAt]);

  const action=(label:string,onPress:()=>void,testID:string,disabled=false)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={{minHeight:44,paddingHorizontal:14,borderRadius:12,backgroundColor:p.selected,alignItems:'center',justifyContent:'center',opacity:disabled?.45:1}}><Text style={{fontSize:13,fontWeight:'600',color:p.accent}}>{label}</Text></Pressable>;
  const refresh=(testID:string,label:string,onPress:()=>void,busy:boolean)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={{width:44,height:44,borderRadius:22,backgroundColor:p.selected,alignItems:'center',justifyContent:'center',opacity:busy?.45:1}}><Ionicons name="refresh" size={20} color={p.accent}/></Pressable>;
  const row=(prefix:string,index:number,track:Track,play:()=>void,extra?:React.ReactNode)=><View key={`${prefix}-${index}`} testID={`${prefix}-track-${index}`} style={{minHeight:58,paddingVertical:8,borderTopWidth:1,borderColor:p.border,flexDirection:'row',alignItems:'center',gap:10}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`播放：${track.title}`} onPress={play} style={{flex:1,minHeight:50,flexDirection:'row',alignItems:'center',gap:12}}><Cover services={services} track={track} size={42}/><View style={{flex:1}}><Text numberOfLines={1} style={{fontSize:15,color:p.text}}>{track.title}</Text><Text numberOfLines={1} style={{fontSize:12,color:p.secondary,marginTop:4}}>{track.artist}{track.album?` · ${track.album}`:''}</Text></View></Pressable>
    {extra}
  </View>;
  const status=(panel:Panel,prefix:string)=><>
    {panel.phase==='loading'&&<View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10}}><ActivityIndicator size="small" color={p.accent}/><Text style={{fontSize:12,color:p.secondary}}>正在读取平台数据…</Text></View>}
    {panel.phase==='error'&&<View style={{gap:8}}><Text testID={`${prefix}-error`} accessibilityRole="alert" style={{fontSize:12,lineHeight:20,color:p.accent}}>{panel.message}</Text>{panel.login&&action('去登录',openAccounts,`${prefix}-login`)}</View>}
    {panel.phase==='empty'&&<Text testID={`${prefix}-empty`} accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:20,color:p.secondary}}>{panel.message}</Text>}
    {panel.message&&panel.phase!=='error'&&panel.phase!=='empty'&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,color:p.secondary}}>{panel.message}</Text>}
  </>;

  return <View testID="account-recommendations" style={{padding:20,marginTop:22,borderWidth:1,borderColor:p.border,borderRadius:18,backgroundColor:p.surface,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <View style={{flex:1}}>
        <Text style={{fontSize:18,fontWeight:'600',color:p.text}}>平台推荐</Text>
        <Text style={{fontSize:12,lineHeight:19,color:p.secondary,marginTop:4}}>{account?`${account.displayName??account.label} · 网易云账号`:'登录网易云音乐后获取账号每日推荐与私人FM；未登录时不展示替代内容。'}</Text>
      </View>
      {account&&refresh('account-daily-refresh','刷新每日推荐',()=>{void loadDaily(account,true);},daily.phase==='loading')}
    </View>
    {netease.length>1&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{netease.map((item,index)=>{const active=item.id===account?.id;return <Pressable key={item.id} testID={`account-recommendations-account-${index}`} accessibilityRole="button" accessibilityState={{selected:active}} accessibilityLabel={`选择网易云账号：${item.displayName??item.label}`} onPress={()=>setSelectedId(item.id)} style={{minHeight:44,paddingHorizontal:14,borderRadius:12,backgroundColor:active?p.selected:p.surface,borderWidth:1,borderColor:active?p.accent:p.border,justifyContent:'center'}}><Text style={{fontSize:13,fontWeight:active?'600':'400',color:active?p.accent:p.secondary}}>{item.displayName??item.label}</Text></Pressable>;})}</View>}
    {!account&&<View><Pressable testID="account-recommendations-login" accessibilityRole="button" accessibilityLabel="登录网易云音乐" onPress={openAccounts} style={{minHeight:46,paddingHorizontal:16,borderRadius:14,backgroundColor:p.accent,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:14,fontWeight:'600',color:'#FFFFFF'}}>去登录</Text></Pressable></View>}
    {account&&<View style={{gap:4}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:6}}><Text style={{fontSize:15,fontWeight:'600',color:p.text}}>每日推荐</Text>{daily.phase==='ready'&&<Text style={{fontSize:11,color:p.secondary}}>共 {daily.tracks.length} 首</Text>}</View>
      {daily.tracks.slice(0,5).map((track,index)=>row('account-daily',index,track,()=>services.playTracks(daily.tracks,index)))}
      {status(daily,'account-daily')}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4}}>
        {daily.tracks.length>0&&action(`播放全部 ${daily.tracks.length} 首`,()=>services.playTracks(daily.tracks,0),'account-daily-play')}
        {daily.phase==='error'&&!daily.login&&action('重试',()=>{void loadDaily(account!,true);},'account-daily-retry')}
      </View>
    </View>}
    {account&&<View style={{gap:4,marginTop:10,paddingTop:10,borderTopWidth:1,borderColor:p.border}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{flex:1}}><Text style={{fontSize:15,fontWeight:'600',color:p.text}}>私人FM</Text><Text style={{fontSize:11,lineHeight:18,color:p.secondary,marginTop:2}}>按账号偏好取一批歌曲；不喜欢会提交到网易云。</Text></View>{fm.phase==='ready'&&refresh('account-fm-refresh','换一批私人FM',()=>{void loadFm(account!,true,false);},false)}</View>
      {fm.tracks.slice(0,5).map((track,index)=>row('account-fm',index,track,()=>{void playFm(account!,index);},<Pressable key={`${track.origin.id}-discard`} testID={`account-fm-discard-${index}`} accessibilityRole="button" accessibilityLabel={`不喜欢：${track.title}`} onPress={()=>{void discardFm(account!,track);}} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="thumbs-down-outline" size={20} color={p.secondary}/></Pressable>))}
      {status(fm,'account-fm')}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4}}>
        <Pressable testID="account-fm-start" accessibilityRole="button" accessibilityLabel="播放私人FM" onPress={()=>{void loadFm(account!,false,true);}} disabled={fm.phase==='loading'} style={{minHeight:46,paddingHorizontal:16,borderRadius:14,backgroundColor:p.accent,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:fm.phase==='loading'?.65:1}}>{fm.phase==='loading'?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="radio-outline" size={20} color="#FFFFFF"/>}<Text style={{fontSize:14,fontWeight:'600',color:'#FFFFFF'}}>{fm.tracks.length?'播放本批私人FM':'播放私人FM'}</Text></Pressable>
        {(fm.phase==='error'||fm.phase==='empty')&&action(fm.phase==='empty'?'换一批':'重试',()=>{void loadFm(account!,true,fm.phase==='empty');},'account-fm-retry')}
      </View>
    </View>}
  </View>;
}
