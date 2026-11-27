import {Text,TextInput} from './Typography.tsx';
import {useEffect,useRef,useState} from 'react';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import type {QishuiPlaylist} from '../providers/qishui.ts';
import {useTheme} from './theme.tsx';
import {controls,sollinTokens} from './tokens.ts';
export function QishuiImport({services,grouped=false}:{services:Services;grouped?:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),pending=useRef(new AbortController()),generation=useRef(0),saving=useRef(false);
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
  const button=(label:string,action:()=>void,disabled=false,testID?:string,primary=false)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{paddingHorizontal:16,paddingVertical:11,minHeight:controls.hit,justifyContent:'center',alignItems:'center',borderRadius:22,backgroundColor:primary?s.control:s.chip,borderWidth:primary?0:1,borderColor:s.cardBorder,opacity:disabled?.42:1}}><Text style={{color:primary?'#FFFFFF':s.ink,fontSize:14,fontWeight:'600'}}>{label}</Text></Pressable>;
  const field={color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:14,paddingVertical:12,borderWidth:1,borderColor:s.cardBorder,borderRadius:14,fontSize:14};
  return <>{grouped?<Pressable testID="qishui-import-open" accessibilityRole="button" accessibilityLabel="导入汽水公开歌单" onPress={()=>setOpen(true)} style={{minHeight:60,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="link-outline" size={18} color={s.accent}/></View>
    <View style={{flex:1,minWidth:0,gap:2}}>
      <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>导入汽水公开歌单</Text>
      <Text numberOfLines={1} style={{color:s.muted,fontSize:12}}>粘贴分享文本、链接或 ID，匹配曲目后导入</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
  </Pressable>:button('导入汽水公开歌单',()=>setOpen(true),false,'qishui-import-open')}<Modal visible={open} animationType="slide" onRequestClose={close}><View style={{flex:1}}><LinearGradient colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/><View style={{flex:1,paddingTop:56,paddingHorizontal:20}}>
    <FlatList data={preview?.tracks??[]} keyExtractor={(track,index)=>`${index}-${track.origin.id}`} initialNumToRender={12} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:50}} ListHeaderComponent={<View style={{gap:12,paddingBottom:20}}>
      <View style={{alignSelf:'flex-start'}}>{button('收起汽水导入',close,busy,'qishui-import-close')}</View><Text style={{fontSize:26,fontWeight:'700',color:s.ink}}>汽水歌单导入</Text>
      <Text style={{color:s.muted,fontSize:13,lineHeight:20}}>保留原始歌曲和曲序，通过其他平台匹配播放；不会登录汽水或使用汽水直接播放。</Text>
      <TextInput testID="qishui-import-input" accessibilityLabel="汽水公开歌单链接或ID" placeholder="粘贴汽水分享文本、完整链接或ID" placeholderTextColor={s.subtle} value={input} editable={!loading&&!busy} onChangeText={value=>{setInput(value);setPreview(undefined);setMessage('');}} autoCapitalize="none" autoCorrect={false} style={field}/>
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button(loading?'正在完整读取…':'读取并预览汽水歌单',()=>{void read();},loading||busy||!input.trim(),'qishui-import-read',true)}{loading&&button('取消汽水读取',()=>{generation.current++;pending.current.abort();setLoading(false);},false,'qishui-import-cancel')}</View>
      {!!message&&<Text testID="qishui-import-message" accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13,lineHeight:20}}>{message}</Text>}
      {preview&&<><TextInput testID="qishui-import-title" accessibilityLabel="汽水导入歌单名称" value={title} onChangeText={setTitle} style={field}/><Text testID="qishui-import-summary" style={{color:s.muted,fontSize:13}}>完整读取 {preview.tracks.length} 条 · 保留重复项 · 作为新歌单追加</Text>{button('确认追加汽水歌单',()=>{void save();},busy||!title.trim(),'qishui-import-confirm',true)}</>}
    </View>} renderItem={({item,index})=><View testID={`qishui-preview-${index}`} style={{paddingVertical:12,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}><Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{item.title}</Text><Text style={{color:s.muted,fontSize:12,marginTop:3}}>{item.artist} · 待匹配</Text></View>}/>
  </View></View></Modal></>;
}
