import {useState,useSyncExternalStore} from 'react';
import {Alert,FlatList,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import type {OnlinePlatform} from '../domain/track.ts';
import {catalogKey,type CatalogFavorite,type CatalogKind} from '../storage/catalogFavorites.ts';
import {Modal} from './AdaptiveModal.tsx';
import {catalogNames} from './CatalogFavoriteButton.tsx';
import {Cover} from './Cover.tsx';
import {Discovery} from './Discovery.tsx';
import {MVDetail} from './MVDetail.tsx';
import {Text} from './Typography.tsx';
import {catalogArtwork,controls,radius,sollinTokens,space,typography} from './tokens.ts';
import {useTheme} from './theme.tsx';
const platforms=[['wy','网易云'],['tx','QQ音乐'],['kw','酷我'],['kg','酷狗'],['mg','咪咕']] as const;
const kindIcons:Record<CatalogKind,React.ComponentProps<typeof Ionicons>['name']>={playlist:'list',album:'disc-outline',mv:'videocam-outline'};
export function SavedCatalogs({services,compact=false}:{services:Services;compact?:boolean}){
 const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets(),library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
 const [kind,setKind]=useState<CatalogKind|null>(null),[platform,setPlatform]=useState<OnlinePlatform|'all'>('all'),[selected,setSelected]=useState<CatalogFavorite|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const items=library.catalogFavorites??[],shown=items.filter(item=>item.kind===kind&&(platform==='all'||item.platform===platform));
 const pill={minHeight:compact?38:controls.hit,paddingHorizontal:compact?12:14,flexDirection:'row' as const,alignItems:'center' as const,gap:6,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder};
 async function refresh(){setBusy(true);setMessage('');try{await services.library.reload();setMessage('已重新读取本机收藏');}catch{setMessage('本机收藏读取失败，请重试');}finally{setBusy(false);}}
 function remove(item:CatalogFavorite){Alert.alert(`取消收藏${catalogNames[item.kind]}？`,`${item.title}。只移除音枢本机收藏，不删除曲目、音频或平台数据。`,[{text:'取消',style:'cancel'},{text:'移除收藏',style:'destructive',onPress:()=>{setBusy(true);setMessage('');void services.library.removeCatalogFavorite(item,item.savedId).catch(()=>setMessage('收藏已更改或保存失败，请刷新后重新确认')).finally(()=>setBusy(false));}}]);}
 return <View style={{gap:compact?6:space.sm,paddingVertical:compact?2:space.sm}}>
  {!compact&&<View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between'}}><Text style={{fontSize:16,fontWeight:'700',color:s.ink}}>本机目录收藏</Text><Text style={{color:s.muted,fontSize:12}}>与平台账号分开管理</Text></View>}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['playlist','album','mv'] as const).map(value=>{const count=items.filter(item=>item.kind===value).length;return <Pressable key={value} testID={`saved-catalogs-open-${value}`} accessibilityRole="button" accessibilityLabel={`收藏${catalogNames[value]} ${count}`} onPress={()=>{setPlatform('all');setSelected(null);setMessage('');setKind(value);}} style={pill}><Ionicons name={kindIcons[value]} size={15} color={s.control}/><Text style={{color:s.ink,fontSize:13,fontWeight:'500'}}>收藏{catalogNames[value]}</Text><Text style={{color:s.muted,fontSize:12,fontWeight:'600'}}>{count}</Text></Pressable>;})}</View>
  <Modal visible={kind!==null} animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>{setSelected(null);setKind(null);}}><View style={{flex:1,paddingTop:insets.top+space.sm,paddingBottom:insets.bottom,paddingLeft:insets.left+space.lg,paddingRight:insets.right+space.lg,gap:space.sm,backgroundColor:theme.palette.background[0]}}>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:space.sm}}><Pressable testID="saved-catalogs-close" accessibilityRole="button" accessibilityLabel="返回收藏入口" onPress={()=>setKind(null)} style={pill}><Ionicons name="chevron-back" size={16} color={s.ink}/><Text style={{color:s.ink,fontSize:13,fontWeight:'600'}}>返回收藏入口</Text></Pressable><Pressable testID="saved-catalogs-refresh" accessibilityRole="button" accessibilityLabel={busy?'正在读取…':'刷新'} disabled={busy} onPress={()=>{void refresh();}} style={pill}><Ionicons name="refresh" size={15} color={s.control}/><Text style={{color:s.control,fontSize:13,fontWeight:'600'}}>{busy?'正在读取…':'刷新'}</Text></Pressable></View>
   <View style={{gap:2,paddingTop:4}}><Text style={{...typography.title,color:s.ink}}>收藏{kind?catalogNames[kind]:'目录'}</Text><Text testID="saved-catalogs-count" style={{color:s.muted,fontSize:13}}>{shown.length} 项本机收藏</Text></View>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{([['all','全部'],...platforms] as const).map(([id,label])=><Pressable key={id} accessibilityRole="radio" accessibilityState={{selected:platform===id}} onPress={()=>setPlatform(id)} style={{minHeight:36,paddingHorizontal:12,borderRadius:18,justifyContent:'center',backgroundColor:platform===id?s.control:s.chip,borderWidth:1,borderColor:platform===id?s.control:s.chipBorder}}><Text style={{color:platform===id?'#FFFFFF':s.muted,fontSize:13,fontWeight:'600'}}>{label}</Text></Pressable>)}</View>
   {!!message&&<Text accessibilityLiveRegion="polite" style={{color:s.muted,fontSize:12}}>{message}</Text>}
   <FlatList data={shown} keyExtractor={catalogKey} ListEmptyComponent={<Text style={{color:s.muted,paddingVertical:space.lg}}>暂无此来源的本机收藏。可在公开歌单、专辑或MV详情中收藏。</Text>} renderItem={({item})=><View style={{flexDirection:'row',alignItems:'center',gap:space.sm,paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
    <Pressable testID={`saved-catalog-${catalogKey(item)}`} accessibilityRole="button" accessibilityLabel={`打开收藏${catalogNames[item.kind]}：${item.title}`} onPress={()=>setSelected(item)} style={{flex:1,minHeight:controls.hit,flexDirection:'row',gap:space.md,alignItems:'center'}}><Cover services={services} url={item.artwork} size={item.kind==='mv'?catalogArtwork.videoWidth:56} aspectRatio={item.kind==='mv'?catalogArtwork.videoAspect:1} radius={item.kind==='mv'?radius.md:10}/><View style={{flex:1,gap:3}}><Text numberOfLines={2} style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{item.title}</Text><Text style={{color:s.muted,fontSize:12}}>{platforms.find(([id])=>id===item.platform)?.[1]}{item.author?` · ${item.author}`:''}</Text></View></Pressable>
    <Pressable testID={`saved-catalog-remove-${catalogKey(item)}`} accessibilityRole="button" accessibilityLabel={`取消收藏：${item.title}`} disabled={busy} onPress={()=>remove(item)} style={{minHeight:controls.hit,paddingHorizontal:10,justifyContent:'center',alignItems:'center'}}><Text style={{color:s.accent,fontSize:13,fontWeight:'600'}}>移除</Text></Pressable>
   </View>} showsVerticalScrollIndicator={false}/>
   {selected&&(selected.kind==='mv'?<MVDetail key={catalogKey(selected)} services={services} platform={selected.platform} video={selected} onClose={()=>setSelected(null)}/>:<Discovery key={catalogKey(selected)} services={services} initialCollection={{platform:selected.platform,collection:selected,...(selected.kind==='album'?{kind:'album' as const}:{}),returnLabel:`返回收藏${catalogNames[selected.kind]}`}} onClose={()=>setSelected(null)}/>)}
  </View></Modal>
 </View>;
}
