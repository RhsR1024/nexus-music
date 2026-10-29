import {useState,useSyncExternalStore} from 'react';
import {Alert,FlatList,Pressable,View} from 'react-native';
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
import {catalogArtwork,controls,radius,space,typography} from './tokens.ts';
import {useTheme} from './theme.tsx';
const platforms=[['wy','网易云'],['tx','QQ音乐'],['kw','酷我'],['kg','酷狗'],['mg','咪咕']] as const;
export function SavedCatalogs({services}:{services:Services}){
 const theme=useTheme(),insets=useSafeAreaInsets(),library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
 const [kind,setKind]=useState<CatalogKind|null>(null),[platform,setPlatform]=useState<OnlinePlatform|'all'>('all'),[selected,setSelected]=useState<CatalogFavorite|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const items=library.catalogFavorites??[],shown=items.filter(item=>item.kind===kind&&(platform==='all'||item.platform===platform));
 const button={minHeight:controls.hit,paddingHorizontal:space.md,justifyContent:'center' as const,borderRadius:radius.md,backgroundColor:theme.palette.selected};
 async function refresh(){setBusy(true);setMessage('');try{await services.library.reload();setMessage('已重新读取本机收藏');}catch{setMessage('本机收藏读取失败，请重试');}finally{setBusy(false);}}
 function remove(item:CatalogFavorite){Alert.alert(`取消收藏${catalogNames[item.kind]}？`,`${item.title}。只移除音枢本机收藏，不删除曲目、音频或平台数据。`,[{text:'取消',style:'cancel'},{text:'移除收藏',style:'destructive',onPress:()=>{setBusy(true);setMessage('');void services.library.removeCatalogFavorite(item,item.savedId).catch(()=>setMessage('收藏已更改或保存失败，请刷新后重新确认')).finally(()=>setBusy(false));}}]);}
 return <View style={{gap:space.sm,paddingVertical:space.md}}>
  <Text style={{...typography.heading,color:theme.palette.text}}>音枢目录收藏</Text><Text style={{color:theme.palette.secondary}}>保存在本机，与平台账号收藏分开管理。</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{(['playlist','album','mv'] as const).map(value=><Pressable key={value} testID={`saved-catalogs-open-${value}`} accessibilityRole="button" onPress={()=>{setPlatform('all');setSelected(null);setMessage('');setKind(value);}} style={button}><Text style={{color:theme.palette.accent}}>收藏{catalogNames[value]} {items.filter(item=>item.kind===value).length}</Text></Pressable>)}</View>
  <Modal visible={kind!==null} animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>{setSelected(null);setKind(null);}}><View style={{flex:1,paddingTop:insets.top+space.sm,paddingBottom:insets.bottom,paddingLeft:insets.left+space.lg,paddingRight:insets.right+space.lg,gap:space.sm,backgroundColor:theme.palette.background[0]}}>
   <View style={{flexDirection:'row',justifyContent:'space-between',gap:space.sm}}><Pressable testID="saved-catalogs-close" accessibilityRole="button" onPress={()=>setKind(null)} style={button}><Text style={{color:theme.palette.accent}}>返回收藏入口</Text></Pressable><Pressable testID="saved-catalogs-refresh" accessibilityRole="button" disabled={busy} onPress={()=>{void refresh();}} style={button}><Text style={{color:theme.palette.accent}}>{busy?'正在读取…':'刷新'}</Text></Pressable></View>
   <Text style={{...typography.title,color:theme.palette.text}}>收藏{kind?catalogNames[kind]:'目录'}</Text><Text testID="saved-catalogs-count" style={{color:theme.palette.secondary}}>{shown.length} 项本机收藏</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{([['all','全部'],...platforms] as const).map(([id,label])=><Pressable key={id} accessibilityRole="radio" accessibilityState={{selected:platform===id}} onPress={()=>setPlatform(id)} style={[button,platform===id&&{borderWidth:1,borderColor:theme.palette.accent}]}><Text style={{color:theme.palette.accent}}>{label}</Text></Pressable>)}</View>
   {!!message&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.secondary}}>{message}</Text>}
   <FlatList data={shown} keyExtractor={catalogKey} ListEmptyComponent={<Text style={{color:theme.palette.secondary,paddingVertical:space.lg}}>暂无此来源的本机收藏。可在公开歌单、专辑或MV详情中收藏。</Text>} renderItem={({item})=><View style={{flexDirection:'row',alignItems:'center',gap:space.sm,paddingVertical:space.sm,borderBottomWidth:1,borderColor:theme.palette.border}}>
    <Pressable testID={`saved-catalog-${catalogKey(item)}`} accessibilityRole="button" accessibilityLabel={`打开收藏${catalogNames[item.kind]}：${item.title}`} onPress={()=>setSelected(item)} style={{flex:1,minHeight:controls.hit,flexDirection:'row',gap:space.md,alignItems:'center'}}><Cover services={services} url={item.artwork} size={item.kind==='mv'?catalogArtwork.videoWidth:catalogArtwork.square} aspectRatio={item.kind==='mv'?catalogArtwork.videoAspect:1} radius={item.kind==='mv'?radius.md:undefined}/><View style={{flex:1,gap:space.xs}}><Text numberOfLines={2} style={{color:theme.palette.text,fontWeight:'600'}}>{item.title}</Text><Text style={{color:theme.palette.secondary}}>{platforms.find(([id])=>id===item.platform)?.[1]}{item.author?` · ${item.author}`:''}</Text></View></Pressable>
    <Pressable testID={`saved-catalog-remove-${catalogKey(item)}`} accessibilityRole="button" accessibilityLabel={`取消收藏：${item.title}`} disabled={busy} onPress={()=>remove(item)} style={{minHeight:controls.hit,minWidth:controls.hit,justifyContent:'center',alignItems:'center'}}><Text style={{color:theme.palette.accent}}>移除</Text></Pressable>
   </View>}/>
   {selected&&(selected.kind==='mv'?<MVDetail key={catalogKey(selected)} services={services} platform={selected.platform} video={selected} onClose={()=>setSelected(null)}/>:<Discovery key={catalogKey(selected)} services={services} initialCollection={{platform:selected.platform,collection:selected,...(selected.kind==='album'?{kind:'album' as const}:{}),returnLabel:`返回收藏${catalogNames[selected.kind]}`}} onClose={()=>setSelected(null)}/>)}
  </View></Modal>
 </View>;
}
