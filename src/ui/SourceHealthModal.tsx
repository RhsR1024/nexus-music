import {Text,TextInput} from './Typography.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {FlatList, Keyboard, Pressable, Share, View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import {File,Paths} from 'expo-file-system';
import type {SourceHealth,HealthStatus} from '../providers/sourceHealth.ts';
import type {Quality} from '../domain/quality.ts';
import {useTheme} from './theme.tsx';
const labels:Record<HealthStatus,string>={pending:'等待检查',initializing:'初始化独立诊断会话','init-error':'诊断初始化失败',searching:'搜索测试曲目',resolving:'解析地址',probing:'检查媒体响应',header:'媒体头已识别',unrecognized:'响应未识别为媒体','http-error':'服务器状态错误','network-error':'响应获取失败',timeout:'检查超时','invalid-url':'地址无效','redirect-error':'重定向被拒绝','range-error':'分段响应无效',cancelled:'已取消','not-ready':'音源未就绪',unsupported:'未声明所选档位','search-error':'平台搜索暂不可用','no-song':'未找到测试歌曲','url-error':'未取得有效地址','source-changed':'音源已变化，请重新检查'};
const busy=new Set<HealthStatus>(['pending','initializing','searching','resolving','probing']);
const names={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'};
export function SourceHealthModal({health,ids,visible,onClose}:{health:SourceHealth;ids:readonly string[];visible:boolean;onClose:()=>void}){
  const {palette:p}=useTheme(),state=useSyncExternalStore(health.subscribe,health.getSnapshot);
  const [keyword,setKeyword]=useState(''),[mode,setMode]=useState<'basic'|'common'|'all'>('common'),[error,setError]=useState('');
  useEffect(()=>()=>health.cancel(),[health]);
  const button=(title:string,action:()=>void,disabled=false,id?:string)=><Pressable testID={id} accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:13,borderRadius:14,backgroundColor:p.selected,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{title}</Text></Pressable>;
  const close=()=>{health.cancel();onClose();};
  const run=(query:string)=>{if(state.running)return;Keyboard.dismiss();setError('');const qualities:readonly Quality[]|undefined=mode==='basic'?['128k']:mode==='common'?['flac','320k','128k']:undefined;void health.run(ids,query,qualities).catch(()=>setError('无法开始检查，请重新选择音源并输入关键词。'));};
  async function exportReport(){const file=new File(Paths.cache,`nexus-source-health-${Date.now()}.json`);try{file.write(health.report());await Share.share({url:file.uri,title:'音枢音源检查报告'});}catch{setError('报告未导出，请重试。');}finally{if(file.exists)file.delete();}}
  const done=state.rows.filter(row=>!busy.has(row.status)&&row.status!=='cancelled').length;
  return <Modal visible={visible} animationType="slide" onRequestClose={close}><View style={{flex:1,backgroundColor:p.background[0],paddingTop:60,paddingHorizontal:22}}>
    <FlatList keyboardShouldPersistTaps="handled" data={state.rows} keyExtractor={row=>row.id} initialNumToRender={12} windowSize={5} contentContainerStyle={{paddingBottom:60}} ListHeaderComponent={<View style={{gap:13,paddingBottom:20}}>
      {button('收起音源检查',close)}<Text style={{fontSize:28,fontWeight:'700',color:p.text}}>音源健康批测</Text>
      <Text style={{color:p.secondary,lineHeight:21}}>本次选择 {ids.length} 个音源。按其声明的平台与档位逐项检查，不更换音源、不降档、不改变播放队列。</Text>
      <TextInput accessibilityLabel="音源检查关键词" value={keyword} onChangeText={setKeyword} editable={!state.running} maxLength={250} placeholder="输入歌曲或歌手作为本次样本" placeholderTextColor={p.secondary} style={{padding:14,borderWidth:1,borderColor:p.border,borderRadius:13,color:p.text}} onSubmitEditing={event=>run(event.nativeEvent.text)}/>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>{([['basic','128k'],['common','常用三档'],['all','全部声明档位']]as const).map(([id,title])=><Pressable key={id} testID={`health-mode-${id}`} accessibilityRole="radio" accessibilityState={{selected:mode===id}} disabled={state.running} onPress={()=>setMode(id)} style={{padding:12,borderRadius:14,borderWidth:1,borderColor:mode===id?p.accent:p.border}}><Text style={{color:p.text}}>{title}</Text></Pressable>)}</View>
      {state.running?button('取消检查',()=>health.cancel(),false,'health-cancel'):button('开始逐项检查',()=>run(keyword),!ids.length||!keyword.trim(),'health-start')}
      <Text testID="health-progress" style={{color:p.text}}>{state.running?'检查中':state.cancelled?'已取消，已完成项保留':state.finishedAt?'检查结束':'尚未开始'} · {done} / {state.rows.length}</Text>
      <Text style={{color:p.secondary,lineHeight:21}}>媒体头识别只证明本次响应，不能证明完整文件、可解码或真实无损音质；MP4 等也可能仅识别到容器。检查不会播放音频。每个平台使用其实际搜索结果，失败不代表所有歌曲均不可用。</Text>
      {!!state.rows.length&&button('导出检查报告',()=>{void exportReport();},state.running)}{!!error&&<Text accessibilityRole="alert" style={{color:p.accent}}>{error}</Text>}
    </View>} renderItem={({item:row})=><View testID={`health-row-${row.platform??'none'}-${row.quality??'none'}`} style={{borderTopWidth:1,borderColor:p.border,paddingVertical:16,gap:7}}>
      <Text style={{color:p.text,fontWeight:'600'}}>{row.sourceName} · {row.platform?names[row.platform]:'音源'}{row.quality?` · ${row.quality}`:''}</Text>
      <Text style={{color:row.status==='header'?p.accent:p.text}}>{labels[row.status]}{row.format?` · ${row.format.toUpperCase()}`:''}{row.httpStatus?` · HTTP ${row.httpStatus}`:''}</Text>
      {!!row.song&&<Text style={{color:p.secondary}}>{row.song}</Text>}
      <Text style={{color:p.secondary,fontSize:12}}>本项 {(row.elapsedMs/1000).toFixed(2)} 秒{row.initializationMs!==undefined?` · 会话初始化 ${(row.initializationMs/1000).toFixed(2)} 秒`:null}{row.resolutionMs!==undefined?` · 解析 ${(row.resolutionMs/1000).toFixed(2)} 秒`:''}{row.probeMs!==undefined?` · 响应 ${(row.probeMs/1000).toFixed(2)} 秒`:''}{row.bytes!==undefined?` · 读取 ${row.bytes} 字节`:''}</Text>
    </View>} ListEmptyComponent={<Text style={{color:p.secondary}}>输入关键词后开始；未启用或不支持所选档位的音源会单独说明。</Text>}/>
  </View></Modal>;
}
