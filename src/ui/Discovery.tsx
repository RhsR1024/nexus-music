import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useEffect,useRef,useState} from 'react';
import {Alert,FlatList,Modal,Pressable,Text,TextInput,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {OnlinePlatform,Track} from '../domain/track.ts';
import type {BrowseItem} from '../providers/discovery.ts';
import {parsePlaylistLink} from '../providers/playlistLink.ts';
type PageView={kind:'playlists'}|{kind:'rankings'}|{kind:'categories'}|{kind:'detail';id:string;title:string;rank:boolean};
type Item={kind:'collection';value:BrowseItem;rank:boolean}|{kind:'category';id:string;title:string;group?:string}|{kind:'track';track:Track};
const platforms=[['wy','网易'],['tx','QQ'],['kw','酷我'],['kg','酷狗'],['mg','咪咕']]as const;
export function Discovery({services}:{services:Services}){
  const theme=useTheme();
  const [open,setOpen]=useState(false),[platform,setPlatform]=useState<OnlinePlatform>('wy'),[view,setView]=useState<PageView>({kind:'playlists'}),[category,setCategory]=useState<string>();
  const [items,setItems]=useState<readonly Item[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState(''),[importing,setImporting]=useState(false);
  const page=useRef(0),generation=useRef(0),pending=useRef(new AbortController()),importAbort=useRef(new AbortController());
  async function load(append=false){
    const version=++generation.current;pending.current.abort();pending.current=new AbortController();const signal=pending.current.signal,next=append?page.current+1:1;
    setLoading(true);setError('');
    try{
      let values:Item[]=[],hasMore=false;
      if(view.kind==='playlists'){const result=await services.discovery.playlists(platform,next,category,signal);values=result.items.map(value=>({kind:'collection',value,rank:false}));hasMore=result.hasMore;}
      else if(view.kind==='rankings'){values=(await services.discovery.rankings(platform,signal)).map(value=>({kind:'collection',value,rank:true}));}
      else if(view.kind==='categories'){values=(await services.discovery.categories(platform,signal)).map(value=>({kind:'category',...value}));}
      else{const result=await services.discovery.detail(platform,view.id,next,signal,view.rank);values=result.items.map(track=>({kind:'track',track}));hasMore=result.hasMore;}
      if(version!==generation.current||signal.aborted)return;
      setItems(old=>append?[...old,...values]:values);setMore(hasMore);page.current=next;
    }catch{if(version===generation.current&&!signal.aborted)setError('此平台暂时无法读取，请重试或选择其他平台；已加载内容保留。');}
    finally{if(version===generation.current)setLoading(false);}
  }
  useEffect(()=>{if(open){setItems([]);setMore(false);page.current=0;void load();}return()=>{generation.current++;pending.current.abort();importAbort.current.abort();};},[open,platform,view,category]);
  function close(){importAbort.current.abort();setImporting(false);setOpen(false);}
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
  const tracks=items.flatMap(item=>item.kind==='track'?[item.track]:[]);
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{backgroundColor:theme.color('#303A32'),padding:12,borderRadius:10,opacity:disabled ? .4 : 1}}><Text style={{color:theme.color('#D9F49B')}}>{label}</Text></Pressable>;
  const header=<View style={{gap:12,paddingBottom:18}}>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button('收起发现',close)}{view.kind==='detail'&&button('返回歌单广场',()=>setView({kind:'playlists'}))}</View>
    <Text accessibilityRole="header" style={{fontSize:26,color:theme.color('#ECEBF3')}}>{view.kind==='detail'?view.title:'发现音乐'}</Text>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{platforms.map(([id,name])=><View key={id}>{button(`${platform===id?'● ':''}${name}`,()=>{setPlatform(id);setCategory(undefined);setView({kind:'playlists'});})}</View>)}</View>
    {view.kind!=='detail'&&<View style={{gap:10}}>
      <View style={{flexDirection:'row',gap:8}}>{button('公开歌单',()=>setView({kind:'playlists'}))}{button('排行榜',()=>setView({kind:'rankings'}))}{button('歌单分类',()=>setView({kind:'categories'}))}</View>
      <TextInput accessibilityLabel="公开歌单分享链接或ID" placeholder="粘贴完整分享链接或当前平台歌单ID" placeholderTextColor="#768191" value={link} onChangeText={setLink} autoCorrect={false} autoCapitalize="none" style={{color:theme.color('#ECEBF3'),padding:14,borderRadius:12,borderWidth:1,borderColor:theme.color('#414754')}}/>
      {button('预览分享歌单',()=>{try{const value=parsePlaylistLink(link,platform);setMessage('');setView({kind:'detail',id:value.id,title:'公开分享歌单',rank:false});}catch(error){setMessage(error instanceof Error?error.message:'分享地址无效');}})}
      {!!category&&button('清除分类筛选',()=>{setCategory(undefined);setView({kind:'playlists'});})}
    </View>}
    {view.kind==='detail'&&<View style={{gap:10}}>{tracks.length>0&&button('播放已加载歌曲',()=>services.playTracks(tracks,0))}{button(importing?'正在完整读取…':'导入完整歌单到音乐库',()=>{void importPlaylist();},importing)}{importing&&button('取消读取',()=>{importAbort.current.abort();setImporting(false);})}</View>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:theme.color('#D6B69A'),lineHeight:22}}>{message}</Text>}
  </View>;
  return <>
    <View style={{marginBottom:18}}>{button('发现 · 分类 · 排行榜 · 歌单导入',()=>setOpen(true))}</View>
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={{flex:1,backgroundColor:theme.color('#111318'),paddingHorizontal:24,paddingTop:60}}>
        <FlatList data={items} keyExtractor={(item,index)=>`${index}-${item.kind}`} ListHeaderComponent={header} initialNumToRender={12} windowSize={7} keyboardShouldPersistTaps="handled"
          renderItem={({item,index})=>item.kind==='track'?<View style={{paddingVertical:15,borderTopWidth:1,borderColor:theme.color('#303744')}}>
            <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)}><Text style={{color:theme.color('#E1E6F0'),fontSize:16}}>{item.track.title}</Text><Text style={{color:theme.color('#959EAC'),marginTop:7}}>{item.track.artist} · {item.track.album}</Text></Pressable>
            <View style={{flexDirection:'row',gap:10,marginTop:10}}>{button('下一首',()=>services.addToQueue(item.track,true))}{button('加入队列',()=>services.addToQueue(item.track))}</View>
          </View>:<Pressable testID={`discovery-item-${index}`} accessibilityRole="button" onPress={()=>item.kind==='category'?(setCategory(item.id),setView({kind:'playlists'})):setView({kind:'detail',id:item.value.id,title:item.value.title,rank:item.rank})} style={{paddingVertical:20,borderTopWidth:1,borderColor:theme.color('#303744')}}>
            <Text style={{color:theme.color('#E1E6F0'),fontSize:16}}>{item.kind==='category'?item.title:item.value.title}</Text><Text style={{color:theme.color('#959EAC'),marginTop:8}}>{item.kind==='category'?item.group:item.value.count!==undefined?`${item.value.count} 首`:item.value.description}</Text>
          </Pressable>}
          ListFooterComponent={<View style={{gap:12,paddingVertical:24,paddingBottom:50}}>{loading&&<Text style={{color:theme.color('#959EAC')}}>正在获取平台数据…</Text>}{!!error&&<Text style={{color:theme.color('#D6B69A')}}>{error}</Text>}{!loading&&!error&&!items.length&&<Text style={{color:theme.color('#959EAC')}}>此平台暂未返回可展示内容</Text>}{button(error?'重试':'刷新',()=>{void load();},loading)}{more&&button('加载更多',()=>{void load(true);},loading)}</View>}/>
      </View>
    </Modal>
  </>;
}
