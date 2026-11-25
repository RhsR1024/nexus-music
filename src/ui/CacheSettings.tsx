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
  useSyncExternalStore(services.offlineDownloads.subscribe,services.offlineDownloads.getSnapshot);
  const attachments=useSyncExternalStore(services.managedAttachments.subscribe,services.managedAttachments.getSnapshot);
  const offlineStats=services.offlineDownloads.getStatistics();
  const [statistics,setStatistics]=useState<{bytes:number;files:number}>(),[message,setMessage]=useState('');
  const [covers,setCovers]=useState<{bytes:number;files:number}>();
  const clearing=useRef(false),[busy,setBusy]=useState(false);
  async function refresh(){try{const [audio,images]=await Promise.all([services.playback.cache.statistics(),services.covers.statistics()]);setStatistics(audio);setCovers(images);return true;}catch{setMessage('无法读取缓存统计');return false;}}
  async function runExclusive(work:()=>Promise<void>){
    if(clearing.current)return;clearing.current=true;setBusy(true);setMessage('');
    try{await work();}catch{setMessage('缓存清理未完成，请刷新后重试');}
    finally{clearing.current=false;setBusy(false);}
  }
  const clearAll=()=>runExclusive(async()=>{
    const results=await Promise.allSettled([services.playback.cache.clear(),services.covers.clear()]);
    services.lyrics.clear();services.davMedia.clearMetadata();services.visualColors.clear();services.coverTheme.invalidate();
    const refreshed=await refresh();
    if(results.some(result=>result.status==='rejected'))setMessage('部分缓存未能清理，请刷新后重试');
    else if(refreshed)setMessage('已清理临时缓存，离线下载与本地音频已保留');
  });
  const clearCovers=()=>runExclusive(async()=>{
    await services.covers.clear();
    services.visualColors.clear();services.coverTheme.invalidate();
    await refresh();
    setMessage('已清理封面图片缓存，重新浏览时按需加载');
  });
  const clearLyrics=()=>runExclusive(async()=>{
    services.lyrics.clear();
    setMessage('已清理歌词缓存，离线附加歌词文件已保留');
  });
  const clearOffline=()=>runExclusive(async()=>{
    await services.offlineDownloads.clearCompleted();
    await refresh();
    setMessage('已清理离线下载目录（正在播放的音频已保留）');
  });
  useEffect(()=>{void refresh();},[]);
  const totalCacheBytes=(statistics?.bytes??0)+(covers?.bytes??0);
  const readyAttachments=attachments.filter(item=>item.state==='ready').length;
  const button=(label:string,action:()=>void,selected=false,testID?:string)=><Pressable testID={testID} accessibilityRole="button" accessibilityState={selected!==undefined?{selected}:undefined} onPress={action} style={{minHeight:38,paddingHorizontal:13,paddingVertical:8,backgroundColor:selected?s.control:s.chip,borderWidth:1,borderColor:selected?s.control:s.chipBorder,borderRadius:19,justifyContent:'center'}}><Text style={{color:selected?'#FFFFFF':s.ink,fontSize:13,fontWeight:selected?'700':'600'}}>{label}</Text></Pressable>;
  const statTile=(icon:React.ComponentProps<typeof Ionicons>['name'],label:string,value:string,sub:string)=><View style={{flex:1,minWidth:'45%',padding:12,borderRadius:16,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,gap:3}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name={icon} size={15} color={s.control}/><Text style={{color:s.muted,fontSize:12,fontWeight:'600'}}>{label}</Text></View>
    <Text style={{color:s.ink,fontSize:15,fontWeight:'700',fontVariant:['tabular-nums']}}>{value}</Text>
    <Text numberOfLines={1} style={{color:s.subtle,fontSize:11}}>{sub}</Text>
  </View>;
  return <View style={{gap:14,marginTop:8}}>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6,marginBottom:-6}}>概览</Text>
    <View testID="storage-overview-card" style={[{padding:16,borderRadius:22,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
        <View style={{gap:2}}>
          <Text style={{color:s.muted,fontSize:12.5}}>当前临时缓存</Text>
          <Text style={{color:s.ink,fontSize:30,fontWeight:'800',fontVariant:['tabular-nums']}}>{statistics||covers?`${(totalCacheBytes/1048576).toFixed(1)} MB`:'计算中…'}</Text>
          <Text style={{color:s.muted,fontSize:12}}>包含临时音频、封面图片与内存歌词缓存</Text>
        </View>
        {button('刷新缓存统计',()=>{void refresh();})}
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {statTile('musical-notes-outline','离线音频',`${(offlineStats.bytes/1048576).toFixed(1)} MB`,`${offlineStats.files} 首已保存`)}
        {statTile('image-outline','封面缓存',covers?`${(covers.bytes/1048576).toFixed(1)} MB`:'—',covers?`${covers.files} 张 · 上限 32 MB`:'读取中')}
        {statTile('document-text-outline','歌词与附加',`${readyAttachments} 组`,'内存歌词 + 离线附加')}
        {statTile('disc-outline','临时音频',statistics?`${(statistics.bytes/1048576).toFixed(1)} MB`:'—',statistics?`${statistics.files} 个完整文件`:'读取中')}
      </View>
    </View>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6,marginBottom:-6}}>本地数据</Text>
    <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
        <Ionicons name="swap-vertical-outline" size={20} color={s.ink}/>
        <View style={{flex:1,gap:2}}>
          <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>歌曲添加位置</Text>
          <Text style={{color:s.muted,fontSize:12}}>应用到自建歌单添加新歌曲时的排序位置</Text>
        </View>
      </View>
      <View style={{flexDirection:'row',gap:8}}>{([['end','添加到末尾'],['start','添加到开头']] as const).map(([pos,label])=>button(label,()=>{void services.preferences.update({playlistAddPosition:pos}).catch(()=>setMessage('添加位置未保存'));},preferences.playlistAddPosition===pos,`storage-add-position-${pos}`))}</View>
    </View>
    <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:11},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <View style={{gap:2}}>
          <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>临时播放缓存</Text>
          <Text style={{color:s.muted,fontSize:12.5,fontVariant:['tabular-nums']}}>{statistics?`${(statistics.bytes/1048576).toFixed(1)} MB · ${statistics.files} 个完整文件`:'正在读取缓存…'}</Text>
        </View>
        <Text style={{color:s.control,fontSize:13,fontWeight:'700'}}>{preferences.cacheLimitMB} MB</Text>
      </View>
      {covers&&<Text style={{color:s.muted,fontSize:12}}>封面 {(covers.bytes/1048576).toFixed(1)} MB · {covers.files} 张 · 上限 32 MB</Text>}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
      <Text style={{color:s.muted,fontSize:12}}>缓存配额上限</Text>
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[64,128,256,512,1024].map(limit=><View key={limit}>{button(`${limit} MB${preferences.cacheLimitMB===limit?' ✓':''}`,()=>{void services.preferences.update({cacheLimitMB:limit}).then(refresh).catch(()=>setMessage('缓存配额未保存'));},preferences.cacheLimitMB===limit)}</View>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={busy?'正在清理…':'清理临时音频、封面和歌词缓存'} accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>Alert.alert('清理临时缓存？','仅清理临时音频、封面与歌词缓存。保留当前播放引用、离线下载及本地音频，不影响歌单和账号。',[{text:'取消',style:'cancel'},{text:'清理',style:'destructive',onPress:()=>{void clearAll();}}])} style={{minHeight:44,paddingHorizontal:16,paddingVertical:10,backgroundColor:s.control,borderRadius:22,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:busy?.45:1}}>
        <Ionicons name="trash-outline" size={17} color="#FFFFFF"/>
        <Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'600'}}>{busy?'正在清理…':'清理临时音频、封面和歌词缓存'}</Text>
      </Pressable>
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline,marginVertical:2}}/>
      <Text style={{color:s.muted,fontSize:12,fontWeight:'600'}}>分项清理</Text>
      <View style={{gap:8}}>
        <Pressable testID="cache-clear-covers" accessibilityRole="button" accessibilityLabel="清理封面缓存" accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>Alert.alert('清理封面缓存？','清理已缓存的专辑封面与配色缓存，离线下载与歌单不受影响。',[{text:'取消',style:'cancel'},{text:'清理封面',style:'destructive',onPress:()=>{void clearCovers();}}])} style={{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,opacity:busy?.45:1}}>
          <View style={{flex:1,gap:1}}><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>清理封面缓存</Text><Text style={{color:s.muted,fontSize:11.5}}>{covers?`${(covers.bytes/1048576).toFixed(1)} MB · ${covers.files} 张图片`:'清理封面与主色缓存'}</Text></View>
          <Text style={{color:s.control,fontSize:13,fontWeight:'600'}}>清理</Text>
        </Pressable>
        <Pressable testID="cache-clear-lyrics" accessibilityRole="button" accessibilityLabel="清理歌词缓存" accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>{void clearLyrics();}} style={{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,opacity:busy?.45:1}}>
          <View style={{flex:1,gap:1}}><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>清理歌词缓存</Text><Text style={{color:s.muted,fontSize:11.5}}>释放内存歌词缓存，不影响已下载附加歌词</Text></View>
          <Text style={{color:s.control,fontSize:13,fontWeight:'600'}}>清理</Text>
        </Pressable>
        <Pressable testID="cache-clear-offline" accessibilityRole="button" accessibilityLabel="清理离线下载目录" accessibilityState={{disabled:busy||offlineStats.files===0,busy}} disabled={busy||offlineStats.files===0} onPress={()=>Alert.alert('清理离线下载目录？',`将删除 ${offlineStats.files} 首已保存离线音频（${(offlineStats.bytes/1048576).toFixed(1)} MB）；当前正在播放的音频会保留，其他歌曲需重新下载。`,[{text:'保留',style:'cancel'},{text:'清理离线文件',style:'destructive',onPress:()=>{void clearOffline();}}])} style={{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:s.accentSoft,borderWidth:1,borderColor:`${s.control}38`,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,opacity:busy||offlineStats.files===0?.45:1}}>
          <View style={{flex:1,gap:1}}><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>清理离线下载目录</Text><Text style={{color:s.muted,fontSize:11.5}}>{offlineStats.files>0?`${(offlineStats.bytes/1048576).toFixed(1)} MB · ${offlineStats.files} 首（谨慎操作）`:'暂无已保存离线音频'}</Text></View>
          <Text style={{color:s.control,fontSize:13,fontWeight:'700'}}>清理</Text>
        </Pressable>
      </View>
      <Text style={{color:s.muted,fontSize:11,lineHeight:18}}>仅完整接收的音频可复用；按账号、歌曲、音源版本和音质隔离。清理临时缓存保留当前播放文件与离线保存。</Text>
      {!!message&&<Text style={{color:s.accent,fontSize:12.5,fontWeight:'500'}}>{message}</Text>}
    </View>
  </View>;
}
