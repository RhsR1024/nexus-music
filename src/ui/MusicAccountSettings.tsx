import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {MusicAuthError} from '../providers/musicAuth.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';

export function MusicAccountSettings({services}:{services:Services}){
  const {palette:p}=useTheme();
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const auth=useSyncExternalStore(services.musicWebLogin.subscribe,services.musicWebLogin.getSnapshot);
  const [error,setError]=useState('');
  const netease=accounts.filter(account=>account.platform==='wy');
  const waiting=auth.status==='waiting';
  useEffect(()=>()=>services.musicWebLogin.cancel(),[services]);
  const login=()=>{
    setError('');
    void services.musicWebLogin.login('wy').catch(reason=>{
      setError(reason instanceof MusicAuthError?reason.message:'登录失败，请重试');
    });
  };
  const remove=(id:string)=>{
    setError('');
    void services.musicAccounts.remove(id).catch(()=>setError('账号未移除，原有会话仍保留'));
  };
  return <View style={{gap:18}}>
    <View style={{borderRadius:18,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,overflow:'hidden'}}>
      <View style={{padding:18,gap:8}}>
        <Text style={{fontSize:18,fontWeight:'600',color:p.text}}>网易云音乐</Text>
        <Text style={{fontSize:13,lineHeight:20,color:p.secondary}}>在官方网页完成登录。会话凭据只写入本机 Keychain，不进入备份、同步或日志。</Text>
      </View>
      {netease.map((account,index)=><View key={account.id} style={{minHeight:62,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:index===0?1:0,borderTopColor:p.border,borderBottomWidth:1,borderBottomColor:p.border}}>
        <View style={{flex:1,gap:3}}><Text style={{fontSize:15,color:p.text}}>{account.label}</Text><Text numberOfLines={1} style={{fontSize:12,color:p.secondary}}>{account.username}</Text></View>
        <Pressable testID={`remove-music-account-${account.platform}`} accessibilityRole="button" accessibilityLabel="退出网易云账号" onPress={()=>remove(account.id)} style={{minWidth:64,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13,color:p.accent}}>退出</Text></Pressable>
      </View>)}
      <View style={{padding:18,flexDirection:'row',alignItems:'center',gap:12}}>
        <Pressable testID="login-music-account-wy" accessibilityRole="button" accessibilityLabel={netease.length?'添加网易云账号':'登录网易云账号'} disabled={waiting} onPress={login} style={{minHeight:48,paddingHorizontal:18,borderRadius:14,backgroundColor:p.accent,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:waiting?.65:1}}>
          {waiting?<ActivityIndicator size="small" color="#FFFFFF"/>:null}
          <Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFF'}}>{waiting?'等待官方网页登录':netease.length?'添加网易云账号':'登录网易云账号'}</Text>
        </Pressable>
        {waiting&&<Pressable testID="cancel-music-login-wy" accessibilityRole="button" accessibilityLabel="取消网易云登录" onPress={()=>services.musicWebLogin.cancel()} style={{minWidth:60,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:14,color:p.secondary}}>取消</Text></Pressable>}
      </View>
    </View>
    {!!error&&<Text testID="music-account-error" accessibilityRole="alert" style={{fontSize:13,lineHeight:20,color:p.accent}}>{error}</Text>}
    {auth.status==='cancelled'&&<Text testID="music-account-cancelled" style={{fontSize:13,color:p.secondary}}>登录已取消</Text>}
    {auth.status==='expired'&&<Text testID="music-account-expired" accessibilityRole="alert" style={{fontSize:13,color:p.accent}}>登录已过期，请重新打开官方网页。</Text>}
    <Text style={{fontSize:12,lineHeight:19,color:p.secondary}}>登录成功只代表网页会话已保存。每日推荐、个人歌单、收藏与 FM 会分别验收，不会因登录成功自动标记完成。</Text>
  </View>;
}
