import {useEffect,useState,useSyncExternalStore} from 'react';
import {Pressable,Text,View} from 'react-native';
import type {Services} from '../app/services.ts';
export function CacheSettings({services}:{services:Services}){
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [statistics,setStatistics]=useState<{bytes:number;files:number}>(),[message,setMessage]=useState('');
  async function refresh(){try{setStatistics(await services.playback.cache.statistics());}catch{setMessage('无法读取缓存统计');}}
  useEffect(()=>{void refresh();},[]);
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" onPress={action} style={{padding:12,backgroundColor:'#303A32',borderRadius:10}}><Text style={{color:'#D9F49B'}}>{label}</Text></Pressable>;
  return <View style={{gap:12,marginVertical:24}}><Text style={{color:'#ECEBF3',fontSize:18}}>临时播放缓存</Text>
    <Text style={{color:'#959EAC'}}>{statistics?`${(statistics.bytes/1048576).toFixed(1)} MB · ${statistics.files} 个完整文件`:'正在读取缓存…'}</Text>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[64,128,256,512,1024].map(limit=><View key={limit}>{button(`${limit} MB${preferences.cacheLimitMB===limit?' ✓':''}`,()=>{void services.preferences.update({cacheLimitMB:limit}).then(refresh).catch(()=>setMessage('缓存配额未保存'));})}</View>)}</View>
    {button('刷新缓存统计',()=>{void refresh();})}{button('清理临时音频和歌词缓存',()=>{services.lyrics.clear();void services.playback.cache.clear().then(refresh).catch(()=>setMessage('缓存清理失败，可重试'));})}
    <Text style={{color:'#959EAC',fontSize:11,lineHeight:20}}>仅完整接收的音频可复用；按账号、歌曲、音源版本和音质隔离。清理保留当前播放文件，缓存可能被系统回收。歌词仅在内存暂存，签名地址不写入缓存索引。离线保存单独管理。</Text>
    {!!message&&<Text style={{color:'#D6B69A'}}>{message}</Text>}
  </View>;
}
