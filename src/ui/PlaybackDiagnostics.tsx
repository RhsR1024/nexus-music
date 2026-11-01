import {useSyncExternalStore} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {Services} from '../app/services.ts';
import {currentEntry} from '../domain/queue.ts';
import type {PlaybackTraceEvent, PlaybackTraceRun, PlaybackTraceStage} from '../playback/diagnostics.ts';
import {useTheme,type Theme} from './theme.tsx';
import {Text} from './Typography.tsx';

const stageLabels:Record<PlaybackTraceStage,string>={resolution:'解析',offline:'离线',match:'匹配',source:'选源',cache:'缓存',native:'解码'};
const runLabels:Record<PlaybackTraceRun['status'],string>={running:'采集中',ready:'已就绪',error:'失败',cancelled:'已取消'};
const eventLabels:Record<PlaybackTraceEvent['status'],string>={info:'进行',success:'完成',fallback:'降级',failed:'失败',cancelled:'取消'};

function elapsed(run:PlaybackTraceRun,event:PlaybackTraceEvent){
  return Math.max(0,event.at-run.startedAt)/1000;
}

export function PlaybackDiagnostics({services}:{services:Services}){
  const theme=useTheme(),styles=makeStyles(theme);
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const entry=currentEntry(state.queue),runs=state.diagnostics.slice(-6).reverse();
  const retry=()=>{
    if(!entry)return;
    services.playback.controller.invalidateMediaFor(entry.track);
    void services.playback.controller.play();
  };
  return <View style={styles.root}>
    <Text testID="playback-diagnostics-title" accessibilityRole="header" style={styles.title}>播放链路诊断</Text>
    <Text style={styles.caption}>记录本次播放的结构化阶段：匹配、离线命中、逐源请求、降档、缓存身份和原生解码。最多保留最近 6 次解析；不记录音频地址、请求头、凭据、脚本输出或异常原文。</Text>
    {entry&&<Pressable testID="playback-diagnostics-retry" accessibilityRole="button" accessibilityLabel="重新解析当前歌曲并采集链路" onPress={retry} style={styles.action}><Text style={styles.actionText}>{state.phase==='resolving'?'重新从当前进度解析':'重新解析当前歌曲'}</Text></Pressable>}
    {!runs.length&&<View style={styles.empty}><Text style={styles.emptyTitle}>还没有播放解析记录</Text><Text style={styles.caption}>播放一首在线、匹配、私服或本机歌曲后，这里会显示真实链路。已恢复但尚未解析的暂停队列不会伪造记录。</Text></View>}
    {runs.map(run=><View key={run.id} testID={`playback-diagnostic-run-${run.generation}`} style={styles.card}>
      <View style={styles.runHeader}>
        <View style={{flex:1}}><Text numberOfLines={1} style={styles.track}>{run.trackTitle}</Text><Text style={styles.caption}>{run.trackArtist} · 第 {run.generation} 代</Text></View>
        <View style={[styles.badge,run.status==='ready'?styles.ready:run.status==='error'?styles.failed:null]}><Text style={styles.badgeText}>{runLabels[run.status]}</Text></View>
      </View>
      {run.events.map(event=><View key={`${run.id}:${event.sequence}`} testID={`playback-diagnostic-event-${event.stage}-${event.status}-${event.sequence}`} style={styles.event}>
        <Text style={styles.time}>+{elapsed(run,event).toFixed(2)}s</Text>
        <View style={{flex:1,gap:3}}>
          <Text style={styles.eventTitle}>{stageLabels[event.stage]} · {event.title}</Text>
          <Text style={styles.meta}>{[eventLabels[event.status],event.sourceName,event.quality&&`音质 ${event.quality}`,event.platform&&`平台 ${event.platform}`].filter(Boolean).join(' · ')}</Text>
          {!!event.detail&&<Text style={styles.detail}>{event.detail}</Text>}
        </View>
      </View>)}
      {!run.events.length&&<Text style={styles.caption}>已开始解析，等待首个结构化阶段。</Text>}
    </View>)}
    <Text style={styles.caption}>“原生媒体已就绪”来自 AVPlayer ready 事件；“缓存文件解码成功”来自原生缓存标记。它们证明本次媒体容器已通过原生加载准备，仍不等同于完成全曲播放或真机音质验证。</Text>
  </View>;
}

const makeStyles=(theme:Theme)=>StyleSheet.create({
  root:{gap:14},
  title:{fontSize:24,lineHeight:31,fontWeight:'600',color:theme.palette.text},
  caption:{fontSize:12,lineHeight:19,color:theme.palette.secondary},
  action:{minHeight:46,borderRadius:13,paddingHorizontal:15,alignItems:'center',justifyContent:'center',backgroundColor:theme.palette.selected},
  actionText:{fontSize:13,fontWeight:'600',color:theme.palette.accent},
  empty:{padding:18,borderRadius:16,borderWidth:1,borderColor:theme.palette.border,gap:6},
  emptyTitle:{fontSize:15,fontWeight:'600',color:theme.palette.text},
  card:{borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.palette.border,backgroundColor:theme.palette.surface,overflow:'hidden'},
  runHeader:{padding:15,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.palette.border},
  track:{fontSize:15,fontWeight:'600',color:theme.palette.text},
  badge:{paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:theme.palette.selected},
  ready:{backgroundColor:theme.palette.accent},
  failed:{backgroundColor:theme.palette.accent,opacity:0.72},
  badgeText:{fontSize:10,fontWeight:'700',color:theme.palette.background[0]},
  event:{paddingHorizontal:15,paddingVertical:12,flexDirection:'row',gap:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.palette.border},
  time:{width:48,fontSize:10,lineHeight:17,color:theme.palette.secondary,fontVariant:['tabular-nums']},
  eventTitle:{fontSize:13,lineHeight:19,fontWeight:'600',color:theme.palette.text},
  meta:{fontSize:10,lineHeight:16,color:theme.palette.accent},
  detail:{fontSize:11,lineHeight:17,color:theme.palette.secondary},
});
