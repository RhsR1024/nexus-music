import {Text,TextInput} from './Typography.tsx';
import {useEffect,useRef,useState} from 'react';
import {FlatList, Modal, Pressable, View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {QishuiPlaylist} from '../providers/qishui.ts';
import {useTheme} from './theme.tsx';
export function QishuiImport({services}:{services:Services}){
  const theme=useTheme(),pending=useRef(new AbortController()),generation=useRef(0),saving=useRef(false);
  const [open,setOpen]=useState(false),[input,setInput]=useState(''),[title,setTitle]=useState(''),[preview,setPreview]=useState<QishuiPlaylist>(),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>()=>{generation.current++;pending.current.abort();},[]);
  function close(){if(saving.current)return;generation.current++;pending.current.abort();setLoading(false);setOpen(false);}
  async function read(){pending.current.abort();pending.current=new AbortController();const signal=pending.current.signal,version=++generation.current;setLoading(true);setMessage('');setPreview(undefined);
    try{const result=await services.qishui.complete(input,signal);if(signal.aborted||version!==generation.current)return;setPreview(result);setTitle(result.title);}
    catch(error){if(!signal.aborted&&version===generation.current)setMessage(error instanceof Error&&/汽水|链接|分页|歌单|ID/.test(error.message)?error.message:'读取失败，请确认歌单公开后重试。');}
    finally{if(version===generation.current)setLoading(false);}
  }
  async function save(){if(!preview||!title.trim()||saving.current)return;saving.current=true;setBusy(true);setMessage('');
    try{await services.library.createPlaylist(title,preview.tracks);setMessage(`已追加导入 ${preview.tracks.length} 条，原始歌曲保留；播放时匹配其他平台。`);setPreview(undefined);}catch{setMessage('保存失败，原音乐库保留，请重试。');}finally{saving.current=false;setBusy(false);}
  }
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:12,borderRadius:10,backgroundColor:theme.color('#303A32'),opacity:disabled?.4:1}}><Text style={{color:theme.color('#D9F49B')}}>{label}</Text></Pressable>;
  const field={color:theme.color('#ECEBF3'),padding:14,borderWidth:1,borderColor:theme.color('#414754'),borderRadius:12};
  return <>{button('导入汽水公开歌单',()=>setOpen(true))}<Modal visible={open} animationType="slide" onRequestClose={close}><View style={{flex:1,paddingTop:60,paddingHorizontal:24,backgroundColor:theme.color('#111318')}}>
    <FlatList data={preview?.tracks??[]} keyExtractor={(track,index)=>`${index}-${track.origin.id}`} initialNumToRender={12} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:50}} ListHeaderComponent={<View style={{gap:12,paddingBottom:20}}>
      {button('收起汽水导入',close,busy)}<Text style={{fontSize:25,color:theme.color('#ECEBF3')}}>汽水歌单导入</Text>
      <Text style={{color:theme.color('#959EAC'),lineHeight:22}}>保留原始歌曲和曲序，通过其他平台匹配播放；不会登录汽水或使用汽水直接播放。</Text>
      <TextInput accessibilityLabel="汽水公开歌单链接或ID" placeholder="粘贴汽水分享文本、完整链接或ID" placeholderTextColor="#768191" value={input} editable={!loading&&!busy} onChangeText={value=>{setInput(value);setPreview(undefined);setMessage('');}} autoCapitalize="none" autoCorrect={false} style={field}/>
      {button(loading?'正在完整读取…':'读取并预览汽水歌单',()=>{void read();},loading||busy||!input.trim())}
      {loading&&button('取消汽水读取',()=>{generation.current++;pending.current.abort();setLoading(false);})}
      {!!message&&<Text accessibilityLiveRegion="polite" style={{color:theme.color('#D6B69A'),lineHeight:22}}>{message}</Text>}
      {preview&&<><TextInput accessibilityLabel="汽水导入歌单名称" value={title} onChangeText={setTitle} style={field}/><Text style={{color:theme.color('#959EAC')}}>完整读取 {preview.tracks.length} 条 · 保留重复项 · 作为新歌单追加</Text>{button('确认追加汽水歌单',()=>{void save();},busy||!title.trim())}</>}
    </View>} renderItem={({item})=><View style={{paddingVertical:14,borderTopWidth:1,borderColor:theme.color('#303744')}}><Text style={{color:theme.color('#E1E6F0'),fontSize:16}}>{item.title}</Text><Text style={{color:theme.color('#959EAC'),marginTop:6}}>{item.artist} · 待匹配</Text></View>}/>
  </View></Modal></>;
}
