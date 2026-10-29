import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,FlatList,Pressable,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import {AccountCatalogError} from '../providers/accountCatalogRead.ts';
import type {AccountAlbum} from '../providers/accountAlbums.ts';
import type {AccountMV} from '../providers/accountMVs.ts';
import {Modal} from './AdaptiveModal.tsx';
import {Cover} from './Cover.tsx';
import {Discovery} from './Discovery.tsx';
import {MVDetail,videoDuration} from './MVDetail.tsx';
import {Text} from './Typography.tsx';
import {catalogArtwork,controls,radius,space,typography} from './tokens.ts';
import {useTheme} from './theme.tsx';
type Props={services:Services;active:boolean;disabled:boolean;onLogin:()=>void};
type Entry=AccountAlbum|AccountMV;
export function AccountAlbumCatalog(props:Props){return <AccountCatalog {...props} kind="album"/>;}
export function AccountMVCatalog(props:Props){return <AccountCatalog {...props} kind="mv"/>;}
function AccountCatalog({services,active,disabled,onLogin,kind}:Props&{kind:'album'|'mv'}){
 const {palette:p}=useTheme(),insets=useSafeAreaInsets(),accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot),available=accounts.filter(item=>item.platform==='wy');
 const noun=kind==='album'?'专辑':'MV',prefix=kind==='album'?'account-albums':'account-mvs',tid=(suffix:string)=>`${prefix}-${suffix}`;
 const [selected,setSelected]=useState(''),account=available.find(item=>item.id===selected)??available[0];
 const [visible,setVisible]=useState(false),[items,setItems]=useState<readonly Entry[]|null>(null),[detail,setDetail]=useState<Entry|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loginNeeded,setLoginNeeded]=useState(false);
 const controller=useRef<AbortController|null>(null),latest=useRef({active,account});latest.current={active,account};
 const close=()=>{controller.current?.abort();controller.current=null;setVisible(false);setDetail(null);setItems(null);setMessage('');setBusy(false);setLoginNeeded(false);};
 useLayoutEffect(()=>{close();},[account,active,kind]);useEffect(()=>()=>{controller.current?.abort();controller.current=null;},[]);
 const button=(id:string,title:string,press:()=>void,blocked=disabled||busy)=><Pressable testID={tid(id)} accessibilityRole="button" disabled={blocked} onPress={press} style={{minHeight:controls.hit,paddingHorizontal:space.md,paddingVertical:space.sm,borderRadius:radius.md,backgroundColor:p.selected,justifyContent:'center',opacity:blocked?0.55:1}}><Text style={{color:p.accent}}>{title}</Text></Pressable>;
 const load=async()=>{
  const owner=account;if(!active||!owner||disabled||controller.current)return;
  const next=new AbortController();controller.current=next;setVisible(true);setItems(null);setDetail(null);setMessage('');setLoginNeeded(false);setBusy(true);
  try{const values=await(kind==='album'?services.accountAlbums.list(owner,next.signal):services.accountMVs.list(owner,next.signal));if(controller.current===next&&latest.current.active&&latest.current.account===owner)setItems(values);}
  catch(error){if(controller.current===next&&latest.current.active&&latest.current.account===owner){setMessage(error instanceof AccountCatalogError?error.message:`暂时无法读取收藏${noun}，请重试`);setLoginNeeded(error instanceof AccountCatalogError&&error.kind==='login_required');}}
  finally{if(controller.current===next){controller.current=null;setBusy(false);}}
 };
 const open=(item:Entry)=>{if(!account||busy||disabled)return;try{if(item.kind==='album')services.accountAlbums.assertMember(account,item);else{services.accountMVs.assertMember(account,item);if(!item.canOpen){setMessage('此条目为平台视频，暂不支持在应用内打开；未加入音乐队列。');return;}}setDetail(item);}catch{setMessage(`账号或目录已更改，请重新读取收藏${noun}`);}};
 return <View testID={tid('card')} style={{padding:space.lg,gap:space.md,borderRadius:radius.xl,borderWidth:1,borderColor:p.border,backgroundColor:p.surface}}>
  <Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>网易云收藏{noun} · 远端</Text>
  <Text style={{color:p.secondary}}>按需读取平台账号的收藏目录，可刷新并打开{noun}；不修改平台收藏，与音枢本机目录分开管理。{kind==='mv'?'平台视频保留元信息并说明打开限制，不作为音乐播放。':''}</Text>
  {!account?<><Text testID={tid('login-required')} style={{color:p.secondary}}>登录网易云后可读取平台收藏{noun}。</Text>{button('login',`登录网易云读取收藏${noun}`,onLogin,disabled)}</>:<>
   {available.map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityState={{selected:item===account}} disabled={disabled||busy} onPress={()=>setSelected(item.id)} style={{minHeight:controls.hit,justifyContent:'center'}}><Text style={{color:p.text}}>{item.displayName??item.label}</Text></Pressable>)}
   {button('load',`读取平台收藏${noun}`,()=>{void load();})}
  </>}
  <Modal visible={active&&visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}><View style={{flex:1,paddingTop:insets.top+space.sm,paddingBottom:insets.bottom,paddingLeft:insets.left+space.lg,paddingRight:insets.right+space.lg,gap:space.md,backgroundColor:p.background[0]}}>
   <View style={{flexDirection:'row',justifyContent:'space-between',gap:space.md}}>{button('close',busy?'取消读取':'返回平台账号',close,false)}{button('refresh','刷新',()=>{void load();})}</View>
   <Text accessibilityRole="header" style={{...typography.title,color:p.text}}>平台收藏{kind==='mv'?'MV／视频':noun} · 网易云</Text>
   {busy&&<View style={{flexDirection:'row',gap:space.sm}}><ActivityIndicator color={p.accent}/><Text accessibilityLiveRegion="polite" style={{color:p.secondary}}>正在读取完整目录…</Text></View>}
   {!!message&&<Text testID={tid('status')} accessibilityRole="alert" style={{color:p.secondary}}>{message}</Text>}
   {loginNeeded&&button('relogin','返回账号重新登录',close)}
   {items&&<Text testID={tid('count')} style={{color:p.secondary}}>{items.length} 项平台{kind==='mv'?'视频收藏（含MV）':'收藏专辑'}</Text>}
   {items&&<FlatList data={items} keyExtractor={item=>item.kind==='album'?item.id:`${item.contentKind}:${item.id}`} ListEmptyComponent={<Text testID={tid('empty')} style={{color:p.secondary}}>平台账号当前没有收藏{noun}。</Text>} renderItem={({item})=><Pressable testID={item.kind==='album'?`account-album-${item.id}`:`account-mv-${item.contentKind}-${item.id}`} accessibilityRole="button" accessibilityLabel={item.kind==='mv'&&!item.canOpen?`平台视频：${item.title}，暂不支持打开`:`打开平台收藏${noun}：${item.title}`} onPress={()=>open(item)} disabled={disabled||busy} style={{minHeight:controls.hit,flexDirection:'row',alignItems:'center',gap:space.md,paddingVertical:space.sm,borderBottomWidth:1,borderColor:p.border}}><Cover services={services} url={item.artwork} size={item.kind==='mv'?catalogArtwork.videoWidth:catalogArtwork.square} aspectRatio={item.kind==='mv'?catalogArtwork.videoAspect:1}/><View style={{flex:1,gap:space.xs}}><Text numberOfLines={2} style={{color:p.text,fontWeight:'600'}}>{item.title}</Text><Text style={{color:p.secondary}}>{item.author??'网易云'}{item.kind==='album'?(item.count!==undefined?` · ${item.count} 首`:''):`${item.durationSeconds?` · ${videoDuration(item.durationSeconds)}`:''}${item.canOpen?'':' · 平台视频暂不支持打开'}`}</Text></View></Pressable>}/>}
   {detail&&(detail.kind==='album'?<Discovery services={services} initialCollection={{platform:'wy',kind:'album',collection:detail,returnLabel:'返回平台收藏专辑'}} onClose={()=>setDetail(null)}/>:<MVDetail services={services} platform="wy" video={detail} onClose={()=>setDetail(null)}/>)}
  </View></Modal>
 </View>;
}
