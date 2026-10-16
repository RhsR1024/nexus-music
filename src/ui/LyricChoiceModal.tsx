import {Text,TextInput} from './Typography.tsx';
import {useEffect,useRef,useState} from 'react';
import {Alert, FlatList, Keyboard, Modal, Pressable, View} from 'react-native';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import type {MatchCandidate} from '../providers/crossPlatformMatcher.ts';
import type {LyricResult} from '../lyrics/normalize.ts';
import type {LyricChoice} from '../storage/library.ts';
import {useTheme} from './theme.tsx';
export const lyricPlatformLabel=(track:Track)=>track.origin.kind==='online'?{wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'}[track.origin.platform]:'原歌词';
export function LyricChoiceModal({services,track,onClose}:{services:Services;track:Track|null;onClose:()=>void}){
  const {palette:p}=useTheme(),request=useRef(new AbortController()),lifetime=useRef(new AbortController()),serial=useRef(0);
  const list=useRef<FlatList<MatchCandidate>>(null);
  const privateSearchAllowed=useRef(false);
  const [items,setItems]=useState<readonly MatchCandidate[]>([]),[query,setQuery]=useState(''),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const [preview,setPreview]=useState<{track:Track;value:LyricResult}>();
  const isPublic=track?.origin.kind==='online'||track?.origin.kind==='imported';
  useEffect(()=>{lifetime.current.abort();lifetime.current=new AbortController();request.current.abort();serial.current++;privateSearchAllowed.current=false;setItems([]);setPreview(undefined);setQuery(track?`${track.title} ${track.artist}`:'');setPage(1);setError('');setBusy(false);setSaving(false);return()=>{lifetime.current.abort();request.current.abort();serial.current++;};},[track]);
  function begin(){request.current.abort();request.current=new AbortController();setBusy(true);setError('');return{signal:request.current.signal,id:++serial.current};}
  async function search(next=1){if(!track)return;Keyboard.dismiss();const {signal,id}=begin();
    try{const result=await services.lyrics.candidates(track,signal,{query,page:next,limit:10,allowPrivate:!isPublic});if(signal.aborted||id!==serial.current)return;
      if(result.failedPlatforms.length===5){setError('所有平台暂不可用，保留已有候选，可重试');return;}
      setPage(next);setPreview(undefined);setItems(previous=>next===1?result.items:[...new Map([...previous,...result.items].map(item=>[trackKey(item.track.origin),item])).values()]);if(result.failedPlatforms.length)setError(`${result.failedPlatforms.length} 个平台暂不可用，其他候选仍可预览`);
    }catch{if(!signal.aborted&&id===serial.current)setError('歌词候选搜索失败，原歌词与选择保留');}finally{if(id===serial.current)setBusy(false);}
  }
  function startSearch(next=1){const signal=lifetime.current.signal;if(isPublic||privateSearchAllowed.current)void search(next);else Alert.alert('搜索公开歌词', '将此曲歌名和歌手发送给五个在线平台搜索。不会上传文件、服务器地址、账号或原有歌词。',[{text:'取消',style:'cancel'},{text:'搜索公开歌词',onPress:()=>{if(!signal.aborted&&signal===lifetime.current.signal){privateSearchAllowed.current=true;void search(next);}}}]);}
  async function inspect(candidate:Track){const {signal,id}=begin();setPreview(undefined);
    try{const value=await services.lyrics.preview(candidate,signal);if(signal.aborted||id!==serial.current)return;if(!value.document.lines.length&&!value.document.plain.length){setError('此候选暂未返回歌词，原选择保留');return;}setPreview({track:candidate,value});list.current?.scrollToOffset({offset:0,animated:true});}
    catch{if(!signal.aborted&&id===serial.current)setError('歌词预览失败，原选择保留，可重试');}finally{if(id===serial.current)setBusy(false);}
  }
  async function save(mode:LyricChoice['mode'],target?:Track){if(!track||saving)return;setSaving(true);setError('');const signal=lifetime.current.signal;
    try{await services.lyrics.choose(track,mode,target,signal);if(!signal.aborted)onClose();}catch{if(!signal.aborted)setError('歌词选择未保存，原记录保留');}finally{if(!signal.aborted)setSaving(false);}
  }
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:13,borderRadius:14,backgroundColor:p.selected,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  return <Modal visible={!!track} animationType="slide" onRequestClose={()=>{if(!saving)onClose();}}><View style={{flex:1,paddingTop:60,paddingHorizontal:24,backgroundColor:p.background[0]}}>
    <FlatList ref={list} keyboardShouldPersistTaps="handled" data={items} keyExtractor={item=>trackKey(item.track.origin)} initialNumToRender={8} windowSize={5} contentContainerStyle={{paddingBottom:50}} ListHeaderComponent={<View style={{gap:12,paddingBottom:20}}>
      {button('收起歌词选择',onClose,saving)}<Text style={{fontSize:26,color:p.text,fontWeight:'700'}}>歌词来源与候选</Text><Text style={{color:p.secondary}}>{track?.title} · {track?.artist}</Text>
      <Text style={{color:p.secondary,lineHeight:21}}>只更换歌词，播放歌曲、队列和进度保持。自动优选只采用标题、歌手、录音版本和时长可靠匹配的候选；人工选择前请核对预览。</Text>
      {button('使用原歌词',()=>{void save('original');},saving)}{isPublic&&button('自动优选跨平台歌词',()=>{void save('automatic');},saving)}
      <TextInput accessibilityLabel="歌词候选关键词" maxLength={250} value={query} onChangeText={setQuery} style={{padding:13,borderWidth:1,borderColor:p.border,borderRadius:14,color:p.text}} onSubmitEditing={()=>startSearch()}/>
      {button(isPublic?'搜索歌词候选':'搜索公开歌词',()=>startSearch(),busy||saving||!query.trim())}{busy&&<Text style={{color:p.secondary}}>正在获取歌词候选或预览…</Text>}{!!error&&<Text accessibilityRole="alert" style={{color:p.accent}}>{error}</Text>}
      {preview&&<View style={{gap:10,padding:16,borderRadius:18,backgroundColor:p.surface}}><Text style={{color:p.text,fontWeight:'700'}}>歌词预览 · {preview.track.title}</Text><Text style={{color:p.secondary}}>{preview.track.artist} · {lyricPlatformLabel(preview.track)} · {preview.value.document.lines.some(line=>line.words?.length)?'逐字时间':preview.value.document.synced?'行级时间':'纯文本'}</Text>{[...preview.value.document.lines.map(line=>line.text),...preview.value.document.plain].slice(0,6).map((line,index)=><Text key={index} style={{color:p.text}}>{line}</Text>)}{button('保存此歌词',()=>{void save('manual',preview.track);},saving||busy)}</View>}
    </View>} renderItem={({item})=><Pressable testID={`lyric-candidate-${item.track.origin.kind==='online'?item.track.origin.platform:''}-${item.track.origin.id}`} accessibilityRole="button" disabled={saving||busy} onPress={()=>{void inspect(item.track);}} style={{paddingVertical:18,borderTopWidth:1,borderColor:p.border}}><Text style={{color:p.text,fontSize:16}}>{item.track.title}</Text><Text style={{color:p.secondary,lineHeight:22}}>{item.track.artist} · {item.track.album} · {lyricPlatformLabel(item.track)} · {item.track.durationMs?`${(item.track.durationMs/1000).toFixed(0)}秒`:'时长未知'}</Text><Text style={{color:p.accent}}>{item.reason} · 点击预览</Text></Pressable>} ListFooterComponent={items.length>0&&page<10?button('更多歌词候选',()=>startSearch(page+1),busy||saving):null}/>
  </View></Modal>;
}
