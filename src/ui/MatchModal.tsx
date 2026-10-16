import {Text,TextInput} from './Typography.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert, FlatList, Pressable, View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {currentEntry} from '../domain/queue.ts';
import type {MatchCandidate} from '../providers/crossPlatformMatcher.ts';
import {useTheme} from './theme.tsx';
const platformNames={wy:'网易',tx:'QQ',kw:'酷我',kg:'酷狗',mg:'咪咕'};
const duration=(track:Track)=>track.durationMs===undefined?'时长未知':`${Math.floor(track.durationMs/60000)}:${String(Math.floor(track.durationMs/1000)%60).padStart(2,'0')}`;
export function MatchModal({services,track,onClose}:{services:Services;track:Track|null;onClose:()=>void}){
  const theme=useTheme(),pending=useRef(new AbortController()),version=useRef(0);
  const [items,setItems]=useState<readonly MatchCandidate[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [query,setQuery]=useState(''),[page,setPage]=useState(1);
  async function load(next=1,search=query){if(!track)return;pending.current.abort();pending.current=new AbortController();const signal=pending.current.signal,id=++version.current;setLoading(true);setError('');
    try{const result=await services.matching.candidates(track,signal,undefined,{query:search||undefined,page:next,limit:25});if(signal.aborted||id!==version.current)return;if(result.failedPlatforms.length===5){setError('所有平台暂不可用，已保留上次候选，请重试。');return;}setPage(next);setItems(previous=>next===1?result.items:[...new Map([...previous,...result.items].map(item=>[trackKey(item.track.origin),item])).values()]);if(result.failedPlatforms.length)setError(`${result.failedPlatforms.length} 个平台暂不可用，已保留其他候选，可重试。`);}
    catch{if(!signal.aborted&&id===version.current)setError('暂时无法搜索匹配，可稍后重试；原始歌曲仍保留。');}finally{if(id===version.current)setLoading(false);}
  }
  useEffect(()=>{setItems([]);setQuery('');setPage(1);if(track)void load(1,'');return()=>{version.current++;pending.current.abort();};},[track]);
  function choose(target:Track){if(!track||busy)return;
    Alert.alert('确认匹配歌曲',`原曲：${track.title} · ${track.artist} · ${duration(track)}\n目标：${target.title} · ${target.artist} · ${target.album??''} · ${duration(target)}\n请确认版本正确；原始歌曲身份会保留。`,[{text:'取消',style:'cancel'},{text:'保存匹配',onPress:()=>{void save(target);}}]);
  }
  async function reset(){if(!track)return;setBusy(true);setError('');const current=currentEntry(services.playback.controller.getSnapshot().queue);if(current&&trackKey(current.track.origin)===trackKey(track.origin))services.playback.controller.pause();try{await services.library.removeMatch(track);onClose();}catch{setError('取消匹配失败，原记录保留');}finally{setBusy(false);}}
  async function save(target:Track){if(!track)return;setBusy(true);setError('');
    const current=currentEntry(services.playback.controller.getSnapshot().queue);
    if(current&&trackKey(current.track.origin)===trackKey(track.origin))services.playback.controller.pause();
    try{await services.library.setMatch(track,target,'manual');onClose();}catch{setError('匹配保存失败，原有记录保留，请重试。');}finally{setBusy(false);}
  }
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:12,borderRadius:10,backgroundColor:theme.color('#303A32'),opacity:disabled?.4:1}}><Text style={{color:theme.color('#D9F49B')}}>{label}</Text></Pressable>;
  return <Modal visible={!!track} animationType="slide" onRequestClose={()=>{if(!busy)onClose();}}><View style={{flex:1,paddingTop:60,paddingHorizontal:24,backgroundColor:theme.color('#111318')}}>
    <FlatList data={items} keyExtractor={item=>trackKey(item.track.origin)} initialNumToRender={10} windowSize={5} ListHeaderComponent={<View style={{gap:12,paddingBottom:20}}>
      {button('收起匹配',onClose,busy)}<Text style={{fontSize:25,color:theme.color('#ECEBF3')}}>匹配歌曲</Text>
      <Text style={{color:theme.color('#ECEBF3')}}>{track?.title} · {track?.artist} · {track?duration(track):''}</Text>
      <Text style={{color:theme.color('#959EAC'),lineHeight:22}}>原始歌曲与歌单保留。请选择正确录音版本；缺少时长或版本不同时需要你确认。</Text>
      {track&&services.library.matchFor(track)&&button('取消指定版本，恢复自动',()=>{void reset();},busy)}
      <TextInput accessibilityLabel="匹配候选关键词" value={query} onChangeText={setQuery} maxLength={250} placeholder="可修改歌曲、歌手关键词" placeholderTextColor={theme.palette.secondary} style={{padding:12,color:theme.palette.text,borderWidth:1,borderColor:theme.palette.border,borderRadius:12}} onSubmitEditing={()=>{void load();}}/>
      {button(loading?'正在搜索候选…':'重新搜索候选',()=>{void load();},loading||busy)}{!!error&&<Text style={{color:theme.color('#D6B69A')}}>{error}</Text>}
    </View>} renderItem={({item})=><Pressable testID={`match-candidate-${item.track.origin.kind==='online'?item.track.origin.platform:''}-${item.track.origin.id}`} accessibilityRole="button" disabled={busy} onPress={()=>choose(item.track)} style={{paddingVertical:18,borderTopWidth:1,borderColor:theme.color('#303744')}}>
      <Text style={{fontSize:16,color:theme.color('#E1E6F0')}}>{item.track.title}</Text><Text style={{color:theme.color('#959EAC'),lineHeight:22}}>{item.track.artist} · {item.track.album} · {duration(item.track)} · {item.track.origin.kind==='online'?platformNames[item.track.origin.platform]:''}</Text>
      <Text style={{color:theme.color('#D6B69A')}}>{item.reason}</Text>
    </Pressable>} ListFooterComponent={items.length>0&&page<10?button('更多匹配候选',()=>{void load(page+1);},loading||busy):null} ListEmptyComponent={!loading?<Text style={{color:theme.color('#959EAC')}}>尚无候选。原曲保留在歌单中。</Text>:null} contentContainerStyle={{paddingBottom:50}}/>
  </View></Modal>;
}
