import {Text,TextInput} from './Typography.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {SheetModal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {currentEntry} from '../domain/queue.ts';
import type {MatchCandidate} from '../providers/crossPlatformMatcher.ts';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

const platformNames={wy:'网易',tx:'QQ',kw:'酷我',kg:'酷狗',mg:'咪咕'};
const duration=(track:Track)=>track.durationMs===undefined?'时长未知':`${Math.floor(track.durationMs/60000)}:${String(Math.floor(track.durationMs/1000)%60).padStart(2,'0')}`;

export function MatchModal({services,track,onClose,inline=false}:{services:Services;track:Track|null;onClose:()=>void;inline?:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),pending=useRef(new AbortController()),version=useRef(0);
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
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';
  const currentMatch=track?services.library.matchFor(track):undefined;

  const body=<View style={{flex:1}}>
    {!inline&&<LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>}
    <FlatList data={items} keyExtractor={item=>trackKey(item.track.origin)} initialNumToRender={10} windowSize={5} contentContainerStyle={{paddingHorizontal:18,paddingTop:10,paddingBottom:40,gap:10}}
      ListHeaderComponent={<View style={{gap:14,paddingBottom:6}}>
        <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.dark?'rgba(255,255,255,0.28)':'rgba(60,48,50,0.26)'}}/>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <Text style={{fontSize:24,fontWeight:'700',letterSpacing:-0.3,color:s.ink}}>匹配歌曲</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="收起匹配" disabled={busy} onPress={onClose} style={{minHeight:36,paddingHorizontal:14,borderRadius:18,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder,alignItems:'center',justifyContent:'center',opacity:busy?0.5:1}}>
            <Text style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>收起匹配</Text>
          </Pressable>
        </View>

        <View style={[{borderRadius:18,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:6},s.cardShadow]}>
          <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>{track?.title} · {track?.artist} · {track?duration(track):''}</Text>
          <Text style={{color:s.muted,lineHeight:18.5,fontSize:12.5}}>原始歌曲与歌单保留。请选择正确录音版本；缺少时长或版本不同时需要你确认。</Text>
          {currentMatch&&<Pressable accessibilityRole="button" accessibilityLabel="取消指定版本，恢复自动" disabled={busy} onPress={()=>{void reset();}} style={{alignSelf:'flex-start',marginTop:4,minHeight:36,paddingHorizontal:13,borderRadius:18,backgroundColor:warnBg,flexDirection:'row',alignItems:'center',gap:6,opacity:busy?0.5:1}}>
            <Ionicons name="refresh-outline" size={15} color={s.accent}/>
            <Text style={{color:s.accent,fontSize:13,fontWeight:'600'}}>取消指定版本，恢复自动</Text>
          </Pressable>}
        </View>

        <View style={[{borderRadius:18,padding:12,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},s.cardShadow]}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:42,paddingHorizontal:12,borderRadius:14,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder}}>
            <Ionicons name="search-outline" size={17} color={s.subtle}/>
            <TextInput accessibilityLabel="匹配候选关键词" value={query} onChangeText={setQuery} maxLength={250} placeholder="可修改歌曲、歌手关键词" placeholderTextColor={s.subtle} style={{flex:1,color:s.ink,fontSize:14.5,paddingVertical:8}} onSubmitEditing={()=>{void load();}}/>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={loading?'正在搜索候选…':'重新搜索候选'} disabled={loading||busy} onPress={()=>{void load();}} style={{minHeight:42,borderRadius:21,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:loading||busy?0.5:1}}>
            {loading?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="search" size={16} color="#FFFFFF"/>}
            <Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'700'}}>{loading?'正在搜索候选…':'重新搜索候选'}</Text>
          </Pressable>
        </View>

        {!!error&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:13,paddingVertical:10,borderRadius:14,backgroundColor:warnBg}}>
          <Ionicons name="alert-circle-outline" size={17} color={s.accent}/>
          <Text style={{flex:1,color:s.accent,fontSize:13}}>{error}</Text>
        </View>}
      </View>}
      renderItem={({item})=>{
        const pLabel=item.track.origin.kind==='online'?platformNames[item.track.origin.platform]:'';
        return <Pressable testID={`match-candidate-${item.track.origin.kind==='online'?item.track.origin.platform:''}-${item.track.origin.id}`} accessibilityRole="button" disabled={busy} onPress={()=>choose(item.track)} style={[{padding:14,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:5},s.cardShadow]}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <Text numberOfLines={1} style={{flex:1,fontSize:15.5,fontWeight:'700',color:s.ink}}>{item.track.title}</Text>
            {!!pLabel&&<View style={{paddingHorizontal:8,paddingVertical:2.5,borderRadius:8,backgroundColor:s.accentSoft}}><Text style={{color:s.accent,fontSize:11,fontWeight:'700'}}>{pLabel}</Text></View>}
          </View>
          <Text numberOfLines={2} style={{color:s.muted,lineHeight:18.5,fontSize:12.5}}>{item.track.artist}{item.track.album?` · ${item.track.album}`:''} · {duration(item.track)}</Text>
          <Text style={{color:s.accent,fontSize:12,fontWeight:'500'}}>{item.reason}</Text>
        </Pressable>;
      }}
      ListFooterComponent={items.length>0&&page<10?<Pressable accessibilityRole="button" disabled={loading||busy} onPress={()=>{void load(page+1);}} style={{marginTop:4,minHeight:44,borderRadius:16,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder,alignItems:'center',justifyContent:'center',opacity:loading||busy?0.45:1}}><Text style={{color:s.accent,fontSize:14,fontWeight:'600'}}>更多匹配候选</Text></Pressable>:null}
      ListEmptyComponent={!loading?<View style={{padding:20,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,alignItems:'center'}}><Text style={{color:s.muted,fontSize:13.5}}>尚无候选。原曲保留在歌单中。</Text></View>:null} showsVerticalScrollIndicator={false}/>
  </View>;
  if(inline)return track?body:null;
  return <SheetModal allowSwipeDismissal visible={!!track} animationType="slide" onRequestClose={()=>{if(!busy)onClose();}}>{body}</SheetModal>;
}
