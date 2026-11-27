import {QQAccountTransferCard} from './QQAccountTransferCard.tsx';
import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,AppState,Image,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {MusicWebLoginProvider} from '../providers/musicWebLogin.ts';
import {MusicAuthError} from '../providers/musicAuth.ts';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {QQDailyAuthorizationCard} from './QQDailyAuthorizationCard.tsx';
import {KugouAccountCard} from './KugouAccountCard.tsx';
import {kugouLoginBusy} from '../providers/kugouLoginCoordinator.ts';
import {neteaseQrBusy} from '../providers/neteaseQrLogin.ts';
import {decodeQQBaseInfoNick} from '../providers/qqAccountProfile.ts';
import {AccountPlaylistImport} from './AccountPlaylistImport.tsx';
import {AccountAlbumCatalog,AccountMVCatalog} from './AccountAlbumCatalog.tsx';
import {Cover} from './Cover.tsx';

type AccountPlatformTab='wy'|'tx'|'kg'|'qishui';

export function MusicAccountSettings({services,active,onRevealQr}:{services:Services;active:boolean;onRevealQr:(bounds:{top:number;height:number})=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const qishuiAccount=useSyncExternalStore(services.qishuiAccount.subscribe,services.qishuiAccount.getSnapshot);
  const auth=useSyncExternalStore(services.musicWebLogin.subscribe,services.musicWebLogin.getSnapshot);
  const wyQr=useSyncExternalStore(services.neteaseQrLogin.subscribe,services.neteaseQrLogin.getSnapshot);
  const wyQrPhoto=useSyncExternalStore(services.neteaseQrPhoto.subscribe,services.neteaseQrPhoto.getSnapshot);
  const wyQrImage=useRef<Image|null>(null);
  const kugouAuth=useSyncExternalStore(services.kugouLogin.subscribe,services.kugouLogin.getSnapshot);
  const dailyAuth=useSyncExternalStore(services.qqDailyAuthorization.subscribe,services.qqDailyAuthorization.getSnapshot);
  const transfer=useSyncExternalStore(services.qqAccountTransfer.subscribe,services.qqAccountTransfer.getSnapshot);
  const transferWaiting=['scanning','connecting','verifying','confirm','saving'].includes(transfer.status);
  const dailyWaiting=dailyAuth.status==='waiting';
  const wyQrWaiting=neteaseQrBusy(wyQr.status);
  const [selectedPlatform,setSelectedPlatform]=useState<AccountPlatformTab>('wy');
  const [showManualImport,setShowManualImport]=useState(false);
  const [qishuiNick,setQishuiNick]=useState(qishuiAccount.nickname);
  const [qishuiLink,setQishuiLink]=useState('');
  const [qishuiBusy,setQishuiBusy]=useState(false);
  const [qishuiMsg,setQishuiMsg]=useState('');
  const [error,setError]=useState('');
  const [verifying,setVerifying]=useState('');
  const [verified,setVerified]=useState('');
  const verifyController=useRef<AbortController|null>(null);
  const [loginProvider,setLoginProvider]=useState<MusicWebLoginProvider>('wy');
  const wyTab={id:'wy' as const,label:'网易云',title:'网易云音乐',icon:'musical-notes' as const,tint:s.dark?'rgba(230,57,70,0.18)':'rgba(217,50,62,0.11)',ink:s.dark?'#FF6B78':'#D9323E'};
  const txTab={id:'tx' as const,label:'QQ',title:'QQ 音乐',icon:'disc-outline' as const,tint:s.dark?'rgba(49,194,124,0.18)':'rgba(49,194,124,0.12)',ink:s.dark?'#5EE0A0':'#1B9C5E'};
  const kgTab={id:'kg' as const,label:'酷狗',title:'酷狗音乐',icon:'radio-outline' as const,tint:s.dark?'rgba(62,152,255,0.18)':'rgba(32,126,232,0.12)',ink:s.dark?'#6BB4FF':'#1E72D8'};
  const qsTab={id:'qishui' as const,label:'汽水',title:'汽水音乐',icon:'sparkles-outline' as const,tint:s.dark?'rgba(0,214,160,0.18)':'rgba(0,184,134,0.12)',ink:s.dark?'#4CE8BE':'#009970'};
  const tabs=[wyTab,txTab,kgTab,qsTab] as const;
  const webWaiting=auth.status==='waiting',waiting=webWaiting||wyQrWaiting||kugouLoginBusy(kugouAuth.status)||dailyWaiting||transferWaiting;
  useEffect(()=>{setQishuiNick(qishuiAccount.nickname);},[qishuiAccount.nickname]);
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',value=>{if(value==='background')services.neteaseQrLogin.setForeground(false);else if(value==='active')services.neteaseQrLogin.setForeground(true);});
    return()=>{subscription.remove();verifyController.current?.abort();services.musicWebLogin.cancel();services.neteaseQrLogin.cancel();};
  },[services]);
  useLayoutEffect(()=>{
    if(active)return;
    verifyController.current?.abort();services.musicWebLogin.cancel();services.neteaseQrLogin.cancel();services.kugouLogin.cancel();
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
  const bindQishuiPlaylist=async()=>{
    const raw=qishuiLink.trim();
    if(!raw||qishuiBusy)return;
    setQishuiBusy(true);setQishuiMsg('');
    try{
      const pl=await services.qishui.complete(raw,new AbortController().signal);
      await services.qishuiAccount.bindPlaylist(pl);
      setQishuiLink('');
      setQishuiMsg(`已绑定汽水歌单「${pl.title}」（${pl.tracks.length} 首），可直接在发现页「汽水」中点击播放。`);
    }catch(e){
      setQishuiMsg(e instanceof Error?e.message:'无法读取此汽水公开歌单，请检查链接或 ID');
    }finally{setQishuiBusy(false);}
  };
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';
  const okColor=s.dark?'#5EE0A0':'#1D8A56';
  const okBg=s.dark?'rgba(94,224,160,0.14)':'rgba(29,138,86,0.11)';

  const switchPlatform=(next:AccountPlatformTab)=>{
    if(next===selectedPlatform)return;
    setSelectedPlatform(next);
    setShowManualImport(false);
    setError('');
    setVerified('');
    setQishuiMsg('');
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
            <Text style={{fontSize:12,lineHeight:17,color:s.muted}}>在官方网页完成登录，凭据仅存本机钥匙串，不参与云同步。</Text>
          </View>
        </View>
        {provider.id==='tx'&&<Text style={{fontSize:12,lineHeight:18,color:s.muted}}>使用 QQ 官方网页登录，不跳转 QQ App；微信账号请用下方电脑配对。</Text>}
      </View>
      {platformAccounts.map((account,index)=>{
        const accountName=account.displayName?(account.platform==='tx'?decodeQQBaseInfoNick(account.displayName)||account.displayName:account.displayName):account.label;
        return <View key={account.id}>
          <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:index===0?0:68,backgroundColor:s.hairline}}/>
          <View style={{minHeight:64,paddingHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:12}}>
            <Cover services={services} url={account.avatar} size={42} radius={21} fallbackText={accountName} testID={`music-account-avatar-${account.platform}`}/>
            <View style={{flex:1,minWidth:0,gap:2}}>
              <Text numberOfLines={1} style={{fontSize:15,fontWeight:'600',color:s.ink}}>{accountName}</Text>
              <Text numberOfLines={1} style={{fontSize:12,color:s.muted}}>会话凭据已保存到本机</Text>
            </View>
            <Pressable testID={`verify-music-account-${account.platform}`} accessibilityRole="button" accessibilityLabel={`验证${provider.label}会话`} disabled={!!verifying} onPress={()=>verify(account.id)} style={{minWidth:54,minHeight:34,paddingHorizontal:11,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:verifying?0.5:1}}><Text style={{fontSize:12.5,fontWeight:'600',color:s.ink}}>{verifying===account.id?'验证中':'验证'}</Text></Pressable>
            <Pressable testID={`remove-music-account-${account.platform}`} accessibilityRole="button" accessibilityLabel={`退出${provider.label}账号`} onPress={()=>remove(account.id)} style={{minWidth:54,minHeight:34,paddingHorizontal:11,borderRadius:17,backgroundColor:warnBg,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12.5,fontWeight:'600',color:s.accent}}>退出</Text></Pressable>
          </View>
        </View>;
      })}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
      <View style={{padding:14,gap:12}}>
        <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10}}>
          <Pressable testID={`login-music-account-${provider.id}`} accessibilityRole="button" accessibilityLabel={`${signedIn?'添加':'登录'}${provider.label}账号`} disabled={waiting} onPress={()=>login(provider.id)} style={{minHeight:44,paddingHorizontal:18,borderRadius:22,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:waiting?.6:1}}>
            {webWaiting&&loginProvider===provider.id?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="log-in-outline" size={17} color="#FFFFFF"/>}
            <Text style={{fontSize:14.5,fontWeight:'700',color:'#FFFFFF'}}>{webWaiting&&loginProvider===provider.id?'等待官方网页登录':`${signedIn?'添加':'登录'}${provider.label}账号`}</Text>
          </Pressable>
          {provider.id==='wy'&&<Pressable testID="login-music-account-wy-qr" accessibilityRole="button" accessibilityLabel="网易云扫码登录" disabled={waiting} onPress={()=>{setError('');setVerified('');void services.neteaseQrLogin.login();}} style={{minHeight:44,paddingHorizontal:16,borderRadius:22,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:waiting?.6:1}}>
            {wyQrWaiting?<ActivityIndicator size="small" color={s.control}/>:<Ionicons name="qr-code-outline" size={16} color={s.control}/>}
            <Text style={{fontSize:14,fontWeight:'700',color:s.ink}}>{wyQrWaiting?'等待扫码中':'扫码登录'}</Text>
          </Pressable>}
          {webWaiting&&loginProvider===provider.id&&<Pressable testID={`cancel-music-login-${provider.id}`} accessibilityRole="button" accessibilityLabel={`取消${provider.label}登录`} onPress={()=>services.musicWebLogin.cancel()} style={{minWidth:60,minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>取消</Text></Pressable>}
          {provider.id==='wy'&&wyQrWaiting&&<Pressable testID="cancel-music-login-wy-qr" accessibilityRole="button" accessibilityLabel="取消网易云扫码登录" onPress={()=>services.neteaseQrLogin.cancel()} style={{minWidth:60,minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>取消</Text></Pressable>}
        </View>
        {provider.id==='wy'&&!!wyQr.image&&<View style={{alignItems:'center',gap:10,padding:14,borderRadius:16,backgroundColor:s.dark?'rgba(255,255,255,0.04)':'rgba(42,36,31,0.03)'}}>
          <View style={{padding:10,borderRadius:16,backgroundColor:'#FFFFFF'}}>
            <Image key={wyQr.generation} ref={wyQrImage} testID="netease-login-qr" accessibilityLabel="网易云官方登录二维码" accessible source={{uri:wyQr.image}} resizeMode="contain" onError={()=>services.neteaseQrLogin.imageFailed(wyQr.generation)} onLayout={()=>requestAnimationFrame(()=>{
              const current=services.neteaseQrLogin.getSnapshot();
              if(current.generation!==wyQr.generation||!current.image)return;
              wyQrImage.current?.measureInWindow((_x,top,_width,height)=>onRevealQr({top,height}));
            })} style={{width:220,height:220,maxWidth:'100%',backgroundColor:'#FFFFFF'}}/>
          </View>
          <Pressable testID="netease-login-save-photo" accessibilityRole="button" disabled={wyQrPhoto.status==='saving'} onPress={()=>{void services.neteaseQrPhoto.save();}} style={{minHeight:40,paddingHorizontal:16,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',gap:6,opacity:wyQrPhoto.status==='saving'?.5:1}}>
            <Ionicons name="download-outline" size={15} color={s.control}/>
            <Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>{wyQrPhoto.status==='saving'?'正在保存二维码…':'保存二维码到照片'}</Text>
          </Pressable>
          {wyQrPhoto.generation===wyQr.generation&&wyQrPhoto.status!=='idle'&&wyQrPhoto.status!=='saving'&&<Text testID={`netease-qr-photo-${wyQrPhoto.status}`} accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:17,color:s.muted,textAlign:'center'}}>{wyQrPhoto.status==='saved'?'已保存到照片。请在本机网易云音乐 App 扫一扫中选择该图。':wyQrPhoto.status==='saved_stale'?'已保存到照片，但二维码已变化，请重新获取。':wyQrPhoto.status==='denied'?'未保存。需要允许添加照片权限；仍可用另一台设备扫码。':wyQrPhoto.status==='expired'?'二维码已失效，请重新获取。':wyQrPhoto.status==='cancelled'?'二维码保存已取消。':'未能保存二维码，请重试。'}</Text>}
          <Text style={{fontSize:11.5,lineHeight:17,color:s.muted,textAlign:'center'}}>请使用网易云音乐 App 扫一扫，确认登录并返回音枢即可自动完成；二维码约三分钟有效。</Text>
        </View>}
        {provider.id==='wy'&&wyQr.status!=='idle'&&(()=>{
          const wyQrMsg=wyQr.status==='loading'?'正在生成网易云登录二维码…':wyQr.status==='waiting'?'等待网易云 App 扫码':wyQr.status==='scanned'?`已扫码${wyQr.nickname?`（${wyQr.nickname}）`:''}，请在网易云 App 中点击确认`:wyQr.status==='saving'?'正在验证并保存网易云账号…':wyQr.status==='succeeded'?'网易云扫码登录已保存':wyQr.status==='expired'?'二维码已过期，请点击「扫码登录」重新获取':wyQr.status==='cancelled'?'网易云扫码登录已取消':wyQr.detail??'网易云扫码登录失败，请重试或改用网页登录';
          return <Text testID={`netease-qr-${wyQr.status}`} accessibilityLiveRegion="polite" style={{fontSize:12.5,color:wyQr.status==='succeeded'?okColor:wyQr.status==='failed'?s.accent:s.muted,fontWeight:wyQr.status==='succeeded'?'600':'400'}}>{wyQrMsg}</Text>;
        })()}
      </View>
      {provider.id==='tx'&&<QQAccountTransferCard services={services} active={active} disabled={webWaiting||wyQrWaiting||kugouLoginBusy(kugouAuth.status)||dailyWaiting}/>}
      {provider.id==='tx'&&<QQDailyAuthorizationCard services={services} active={active} disabled={webWaiting||wyQrWaiting||kugouLoginBusy(kugouAuth.status)||transferWaiting}/>}
    </View>;
  };

  return <View style={{gap:14,paddingTop:4}}>
    <View testID="music-accounts-platform-tabs" style={[{flexDirection:'row',padding:4,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:4},s.cardShadow]}>
      {tabs.map(tab=>{
        const selected=selectedPlatform===tab.id;
        const count=tab.id==='qishui'?qishuiAccount.playlists.length:accounts.filter(a=>a.platform===tab.id).length;
        return <Pressable key={tab.id} testID={`accounts-tab-${tab.id}`} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{selected}} onPress={()=>switchPlatform(tab.id)} style={{flex:1,minHeight:40,borderRadius:14,backgroundColor:selected?s.accentSoft:'transparent',borderWidth:selected?1:0,borderColor:selected?s.accent+'44':'transparent',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:6}}>
          <Ionicons name={tab.icon} size={14} color={selected?s.accent:s.muted}/>
          <Text numberOfLines={1} style={{fontSize:13,fontWeight:selected?'700':'500',color:selected?s.accent:s.ink}}>{tab.label}</Text>
          {count>0&&<View style={{width:6,height:6,borderRadius:3,backgroundColor:okColor}}/>}
        </Pressable>;
      })}
    </View>

    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:4}}>
      <Text accessibilityRole="header" style={{color:s.muted,fontSize:12.5,fontWeight:'600'}}>
        {selectedPlatform==='wy'?'网易云音乐账号':selectedPlatform==='tx'?'QQ 音乐账号':selectedPlatform==='kg'?'酷狗音乐账号':'汽水音乐配置'}
      </Text>
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

    {selectedPlatform==='wy'&&renderWebProviderCard(wyTab)}
    {selectedPlatform==='tx'&&renderWebProviderCard(txTab)}
    {selectedPlatform==='kg'&&<KugouAccountCard services={services} disabled={webWaiting||wyQrWaiting||dailyWaiting||transferWaiting} onRevealQr={onRevealQr}/>}

    {selectedPlatform==='qishui'&&<View style={[{borderRadius:22,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,gap:12},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:42,height:42,borderRadius:14,backgroundColor:qsTab.tint,alignItems:'center',justifyContent:'center'}}>
          <Ionicons name="sparkles-outline" size={21} color={qsTab.ink}/>
        </View>
        <View style={{flex:1,gap:2}}>
          <Text style={{fontSize:17,fontWeight:'700',color:s.ink}}>汽水音乐 · 漫游与歌单绑定</Text>
          <Text style={{fontSize:12,color:s.muted}}>已绑定 {qishuiAccount.playlists.length} 个公开歌单 · {qishuiAccount.liked.length} 首喜欢</Text>
        </View>
      </View>
      <Text style={{fontSize:12,lineHeight:18,color:s.muted}}>
        汽水官方 OAuth 登录接口需要闭源商业合作 SDK 与私有密钥；音枢支持免登录直接畅享 12 种场景漫游、绑定任意汽水公开歌单直达播放，并由 LX 多音源跨平台自动解析高音质流。
      </Text>
      <View style={{flexDirection:'row',gap:8}}>
        <TextInput
          accessibilityLabel="汽水展示昵称"
          placeholder="可选：设置本机展示昵称"
          placeholderTextColor={s.subtle}
          value={qishuiNick}
          onChangeText={setQishuiNick}
          style={{flex:1,color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:12,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:s.cardBorder,fontSize:13.5}}
        />
        <Pressable accessibilityRole="button" onPress={()=>{void services.qishuiAccount.setNickname(qishuiNick).then(()=>setQishuiMsg('汽水昵称已保存'));}} style={{paddingHorizontal:14,borderRadius:12,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,justifyContent:'center'}}>
          <Text style={{color:s.ink,fontSize:13,fontWeight:'600'}}>保存</Text>
        </Pressable>
      </View>
      <View style={{flexDirection:'row',gap:8}}>
        <TextInput
          testID="qishui-account-bind-input"
          accessibilityLabel="绑定汽水公开歌单链接或ID"
          placeholder="粘贴汽水公开歌单分享链接或 ID"
          placeholderTextColor={s.subtle}
          value={qishuiLink}
          onChangeText={setQishuiLink}
          autoCapitalize="none"
          autoCorrect={false}
          style={{flex:1,color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:12,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:s.cardBorder,fontSize:13.5}}
        />
        <Pressable accessibilityRole="button" disabled={qishuiBusy||!qishuiLink.trim()} onPress={()=>{void bindQishuiPlaylist();}} style={{paddingHorizontal:15,borderRadius:12,backgroundColor:s.control,justifyContent:'center',opacity:qishuiBusy||!qishuiLink.trim()?.45:1}}>
          <Text style={{color:'#FFFFFF',fontSize:13,fontWeight:'700'}}>{qishuiBusy?'读取中…':'绑定'}</Text>
        </Pressable>
      </View>
      {!!qishuiMsg&&<Text style={{color:s.accent,fontSize:12.5,lineHeight:18}}>{qishuiMsg}</Text>}
      {qishuiAccount.playlists.length>0&&<View style={{gap:6}}>
        {qishuiAccount.playlists.map(pl=><View key={pl.id} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:6,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
          <Cover services={services} url={pl.artwork} size={38} radius={8} fallbackText={pl.title}/>
          <View style={{flex:1}}><Text numberOfLines={1} style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{pl.title}</Text><Text style={{color:s.muted,fontSize:11.5}}>{pl.trackCount} 首</Text></View>
          <Pressable accessibilityRole="button" onPress={()=>Alert.alert('解除绑定？',`从汽水列表移除「${pl.title}」？`,[{text:'取消',style:'cancel'},{text:'移除',style:'destructive',onPress:()=>{void services.qishuiAccount.removePlaylist(pl.id);}}])} style={{padding:6}}><Ionicons name="trash-outline" size={16} color={s.muted}/></Pressable>
        </View>)}
      </View>}
    </View>}

    {/* Streamlined direct-in-Discovery guidance (Item 8) + optional collapsed manual offline import */}
    {selectedPlatform!=='qishui'&&<>
      <View style={[{flexDirection:'row',alignItems:'flex-start',gap:10,padding:14,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>
        <Ionicons name="sparkles" size={18} color={s.accent} style={{marginTop:1}}/>
        <View style={{flex:1,gap:3}}>
          <Text style={{fontSize:14,fontWeight:'700',color:s.ink}}>登录后即刻在「发现」页直达浏览与播放</Text>
          <Text style={{fontSize:12,lineHeight:18,color:s.muted}}>
            {selectedPlatform==='wy'
              ?'每日推荐、推荐歌单、心动模式、收藏/创建歌单、我喜欢、私人 FM、最近播放、听歌排行、我的云盘及收藏歌手/专辑/MV 均已集成到发现页「网易」顶部入口，无需手动导入即可直接播放。'
              :selectedPlatform==='tx'
              ?'我喜欢、个人歌单、雷达推荐、新歌推荐、推荐歌单与个性首页均已在发现页「QQ」实时直达播放，无需手动导入。'
              :'每日推荐、我喜欢、个人歌单与新歌速递均已在发现页「酷狗」实时直达播放，无需手动导入。'}
          </Text>
        </View>
      </View>

      <Pressable
        testID={`toggle-manual-import-${selectedPlatform}`}
        accessibilityRole="button"
        accessibilityState={{expanded:showManualImport}}
        onPress={()=>setShowManualImport(v=>!v)}
        style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,paddingVertical:12,borderRadius:16,backgroundColor:s.dark?'rgba(255,255,255,0.05)':'rgba(42,36,31,0.04)'}}
      >
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Ionicons name="copy-outline" size={16} color={s.muted}/>
          <Text style={{fontSize:13,fontWeight:'600',color:s.muted}}>高级工具：手动复制远端歌单 / 收藏到本地音枢歌单</Text>
        </View>
        <Ionicons name={showManualImport?'chevron-up':'chevron-down'} size={16} color={s.subtle}/>
      </Pressable>

      {showManualImport&&selectedPlatform==='wy'&&<>
        <AccountPlaylistImport services={services} active={active} disabled={waiting} onLogin={()=>login('wy')}/>
        <AccountAlbumCatalog services={services} active={active} disabled={waiting} onLogin={()=>login('wy')}/>
        <AccountMVCatalog services={services} active={active} disabled={waiting} onLogin={()=>login('wy')}/>
      </>}
      {showManualImport&&selectedPlatform==='tx'&&<AccountPlaylistImport services={services} active={active} disabled={waiting} platform="tx" onLogin={()=>login('tx')}/>}
      {showManualImport&&selectedPlatform==='kg'&&<AccountPlaylistImport services={services} active={active} disabled={waiting} platform="kg" onLogin={()=>{void services.kugouLogin.login();}}/>}
    </>}
  </View>;
}
