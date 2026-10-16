import {Text,TextInput} from './Typography.tsx';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator, FlatList, Linking, Pressable, View, useWindowDimensions} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {Cover} from './Cover.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {useTheme} from './theme.tsx';
export function DeviceMediaLibrary({services}:{services:Services}) {
  const {palette:p}=useTheme(),{width}=useWindowDimensions(),store=services.deviceMedia,state=useSyncExternalStore(store.subscribe,store.getSnapshot);
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[mode,setMode]=useState<'songs'|'albums'|'artists'>('songs'),[group,setGroup]=useState<string|null>(null),[adding,setAdding]=useState<readonly Track[]>(),[message,setMessage]=useState('');
  useEffect(()=>{if(open)void store.checkAuthorization().then(status=>{if(status==='authorized')return store.search(query);}).catch(()=>setMessage('无法读取媒体库权限'));},[open]);
  const groupKey=(track:Track)=>mode==='albums'?JSON.stringify([track.album||'未知专辑',track.metadata.albumArtist??track.artist]):track.artist;
  const groups=useMemo(()=>{const values=new Map<string,Track[]>();for(const track of state.tracks){const key=groupKey(track),list=values.get(key);if(list)list.push(track);else values.set(key,[track]);}return [...values].map(([key,tracks])=>({key,name:mode==='albums'?tracks[0]!.album||'未知专辑':tracks[0]!.artist,tracks})).sort((a,b)=>a.name.localeCompare(b.name,'zh'));},[state.tracks,mode]);
  const shown=useMemo(()=>group?state.tracks.filter(track=>groupKey(track)===group):state.tracks,[state.tracks,mode,group]);
  const status={authorized:'已授权',denied:'已拒绝授权',restricted:'系统限制访问',notDetermined:'尚未授权',unavailable:'当前无法访问'}[state.authorization];
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={action} style={{padding:12,borderRadius:15,backgroundColor:p.selected,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  return <View style={{marginBottom:18}}>{button(`设备媒体库 · ${status}`,()=>setOpen(true))}
    <Modal visible={open} onRequestClose={()=>setOpen(false)} animationType="slide"><View style={{flex:1,padding:22,paddingTop:64,gap:14,backgroundColor:p.background[0]}}>
      {button('收起设备媒体库',()=>setOpen(false))}<Text style={{fontSize:30,fontWeight:'700',color:p.text}}>设备媒体库</Text>
      <Text testID="device-media-authorization" style={{color:p.secondary}}>{status}</Text>
      <Text style={{fontSize:12,lineHeight:19,color:p.secondary}}>读取你授权的系统音乐库。云端未下载和受保护媒体会单独标记；设备引用仅在本机有效，不替代文件导入。</Text>
      {state.authorization==='notDetermined'?button('授权访问设备媒体库',()=>{void store.checkAuthorization(true).then(status=>{if(status==='authorized')return store.search(query);}).catch(()=>setMessage('无法请求媒体库授权'));}):state.authorization!=='authorized'?<View style={{gap:10}}>{button('前往系统设置',()=>{void Linking.openSettings().catch(()=>setMessage('请在系统设置中检查音枢的媒体库权限'));})}{button('重新检查媒体库权限',()=>{void store.checkAuthorization().catch(()=>setMessage('权限检查失败'));})}</View>:<>
        <TextInput accessibilityLabel="搜索设备媒体库" value={query} onChangeText={setQuery} onSubmitEditing={()=>{setGroup(null);void store.search(query);}} placeholder="歌曲、艺术家或专辑" placeholderTextColor={p.secondary} style={{padding:12,borderWidth:1,borderColor:p.border,borderRadius:14,color:p.text}}/>
        <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{button('搜索或刷新设备音乐',()=>{setGroup(null);void store.search(query);},state.busy)}{(['songs','albums','artists'] as const).map(value=><View key={value}>{button({songs:'歌曲',albums:'专辑',artists:'艺术家'}[value],()=>{setMode(value);setGroup(null);})}</View>)}</View>
        <Text style={{color:p.secondary,fontSize:12}}>已加载 {state.tracks.length} / {state.total} 首 · 分组基于已加载结果</Text>
        {group&&button('返回媒体库分组',()=>setGroup(null))}
        {mode==='songs'||group?<FlatList key="songs" data={shown} keyExtractor={track=>track.origin.id} initialNumToRender={12} windowSize={5} keyboardShouldPersistTaps="handled" ListEmptyComponent={!state.busy?<Text style={{color:p.secondary}}>设备音乐库为空，或没有匹配的音乐</Text>:null} renderItem={({item,index})=><View style={{paddingVertical:12,gap:10,borderBottomWidth:1,borderBottomColor:p.border}}>
          <Pressable accessibilityRole="button" disabled={!!item.metadata.deviceUnavailable} accessibilityState={{disabled:!!item.metadata.deviceUnavailable}} onPress={()=>services.playTracks(shown,index)} style={{flexDirection:'row',gap:12,alignItems:'center',opacity:item.metadata.deviceUnavailable?.55:1}}><Cover services={services} track={item} size={54}/><View style={{flex:1}}><Text style={{color:p.text,fontWeight:'600'}}>{item.title}</Text><Text style={{color:p.secondary,fontSize:12}}>{item.artist} · {item.album}</Text>{!!item.metadata.deviceUnavailable&&<Text style={{color:p.secondary,fontSize:12}}>{{protected:'受保护媒体',cloud:'尚未下载到本机',unavailable:'没有可用媒体地址'}[String(item.metadata.deviceUnavailable)]}</Text>}</View></Pressable>
          <View style={{flexDirection:'row',gap:10}}>{button('收藏',()=>{void services.library.favorite(item).catch(()=>setMessage('收藏未保存'));})}{button('加入歌单',()=>setAdding([item]))}</View>
        </View>}/>:<FlatList key={`groups-${mode}`} numColumns={mode==='albums'?2:1} columnWrapperStyle={mode==='albums'?{justifyContent:'space-between'}:undefined} data={groups} keyExtractor={item=>item.key} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`${item.name} · ${item.tracks.length}首`} onPress={()=>setGroup(item.key)} style={{width:mode==='albums'?'48%':'100%',padding:12,marginVertical:6,borderRadius:18,backgroundColor:p.surface,gap:10,flexDirection:mode==='albums'?'column':'row'}}><Cover services={services} track={item.tracks[0]!} size={mode==='albums'?Math.min(180,Math.max(80,(width-76)/2-24)):48}/><Text style={{color:p.text,flexShrink:1}}>{item.name}</Text></Pressable>}/>}
        {state.tracks.length<state.total&&button('加载更多设备音乐',()=>{void store.loadMore();},state.busy||state.stale)}
      </>}
      {state.busy&&<ActivityIndicator color={p.accent} accessibilityLabel="读取设备媒体库"/>}{!!(state.error||message)&&<Text accessibilityRole="alert" style={{color:p.accent}}>{state.error??message}</Text>}
      <PlaylistPicker services={services} tracks={adding??[]} visible={!!adding} onClose={()=>setAdding(undefined)}/>
    </View></Modal>
  </View>;
}
