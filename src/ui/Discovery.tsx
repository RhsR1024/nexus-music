import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {Alert, FlatList, Pressable, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Modal,SheetModal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import type {OnlinePlatform,Track} from '../domain/track.ts';
import type {BrowseItem} from '../providers/discovery.ts';
import {parsePlaylistLink} from '../providers/playlistLink.ts';
import {Cover} from './Cover.tsx';
import {trackRows,viewTrackRows,type TrackSort} from '../domain/trackList.ts';
import {TrackListTools} from './TrackListTools.tsx';
import {QishuiImport} from './QishuiImport.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
type PageView={kind:'playlists'}|{kind:'rankings'}|{kind:'categories'}|{kind:'detail';id:string;title:string;rank:boolean;artwork?:string;description?:string};
type Item={kind:'collection';value:BrowseItem;rank:boolean}|{kind:'category';id:string;title:string;group?:string}|{kind:'track';track:Track;key?:string};
const platforms=[['wy','网易'],['tx','QQ'],['kw','酷我'],['kg','酷狗'],['mg','咪咕']]as const;
export function Discovery({services,embedded=false}:{services:Services;embedded?:boolean}){
  const theme=useTheme(),{width,fontScale}=useWindowDimensions();
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [contentWidth,setContentWidth]=useState<number>();
  const [tools,setTools]=useState(false),[descriptionOpen,setDescriptionOpen]=useState(false);
  const [query,setQuery]=useState(''),[sort,setSort]=useState<TrackSort>('original');
  const [total,setTotal]=useState<number>();

  const [open,setOpen]=useState(false),[platform,setPlatform]=useState<OnlinePlatform>('wy'),[view,setView]=useState<PageView>({kind:'playlists'}),[category,setCategory]=useState<string>();
  const [items,setItems]=useState<readonly Item[]>([]),[more,setMore]=useState(false),[retryAppend,setRetryAppend]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState(''),[importing,setImporting]=useState(false),[adding,setAdding]=useState<readonly Track[]>([]),[menuTrack,setMenuTrack]=useState<Track|null>(null);
  const page=useRef(0),generation=useRef(0),pending=useRef(new AbortController()),importAbort=useRef(new AbortController());
  async function load(append=false){
    const version=++generation.current;pending.current.abort();pending.current=new AbortController();const signal=pending.current.signal,next=append?page.current+1:1;
    setRetryAppend(append);
    setLoading(true);setError('');
    try{
      let values:Item[]=[],hasMore=false,detailTotal:number|undefined;
      if(view.kind==='playlists'){const result=await services.discovery.playlists(platform,next,category,signal);values=result.items.map(value=>({kind:'collection',value,rank:false}));hasMore=result.hasMore;}
      else if(view.kind==='rankings'){values=(await services.discovery.rankings(platform,signal)).map(value=>({kind:'collection',value,rank:true}));}
      else if(view.kind==='categories'){values=(await services.discovery.categories(platform,signal)).map(value=>({kind:'category',...value}));}
      else{const result=await services.discovery.detail(platform,view.id,next,signal,view.rank);values=result.items.map(track=>({kind:'track',track}));hasMore=result.hasMore;detailTotal=result.total;}
      if(version!==generation.current||signal.aborted)return;
      if(view.kind==='detail')setTotal(detailTotal);
      setItems(old=>append?[...old,...values]:values);setMore(hasMore);setRetryAppend(false);page.current=next;
    }catch{if(version===generation.current&&!signal.aborted)setError('此平台暂时无法读取，请重试或选择其他平台；已加载内容保留。');}
    finally{if(version===generation.current)setLoading(false);}
  }
  useEffect(()=>{if(open||embedded){setItems([]);setQuery('');setSort('original');setMore(false);setRetryAppend(false);page.current=0;void load();}return()=>{generation.current++;pending.current.abort();importAbort.current.abort();};},[open,embedded,platform,view,category]);
  function close(){importAbort.current.abort();setImporting(false);setAdding([]);setMenuTrack(null);setOpen(false);}
  async function importPlaylist(){
    if(view.kind!=='detail')return;importAbort.current.abort();importAbort.current=new AbortController();const signal=importAbort.current.signal;
    setImporting(true);setMessage('');
    try{
      const result=await services.discovery.complete(platform,view.id,signal,view.rank);if(signal.aborted)return;
      if(!result.tracks.length){setMessage('此歌单为空，未创建本地歌单');return;}
      Alert.alert('导入公开歌单',`${result.title} · ${result.tracks.length} 首。保留平台来源、完整顺序和重复项；创建一个新的音枢本地歌单。`,[{text:'取消',style:'cancel'},{text:'创建本地歌单',onPress:()=>{void services.library.createPlaylist(result.title,result.tracks).then(()=>setMessage('已保存到我的歌单')).catch(()=>setMessage('保存失败，原音乐库保留'));}}]);
    }catch(error){if(!signal.aborted)setMessage(error instanceof Error&&/分页|歌曲|20000/.test(error.message)?error.message:'未能完整读取歌单，原音乐库保留；可重试');}
    finally{if(!signal.aborted)setImporting(false);}
  }
  const loadedTracks=useMemo(()=>items.flatMap(item=>item.kind==='track'?[item.track]:[]),[items]);
  const shownRows=useMemo(()=>viewTrackRows(trackRows(loadedTracks),query,sort),[loadedTracks,query,sort]);
  const tracks=useMemo(()=>shownRows.map(row=>row.track),[shownRows]);
  const displayed:readonly Item[]=view.kind==='detail'?shownRows.map(row=>({kind:'track',track:row.track,key:row.key})):items;
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{backgroundColor:theme.color('#303A32'),padding:12,borderRadius:10,opacity:disabled ? .4 : 1}}><Text style={{color:theme.color('#D9F49B')}}>{label}</Text></Pressable>;
  const usableWidth=contentWidth??Math.max(1,width-48);
  const gridColumns=Math.max(1,Math.min(4,Math.floor((usableWidth+14)/(160*Math.max(1,fontScale)+14))));
  const columns=view.kind==='detail'?1:gridColumns,cardWidth=Math.max(1,Math.min(240,(usableWidth-14*(columns-1))/columns));
  const openCollection=(item:BrowseItem,rank:boolean)=>{setDescriptionOpen(false);setTotal(undefined);setView({kind:'detail',id:item.id,title:item.title,rank,artwork:item.artwork,description:item.description});};
  const header=<View style={{gap:20,paddingBottom:24}}>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{!embedded&&button('收起发现',close)}{view.kind==='detail'&&button('返回歌单广场',()=>setView({kind:'playlists'}))}</View>
    {view.kind==='detail'?<>
      <View style={{flexDirection:'row',alignItems:'center',gap:20}}><Cover services={services} url={view.artwork} size={116}/><View style={{flex:1,gap:8}}><Text accessibilityRole="header" style={{fontSize:25,fontWeight:'700',color:theme.palette.text}}>{view.title}</Text><Text style={{color:theme.palette.secondary}}>{platforms.find(([id])=>id===platform)?.[1]} · 已加载 {loadedTracks.length}{total!==undefined?` / ${total}`:''} 首</Text></View><Pressable accessibilityRole="button" accessibilityLabel="刷新歌单" accessibilityHint="重新读取当前分页，失败时保留已加载内容" onPress={()=>{void load();}} disabled={loading} style={{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:theme.palette.surface,opacity:loading?.45:1}}><Ionicons name="refresh" size={22} color={theme.palette.accent}/></Pressable></View>
      <TrackListTools query={query} onQuery={setQuery} sort={sort} onSort={setSort} label="搜索已加载歌曲歌手专辑"/><Text style={{color:theme.palette.secondary,fontSize:12}}>筛选显示 {tracks.length} 首；搜索和排序仅作用于已加载歌曲，完整导入保留平台原始顺序。</Text>
      {!!view.description&&<Pressable accessibilityRole="button" accessibilityLabel={descriptionOpen?'收起歌单简介':'展开歌单简介'} onPress={()=>setDescriptionOpen(value=>!value)}><Text numberOfLines={descriptionOpen?undefined:2} style={{color:theme.palette.secondary,lineHeight:23}}>{view.description}</Text><Text style={{color:theme.palette.accent,marginTop:6}}>{descriptionOpen?'收起':'展开'}</Text></Pressable>}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{tracks.length>0&&button('播放已加载歌曲',()=>services.playTracks(tracks,0))}{tracks.length>0&&button('随机播放已加载',()=>{void services.preferences.update({shuffle:true}).then(()=>services.playTracks(tracks,0)).catch(()=>setMessage('无法保存随机模式，请重试'));})}</View>
      {button(importing?'正在完整读取…':'导入完整歌单到音乐库',()=>{void importPlaylist();},importing)}{importing&&button('取消读取',()=>{importAbort.current.abort();setImporting(false);})}
    </>:<>
      <Text accessibilityRole="header" style={{fontSize:40,fontWeight:'800',color:theme.palette.text,letterSpacing:-1}}>发现</Text>
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{platforms.map(([id,name])=><Pressable key={id} accessibilityRole="radio" accessibilityLabel={name} accessibilityState={{selected:platform===id}} onPress={()=>{setPlatform(id);setCategory(undefined);setView({kind:'playlists'});}} style={{paddingHorizontal:15,paddingVertical:11,borderRadius:22,backgroundColor:platform===id?theme.palette.selected:theme.palette.surface}}><Text style={{color:platform===id?theme.palette.accent:theme.palette.secondary,fontWeight:platform===id?'700':'400'}}>{name}</Text></Pressable>)}</View>
      <View style={{flexDirection:'row',gap:8}}>{([['playlists','精选歌单'],['rankings','榜单'],['categories','分类']]as const).map(([kind,label])=><Pressable key={kind} accessibilityRole="tab" accessibilityState={{selected:view.kind===kind}} onPress={()=>setView({kind})} style={{flex:1,padding:14,borderRadius:24,backgroundColor:view.kind===kind?theme.palette.selected:'transparent',alignItems:'center'}}><Text style={{color:view.kind===kind?theme.palette.text:theme.palette.secondary,fontWeight:'600',fontSize:16}}>{label}</Text></Pressable>)}</View>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:theme.palette.text,fontSize:23,fontWeight:'700'}}>{view.kind==='rankings'?'排行榜':view.kind==='categories'?'选择喜欢的风格':'发现好歌单'}</Text><Pressable accessibilityRole="button" accessibilityLabel="展开歌单导入" onPress={()=>setTools(value=>!value)} style={{padding:10}}><Text style={{color:theme.palette.accent}}>歌单导入</Text></Pressable></View>
      {(tools||!embedded)&&<View style={{gap:12,padding:16,borderRadius:22,backgroundColor:theme.palette.surface}}>
        <TextInput accessibilityLabel="公开歌单分享链接或ID" placeholder="分享链接或当前平台歌单ID" placeholderTextColor={theme.palette.secondary} value={link} onChangeText={setLink} autoCorrect={false} autoCapitalize="none" style={{color:theme.palette.text,padding:14,borderRadius:12,borderWidth:1,borderColor:theme.palette.border}}/>
        {button('预览分享歌单',()=>{try{const value=parsePlaylistLink(link,platform);setMessage('');setTotal(undefined);setView({kind:'detail',id:value.id,title:'公开分享歌单',rank:false});}catch(error){setMessage(error instanceof Error?error.message:'分享地址无效');}})}
        <QishuiImport services={services}/>
      </View>}
      {!!category&&button('清除分类筛选',()=>{setCategory(undefined);setView({kind:'playlists'});})}
    </>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.accent,lineHeight:22}}>{message}</Text>}
  </View>;
  const content=<View testID="discovery-content" onLayout={event=>{const next=Math.max(1,event.nativeEvent.layout.width-48);setContentWidth(previous=>previous!==undefined&&Math.abs(previous-next)<.5?previous:next);}} style={{flex:1,backgroundColor:embedded?'transparent':theme.palette.background[0],paddingHorizontal:24,paddingTop:embedded?0:60}}>
    <FlatList key={columns} numColumns={columns} columnWrapperStyle={columns>1?{gap:14}:undefined} data={displayed} keyExtractor={(item,index)=>item.kind==='track'?item.key??`${index}-track`:`${index}-${item.kind}`} ListHeaderComponent={header} initialNumToRender={12} windowSize={7} contentContainerStyle={{paddingBottom:40}} keyboardShouldPersistTaps="handled"
      renderItem={({item,index})=>item.kind==='track'?<View testID={`discovery-track-${index}`} style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12,borderTopWidth:1,borderColor:theme.palette.border}}>
        <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)} style={{flex:1,minHeight:50,flexDirection:'row',alignItems:'center',gap:12}}><Cover services={services} track={item.track} size={50}/><View style={{flex:1,gap:6}}><Text numberOfLines={2} style={{color:theme.palette.text,fontSize:16,fontWeight:'600'}}>{item.track.title}</Text><Text numberOfLines={1} style={{color:theme.palette.secondary}}>{item.track.artist}{item.track.album?` · ${item.track.album}`:''}</Text></View></Pressable>
        <Pressable testID={`discovery-more-${index}`} accessibilityRole="button" accessibilityLabel={`更多操作：${item.track.title}`} onPress={()=>setMenuTrack(item.track)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="ellipsis-horizontal" size={24} color={theme.palette.accent}/></Pressable>
      </View>:<Pressable testID={`discovery-item-${index}`} accessibilityRole="button" onPress={()=>item.kind==='category'?(setCategory(item.id),setView({kind:'playlists'})):openCollection(item.value,item.rank)} style={{flex:1,marginBottom:24,gap:9,maxWidth:cardWidth}}>
        {item.kind==='collection'?<Cover services={services} url={item.value.artwork} size={cardWidth}/>:<View style={{padding:22,borderRadius:22,backgroundColor:theme.palette.surface}}><Text style={{color:theme.palette.accent,fontSize:22}}>♫</Text></View>}
        <Text numberOfLines={2} style={{color:theme.palette.text,fontSize:15,fontWeight:'600',lineHeight:21}}>{item.kind==='category'?item.title:item.value.title}</Text><Text numberOfLines={1} style={{color:theme.palette.secondary,fontSize:12}}>{item.kind==='category'?item.group:item.value.count!==undefined?`${item.value.count} 首`:item.value.description}</Text>
      </Pressable>}
      ListFooterComponent={<View style={{gap:12,paddingVertical:24}}>{loading&&<Text style={{color:theme.palette.secondary}}>正在获取平台数据…</Text>}{!!error&&<Text style={{color:theme.palette.accent}}>{error}</Text>}{!loading&&!error&&!items.length&&<Text style={{color:theme.palette.secondary}}>此平台暂未返回可展示内容</Text>}{button(error?'重试':'刷新',()=>{void load(error?retryAppend:false);},loading)}{more&&button('加载更多',()=>{void load(true);},loading)}</View>}/>
  </View>;
  const sheetAction=(label:string,icon:React.ComponentProps<typeof Ionicons>['name'],action:()=>void)=><Pressable testID={`discovery-action-${label}`} accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{minHeight:56,paddingHorizontal:16,borderRadius:14,backgroundColor:theme.palette.surface,flexDirection:'row',alignItems:'center',gap:14}}><Ionicons name={icon} size={22} color={theme.palette.accent}/><Text style={{color:theme.palette.text,fontSize:16,fontWeight:'600'}}>{label}</Text><Ionicons name="chevron-forward" size={18} color={theme.palette.secondary} style={{marginLeft:'auto'}}/></Pressable>;
  const overlays=<SheetModal visible={!!menuTrack||adding.length>0} animationType="slide" onRequestClose={()=>{setMenuTrack(null);setAdding([]);}}>{adding.length>0?<PlaylistPicker inline services={services} tracks={adding} visible onClose={()=>setAdding([])}/>:<View testID="discovery-actions" style={{flex:1,backgroundColor:theme.palette.background[0],padding:24,paddingTop:48,gap:14}}><Pressable accessibilityRole="button" accessibilityLabel="收起歌曲更多操作" onPress={()=>setMenuTrack(null)} style={{minHeight:44,justifyContent:'center'}}><Ionicons name="chevron-down" size={26} color={theme.palette.text}/></Pressable><Text accessibilityRole="header" style={{fontSize:24,fontWeight:'700',color:theme.palette.text}}>{menuTrack?.title??'歌曲操作'}</Text><Text style={{color:theme.palette.secondary}}>{menuTrack?.artist}{menuTrack?.album?` · ${menuTrack.album}`:''}</Text>{menuTrack&&<View style={{gap:10}}>{sheetAction('下一首','play-skip-forward',()=>{services.addToQueue(menuTrack,true);setMenuTrack(null);})}{sheetAction('加入队列','list',()=>{services.addToQueue(menuTrack);setMenuTrack(null);})}{sheetAction(services.library.isFavorite(menuTrack)?'取消本地收藏':'本地收藏',services.library.isFavorite(menuTrack)?'heart':'heart-outline',()=>{void services.library.favorite(menuTrack).catch(()=>setMessage('收藏未保存，原数据保留；请重试'));setMenuTrack(null);})}{sheetAction('加入歌单','albums-outline',()=>{setAdding([menuTrack]);setMenuTrack(null);})}</View>}</View>}</SheetModal>;
  if(embedded)return <><View style={{flex:1}}>{content}</View>{overlays}</>;
  return <><View style={{marginBottom:18}}>{button('发现 · 分类 · 排行榜 · 歌单导入',()=>setOpen(true))}</View><Modal visible={open} animationType="slide" onRequestClose={close}>{content}{overlays}</Modal></>;
}
