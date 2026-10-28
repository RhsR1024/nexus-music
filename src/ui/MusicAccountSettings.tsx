import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {MusicWebLoginProvider} from '../providers/musicWebLogin.ts';
import {MusicAuthError} from '../providers/musicAuth.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {KugouAccountCard} from './KugouAccountCard.tsx';
import {kugouLoginBusy} from '../providers/kugouLoginCoordinator.ts';

export function MusicAccountSettings({services,active,onRevealQr}:{services:Services;active:boolean;onRevealQr:(bounds:{top:number;height:number})=>void}){
  const {palette:p}=useTheme();
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const auth=useSyncExternalStore(services.musicWebLogin.subscribe,services.musicWebLogin.getSnapshot);
  const kugouAuth=useSyncExternalStore(services.kugouLogin.subscribe,services.kugouLogin.getSnapshot);
  const [error,setError]=useState('');
  const [verifying,setVerifying]=useState('');
  const [verified,setVerified]=useState('');
  const verifyController=useRef<AbortController|null>(null);
  const [loginProvider,setLoginProvider]=useState<MusicWebLoginProvider>('wy');
  const providers=[{id:'wy' as const,name:'网易云',title:'网易云音乐'},{id:'tx' as const,name:'QQ 音乐',title:'QQ 音乐'}];
  const webWaiting=auth.status==='waiting',waiting=webWaiting||kugouLoginBusy(kugouAuth.status);
  useEffect(()=>()=>{verifyController.current?.abort();services.musicWebLogin.cancel();},[services]);
  // Settings caches visited pages. Hidden pages are not unmounted, so revoke
  // the attempt when navigation removes focus as well as on actual teardown.
  useLayoutEffect(()=>{
    if(active)return;
    verifyController.current?.abort();services.musicWebLogin.cancel();services.kugouLogin.cancel();
  },[active,services]);
  const login=(provider:MusicWebLoginProvider)=>{
    verifyController.current?.abort();setVerified('');setLoginProvider(provider);
    setError('');
    void services.musicWebLogin.login(provider).catch(reason=>{
      if(reason instanceof MusicAuthError&&reason.kind!=='failed')return;
      setError(reason instanceof MusicAuthError?reason.message:'登录失败，请重试');
    });
  };
  const remove=(id:string)=>{
    verifyController.current?.abort();setVerified('');
    setError('');
    void services.musicAccounts.remove(id).catch(()=>setError('账号未移除，原有会话仍保留'));
  };
  const verify=(id:string)=>{
    const platform=accounts.find(account=>account.id===id)?.platform;
    verifyController.current?.abort();
    const controller=new AbortController();
    verifyController.current=controller;
    setError('');
    setVerified('');
    setVerifying(id);
    void services.musicAccounts.session(id).then(session=>(platform==='tx'?services.qqProfile:services.neteaseProfile).fetch(session,controller.signal)).then(profile=>{
      if(!controller.signal.aborted)setVerified(`${platform==='tx'?'资料可读取':'会话有效'} · ${profile.nickname}`);
    },()=>{
      if(!controller.signal.aborted)setError('登录会话已失效或暂时无法验证，请重新登录');
    }).finally(()=>{
      if(verifyController.current===controller){verifyController.current=null;setVerifying('');}
    });
  };
  return <View style={{gap:18}}>
    {providers.map(provider=><View key={provider.id} style={{borderRadius:18,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,overflow:'hidden'}}>
      <View style={{padding:18,gap:8}}>
        <Text style={{fontSize:18,fontWeight:'600',color:p.text}}>{provider.title}</Text>
        <Text style={{fontSize:13,lineHeight:20,color:p.secondary}}>在官方网页完成登录。登录凭据仅保存在本机，不参与备份或同步。</Text>
      </View>
      {provider.id==='tx'&&<Text style={{paddingHorizontal:18,paddingBottom:12,fontSize:13,lineHeight:20,color:p.secondary}}>使用 QQ 官方网页登录，暂不支持跳转 QQ App 或微信登录。会检查音乐账号授权；日推仍需单独授权。</Text>}
      {accounts.filter(account=>account.platform===provider.id).map((account,index)=><View key={account.id} style={{minHeight:62,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:index===0?1:0,borderTopColor:p.border,borderBottomWidth:1,borderBottomColor:p.border}}>
        <View style={{flex:1,gap:3}}><Text style={{fontSize:15,color:p.text}}>{account.displayName??account.label}</Text><Text numberOfLines={1} style={{fontSize:12,color:p.secondary}}>会话凭据已保存到本机</Text></View>
        <Pressable testID={`verify-music-account-${account.platform}`} accessibilityRole="button" accessibilityLabel={`验证${provider.name}会话`} disabled={!!verifying} onPress={()=>verify(account.id)} style={{minWidth:64,minHeight:44,alignItems:'center',justifyContent:'center',opacity:verifying?0.5:1}}><Text style={{fontSize:13,color:p.secondary}}>{verifying===account.id?'验证中':'验证'}</Text></Pressable>
        <Pressable testID={`remove-music-account-${account.platform}`} accessibilityRole="button" accessibilityLabel={`退出${provider.name}账号`} onPress={()=>remove(account.id)} style={{minWidth:64,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13,color:p.accent}}>退出</Text></Pressable>
      </View>)}
      <View style={{padding:18,flexDirection:'row',alignItems:'center',gap:12}}>
        <Pressable testID={`login-music-account-${provider.id}`} accessibilityRole="button" accessibilityLabel={`${accounts.some(account=>account.platform===provider.id)?'添加':'登录'}${provider.name}账号`} disabled={waiting} onPress={()=>login(provider.id)} style={{minHeight:48,paddingHorizontal:18,borderRadius:14,backgroundColor:p.accent,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:waiting?.65:1}}>
          {webWaiting&&loginProvider===provider.id?<ActivityIndicator size="small" color="#FFFFFF"/>:null}
          <Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFF'}}>{webWaiting&&loginProvider===provider.id?'等待官方网页登录':`${accounts.some(account=>account.platform===provider.id)?'添加':'登录'}${provider.name}账号`}</Text>
        </Pressable>
        {webWaiting&&loginProvider===provider.id&&<Pressable testID={`cancel-music-login-${provider.id}`} accessibilityRole="button" accessibilityLabel={`取消${provider.name}登录`} onPress={()=>services.musicWebLogin.cancel()} style={{minWidth:60,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:14,color:p.secondary}}>取消</Text></Pressable>}
      </View>
    </View>)}
    {!!error&&<Text testID="music-account-error" accessibilityRole="alert" style={{fontSize:13,lineHeight:20,color:p.accent}}>{error}</Text>}
    {auth.status==='cancelled'&&<Text testID="music-account-cancelled" style={{fontSize:13,color:p.secondary}}>登录已取消</Text>}
    {auth.status==='expired'&&<Text testID="music-account-expired" accessibilityRole="alert" style={{fontSize:13,color:p.accent}}>登录已过期，请重新打开官方网页。</Text>}
    {!!verified&&<Text testID="music-account-verified" accessibilityLiveRegion="polite" style={{fontSize:13,color:p.secondary}}>{verified}</Text>}
    <Text style={{fontSize:12,lineHeight:19,color:p.secondary}}>QQ 私人雷达可在音乐库获取；官方每日推荐授权暂未开放。个人歌单、收藏与账号播放暂未开放。账号验证失败时，可重试或重新登录。</Text>
    <KugouAccountCard services={services} disabled={webWaiting} onRevealQr={onRevealQr}/>
  </View>;
}
