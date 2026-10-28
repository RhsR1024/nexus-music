import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,AppState,Image,Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {kugouLoginBusy} from '../providers/kugouLoginCoordinator.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,space,radius,typography} from './tokens.ts';

export function KugouAccountCard({services,disabled,onRevealQr}:{services:Services;disabled:boolean;onRevealQr:(bounds:{top:number;height:number})=>void}){
  const {palette:p}=useTheme();
  const state=useSyncExternalStore(services.kugouLogin.subscribe,services.kugouLogin.getSnapshot);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const [error,setError]=useState('');
  const qrImage=useRef<Image|null>(null);
  const busy=kugouLoginBusy(state.status);
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',value=>{if(value!=='active')services.kugouLogin.cancel();});
    return()=>{subscription.remove();services.kugouLogin.cancel();};
  },[services]);
  const message=state.status==='loading'?'正在获取官方二维码':state.status==='waiting'?'等待酷狗扫码':state.status==='scanned'?'已扫码，请在酷狗中确认':state.status==='saving'?'正在保存登录':state.status==='succeeded'?'酷狗登录已保存':state.status==='expired'?'二维码已过期，请重新获取':state.status==='cancelled'?'酷狗登录已取消':state.status==='failed'?'酷狗登录服务暂时不可用，请重试':'';
  return <View style={{borderRadius:radius.lg,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,padding:space.lg,gap:space.md}}>
    <Text style={{...typography.heading,color:p.text}}>酷狗音乐</Text>
    <Text style={{...typography.caption,color:p.secondary}}>使用另一台设备中的酷狗音乐扫描官方二维码，并在酷狗中确认。登录凭据仅存本机，不参与备份或同步。</Text>
    {accounts.filter(account=>account.platform==='kg').map(account=><View key={account.id} style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
      <Text style={{...typography.body,color:p.text,flex:1}}>{account.displayName??account.label}</Text>
      <Pressable testID="remove-music-account-kg" accessibilityRole="button" accessibilityLabel="退出酷狗账号" disabled={busy} onPress={()=>{setError('');void services.musicAccounts.remove(account.id).catch(()=>setError('账号未移除，原有会话仍保留'));}} style={{minHeight:controls.hit,minWidth:64,justifyContent:'center',alignItems:'center',opacity:busy?.5:1}}><Text style={{...typography.caption,color:p.accent}}>退出</Text></Pressable>
    </View>)}
    <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:space.md}}>
      <Pressable testID="login-music-account-kg" accessibilityRole="button" accessibilityLabel="获取酷狗登录二维码" disabled={disabled||busy} onPress={()=>{setError('');void services.kugouLogin.login();}} style={{minHeight:48,paddingHorizontal:space.lg,borderRadius:radius.md,backgroundColor:p.accent,flexDirection:'row',alignItems:'center',gap:space.sm,opacity:disabled||busy?.65:1}}>
        {busy&&<ActivityIndicator color="#FFFFFF"/>}<Text style={{...typography.body,fontWeight:'600',color:'#FFFFFF'}}>{busy?'登录进行中':state.status==='idle'||state.status==='succeeded'?'获取登录二维码':'重新获取二维码'}</Text>
      </Pressable>
      {busy&&<Pressable testID="cancel-music-login-kg" accessibilityRole="button" accessibilityLabel="取消酷狗登录" onPress={()=>services.kugouLogin.cancel()} style={{minHeight:controls.hit,minWidth:64,alignItems:'center',justifyContent:'center'}}><Text style={{...typography.body,color:p.secondary}}>取消</Text></Pressable>}
    </View>
    {!!state.image&&<View style={{alignItems:'center',gap:space.sm}}>
      <Image key={state.generation} ref={qrImage} testID="kugou-login-qr" accessibilityLabel="酷狗官方登录二维码" accessible source={{uri:state.image}} resizeMode="contain" onError={()=>services.kugouLogin.imageFailed(state.generation)} onLayout={()=>requestAnimationFrame(()=>{
        const current=services.kugouLogin.getSnapshot();
        if(current.generation!==state.generation||!current.image)return;
        qrImage.current?.measureInWindow((_x,top,_width,height)=>onRevealQr({top,height}));
      })} style={{width:240,height:240,maxWidth:'100%',backgroundColor:'#FFFFFF'}}/>
      <Text style={{...typography.caption,color:p.secondary}}>二维码约两分钟有效。离开账号页或切到后台会取消本次登录。</Text>
    </View>}
    {!!message&&<Text testID={`kugou-login-${state.status}`} accessibilityLiveRegion="polite" accessibilityRole={state.status==='failed'?'alert':undefined} style={{...typography.caption,color:state.status==='failed'?p.accent:p.secondary}}>{message}</Text>}
    {!!error&&<Text accessibilityRole="alert" style={{...typography.caption,color:p.accent}}>{error}</Text>}
    <Text style={{...typography.caption,color:p.secondary}}>酷狗日推、个人歌单、收藏与账号播放暂未开放。</Text>
  </View>;
}
