import {QQAccountTransferCard} from './QQAccountTransferCard.tsx';
import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {MusicWebLoginProvider} from '../providers/musicWebLogin.ts';
import {MusicAuthError} from '../providers/musicAuth.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {QQDailyAuthorizationCard} from './QQDailyAuthorizationCard.tsx';
import {KugouAccountCard} from './KugouAccountCard.tsx';
import {kugouLoginBusy} from '../providers/kugouLoginCoordinator.ts';
import {AccountPlaylistImport} from './AccountPlaylistImport.tsx';
import {AccountAlbumCatalog,AccountMVCatalog} from './AccountAlbumCatalog.tsx';
import {Cover} from './Cover.tsx';

type AccountPlatformTab='wy'|'tx'|'kg';

export function MusicAccountSettings({services,active,onRevealQr}:{services:Services;active:boolean;onRevealQr:(bounds:{top:number;height:number})=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const auth=useSyncExternalStore(services.musicWebLogin.subscribe,services.musicWebLogin.getSnapshot);
  const kugouAuth=useSyncExternalStore(services.kugouLogin.subscribe,services.kugouLogin.getSnapshot);
  const dailyAuth=useSyncExternalStore(services.qqDailyAuthorization.subscribe,services.qqDailyAuthorization.getSnapshot);
  const transfer=useSyncExternalStore(services.qqAccountTransfer.subscribe,services.qqAccountTransfer.getSnapshot);
  const transferWaiting=['scanning','connecting','verifying','confirm','saving'].includes(transfer.status);
  const dailyWaiting=dailyAuth.status==='waiting';
  const [selectedPlatform,setSelectedPlatform]=useState<AccountPlatformTab>('wy');
  const [error,setError]=useState('');
  const [verifying,setVerifying]=useState('');
  const [verified,setVerified]=useState('');
  const verifyController=useRef<AbortController|null>(null);
  const [loginProvider,setLoginProvider]=useState<MusicWebLoginProvider>('wy');
  const wyTab={id:'wy' as const,label:'网易云',title:'网易云音乐',icon:'musical-notes' as const,tint:s.dark?'rgba(230,57,70,0.18)':'rgba(217,50,62,0.11)',ink:s.dark?'#FF6B78':'#D9323E'};
  const txTab={id:'tx' as const,label:'QQ 音乐',title:'QQ 音乐',icon:'disc-outline' as const,tint:s.dark?'rgba(49,194,124,0.18)':'rgba(49,194,124,0.12)',ink:s.dark?'#5EE0A0':'#1B9C5E'};
  const kgTab={id:'kg' as const,label:'酷狗',title:'酷狗音乐',icon:'radio-outline' as const,tint:s.dark?'rgba(62,152,255,0.18)':'rgba(32,126,232,0.12)',ink:s.dark?'#6BB4FF':'#1E72D8'};
  const tabs=[wyTab,txTab,kgTab] as const;
  const webWaiting=auth.status==='waiting',waiting=webWaiting||kugouLoginBusy(kugouAuth.status)||dailyWaiting||transferWaiting;
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
    services.musicWebLogin.cancel();services.qqDailyAuthorization.cancel();
    verifyController.current?.abort();setVerified('');
    setError('');
    void services.musicAccounts.remove(id).catch(()=>setError('账号未移除，原有会话仍保留'));
  };
  const verify=(id:string)=>{
    const account=accounts.find(item=>item.id===id),platform=account?.platform;
    verifyController.current?.abort();
    const controller=new AbortController();
    verifyController.current=controller;
    setError('');
    setVerified('');
    setVerifying(id);
    void services.musicAccounts.session(id).then(session=>(platform==='tx'?services.qqProfile:services.neteaseProfile).fetch(session,controller.signal)).then(async profile=>{
      const avatar='avatar' in profile&&typeof profile.avatar==='string'?profile.avatar:undefined;
      try{await services.musicAccounts.updateProfile(id,{displayName:profile.nickname,...(avatar?{avatar}:{})},controller.signal,account);}catch{}
      if(!controller.signal.aborted&&services.musicAccounts.getSnapshot().some(account=>account.id===id))setVerified(`${platform==='tx'?'资料可读取':'会话有效'} · ${profile.nickname}`);
    },()=>{
      if(!controller.signal.aborted)setError('登录会话已失效或暂时无法验证，请重新登录');
    }).finally(()=>{
      if(verifyController.current===controller){verifyController.current=null;setVerifying('');}
    });
  };
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';
  const okColor=s.dark?'#5EE0A0':'#1D8A56';
  const okBg=s.dark?'rgba(94,224,160,0.14)':'rgba(29,138,86,0.11)';

  const switchPlatform=(next:AccountPlatformTab)=>{
    if(next===selectedPlatform)return;
    setSelectedPlatform(next);
    setError('');
    setVerified('');
  };

  const renderWebProviderCard=(provider:typeof wyTab|typeof txTab)=>{
    const platformAccounts=accounts.filter(account=>account.platform===provider.id);
    const signedIn=platformAccounts.length>0;
    return <View style={[{borderRadius:22,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
      <View style={{padding:16,gap:8}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <View style={{width:42,height:42,borderRadius:14,backgroundColor:provider.tint,alignItems:'center',justifyContent:'center'}}>
            <Ionicons name={provider.icon} size={21} color={provider.ink}/>
          </View>
          <View style={{flex:1,minWidth:0,gap:3}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:17,fontWeight:'700',color:s.ink}}>{provider.title}</Text>
              <View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:10,backgroundColor:signedIn?okBg:s.chip,borderWidth:1,borderColor:signedIn?okColor+'33':s.chipBorder}}>
                <Text style={{fontSize:11,fontWeight:'700',color:signedIn?okColor:s.muted}}>{signedIn?`已登录 ${platformAccounts.length}`:'未登录'}</Text>
              </View>
            </View>
            <Text style={{fontSize:12,lineHeight:17,color:s.muted}}>在官方网页完成登录，凭据仅存本机，不参与备份或同步。</Text>
          </View>
        </View>
        {provider.id==='tx'&&<Text style={{fontSize:12,lineHeight:18,color:s.muted}}>使用 QQ 官方网页登录，不跳转 QQ App；微信账号请用下方电脑配对。</Text>}
      </View>
      {platformAccounts.map((account,index)=><View key={account.id}>
        <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:index===0?0:68,backgroundColor:s.hairline}}/>
        <View style={{minHeight:64,paddingHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:12}}>
          <Cover services={services} url={account.avatar} size={42} radius={21} fallbackText={account.displayName??account.label} testID={`music-account-avatar-${account.platform}`}/>
          <View style={{flex:1,minWidth:0,gap:2}}>
            <Text numberOfLines={1} style={{fontSize:15,fontWeight:'600',color:s.ink}}>{account.displayName??account.label}</Text>
            <Text numberOfLines={1} style={{fontSize:12,color:s.muted}}>会话凭据已保存到本机</Text>
          </View>
          <Pressable testID={`verify-music-account-${account.platform}`} accessibilityRole="button" accessibilityLabel={`验证${provider.label}会话`} disabled={!!verifying} onPress={()=>verify(account.id)} style={{minWidth:54,minHeight:34,paddingHorizontal:11,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:verifying?0.5:1}}><Text style={{fontSize:12.5,fontWeight:'600',color:s.ink}}>{verifying===account.id?'验证中':'验证'}</Text></Pressable>
          <Pressable testID={`remove-music-account-${account.platform}`} accessibilityRole="button" accessibilityLabel={`退出${provider.label}账号`} onPress={()=>remove(account.id)} style={{minWidth:54,minHeight:34,paddingHorizontal:11,borderRadius:17,backgroundColor:warnBg,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12.5,fontWeight:'600',color:s.accent}}>退出</Text></Pressable>
        </View>
      </View>)}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
      <View style={{padding:14,flexDirection:'row',alignItems:'center',gap:10}}>
        <Pressable testID={`login-music-account-${provider.id}`} accessibilityRole="button" accessibilityLabel={`${signedIn?'添加':'登录'}${provider.label}账号`} disabled={waiting} onPress={()=>login(provider.id)} style={{minHeight:44,paddingHorizontal:18,borderRadius:22,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:waiting?.6:1}}>
          {webWaiting&&loginProvider===provider.id?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="log-in-outline" size={17} color="#FFFFFF"/>}
          <Text style={{fontSize:14.5,fontWeight:'700',color:'#FFFFFF'}}>{webWaiting&&loginProvider===provider.id?'等待官方网页登录':`${signedIn?'添加':'登录'}${provider.label}账号`}</Text>
        </Pressable>
        {webWaiting&&loginProvider===provider.id&&<Pressable testID={`cancel-music-login-${provider.id}`} accessibilityRole="button" accessibilityLabel={`取消${provider.label}登录`} onPress={()=>services.musicWebLogin.cancel()} style={{minWidth:60,minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>取消</Text></Pressable>}
      </View>
      {provider.id==='tx'&&<QQAccountTransferCard services={services} active={active} disabled={webWaiting||kugouLoginBusy(kugouAuth.status)||dailyWaiting}/>}
      {provider.id==='tx'&&<QQDailyAuthorizationCard services={services} active={active} disabled={webWaiting||kugouLoginBusy(kugouAuth.status)||transferWaiting}/>}
    </View>;
  };

  return <View style={{gap:14,paddingTop:4}}>
    <View testID="music-accounts-platform-tabs" style={[{flexDirection:'row',padding:4,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:4},s.cardShadow]}>
      {tabs.map(tab=>{
        const selected=selectedPlatform===tab.id;
        const count=accounts.filter(a=>a.platform===tab.id).length;
        return <Pressable key={tab.id} testID={`accounts-tab-${tab.id}`} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{selected}} onPress={()=>switchPlatform(tab.id)} style={{flex:1,minHeight:40,borderRadius:14,backgroundColor:selected?s.accentSoft:'transparent',borderWidth:selected?1:0,borderColor:selected?s.accent+'44':'transparent',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:8}}>
          <Ionicons name={tab.icon} size={15} color={selected?s.accent:s.muted}/>
          <Text numberOfLines={1} style={{fontSize:13.5,fontWeight:selected?'700':'500',color:selected?s.accent:s.ink}}>{tab.label}</Text>
          {count>0&&<View style={{width:6,height:6,borderRadius:3,backgroundColor:okColor}}/>}
        </Pressable>;
      })}
    </View>

    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:4}}>
      <Text accessibilityRole="header" style={{color:s.muted,fontSize:12.5,fontWeight:'600'}}>{selectedPlatform==='wy'?'网易云音乐配置':selectedPlatform==='tx'?'QQ 音乐配置':'酷狗音乐配置'}</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
        <Ionicons name="shield-checkmark-outline" size={13} color={s.subtle}/>
        <Text style={{color:s.subtle,fontSize:11.5}}>凭据仅存本机钥匙串</Text>
      </View>
    </View>

    {!!error&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:11,borderRadius:16,backgroundColor:warnBg,borderWidth:1,borderColor:s.accent+'33'}}>
      <Ionicons name="alert-circle-outline" size={18} color={s.accent}/>
      <Text testID="music-account-error" accessibilityRole="alert" style={{flex:1,fontSize:13,lineHeight:19,color:s.accent}}>{error}</Text>
    </View>}
    {auth.status==='cancelled'&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>
      <Ionicons name="information-circle-outline" size={17} color={s.muted}/>
      <Text testID="music-account-cancelled" style={{flex:1,fontSize:13,color:s.muted}}>登录已取消</Text>
    </View>}
    {auth.status==='expired'&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:warnBg,borderWidth:1,borderColor:s.accent+'33'}}>
      <Ionicons name="time-outline" size={17} color={s.accent}/>
      <Text testID="music-account-expired" accessibilityRole="alert" style={{flex:1,fontSize:13,color:s.accent}}>登录已过期，请重新打开官方网页。</Text>
    </View>}
    {!!verified&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:okBg}}>
      <Ionicons name="checkmark-circle-outline" size={18} color={okColor}/>
      <Text testID="music-account-verified" accessibilityLiveRegion="polite" style={{flex:1,fontSize:13,color:okColor,fontWeight:'600'}}>{verified}</Text>
    </View>}

    {selectedPlatform==='wy'&&<>
      {renderWebProviderCard(wyTab)}
      <Text accessibilityRole="header" style={{color:s.muted,fontSize:12.5,fontWeight:'600',marginLeft:4,marginTop:2,marginBottom:-4}}>网易云歌单与收藏</Text>
      <AccountPlaylistImport services={services} active={active} disabled={waiting} onLogin={()=>login('wy')}/>
      <AccountAlbumCatalog services={services} active={active} disabled={waiting} onLogin={()=>login('wy')}/>
      <AccountMVCatalog services={services} active={active} disabled={waiting} onLogin={()=>login('wy')}/>
    </>}

    {selectedPlatform==='tx'&&<>
      {renderWebProviderCard(txTab)}
      <Text accessibilityRole="header" style={{color:s.muted,fontSize:12.5,fontWeight:'600',marginLeft:4,marginTop:2,marginBottom:-4}}>QQ 音乐歌单导入</Text>
      <AccountPlaylistImport services={services} active={active} disabled={waiting} platform="tx" onLogin={()=>login('tx')}/>
    </>}

    {selectedPlatform==='kg'&&<>
      <KugouAccountCard services={services} disabled={webWaiting||dailyWaiting||transferWaiting} onRevealQr={onRevealQr}/>
      <Text accessibilityRole="header" style={{color:s.muted,fontSize:12.5,fontWeight:'600',marginLeft:4,marginTop:2,marginBottom:-4}}>酷狗歌单导入</Text>
      <AccountPlaylistImport services={services} active={active} disabled={waiting} platform="kg" onLogin={()=>{void services.kugouLogin.login();}}/>
    </>}

    <View style={{flexDirection:'row',alignItems:'flex-start',gap:8,padding:12,borderRadius:14,backgroundColor:s.dark?'rgba(255,255,255,0.035)':'rgba(42,36,31,0.03)'}}>
      <Ionicons name="information-circle-outline" size={16} color={s.subtle} style={{marginTop:1}}/>
      <Text style={{flex:1,fontSize:11.5,lineHeight:17.5,color:s.muted}}>{selectedPlatform==='wy'?'网易云歌单、收藏专辑与 MV 可手动导入到本机音枢歌单；登录会话不参与云同步。':selectedPlatform==='tx'?'QQ 私人雷达可在音乐库获取；官方每日推荐需完成上方独立授权。歌单可手动复制到音枢歌单。':'酷狗扫码登录后可浏览并复制远端歌单到音枢歌单；凭据仅留本机，验证失败时可重新扫码。'}</Text>
    </View>
  </View>;
}
