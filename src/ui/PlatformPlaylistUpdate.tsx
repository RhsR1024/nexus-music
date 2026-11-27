import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import type {MusicAccount} from '../providers/musicAccounts.ts';
import {AccountPlaylistError,type AccountPlaylist} from '../providers/accountPlaylists.ts';
import type {NeteasePlaylistTrackResult} from '../providers/neteasePlaylistTracks.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';

export type PlatformPlaylistOperation='add'|'remove';
const failureCopy=(status:NeteasePlaylistTrackResult['status'],operation:PlatformPlaylistOperation)=>{
  if(status==='unconfirmed'||status==='unknown')return '已提交，但未确认歌单变化，请稍后重新读取核对';
  if(status==='rejected')return operation==='add'?'网易云音乐拒绝添加到歌单，请检查账号权限':'网易云音乐拒绝从歌单移除，请检查账号权限';
  if(status==='login_required')return '网易云音乐登录已失效，请在设置中重新登录';
  if(status==='account_changed')return '网易云音乐账号已更改，请重新打开歌曲操作';
  if(status==='unsupported')return `这首歌或目标歌单暂不支持${operation==='add'?'添加':'移除'}`;
  if(status==='unavailable')return operation==='add'?'暂时无法添加到网易云歌单，请重试':'暂时无法从网易云歌单移除，请重试';
  return operation==='add'?'添加未完成，请重试':'移除未完成，请重试';
};

export function PlatformPlaylistUpdate({services,track,account,operation,onBack,onUpdated}:{
  services:Services;track:Track;account:MusicAccount;operation:PlatformPlaylistOperation;onBack:()=>void;
  onUpdated:(title:string,unchanged:boolean,operation:PlatformPlaylistOperation)=>void;
}){
  const {palette:p}=useTheme();
  const [lists,setLists]=useState<readonly AccountPlaylist[]|null>(null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const controller=useRef<AbortController|null>(null),mounted=useRef(true);
  const trackId=track.origin.kind==='online'?track.origin.id:'';
  const verb=operation==='add'?'添加':'移除';
  const load=()=>{
    if(controller.current)return;
    const next=new AbortController();controller.current=next;setBusy(true);setMessage('');
    void services.accountPlaylists.list(account,next.signal).then(value=>{
      if(!mounted.current||controller.current!==next)return;
      setLists(value.filter(item=>item.kind==='created'));
    }).catch(error=>{
      if(!mounted.current||controller.current!==next)return;
      setMessage(error instanceof AccountPlaylistError?error.message:'暂时无法读取网易云歌单，请重试');
    }).finally(()=>{
      if(!mounted.current||controller.current!==next)return;
      controller.current=null;setBusy(false);
    });
  };
  useEffect(()=>{
    mounted.current=true;load();
    return()=>{mounted.current=false;controller.current?.abort();controller.current=null;};
  },[]);
  const close=()=>{controller.current?.abort();controller.current=null;onBack();};
  const choose=(item:AccountPlaylist)=>{
    if(busy||!trackId)return;
    const next=new AbortController();controller.current=next;setBusy(true);setMessage('');
    void services.neteasePlaylistTracks.update(account,item,trackId,operation==='add'?'add':'del',next.signal).then(result=>{
      if(!mounted.current||controller.current!==next)return;
      if(operation==='add'&&(result.status==='added'||result.status==='already')){onUpdated(item.title,result.status==='already',operation);return;}
      if(operation==='remove'&&(result.status==='removed'||result.status==='absent')){onUpdated(item.title,result.status==='absent',operation);return;}
      setMessage(failureCopy(result.status,operation));
    }).catch(()=>{
      if(mounted.current&&controller.current===next)setMessage(`${verb}未完成，请重试`);
    }).finally(()=>{
      if(!mounted.current||controller.current!==next)return;
      controller.current=null;setBusy(false);
    });
  };
  return <ScrollView testID="platform-playlist-update" style={{backgroundColor:p.background[0]}} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.heading}>
      <View style={{flex:1,gap:space.xs}}>
        <Text accessibilityRole="header" style={[typography.title,{color:p.text}]}>{verb}网易云歌单</Text>
        <Text style={[typography.caption,{color:p.secondary}]}>{track.title} · {account.displayName??account.label}</Text>
      </View>
      <Pressable testID="platform-playlist-back" accessibilityRole="button" accessibilityLabel="返回歌曲操作" disabled={busy} onPress={close} style={[styles.back,{backgroundColor:p.surface},busy&&styles.disabled]}><Text style={[typography.caption,{color:p.accent}]}>返回</Text></Pressable>
    </View>
    <Text style={[typography.caption,{color:p.secondary}]}>只显示当前账号创建的歌单。确认写入后会重新读取歌单核对，不把接口 code 200 单独当作成功。</Text>
    {busy&&<View style={styles.progress}><ActivityIndicator color={p.accent}/><Text testID="platform-playlist-busy" accessibilityLiveRegion="polite" style={[typography.caption,{color:p.secondary}]}>正在读取或更新网易云歌单…</Text></View>}
    {!!message&&<Text testID="platform-playlist-error" accessibilityLiveRegion="polite" style={[typography.caption,{color:p.accent}]}>{message}</Text>}
    {!busy&&lists===null&&!!message&&<Pressable testID="platform-playlist-retry" accessibilityRole="button" onPress={load} style={[styles.button,{backgroundColor:p.surface}]}><Text style={[typography.body,{color:p.accent}]}>重新读取歌单</Text></Pressable>}
    {lists?.length===0&&<Text testID="platform-playlist-empty" style={[typography.body,{color:p.secondary}]}>当前账号还没有可{verb}的网易云歌单。</Text>}
    {!!lists?.length&&<View testID="platform-playlist-list" style={{gap:space.sm}}>
      {lists.map((item,index)=><Pressable key={item.id} testID={`platform-playlist-target-${index}`} accessibilityRole="button" accessibilityLabel={`${verb}歌单：${item.title}，${item.count} 首`} disabled={busy} onPress={()=>choose(item)} style={[styles.row,{backgroundColor:p.surface,borderColor:p.border},busy&&styles.disabled]}>
        <View style={{flex:1,gap:space.xs}}><Text style={[typography.body,{color:p.text}]}>{item.title}</Text><Text style={[typography.caption,{color:p.secondary}]}>{item.count} 首 · 创建的歌单</Text></View>
        <Text style={[typography.caption,{color:p.accent}]}>{verb}</Text>
      </Pressable>)}
    </View>}
  </ScrollView>;
}

const styles=StyleSheet.create({
  content:{padding:space.lg,gap:space.md,paddingBottom:space.xl},
  heading:{flexDirection:'row',alignItems:'flex-start',gap:space.md},
  back:{minHeight:controls.hit,paddingHorizontal:space.md,borderRadius:radius.md,justifyContent:'center'},
  progress:{flexDirection:'row',alignItems:'center',gap:space.sm},
  row:{minHeight:controls.hit+space.md,paddingHorizontal:space.md,paddingVertical:space.sm,borderRadius:radius.md,borderWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',gap:space.md},
  button:{minHeight:controls.hit,paddingHorizontal:space.md,borderRadius:radius.md,justifyContent:'center'},
  disabled:{opacity:.55},
});
