import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import {AccountPlaylistError,type AccountPlaylist,type AccountPlaylistPreview} from '../providers/accountPlaylists.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {space,radius,typography,controls} from './tokens.ts';
import {SheetModal} from './AdaptiveModal.tsx';

export function AccountPlaylistImport({services,active,disabled,onLogin,platform='wy'}:{services:Services;active:boolean;disabled:boolean;onLogin:()=>void;platform?:'wy'|'tx'|'kg'}){
  const {palette:p}=useTheme();
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const available=accounts.filter(item=>item.platform===platform);
  const [selected,setSelected]=useState(''),[lists,setLists]=useState<readonly AccountPlaylist[]|null>(null);
  const [visibleCount,setVisibleCount]=useState(100);
  const [detail,setDetail]=useState<AccountPlaylist|null>(null),[copied,setCopied]=useState(false);
  const [preview,setPreview]=useState<AccountPlaylistPreview|null>(null),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  const account=available.find(item=>item.id===selected)??available[0];
  const controller=useRef<AbortController|null>(null),closeWhenSettled=useRef(false),mounted=useRef(true),latest=useRef({active,account,preview});latest.current={active,account,preview};
  useLayoutEffect(()=>{controller.current?.abort();controller.current=null;closeWhenSettled.current=false;setLists(null);setDetail(null);setPreview(null);setBusy('');setMessage('');},[account]);
  useLayoutEffect(()=>{if(active)return;controller.current?.abort();controller.current=null;closeWhenSettled.current=false;setLists(null);setDetail(null);setPreview(null);setBusy('');setMessage('');},[active]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();controller.current=null;};},[]);
  async function execute<T>(label:string,task:(signal:AbortSignal)=>Promise<T>,success:(value:T)=>void){
    if(!mounted.current||!latest.current.active||!latest.current.account||controller.current)return;
    const next=new AbortController();controller.current=next;setBusy(label);setMessage('');
    try{const value=await task(next.signal);if(controller.current===next&&latest.current.active)success(value);}
    catch(error){if(controller.current===next&&latest.current.active)setMessage(error instanceof AccountPlaylistError?error.message:'暂时无法读取或保存歌单，请重试');}
    finally{if(controller.current===next){controller.current=null;setBusy('');if(closeWhenSettled.current){closeWhenSettled.current=false;setDetail(null);setPreview(null);}}}
  }
  const platformName=platform==='tx'?'QQ 音乐':platform==='kg'?'酷狗音乐':'网易云';
  const testID=(id:string)=>platform==='wy'?id:`${id}-${platform}`;
  const pending=!!busy,blocked=disabled||pending;
  const button=(id:string,title:string,onPress:()=>void,locked=blocked)=><Pressable testID={testID(id)} accessibilityRole="button" disabled={locked} onPress={onPress} style={[styles.button,{backgroundColor:p.selected},locked&&styles.disabled]}><Text style={[styles.body,{color:p.accent}]}>{title}</Text></Pressable>;
  const closeDetail=()=>{if(controller.current){closeWhenSettled.current=true;controller.current.abort();setMessage('正在取消操作');}else{setDetail(null);setPreview(null);setMessage('');}};
  const readDetail=(item:AccountPlaylist)=>{if(!account||pending)return;setDetail(item);setCopied(false);setPreview(null);void execute('正在读取完整歌单',signal=>services.accountPlaylists.preview(account,item,signal),setPreview);};
  const progress=<View style={styles.progress}><ActivityIndicator color={p.accent}/><Text testID={testID("account-playlists-busy")} accessibilityLiveRegion="polite" style={[styles.caption,{color:p.secondary}]}>{busy}</Text>{button('account-playlists-cancel','取消操作',()=>{if(detail)closeDetail();else{controller.current?.abort();setMessage('正在取消操作');}},false)}</View>;
  const copy=()=>{
    const value=preview,owner=account;if(!value||!owner)return;
    Alert.alert('导入音枢歌单',`将“${value.playlist.title}”的 ${value.tracks.length} 首歌曲复制到音枢歌单，不修改平台数据。`,[{text:'取消',style:'cancel'},{text:'导入',onPress:()=>{
      if(!mounted.current||!latest.current.active||latest.current.account!==owner||latest.current.preview!==value)return;
      void execute('正在保存音枢歌单',signal=>services.accountPlaylists.importPreview(owner,value,signal),()=>{setCopied(true);setPreview(null);setMessage('已导入音枢歌单，可在音乐库查看和播放');});
    }}]);
  };
  return <View testID={testID("account-playlists-card")} style={[styles.card,{borderColor:p.border,backgroundColor:p.surface}]}>
    <Text accessibilityRole="header" style={[styles.heading,{color:p.text}]}>{platformName}账号歌单</Text>
    <Text style={[styles.caption,{color:p.secondary}]}>按需读取创建和收藏的歌单，确认后复制到音枢歌单。平台歌单不会被修改，也不会自动同步。</Text>
    {!account?<>
      <Text testID={testID("account-playlists-login-required")} style={[styles.body,{color:p.secondary}]}>登录{platformName}后，可读取并导入账号歌单。</Text>
      {button('account-playlists-login',`登录${platformName}`,onLogin,disabled)}
    </>:<>
      {available.map(item=><Pressable key={item.id} testID={testID(`account-playlists-owner-${item.id}`)} accessibilityRole="radio" accessibilityState={{selected:item===account}} disabled={blocked} onPress={()=>setSelected(item.id)} style={[styles.owner,{backgroundColor:item===account?p.selected:p.surface}]}><Text style={[styles.body,{color:p.text}]}>{item.displayName??item.label}</Text></Pressable>)}
      {button('account-playlists-load',lists?'重新读取歌单':'读取账号歌单',()=>{setPreview(null);void execute('正在读取歌单',signal=>services.accountPlaylists.list(account,signal),value=>{setLists(value);setVisibleCount(100);setPreview(null);});})}
      {pending&&!detail&&progress}
      {!!message&&!detail&&<Text testID={testID("account-playlists-status")} accessibilityLiveRegion="polite" style={[styles.caption,{color:p.secondary}]}>{message}</Text>}
      {lists?.length===0&&<Text testID={testID("account-playlists-empty")} style={[styles.body,{color:p.secondary}]}>平台当前没有可导入的歌单。</Text>}
      {lists?.slice(0,visibleCount).map(item=><Pressable key={item.id} testID={testID(`account-playlist-${item.id}`)} accessibilityRole="button" accessibilityLabel={`${item.kind==='created'?'创建':'收藏'}的歌单：${item.title}，${item.count}首，预览导入`} disabled={blocked} onPress={()=>readDetail(item)} style={[styles.row,{borderTopColor:p.border},blocked&&styles.disabled]}><Text style={[styles.body,{color:p.text}]}>{item.title}</Text><Text style={[styles.caption,{color:p.secondary}]}>{item.kind==='created'?'创建':'收藏'} · {item.count} 首 · 预览导入</Text></Pressable>)}
      {lists&&lists.length>visibleCount&&button('account-playlists-more','显示更多歌单',()=>setVisibleCount(value=>value+100))}
    </>}
    <SheetModal visible={active&&!!detail} animationType="slide" onRequestClose={closeDetail}>
      <SafeAreaView style={[styles.modal,{backgroundColor:p.surface}]} edges={['top','bottom']}>
        <View style={styles.modalHeader}><Text accessibilityRole="header" style={[styles.heading,{color:p.text}]}>账号歌单预览</Text>{button('account-playlist-preview-close',pending?'取消操作':'返回歌单列表',closeDetail,false)}</View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          {detail&&<Text style={[styles.heading,{color:p.text}]}>{detail.title}</Text>}
          {pending&&progress}
          {!!message&&<Text testID={testID("account-playlists-status")} accessibilityLiveRegion="polite" style={[styles.caption,{color:p.secondary}]}>{message}</Text>}
          {preview&&<View testID={testID("account-playlist-preview")} style={[styles.preview,{backgroundColor:p.selected}]}>
        <Text style={[styles.caption,{color:p.secondary}]}>已读取完整歌单，共 {preview.tracks.length} 首</Text>
        {preview.tracks.slice(0,5).map((track,index)=><Text key={`${track.origin.id}:${index}`} numberOfLines={2} style={[styles.caption,{color:p.text}]}>{track.title} · {track.artist}</Text>)}
        {preview.tracks.length>5&&<Text style={[styles.caption,{color:p.secondary}]}>导入后可在音枢歌单查看全部歌曲。</Text>}
        {button('account-playlist-copy','复制到音枢歌单',copy)}
          </View>}
          {!pending&&!preview&&!copied&&detail&&button('account-playlist-retry','重新读取完整歌单',()=>readDetail(detail))}
        </ScrollView>
      </SafeAreaView>
    </SheetModal>
  </View>;
}

const styles=StyleSheet.create({
  card:{padding:space.lg,gap:space.md,borderRadius:radius.xl,borderWidth:StyleSheet.hairlineWidth},
  heading:typography.heading,body:typography.body,caption:typography.caption,
  button:{minHeight:controls.hit+space.xs,paddingHorizontal:space.lg,borderRadius:radius.md,justifyContent:'center'},
  owner:{minHeight:controls.hit,paddingHorizontal:space.md,borderRadius:radius.deck,justifyContent:'center'},
  row:{minHeight:controls.hit+space.xl,paddingVertical:space.md,gap:space.xs,borderTopWidth:StyleSheet.hairlineWidth},
  preview:{gap:space.sm,padding:space.md,borderRadius:radius.md},
  progress:{gap:space.sm},disabled:{opacity:0.55},
  modal:{flex:1},modalHeader:{padding:space.lg,gap:space.md},modalContent:{padding:space.lg,gap:space.md},
});
