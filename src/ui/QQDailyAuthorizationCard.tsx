import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,AppState,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {MusicAccount} from '../providers/musicAccounts.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export function QQDailyAuthorizationCard({services,active,disabled}:{services:Services;active:boolean;disabled:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const auth=useSyncExternalStore(services.qqDailyAuthorization.subscribe,services.qqDailyAuthorization.getSnapshot);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const [error,setError]=useState(''),[clearing,setClearing]=useState(false),[showResult,setShowResult]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const cancel=()=>{controller.current?.abort();services.qqDailyAuthorization.cancel();};
  useLayoutEffect(()=>{if(!active)cancel();},[active,services]);
  // Only cancel when actually backgrounded; transient iOS inactive states (FaceID/AutoFill) must keep the flow alive.
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{if(state==='background')cancel();});return()=>{subscription.remove();cancel();};},[services]);
  const busy=auth.status==='waiting'||clearing;
  const authorize=(account?:MusicAccount)=>{setShowResult(true);setError('');void services.qqDailyAuthorization.authorize(account).catch(()=>{});};
  const clear=async(account:MusicAccount)=>{
    setShowResult(false);controller.current?.abort();const next=new AbortController();controller.current=next;setClearing(true);setError('');
    try{await services.qqDailyAuthorization.clear(account,next.signal);}catch{if(!next.signal.aborted)setError('未能移除日推授权，请重试');}
    finally{if(controller.current===next){controller.current=null;setClearing(false);}}
  };
  const dailyAccounts=accounts.filter(account=>account.platform==='tx'&&account.capabilities.includes('daily'));
  const okColor=s.dark?'#5EE0A0':'#1D8A56';
  const okBg=s.dark?'rgba(94,224,160,0.14)':'rgba(29,138,86,0.11)';
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';
  const insetBg=s.dark?'rgba(255,255,255,0.035)':'rgba(42,36,31,0.03)';

  return <View style={{paddingHorizontal:16,paddingVertical:14,gap:10,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <View style={{width:30,height:30,borderRadius:9,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}>
        <Ionicons name="sparkles-outline" size={16} color={s.control}/>
      </View>
      <View style={{flex:1,minWidth:0,gap:2}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Text style={{fontSize:14.5,fontWeight:'700',color:s.ink}}>官方每日推荐授权</Text>
          {dailyAccounts.length>0&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:999,backgroundColor:okBg}}><Text style={{fontSize:10.5,fontWeight:'700',color:okColor}}>已授权</Text></View>}
        </View>
        <Text style={{fontSize:12,lineHeight:17,color:s.muted}}>在官方 Skills 页面登录并创建授权，绑定同一 QQ 账号；私人雷达无需此授权。</Text>
      </View>
    </View>

    {showResult&&auth.status!=='idle'&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,paddingVertical:9,borderRadius:12,backgroundColor:auth.status==='succeeded'?okBg:auth.status==='failed'?warnBg:insetBg}}>
      {auth.status==='waiting'?<ActivityIndicator size="small" color={s.control}/>:<Ionicons name={auth.status==='succeeded'?'checkmark-circle-outline':auth.status==='failed'?'alert-circle-outline':'information-circle-outline'} size={16} color={auth.status==='succeeded'?okColor:auth.status==='failed'?s.accent:s.muted}/>}
      <Text testID={`qq-daily-${auth.status}`} accessibilityLiveRegion="polite" style={{flex:1,fontSize:12.5,lineHeight:17,color:auth.status==='succeeded'?okColor:auth.status==='failed'?s.accent:s.muted}}>{auth.status==='waiting'?'正在完成官方授权与验证':auth.status==='succeeded'?'日推授权已保存':auth.status==='cancelled'?'日推授权已取消':auth.status==='expired'?'日推授权已过期，请重试':'日推授权未完成，请确认 QQ 账号后重试'}</Text>
    </View>}
    {!!error&&<Text accessibilityRole="alert" style={{fontSize:12.5,color:s.accent}}>{error}</Text>}

    <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <Pressable testID="qq-daily-authorize" accessibilityRole="button" accessibilityLabel="打开官方日推授权页" onPress={()=>authorize()} disabled={disabled||busy} style={{minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',gap:6,opacity:disabled||busy?.5:1}}>
        <Ionicons name="key-outline" size={15} color={s.control}/>
        <Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>打开官方日推授权页</Text>
      </Pressable>
      {auth.status==='waiting'&&<Pressable testID="qq-daily-cancel" accessibilityRole="button" accessibilityLabel="取消日推授权" onPress={cancel} style={{minHeight:40,paddingHorizontal:12,borderRadius:20,backgroundColor:s.accentSoft,justifyContent:'center'}}><Text style={{fontSize:13,fontWeight:'600',color:s.control}}>取消日推授权</Text></Pressable>}
    </View>

    {dailyAccounts.map(account=><View key={account.id} style={{padding:11,borderRadius:14,backgroundColor:insetBg,gap:8}}>
      <Text style={{fontSize:12.5,fontWeight:'600',color:s.ink}}>{account.displayName??account.label} · 已配置日推授权</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        <Pressable testID={`qq-daily-reauthorize-${account.id}`} accessibilityRole="button" accessibilityLabel={`重新授权：${account.displayName??account.label}`} onPress={()=>authorize(account)} disabled={disabled||busy} style={{minHeight:34,paddingHorizontal:12,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,justifyContent:'center',opacity:disabled||busy?.5:1}}><Text style={{fontSize:12,fontWeight:'600',color:s.ink}}>重新授权：{account.displayName??account.label}</Text></Pressable>
        <Pressable testID={`qq-daily-clear-${account.id}`} accessibilityRole="button" accessibilityLabel={`移除日推授权：${account.displayName??account.label}`} onPress={()=>{void clear(account);}} disabled={disabled||busy} style={{minHeight:34,paddingHorizontal:12,borderRadius:17,backgroundColor:warnBg,justifyContent:'center',opacity:disabled||busy?.5:1}}><Text style={{fontSize:12,fontWeight:'600',color:s.accent}}>移除日推授权：{account.displayName??account.label}</Text></Pressable>
      </View>
    </View>)}
  </View>;
}
