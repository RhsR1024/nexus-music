import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,AppState,Image,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {kugouLoginBusy} from '../providers/kugouLoginCoordinator.ts';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {Cover} from './Cover.tsx';
import {AccountStatsStrip,MembershipPill} from './AccountInsightBadges.tsx';

export function KugouAccountCard({services,disabled,onRevealQr}:{services:Services;disabled:boolean;onRevealQr:(bounds:{top:number;height:number})=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const state=useSyncExternalStore(services.kugouLogin.subscribe,services.kugouLogin.getSnapshot);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const insights=useSyncExternalStore(services.accountInsights.subscribe,services.accountInsights.getSnapshot);
  const [error,setError]=useState('');
  const [mode,setMode]=useState<'qr'|'phone'>('qr');
  const [mobile,setMobile]=useState('');
  const [smsCode,setSmsCode]=useState('');
  const [phoneMid,setPhoneMid]=useState('');
  const [sendingCode,setSendingCode]=useState(false);
  const [phoneSubmitting,setPhoneSubmitting]=useState(false);
  const [phoneNotice,setPhoneNotice]=useState('');
  const [cooldown,setCooldown]=useState(0);
  const phoneAbort=useRef<AbortController|null>(null);
  const photo=useSyncExternalStore(services.kugouQrPhoto.subscribe,services.kugouQrPhoto.getSnapshot);
  const qrImage=useRef<Image|null>(null);
  const busy=kugouLoginBusy(state.status)||sendingCode||phoneSubmitting;
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',value=>{if(value==='background')services.kugouLogin.setForeground(false);else if(value==='active')services.kugouLogin.setForeground(true);});
    return()=>{subscription.remove();phoneAbort.current?.abort();services.kugouLogin.cancel();};
  },[services]);
  useEffect(()=>{
    if(cooldown<=0)return;
    const timer=setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);
    return()=>clearTimeout(timer);
  },[cooldown]);
  const sendCode=async()=>{
    phoneAbort.current?.abort();const controller=new AbortController();phoneAbort.current=controller;
    setSendingCode(true);setError('');setPhoneNotice('');
    try{
      const result=await services.kugouLogin.sendPhoneCode(mobile,controller.signal,phoneMid||undefined);
      if(!controller.signal.aborted){setPhoneMid(result.mid);setCooldown(60);setPhoneNotice('验证码已发送，请查收短信');}
    }catch(caught){
      if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'验证码发送失败，请重试或改用扫码登录');
    }finally{if(phoneAbort.current===controller){phoneAbort.current=null;setSendingCode(false);}}
  };
  const submitPhone=async()=>{
    phoneAbort.current?.abort();const controller=new AbortController();phoneAbort.current=controller;
    setPhoneSubmitting(true);setError('');setPhoneNotice('');
    try{
      await services.kugouLogin.loginWithPhone(mobile,smsCode,phoneMid,controller.signal);
      if(!controller.signal.aborted){setSmsCode('');setPhoneNotice('酷狗手机号登录成功，会话已保存');}
    }catch(caught){
      if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'登录失败，请检查验证码或改用扫码登录');
    }finally{if(phoneAbort.current===controller){phoneAbort.current=null;setPhoneSubmitting(false);}}
  };
  const message=state.status==='loading'?'正在获取官方二维码':state.status==='waiting'?'等待酷狗扫码':state.status==='scanned'?'已扫码，请在酷狗中确认':state.status==='saving'?'正在保存登录':state.status==='succeeded'?'酷狗登录已保存':state.status==='expired'?'二维码已过期，请重新获取':state.status==='cancelled'?'酷狗登录已取消':state.status==='failed'?'酷狗登录服务暂时不可用，请重试':'';
  const kgAccounts=accounts.filter(account=>account.platform==='kg');
  const signedIn=kgAccounts.length>0;
  const kgTint=s.dark?'rgba(45,140,255,0.18)':'rgba(24,119,242,0.11)';
  const kgInk=s.dark?'#68B0FF':'#1677E8';
  const okColor=s.dark?'#5EE0A0':'#1D8A56';
  const okBg=s.dark?'rgba(94,224,160,0.14)':'rgba(29,138,86,0.11)';
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';
  const insetBg=s.dark?'rgba(255,255,255,0.04)':'rgba(42,36,31,0.03)';

  return <View style={[{borderRadius:22,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
    <View style={{padding:16,gap:8}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:42,height:42,borderRadius:14,backgroundColor:kgTint,alignItems:'center',justifyContent:'center'}}>
          <Ionicons name={mode==='qr'?'qr-code-outline':'phone-portrait-outline'} size={20} color={kgInk}/>
        </View>
        <View style={{flex:1,minWidth:0,gap:3}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{fontSize:17,fontWeight:'700',color:s.ink}}>酷狗音乐</Text>
            <View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:10,backgroundColor:signedIn?okBg:s.chip,borderWidth:1,borderColor:signedIn?okColor+'33':s.chipBorder}}>
              <Text style={{fontSize:11,fontWeight:'700',color:signedIn?okColor:s.muted}}>{signedIn?`已登录 ${kgAccounts.length}`:'未登录'}</Text>
            </View>
          </View>
          <Text style={{fontSize:12,lineHeight:17,color:s.muted}}>支持扫码与手机号验证码登录，凭据仅存本机，不参与备份或同步。</Text>
        </View>
      </View>
    </View>

    {kgAccounts.map((account,index)=>{
      const insight=insights.byKey[account.id];
      const refreshing=Boolean(insights.refreshing[account.id]);
      return <View key={account.id}>
        <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:index===0?0:68,backgroundColor:s.hairline}}/>
        <View style={{minHeight:64,paddingHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:12}}>
          <Cover services={services} url={account.avatar} size={42} radius={21} fallbackText={account.displayName??account.label} testID="music-account-avatar-kg"/>
          <View style={{flex:1,minWidth:0,gap:3}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <Text numberOfLines={1} style={{fontSize:15,fontWeight:'600',color:s.ink,flexShrink:1}}>{account.displayName??account.label}</Text>
              <MembershipPill insight={insight} loading={refreshing} testID="music-account-vip-kg"/>
            </View>
            <Text numberOfLines={1} style={{fontSize:12,color:s.muted}}>会话凭据已保存到本机</Text>
          </View>
          <Pressable testID="refresh-music-account-kg" accessibilityRole="button" accessibilityLabel="刷新酷狗账号信息" disabled={busy||refreshing} onPress={()=>{void services.accountInsights.refreshAccount(account);}} style={{minWidth:50,minHeight:34,paddingHorizontal:10,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,justifyContent:'center',alignItems:'center',opacity:busy||refreshing?.5:1}}><Text style={{fontSize:12.5,fontWeight:'600',color:s.ink}}>{refreshing?'刷新中':'刷新'}</Text></Pressable>
          <Pressable testID="remove-music-account-kg" accessibilityRole="button" accessibilityLabel="退出酷狗账号" disabled={busy} onPress={()=>{setError('');void services.musicAccounts.remove(account.id).catch(()=>setError('账号未移除，原有会话仍保留'));}} style={{minWidth:54,minHeight:34,paddingHorizontal:11,borderRadius:17,backgroundColor:warnBg,justifyContent:'center',alignItems:'center',opacity:busy?.5:1}}><Text style={{fontSize:12.5,fontWeight:'600',color:s.accent}}>退出</Text></Pressable>
        </View>
        <AccountStatsStrip insight={insight} loading={refreshing}/>
      </View>;
    })}

    <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
    <View style={{padding:14,gap:12}}>
      <View style={{flexDirection:'row',padding:3,borderRadius:14,backgroundColor:insetBg,gap:4}}>
        {([['qr','扫码登录','qr-code-outline'],['phone','手机号验证码','chatbox-ellipses-outline']] as const).map(([id,label,icon])=>{
          const selected=mode===id;
          return <Pressable key={id} testID={`kugou-mode-${id}`} accessibilityRole="tab" accessibilityState={{selected}} onPress={()=>{setMode(id);setError('');setPhoneNotice('');}} style={{flex:1,minHeight:36,borderRadius:11,backgroundColor:selected?s.card:'transparent',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6}}>
            <Ionicons name={icon} size={14} color={selected?s.control:s.muted}/>
            <Text style={{fontSize:13,fontWeight:selected?'700':'500',color:selected?s.ink:s.muted}}>{label}</Text>
          </Pressable>;
        })}
      </View>

      {mode==='qr'?<>
        <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10}}>
          <Pressable testID="login-music-account-kg" accessibilityRole="button" accessibilityLabel="获取酷狗登录二维码" disabled={disabled||busy} onPress={()=>{setError('');void services.kugouLogin.login();}} style={{minHeight:44,paddingHorizontal:18,borderRadius:22,backgroundColor:s.control,flexDirection:'row',alignItems:'center',gap:8,opacity:disabled||busy?.6:1}}>
            {kugouLoginBusy(state.status)?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="qr-code-outline" size={17} color="#FFFFFF"/>}
            <Text style={{fontSize:14.5,fontWeight:'700',color:'#FFFFFF'}}>{kugouLoginBusy(state.status)?'登录进行中':state.status==='idle'||state.status==='succeeded'?'获取登录二维码':'重新获取二维码'}</Text>
          </Pressable>
          {kugouLoginBusy(state.status)&&<Pressable testID="cancel-music-login-kg" accessibilityRole="button" accessibilityLabel="取消酷狗登录" onPress={()=>services.kugouLogin.cancel()} style={{minWidth:60,minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>取消</Text></Pressable>}
        </View>

        {!!state.image&&<View style={{alignItems:'center',gap:10,padding:14,borderRadius:16,backgroundColor:insetBg}}>
          <View style={{padding:10,borderRadius:16,backgroundColor:'#FFFFFF'}}>
            <Image key={state.generation} ref={qrImage} testID="kugou-login-qr" accessibilityLabel="酷狗官方登录二维码" accessible source={{uri:state.image}} resizeMode="contain" onError={()=>services.kugouLogin.imageFailed(state.generation)} onLayout={()=>requestAnimationFrame(()=>{
              const current=services.kugouLogin.getSnapshot();
              if(current.generation!==state.generation||!current.image)return;
              qrImage.current?.measureInWindow((_x,top,_width,height)=>onRevealQr({top,height}));
            })} style={{width:220,height:220,maxWidth:'100%',backgroundColor:'#FFFFFF'}}/>
          </View>
          <Pressable testID="kugou-login-save-photo" accessibilityRole="button" disabled={photo.status==='saving'} onPress={()=>{void services.kugouQrPhoto.save();}} style={{minHeight:40,paddingHorizontal:16,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',gap:6,opacity:photo.status==='saving'?.5:1}}>
            <Ionicons name="download-outline" size={15} color={s.control}/>
            <Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>{photo.status==='saving'?'正在保存二维码…':'保存二维码到照片'}</Text>
          </Pressable>
          {photo.generation===state.generation&&photo.status!=='idle'&&photo.status!=='saving'&&<Text testID={`kugou-qr-photo-${photo.status}`} accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:17,color:s.muted,textAlign:'center'}}>{photo.status==='saved'?'已保存到照片。请在本机酷狗扫一扫中选择该图。':photo.status==='saved_stale'?'已保存到照片，但二维码已变化，请重新获取。':photo.status==='denied'?'未保存。需要允许添加照片权限；仍可用另一台设备扫码。':photo.status==='expired'?'二维码已失效，请重新获取。':photo.status==='cancelled'?'二维码保存已取消。':'未能保存二维码，请重试。'}</Text>}
          <Text style={{fontSize:11.5,lineHeight:17,color:s.muted,textAlign:'center'}}>{state.sameDevice?'保存后可切换到酷狗扫码，请在原二维码有效期内返回音枢继续验证；离开此账号页仍会取消。':'二维码约两分钟有效。未保存时离开账号页或切到后台会取消本次登录。'}</Text>
        </View>}

        {!!message&&<Text testID={`kugou-login-${state.status}`} accessibilityLiveRegion="polite" accessibilityRole={state.status==='failed'?'alert':undefined} style={{fontSize:12.5,color:state.status==='failed'?s.accent:s.muted}}>{message}</Text>}
      </>:<View style={{gap:10}}>
        <TextInput testID="kugou-phone-input" accessibilityLabel="酷狗登录手机号" placeholder="请输入 11 位手机号" placeholderTextColor={s.subtle} keyboardType="number-pad" maxLength={11} value={mobile} onChangeText={v=>setMobile(v.replace(/\D/g,''))} editable={!busy} style={{color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:14,paddingVertical:11,borderRadius:14,fontSize:14.5}}/>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <TextInput testID="kugou-code-input" accessibilityLabel="酷狗短信验证码" placeholder="短信验证码" placeholderTextColor={s.subtle} keyboardType="number-pad" maxLength={8} value={smsCode} onChangeText={v=>setSmsCode(v.replace(/\D/g,''))} editable={!phoneSubmitting} style={{flex:1,color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:14,paddingVertical:11,borderRadius:14,fontSize:14.5}}/>
          <Pressable testID="kugou-send-code" accessibilityRole="button" accessibilityLabel="发送酷狗验证码" disabled={disabled||busy||cooldown>0||mobile.length!==11} onPress={()=>{void sendCode();}} style={{minHeight:44,paddingHorizontal:14,borderRadius:14,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:disabled||busy||cooldown>0||mobile.length!==11?.5:1}}>
            <Text style={{fontSize:13,fontWeight:'600',color:s.ink}}>{sendingCode?'发送中…':cooldown>0?`${cooldown}s 后重试`:'发送验证码'}</Text>
          </Pressable>
        </View>
        <Pressable testID="kugou-phone-login" accessibilityRole="button" accessibilityLabel="登录酷狗账号" disabled={disabled||busy||mobile.length!==11||smsCode.length<4} onPress={()=>{void submitPhone();}} style={{minHeight:44,paddingHorizontal:18,borderRadius:22,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:disabled||busy||mobile.length!==11||smsCode.length<4?.55:1}}>
          {phoneSubmitting?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="log-in-outline" size={17} color="#FFFFFF"/>}
          <Text style={{fontSize:14.5,fontWeight:'700',color:'#FFFFFF'}}>{phoneSubmitting?'正在验证登录…':'验证并登录酷狗'}</Text>
        </Pressable>
        {!!phoneNotice&&<Text testID="kugou-phone-notice" accessibilityLiveRegion="polite" style={{fontSize:12.5,color:okColor,fontWeight:'600'}}>{phoneNotice}</Text>}
        <Text style={{fontSize:11.5,lineHeight:17,color:s.muted}}>若酷狗风控触发人机验证，请直接切换回「扫码登录」完成授权。</Text>
      </View>}

      {!!error&&<Text accessibilityRole="alert" style={{fontSize:12.5,color:s.accent}}>{error}</Text>}
      <Text style={{fontSize:12,lineHeight:17,color:s.muted}}>登录后可在音乐库获取每日推荐，账号歌单可在下方手动复制。</Text>
    </View>
  </View>;
}
