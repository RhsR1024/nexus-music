import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,FlatList,Pressable,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import {AccountAlbumError,type AccountAlbum} from '../providers/accountAlbums.ts';
import {Modal} from './AdaptiveModal.tsx';
import {Cover} from './Cover.tsx';
import {Discovery} from './Discovery.tsx';
import {Text} from './Typography.tsx';
import {catalogArtwork,controls,radius,space,typography} from './tokens.ts';
import {useTheme} from './theme.tsx';
export function AccountAlbumCatalog({services,active,disabled,onLogin}:{services:Services;active:boolean;disabled:boolean;onLogin:()=>void}){
 const {palette:p}=useTheme(),insets=useSafeAreaInsets(),accounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot),available=accounts.filter(item=>item.platform==='wy');
 const [selected,setSelected]=useState(''),account=available.find(item=>item.id===selected)??available[0];
 const [visible,setVisible]=useState(false),[items,setItems]=useState<readonly AccountAlbum[]|null>(null),[detail,setDetail]=useState<AccountAlbum|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loginNeeded,setLoginNeeded]=useState(false);
 const controller=useRef<AbortController|null>(null),latest=useRef({active,account});latest.current={active,account};
 const close=()=>{controller.current?.abort();controller.current=null;setVisible(false);setDetail(null);setItems(null);setMessage('');setBusy(false);setLoginNeeded(false);};
 useLayoutEffect(()=>{close();},[account,active]);
 useEffect(()=>()=>{controller.current?.abort();controller.current=null;},[]);
 const button=(id:string,title:string,press:()=>void,blocked=disabled||busy)=><Pressable testID={id} accessibilityRole="button" disabled={blocked} onPress={press} style={{minHeight:controls.hit,paddingHorizontal:space.md,paddingVertical:space.sm,borderRadius:radius.md,backgroundColor:p.selected,justifyContent:'center',opacity:blocked?0.55:1}}><Text style={{color:p.accent}}>{title}</Text></Pressable>;
 const load=async()=>{
  const owner=account;if(!active||!owner||disabled||controller.current)return;
  const next=new AbortController();controller.current=next;setVisible(true);setItems(null);setDetail(null);setMessage('');setLoginNeeded(false);setBusy(true);
  try{const values=await services.accountAlbums.list(owner,next.signal);if(controller.current===next&&latest.current.active&&latest.current.account===owner)setItems(values);}
  catch(error){if(controller.current===next&&latest.current.active&&latest.current.account===owner){setMessage(error instanceof AccountAlbumError?error.message:'暂时无法读取收藏专辑，请重试');setLoginNeeded(error instanceof AccountAlbumError&&error.kind==='login_required');}}
  finally{if(controller.current===next){controller.current=null;setBusy(false);}}
 };
 const open=(item:AccountAlbum)=>{if(!account||busy||disabled)return;try{services.accountAlbums.assertMember(account,item);setDetail(item);}catch{setMessage('账号或目录已更改，请重新读取收藏专辑');}};
 return <View testID="account-albums-card" style={{padding:space.lg,gap:space.md,borderRadius:radius.xl,borderWidth:1,borderColor:p.border,backgroundColor:p.surface}}>
  <Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>网易云收藏专辑 · 远端</Text>
  <Text style={{color:p.secondary}}>按需读取平台账号的收藏目录，可刷新并打开专辑；不修改平台收藏，与音枢本机目录分开管理。</Text>
  {!account?<><Text testID="account-albums-login-required" style={{color:p.secondary}}>登录网易云后可读取平台收藏专辑。</Text>{button('account-albums-login','登录网易云读取收藏专辑',onLogin,disabled)}</>:<>
   {available.map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityState={{selected:item===account}} disabled={disabled||busy} onPress={()=>setSelected(item.id)} style={{minHeight:controls.hit,justifyContent:'center'}}><Text style={{color:p.text}}>{item.displayName??item.label}</Text></Pressable>)}
   {button('account-albums-load','读取平台收藏专辑',()=>{void load();})}
  </>}
  <Modal visible={active&&visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}><View style={{flex:1,paddingTop:insets.top+space.sm,paddingBottom:insets.bottom,paddingLeft:insets.left+space.lg,paddingRight:insets.right+space.lg,gap:space.md,backgroundColor:p.background[0]}}>
   <View style={{flexDirection:'row',justifyContent:'space-between',gap:space.md}}>{button('account-albums-close',busy?'取消读取':'返回平台账号',close,false)}{button('account-albums-refresh','刷新',()=>{void load();})}</View>
   <Text accessibilityRole="header" style={{...typography.title,color:p.text}}>平台收藏专辑 · 网易云</Text>
   {busy&&<View style={{flexDirection:'row',gap:space.sm}}><ActivityIndicator color={p.accent}/><Text accessibilityLiveRegion="polite" style={{color:p.secondary}}>正在读取完整目录…</Text></View>}
   {!!message&&<Text testID="account-albums-status" accessibilityRole="alert" style={{color:p.secondary}}>{message}</Text>}
   {loginNeeded&&button('account-albums-relogin','重新登录网易云',()=>{close();onLogin();})}
   {items&&<Text testID="account-albums-count" style={{color:p.secondary}}>{items.length} 张平台收藏专辑</Text>}
   {items&&<FlatList data={items} keyExtractor={item=>item.id} ListEmptyComponent={<Text testID="account-albums-empty" style={{color:p.secondary}}>平台账号当前没有收藏专辑。</Text>} renderItem={({item})=><Pressable testID={`account-album-${item.id}`} accessibilityRole="button" accessibilityLabel={`打开平台收藏专辑：${item.title}`} onPress={()=>open(item)} disabled={disabled||busy} style={{minHeight:controls.hit,flexDirection:'row',alignItems:'center',gap:space.md,paddingVertical:space.sm,borderBottomWidth:1,borderColor:p.border}}><Cover services={services} url={item.artwork} size={catalogArtwork.square}/><View style={{flex:1,gap:space.xs}}><Text numberOfLines={2} style={{color:p.text,fontWeight:'600'}}>{item.title}</Text><Text style={{color:p.secondary}}>{item.author??'网易云'}{item.count!==undefined?` · ${item.count} 首`:''}</Text></View></Pressable>}/>}
   {detail&&<Discovery services={services} initialCollection={{platform:'wy',kind:'album',collection:detail,returnLabel:'返回平台收藏专辑'}} onClose={()=>setDetail(null)}/>}
  </View></Modal>
 </View>;
}
