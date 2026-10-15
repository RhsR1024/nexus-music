import {useEffect,useRef,useState} from 'react';
import {Alert,FlatList,Modal,Pressable,Text,View} from 'react-native';
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
  async function load(){if(!track)return;pending.current.abort();pending.current=new AbortController();const signal=pending.current.signal,id=++version.current;setLoading(true);setError('');
    try{const result=await services.matching.candidates(track,signal);if(signal.aborted||id!==version.current)return;setItems(result.items);if(result.failedPlatforms.length)setError(`${result.failedPlatforms.length} 个平台暂不可用，已保留其他候选，可重试。`);}
    catch{if(!signal.aborted&&id===version.current)setError('暂时无法搜索匹配，可稍后重试；原始歌曲仍保留。');}finally{if(id===version.current)setLoading(false);}
  }
  useEffect(()=>{setItems([]);if(track)void load();return()=>{version.current++;pending.current.abort();};},[track]);
  function choose(target:Track){if(!track||busy)return;
    Alert.alert('确认匹配歌曲',`原曲：${track.title} · ${track.artist} · ${duration(track)}\n目标：${target.title} · ${target.artist} · ${target.album??''} · ${duration(target)}\n请确认版本正确；原始汽水身份会保留。`,[{text:'取消',style:'cancel'},{text:'保存匹配',onPress:()=>{void save(target);}}]);
  }
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
      <Text style={{color:theme.color('#959EAC'),lineHeight:22}}>原始汽水歌曲保留。请选择正确录音版本；没有可靠匹配时可稍后处理。</Text>
      {button(loading?'正在搜索候选…':'重新搜索候选',()=>{void load();},loading||busy)}{!!error&&<Text style={{color:theme.color('#D6B69A')}}>{error}</Text>}
    </View>} renderItem={({item})=><Pressable accessibilityRole="button" disabled={busy} onPress={()=>choose(item.track)} style={{paddingVertical:18,borderTopWidth:1,borderColor:theme.color('#303744')}}>
      <Text style={{fontSize:16,color:theme.color('#E1E6F0')}}>{item.track.title}</Text><Text style={{color:theme.color('#959EAC'),lineHeight:22}}>{item.track.artist} · {item.track.album} · {duration(item.track)} · {item.track.origin.kind==='online'?platformNames[item.track.origin.platform]:''}</Text>
      <Text style={{color:theme.color('#D6B69A')}}>{item.reason}</Text>
    </Pressable>} ListEmptyComponent={!loading?<Text style={{color:theme.color('#959EAC')}}>尚无候选。原曲保留在歌单中。</Text>:null} contentContainerStyle={{paddingBottom:50}}/>
  </View></Modal>;
}
