import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
export function CacheSettings({services}:{services:Services}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [statistics,setStatistics]=useState<{bytes:number;files:number}>(),[message,setMessage]=useState('');
  const [covers,setCovers]=useState<{bytes:number;files:number}>();
  const clearing=useRef(false),[busy,setBusy]=useState(false);
  async function refresh(){try{const [audio,images]=await Promise.all([services.playback.cache.statistics(),services.covers.statistics()]);setStatistics(audio);setCovers(images);return true;}catch{setMessage('无法读取缓存统计');return false;}}
  async function clear(){
    if(clearing.current)return;clearing.current=true;setBusy(true);setMessage('');
    try{
      const results=await Promise.allSettled([services.playback.cache.clear(),services.covers.clear()]);
      services.lyrics.clear();services.davMedia.clearMetadata();services.visualColors.clear();services.coverTheme.invalidate();
      const refreshed=await refresh();
      if(results.some(result=>result.status==='rejected'))setMessage('部分缓存未能清理，请刷新后重试');
      else if(refreshed)setMessage('已清理临时缓存，离线下载与本地音频已保留');
    }catch{setMessage('缓存清理未完成，请刷新后重试');}
    finally{clearing.current=false;setBusy(false);}
  }
  useEffect(()=>{void refresh();},[]);
  const button=(label:string,action:()=>void,selected=false,testID?:string)=><Pressable testID={testID} accessibilityRole="button" accessibilityState={selected!==undefined?{selected}:undefined} onPress={action} style={{minHeight:38,paddingHorizontal:13,paddingVertical:8,backgroundColor:selected?s.control:s.chip,borderWidth:1,borderColor:selected?s.control:s.chipBorder,borderRadius:19,justifyContent:'center'}}><Text style={{color:selected?'#FFFFFF':s.ink,fontSize:13,fontWeight:'600'}}>{label}</Text></Pressable>;
  return <View style={{gap:14,marginTop:8}}>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,marginLeft:6}}>本地数据</Text>
    <View style={{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
        <Ionicons name="swap-vertical-outline" size={20} color={s.ink}/>
        <View style={{flex:1,gap:2}}>
          <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>歌曲添加位置</Text>
          <Text style={{color:s.muted,fontSize:12}}>应用到自建歌单添加新歌曲时的排序位置</Text>
        </View>
      </View>
      <View style={{flexDirection:'row',gap:8}}>{([['end','添加到末尾'],['start','添加到开头']] as const).map(([pos,label])=>button(label,()=>{void services.preferences.update({playlistAddPosition:pos}).catch(()=>setMessage('添加位置未保存'));},preferences.playlistAddPosition===pos,`storage-add-position-${pos}`))}</View>
    </View>
    <View style={{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View style={{gap:2}}>
          <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>临时播放缓存</Text>
          <Text style={{color:s.muted,fontSize:12}}>{statistics?`${(statistics.bytes/1048576).toFixed(1)} MB · ${statistics.files} 个完整文件`:'正在读取缓存…'}</Text>
        </View>
        {button('刷新缓存统计',()=>{void refresh();})}
      </View>
      {covers&&<Text style={{color:s.muted,fontSize:12}}>封面 {(covers.bytes/1048576).toFixed(1)} MB · {covers.files} 张 · 上限 32 MB</Text>}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
      <Text style={{color:s.muted,fontSize:12}}>缓存配额上限</Text>
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[64,128,256,512,1024].map(limit=><View key={limit}>{button(`${limit} MB${preferences.cacheLimitMB===limit?' ✓':''}`,()=>{void services.preferences.update({cacheLimitMB:limit}).then(refresh).catch(()=>setMessage('缓存配额未保存'));},preferences.cacheLimitMB===limit)}</View>)}</View>
      <Pressable accessibilityRole="button" accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>Alert.alert('清理临时缓存？','仅清理临时音频、封面与歌词缓存。保留当前播放引用、离线下载及本地音频，不影响歌单和账号。',[{text:'取消',style:'cancel'},{text:'清理',style:'destructive',onPress:()=>{void clear();}}])} style={{minHeight:42,paddingHorizontal:16,paddingVertical:10,backgroundColor:s.accentSoft,borderWidth:1,borderColor:s.control+'44',borderRadius:21,alignItems:'center',justifyContent:'center',opacity:busy?.45:1}}><Text style={{color:s.control,fontSize:14,fontWeight:'600'}}>{busy?'正在清理…':'清理临时音频、封面和歌词缓存'}</Text></Pressable>
      <Text style={{color:s.muted,fontSize:11,lineHeight:18}}>仅完整接收的音频可复用；按账号、歌曲、音源版本和音质隔离。清理保留当前播放文件，离线保存单独管理。</Text>
      {!!message&&<Text style={{color:s.accent,fontSize:12}}>{message}</Text>}
    </View>
  </View>;
}
