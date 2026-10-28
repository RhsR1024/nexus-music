import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AppState,Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {MusicAccount} from '../providers/musicAccounts.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';

export function QQDailyAuthorizationCard({services,active,disabled}:{services:Services;active:boolean;disabled:boolean}){
  const {palette:p}=useTheme(),auth=useSyncExternalStore(services.qqDailyAuthorization.subscribe,services.qqDailyAuthorization.getSnapshot);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const [error,setError]=useState(''),[clearing,setClearing]=useState(false),[showResult,setShowResult]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const cancel=()=>{controller.current?.abort();services.qqDailyAuthorization.cancel();};
  useLayoutEffect(()=>{if(!active)cancel();},[active,services]);
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{if(state!=='active')cancel();});return()=>{subscription.remove();cancel();};},[services]);
  const busy=auth.status==='waiting'||clearing;
  const authorize=(account?:MusicAccount)=>{setShowResult(true);setError('');void services.qqDailyAuthorization.authorize(account).catch(()=>{});};
  const clear=async(account:MusicAccount)=>{
    setShowResult(false);controller.current?.abort();const next=new AbortController();controller.current=next;setClearing(true);setError('');
    try{await services.qqDailyAuthorization.clear(account,next.signal);}catch{if(!next.signal.aborted)setError('未能移除日推授权，请重试');}
    finally{if(controller.current===next){controller.current=null;setClearing(false);}}
  };
  const button=(label:string,id:string,run:()=>void)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={run} disabled={disabled||busy} style={{minHeight:controls.hit,paddingHorizontal:space.md,borderRadius:radius.md,backgroundColor:p.selected,justifyContent:'center',opacity:disabled||busy?.5:1}}><Text style={{...typography.caption,color:p.accent}}>{label}</Text></Pressable>;
  return <View style={{padding:space.lg,gap:space.md,borderTopWidth:1,borderColor:p.border}}>
    <Text style={{...typography.body,fontWeight:'600',color:p.text}}>官方每日推荐授权</Text>
    <Text style={{...typography.caption,color:p.secondary}}>在 QQ 音乐官方 Skills 页面登录并创建日推授权。验证后绑定同一 QQ 账号，凭据仅存本机；私人雷达无需此授权。</Text>
    {auth.status==='waiting'&&<Pressable testID="qq-daily-cancel" accessibilityRole="button" accessibilityLabel="取消日推授权" onPress={cancel} style={{minHeight:controls.hit,justifyContent:'center'}}><Text style={{...typography.caption,color:p.accent}}>取消日推授权</Text></Pressable>}
    {showResult&&auth.status!=='idle'&&<Text testID={`qq-daily-${auth.status}`} accessibilityLiveRegion="polite" style={{...typography.caption,color:auth.status==='failed'?p.accent:p.secondary}}>{auth.status==='waiting'?'正在完成官方授权与验证':auth.status==='succeeded'?'日推授权已保存':auth.status==='cancelled'?'日推授权已取消':auth.status==='expired'?'日推授权已过期，请重试':'日推授权未完成，请确认 QQ 账号后重试'}</Text>}
    {!!error&&<Text accessibilityRole="alert" style={{...typography.caption,color:p.accent}}>{error}</Text>}
    {button('打开官方日推授权页','qq-daily-authorize',()=>authorize())}
    {accounts.filter(account=>account.platform==='tx'&&account.capabilities.includes('daily')).map(account=><View key={account.id} style={{gap:space.sm}}>
      <Text style={{...typography.caption,color:p.secondary}}>{account.displayName??account.label} · 已配置日推授权</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{button(`重新授权：${account.displayName??account.label}`,`qq-daily-reauthorize-${account.id}`,()=>authorize(account))}{button(`移除日推授权：${account.displayName??account.label}`,`qq-daily-clear-${account.id}`,()=>{void clear(account);})}</View>
    </View>)}
  </View>;
}
