import {Text,TextInput} from './Typography.tsx';
import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Keyboard,Pressable,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {SheetModal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import type {MatchCandidate} from '../providers/crossPlatformMatcher.ts';
import type {LyricResult} from '../lyrics/normalize.ts';
import type {LyricChoice} from '../storage/library.ts';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export const lyricPlatformLabel=(track:Track)=>track.origin.kind==='online'?{wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'}[track.origin.platform]:'原歌词';

export function LyricChoiceModal({services,track,onClose,inline=false}:{services:Services;track:Track|null;onClose:()=>void;inline?:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const request=useRef(new AbortController()),lifetime=useRef(new AbortController()),serial=useRef(0);
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
  const warnBg=s.dark?'rgba(255,107,129,0.14)':'rgba(217,67,85,0.10)';
  const canSearch=!busy&&!saving&&!!query.trim();

  const body=<View style={{flex:1}}>
    {!inline&&<LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>}
    <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.subtle+'66',marginTop:10,marginBottom:4}}/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:6,paddingBottom:12,gap:12}}>
      <View style={{flex:1,minWidth:0,gap:3}}>
        <Text accessibilityRole="header" style={{fontSize:22,color:s.ink,fontWeight:'700',letterSpacing:-0.3}}>歌词来源与候选</Text>
        {!!track&&<View style={{flexDirection:'row',alignItems:'center',gap:5}}>
          <Ionicons name="musical-notes-outline" size={13} color={s.control}/>
          <Text numberOfLines={1} style={{flex:1,color:s.muted,fontSize:13}}>{track.title} · {track.artist}</Text>
        </View>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="收起歌词选择" disabled={saving} onPress={onClose} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:saving?.4:1}}>
        <View style={{width:34,height:34,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}>
          <Ionicons name="close" size={19} color={s.ink}/>
        </View>
      </Pressable>
    </View>

    <FlatList ref={list} keyboardShouldPersistTaps="handled" data={items} keyExtractor={item=>trackKey(item.track.origin)} initialNumToRender={8} windowSize={5} contentContainerStyle={{paddingHorizontal:20,paddingBottom:48,gap:10}}
      ListHeaderComponent={<View style={{gap:12,paddingBottom:6}}>
        <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,gap:12},s.cardShadow]}>
          <View style={{gap:3}}>
            <Text style={{fontSize:13,fontWeight:'700',color:s.ink}}>歌词匹配策略</Text>
            <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>仅更换歌词显示，播放歌曲、队列和进度保持不变。</Text>
          </View>
          <View style={{flexDirection:'row',gap:10}}>
            <Pressable accessibilityRole="button" accessibilityLabel="使用原歌词" disabled={saving} onPress={()=>{void save('original');}} style={{flex:1,minHeight:46,paddingHorizontal:12,borderRadius:14,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,opacity:saving?.45:1}}>
              <Ionicons name="document-text-outline" size={17} color={s.ink}/>
              <Text numberOfLines={1} style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>使用原歌词</Text>
            </Pressable>
            {isPublic&&<Pressable accessibilityRole="button" accessibilityLabel="自动优选跨平台歌词" disabled={saving} onPress={()=>{void save('automatic');}} style={{flex:1,minHeight:46,paddingHorizontal:12,borderRadius:14,backgroundColor:s.accentSoft,borderWidth:1,borderColor:s.control+'44',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,opacity:saving?.45:1}}>
              <Ionicons name="sparkles-outline" size={17} color={s.control}/>
              <Text numberOfLines={1} style={{color:s.control,fontSize:13.5,fontWeight:'700'}}>自动优选跨平台歌词</Text>
            </Pressable>}
          </View>
        </View>

        <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,gap:12},s.cardShadow]}>
          <Text style={{fontSize:13,fontWeight:'700',color:s.ink}}>手动搜索候选歌词</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,borderRadius:14,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,paddingHorizontal:12,minHeight:46}}>
            <Ionicons name="search-outline" size={18} color={s.subtle}/>
            <TextInput accessibilityLabel="歌词候选关键词" maxLength={250} value={query} onChangeText={setQuery} placeholder="输入歌名或歌手关键词" placeholderTextColor={s.subtle} style={{flex:1,paddingVertical:10,color:s.ink,fontSize:14.5}} onSubmitEditing={()=>startSearch()}/>
            {!!query&&!busy&&!saving&&<Pressable accessibilityRole="button" accessibilityLabel="清空歌词关键词" onPress={()=>setQuery('')} style={{padding:4}}><Ionicons name="close-circle" size={18} color={s.subtle}/></Pressable>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={isPublic?'搜索歌词候选':'搜索公开歌词'} disabled={!canSearch} onPress={()=>startSearch()} style={{minHeight:46,borderRadius:23,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:canSearch?1:.42}}>
            {busy?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="search" size={17} color="#FFFFFF"/>}
            <Text style={{color:'#FFFFFF',fontSize:15,fontWeight:'700'}}>{isPublic?'搜索歌词候选':'搜索公开歌词'}</Text>
          </Pressable>
          {busy&&<Text style={{color:s.muted,fontSize:12.5,textAlign:'center'}}>正在获取歌词候选或预览…</Text>}
        </View>

        {!!error&&<View style={{flexDirection:'row',alignItems:'center',gap:8,padding:12,borderRadius:14,backgroundColor:warnBg,borderWidth:1,borderColor:s.accent+'33'}}>
          <Ionicons name="alert-circle-outline" size={17} color={s.accent}/>
          <Text accessibilityRole="alert" style={{flex:1,color:s.accent,fontSize:13,lineHeight:18}}>{error}</Text>
        </View>}

        {preview&&<View style={[{gap:12,padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1.5,borderColor:s.control+'66'},s.cardShadow]}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <View style={{flex:1,minWidth:0,gap:3}}>
              <Text numberOfLines={1} style={{color:s.ink,fontSize:16,fontWeight:'700'}}>歌词预览 · {preview.track.title}</Text>
              <Text numberOfLines={1} style={{color:s.muted,fontSize:12.5}}>{preview.track.artist} · {lyricPlatformLabel(preview.track)}</Text>
            </View>
            <View style={{paddingHorizontal:9,paddingVertical:3,borderRadius:999,backgroundColor:s.accentSoft}}>
              <Text style={{color:s.control,fontSize:11.5,fontWeight:'700'}}>{preview.value.document.lines.some(line=>line.words?.length)?'逐字时间':preview.value.document.synced?'行级时间':'纯文本'}</Text>
            </View>
          </View>
          <View style={{padding:12,borderRadius:14,backgroundColor:s.dark?'rgba(255,255,255,0.04)':'rgba(42,36,31,0.035)',borderLeftWidth:3,borderLeftColor:s.control,gap:5}}>
            {[...preview.value.document.lines.map(line=>line.text),...preview.value.document.plain].slice(0,6).map((line,index)=><Text key={index} style={{color:s.ink,fontSize:13.5,lineHeight:20}}>{line}</Text>)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="保存此歌词" disabled={saving||busy} onPress={()=>{void save('manual',preview.track);}} style={{minHeight:46,borderRadius:23,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:saving||busy?.45:1}}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF"/>
            <Text style={{color:'#FFFFFF',fontSize:15,fontWeight:'700'}}>保存此歌词</Text>
          </Pressable>
        </View>}
      </View>}
      renderItem={({item})=><Pressable testID={`lyric-candidate-${item.track.origin.kind==='online'?item.track.origin.platform:''}-${item.track.origin.id}`} accessibilityRole="button" disabled={saving||busy} onPress={()=>{void inspect(item.track);}} style={[{padding:14,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',gap:12,opacity:saving||busy?.55:1},s.cardShadow]}>
        <View style={{flex:1,minWidth:0,gap:5}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text numberOfLines={1} style={{flex:1,color:s.ink,fontSize:15,fontWeight:'700'}}>{item.track.title}</Text>
            <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:s.chip}}><Text style={{color:s.muted,fontSize:11,fontWeight:'600'}}>{lyricPlatformLabel(item.track)}</Text></View>
          </View>
          <Text numberOfLines={1} style={{color:s.muted,fontSize:12.5}}>{item.track.artist}{item.track.album?` · ${item.track.album}`:''} · {item.track.durationMs?`${(item.track.durationMs/1000).toFixed(0)}秒`:'时长未知'}</Text>
          <Text style={{color:s.control,fontSize:12,fontWeight:'600'}}>{item.reason} · 点击预览</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={s.subtle}/>
      </Pressable>}
      ListFooterComponent={items.length>0&&page<10?<Pressable accessibilityRole="button" disabled={busy||saving} onPress={()=>startSearch(page+1)} style={{minHeight:44,borderRadius:22,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',marginTop:4,opacity:busy||saving?.45:1}}><Text style={{color:s.control,fontSize:14,fontWeight:'600'}}>更多歌词候选</Text></Pressable>:null}
    />
  </View>;

  if(inline)return track?body:null;
  return <SheetModal allowSwipeDismissal visible={!!track} animationType="slide" onRequestClose={()=>{if(!saving)onClose();}}>
    <SafeAreaProvider>
      <SafeAreaView style={{flex:1,backgroundColor:s.sheetGradient[0]}} edges={['bottom']}>{body}</SafeAreaView>
    </SafeAreaProvider>
  </SheetModal>;
}
