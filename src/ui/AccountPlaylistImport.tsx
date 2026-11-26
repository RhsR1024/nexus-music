import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import {AccountPlaylistError,type AccountPlaylist,type AccountPlaylistPreview} from '../providers/accountPlaylists.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {space,radius,typography,controls,sollinTokens} from './tokens.ts';
import {SheetModal} from './AdaptiveModal.tsx';

export function AccountPlaylistImport({services,active,disabled,onLogin,platform='wy'}:{services:Services;active:boolean;disabled:boolean;onLogin:()=>void;platform?:'wy'|'tx'|'kg'}){
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const available=accounts.filter(item=>item.platform===platform);
  const [selected,setSelected]=useState(''),[lists,setLists]=useState<readonly AccountPlaylist[]|null>(null);
  const [visibleCount,setVisibleCount]=useState(100);
  const [detail,setDetail]=useState<AccountPlaylist|null>(null),[copied,setCopied]=useState(false);
  const [preview,setPreview]=useState<AccountPlaylistPreview|null>(null),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  const [createName,setCreateName]=useState(''),[createPublic,setCreatePublic]=useState(false),[createMessage,setCreateMessage]=useState('');
  const [deleteMessage,setDeleteMessage]=useState('');
  const account=available.find(item=>item.id===selected)??available[0];
  const controller=useRef<AbortController|null>(null),closeWhenSettled=useRef(false),mounted=useRef(true),latest=useRef({active,account,preview});latest.current={active,account,preview};
  useLayoutEffect(()=>{controller.current?.abort();controller.current=null;closeWhenSettled.current=false;setLists(null);setDetail(null);setPreview(null);setBusy('');setMessage('');setCreateName('');setCreatePublic(false);setCreateMessage('');setDeleteMessage('');},[account]);
  useLayoutEffect(()=>{if(active)return;controller.current?.abort();controller.current=null;closeWhenSettled.current=false;setLists(null);setDetail(null);setPreview(null);setBusy('');setMessage('');setCreateMessage('');setDeleteMessage('');},[active]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();controller.current=null;};},[]);
  async function execute<T>(label:string,task:(signal:AbortSignal)=>Promise<T>,success:(value:T)=>void,failure:(message:string)=>void=setMessage,failureText='暂时无法读取或保存歌单，请重试'){
    if(!mounted.current||!latest.current.active||!latest.current.account||controller.current)return;
    const next=new AbortController();controller.current=next;setBusy(label);setMessage('');
    try{const value=await task(next.signal);if(controller.current===next&&latest.current.active)success(value);}
    catch(error){if(controller.current===next&&latest.current.active)failure(error instanceof AccountPlaylistError?error.message:failureText);}
    finally{if(controller.current===next){controller.current=null;setBusy('');if(closeWhenSettled.current){closeWhenSettled.current=false;setDetail(null);setPreview(null);}}}
  }
  const platformName=platform==='tx'?'QQ 音乐':platform==='kg'?'酷狗音乐':'网易云';
  const testID=(id:string)=>platform==='wy'?id:`${id}-${platform}`;
  const pending=!!busy,blocked=disabled||pending;
  const button=(id:string,title:string,onPress:()=>void,locked=blocked)=><Pressable testID={testID(id)} accessibilityRole="button" disabled={locked} onPress={onPress} style={[styles.button,{backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder},locked&&styles.disabled]}><Text style={[styles.body,{color:s.ink,fontWeight:'600',fontSize:13.5}]}>{title}</Text></Pressable>;
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
  const createPlaylist=()=>{
    if(!account||pending||!createName.trim())return;
    setCreateMessage('');
    void execute('正在创建网易云歌单',signal=>services.neteasePlaylist.create(account,createName,createPublic?0:10,signal),result=>{
      if(result.status==='created'&&result.playlist){
        // Only list() registers entries for an account-bound import preview.
        setLists(null);
        setCreateName('');setCreateMessage(`已创建网易云歌单「${result.playlist.title}」并回读确认`);
      }else if(result.status==='unconfirmed'){
        setCreateMessage(result.id?'平台已返回创建结果，但尚未回读确认。请重新读取账号歌单核对，不要重复创建。':'创建请求可能已提交，但未取得可核验结果。请重新读取账号歌单核对，不要重复创建。');
      }else if(result.status==='login_required')setCreateMessage('网易云登录已失效，请重新登录');
      else if(result.status==='account_changed')setCreateMessage('账号已更改；创建请求可能已提交，请重新登录后核对账号歌单');
      else if(result.status==='cancelled')setCreateMessage('操作已取消，未创建歌单');
      else if(result.status==='rejected')setCreateMessage('平台拒绝了新建歌单请求，未回读确认');
      else if(result.status==='unsupported')setCreateMessage('歌单名称或隐私设置无效');
      else setCreateMessage('暂时无法创建歌单，请重试');
    },setCreateMessage);
  };
  const deletePlaylist=(item:AccountPlaylist)=>{
    if(!account||pending||platform!=='wy'||item.kind!=='created')return;
    Alert.alert('删除这个网易云歌单？',`将从当前网易云账号删除「${item.title}」。歌单与歌曲不会被复制到音枢。`,[
      {text:'取消',style:'cancel'},
      {text:'删除',style:'destructive',onPress:()=>{
        if(!mounted.current||!latest.current.active||latest.current.account!==account)return;
        setDeleteMessage('');
        void execute('正在删除网易云歌单',signal=>services.neteasePlaylistDelete.delete(account,item,signal),result=>{
          if(result.status==='deleted'||result.status==='absent'){
            setLists(value=>value?.filter(row=>row.id!==item.id)??null);
            setDetail(current=>current?.id===item.id?null:current);
            setPreview(null);
            setDeleteMessage(result.status==='deleted'?`已从网易云音乐删除「${item.title}」并回读确认`:`「${item.title}」已不在账号歌单中`);
          }else if(result.status==='unconfirmed')setDeleteMessage('删除请求可能已提交，但未回读确认；请重新读取账号歌单核对，不要重复删除');
          else if(result.status==='rejected')setDeleteMessage('网易云音乐拒绝删除歌单，请检查账号权限');
          else if(result.status==='login_required')setDeleteMessage('网易云登录已失效，请在设置中重新登录');
          else if(result.status==='account_changed')setDeleteMessage('网易云账号已更改，请重新读取账号歌单');
          else if(result.status==='cancelled')setDeleteMessage('操作已取消，未继续等待删除结果');
          else if(result.status==='unsupported')setDeleteMessage('这个歌单暂不支持删除');
          else setDeleteMessage('暂时无法删除网易云歌单，请重试');
        },setDeleteMessage,'暂时无法删除网易云歌单，请重试');
      }},
    ]);
  };
  return <View testID={testID("account-playlists-card")} style={[styles.card,{borderColor:s.cardBorder,backgroundColor:s.card,borderWidth:1},s.cardShadow]}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <View style={{width:32,height:32,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="albums-outline" size={17} color={s.control}/></View>
      <Text accessibilityRole="header" style={[styles.heading,{color:s.ink,fontSize:16,fontWeight:'700'}]}>{platformName}账号歌单</Text>
    </View>
    <Text style={[styles.caption,{color:s.muted}]}>{platform==='wy'?'按需读取创建和收藏的歌单，确认后复制到音枢歌单。新建与删除会直接修改平台数据；导入不会，也不会自动同步。':'按需读取创建和收藏的歌单，确认后复制到音枢歌单。导入不会修改平台歌单，也不会自动同步。'}</Text>
    {!account?<>
      <Text testID={testID("account-playlists-login-required")} style={[styles.caption,{color:s.muted}]}>登录{platformName}后，可读取并导入账号歌单。</Text>
      {button('account-playlists-login',`登录${platformName}`,onLogin,disabled)}
    </>:<>
      {available.map(item=><Pressable key={item.id} testID={testID(`account-playlists-owner-${item.id}`)} accessibilityRole="radio" accessibilityState={{selected:item===account}} disabled={blocked} onPress={()=>setSelected(item.id)} style={[styles.owner,{backgroundColor:item===account?s.accentSoft:s.chip,borderWidth:1,borderColor:item===account?s.control+'44':s.chipBorder}]}><Text style={[styles.body,{color:item===account?s.control:s.ink,fontWeight:'600'}]}>{item.displayName??item.label}</Text></Pressable>)}
      {platform==='wy'&&<View testID="account-playlist-create" style={[styles.create,{borderColor:s.cardBorder,backgroundColor:s.dark?'rgba(255,255,255,0.035)':'rgba(42,36,31,0.03)'}]}>
        <Text accessibilityRole="header" style={[styles.body,{color:s.ink,fontWeight:'700',fontSize:14}]}>新建网易云歌单</Text>
        <TextInput testID="account-playlist-create-name" accessibilityLabel="新建网易云歌单名称" placeholder="歌单名称（1–40字）" placeholderTextColor={s.subtle} value={createName} editable={!pending} onChangeText={value=>{setCreateName(value);setCreateMessage('');}} maxLength={80} style={[styles.input,{color:s.ink,borderColor:s.cardBorder,backgroundColor:s.inputBg}]}/>
        <Pressable testID="account-playlist-create-privacy" accessibilityRole="switch" accessibilityLabel="公开新歌单" accessibilityState={{checked:createPublic}} disabled={blocked} onPress={()=>setCreatePublic(value=>!value)} style={styles.privacy}><Text style={[styles.caption,{color:s.ink,fontWeight:'600'}]}>{createPublic?'公开歌单':'私密歌单'}</Text><Text style={[styles.caption,{color:s.muted}]}>{createPublic?'公开后可被他人看到':'默认仅自己可见'}</Text></Pressable>
        <Pressable testID="account-playlist-create-submit" accessibilityRole="button" disabled={blocked||!createName.trim()} onPress={createPlaylist} style={[styles.button,{backgroundColor:s.control,alignItems:'center'},(blocked||!createName.trim())&&styles.disabled]}><Text style={[styles.body,{color:'#FFFFFF',fontWeight:'700',fontSize:14}]}>创建到网易云音乐</Text></Pressable>
        {!!createMessage&&<Text testID="account-playlist-create-status" accessibilityLiveRegion="polite" style={[styles.caption,{color:s.muted}]}>{createMessage}</Text>}
        <Text testID="account-playlist-management-note" style={[styles.caption,{color:s.subtle}]}>重命名暂未开放：现有协议需要同时写入描述和标签，音枢不会用猜测值覆盖平台资料。</Text>
      </View>}
      {button('account-playlists-load',lists?'重新读取歌单':'读取账号歌单',()=>{setLists(null);setPreview(null);void execute('正在读取歌单',signal=>services.accountPlaylists.list(account,signal),value=>{setLists(value);setVisibleCount(100);setPreview(null);});})}
      {pending&&!detail&&progress}
      {!!message&&!detail&&<Text testID={testID("account-playlists-status")} accessibilityLiveRegion="polite" style={[styles.caption,{color:s.muted}]}>{message}</Text>}
      {!!deleteMessage&&!detail&&<Text testID="account-playlist-delete-status" accessibilityLiveRegion="polite" style={[styles.caption,{color:s.muted}]}>{deleteMessage}</Text>}
      {lists?.length===0&&<Text testID={testID("account-playlists-empty")} style={[styles.body,{color:s.muted}]}>平台当前没有可导入的歌单。</Text>}
      {lists?.slice(0,visibleCount).map(item=><View key={item.id} style={[styles.row,{borderTopColor:s.hairline},blocked&&styles.disabled]}>
        <Pressable testID={testID(`account-playlist-${item.id}`)} accessibilityRole="button" accessibilityLabel={`${item.kind==='created'?'创建':'收藏'}的歌单：${item.title}，${item.count}首，预览导入`} disabled={blocked} onPress={()=>readDetail(item)} style={styles.rowMain}><Text style={[styles.body,{color:s.ink,fontWeight:'600'}]}>{item.title}</Text><Text style={[styles.caption,{color:s.muted}]}>{item.kind==='created'?'创建':'收藏'} · {item.count} 首 · 预览导入</Text></Pressable>
        {platform==='wy'&&item.kind==='created'&&<Pressable testID={`account-playlist-delete-${item.id}`} accessibilityRole="button" accessibilityLabel={`删除网易云歌单：${item.title}`} disabled={blocked} onPress={()=>deletePlaylist(item)} style={[styles.delete,{borderColor:s.cardBorder}]}><Text style={[styles.caption,{color:s.accent,fontWeight:'600'}]}>删除</Text></Pressable>}
      </View>)}
      {lists&&lists.length>visibleCount&&button('account-playlists-more','显示更多歌单',()=>setVisibleCount(value=>value+100))}
    </>}
    <SheetModal allowSwipeDismissal visible={active&&!!detail} animationType="slide" onRequestClose={closeDetail}>
      <SafeAreaView style={[styles.modal,{backgroundColor:s.sheetGradient[0]}]} edges={['top','bottom']}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={styles.modalHeader}><Text accessibilityRole="header" style={[styles.heading,{color:s.ink}]}>账号歌单预览</Text>{button('account-playlist-preview-close',pending?'取消操作':'返回歌单列表',closeDetail,false)}</View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          {detail&&<Text style={[styles.heading,{color:s.ink}]}>{detail.title}</Text>}
          {pending&&progress}
          {!!message&&<Text testID={testID("account-playlists-status")} accessibilityLiveRegion="polite" style={[styles.caption,{color:s.muted}]}>{message}</Text>}
          {preview&&<View testID={testID("account-playlist-preview")} style={[styles.preview,{backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}]}>
        <Text style={[styles.caption,{color:s.muted}]}>已读取完整歌单，共 {preview.tracks.length} 首</Text>
        {preview.tracks.slice(0,5).map((track,index)=><Text key={`${track.origin.id}:${index}`} numberOfLines={2} style={[styles.caption,{color:s.ink}]}>{track.title} · {track.artist}</Text>)}
        {preview.tracks.length>5&&<Text style={[styles.caption,{color:s.muted}]}>导入后可在音枢歌单查看全部歌曲。</Text>}
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
  row:{minHeight:controls.hit+space.xl,paddingVertical:space.md,gap:space.md,borderTopWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center'},
  rowMain:{flex:1,gap:space.xs},
  delete:{minHeight:controls.hit,minWidth:controls.hit,paddingHorizontal:space.md,borderRadius:radius.md,borderWidth:StyleSheet.hairlineWidth,justifyContent:'center',alignItems:'center'},
  create:{gap:space.sm,padding:space.md,borderRadius:radius.md,borderWidth:StyleSheet.hairlineWidth},
  input:{minHeight:controls.hit,paddingHorizontal:space.md,borderRadius:radius.md,borderWidth:StyleSheet.hairlineWidth},
  privacy:{minHeight:controls.hit,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm},
  preview:{gap:space.sm,padding:space.md,borderRadius:radius.md},
  progress:{gap:space.sm},disabled:{opacity:0.55},
  modal:{flex:1},modalHeader:{padding:space.lg,gap:space.md},modalContent:{padding:space.lg,gap:space.md},
});
