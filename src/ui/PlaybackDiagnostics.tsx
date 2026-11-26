import {useState,useSyncExternalStore} from 'react';
import {Pressable, Share, StyleSheet, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {currentEntry} from '../domain/queue.ts';
import type {PlaybackTraceEvent, PlaybackTraceRun, PlaybackTraceStage} from '../playback/diagnostics.ts';
import {formatPlaybackDiagnosticsReport} from '../playback/diagnostics.ts';
import {useTheme,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {Text} from './Typography.tsx';

const stageLabels:Record<PlaybackTraceStage,string>={resolution:'解析',offline:'离线',match:'匹配',source:'选源',cache:'缓存',native:'解码'};
const runLabels:Record<PlaybackTraceRun['status'],string>={running:'采集中',ready:'已就绪',error:'失败',cancelled:'已取消'};
const eventLabels:Record<PlaybackTraceEvent['status'],string>={info:'进行',success:'完成',fallback:'降级',failed:'失败',cancelled:'取消'};

function elapsed(run:PlaybackTraceRun,event:PlaybackTraceEvent){
  return Math.max(0,event.at-run.startedAt)/1000;
}

export function PlaybackDiagnostics({services}:{services:Services}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=makeStyles(theme);
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const entry=currentEntry(state.queue),runs=state.diagnostics.slice(-6).reverse();
  const [shareError,setShareError]=useState('');
  const retry=()=>{
    if(!entry)return;
    services.playback.controller.invalidateMediaFor(entry.track);
    void services.playback.controller.play();
  };
  const share=async()=>{
    setShareError('');
    try{await Share.share({message:formatPlaybackDiagnosticsReport(state.diagnostics),title:'音枢播放链路诊断'});}
    catch{setShareError('未能打开系统分享，请重试。');}
  };
  const okColor=s.dark?'#5EE0A0':'#1D8A56',okBg=s.dark?'rgba(94,224,160,0.16)':'rgba(29,138,86,0.12)';
  return <View style={styles.root}>
    <View style={{gap:6}}>
      <Text testID="playback-diagnostics-title" accessibilityRole="header" style={styles.title}>播放链路诊断</Text>
      <Text style={styles.caption}>记录本次播放的结构化阶段：匹配、离线命中、逐源请求、降档、缓存身份和原生解码。最多保留最近 6 次解析；不记录音频地址、请求头、凭据、脚本输出或异常原文。</Text>
    </View>
    {(entry||runs.length>0)&&<View style={styles.actions}>
      {entry&&<Pressable testID="playback-diagnostics-retry" accessibilityRole="button" accessibilityLabel="重新解析当前歌曲并采集链路" onPress={retry} style={[styles.action,{backgroundColor:s.control,borderWidth:0}]}>
        <Ionicons name="refresh" size={16} color="#FFFFFF"/>
        <Text style={[styles.actionText,{color:'#FFFFFF'}]}>{state.phase==='resolving'?'重新从当前进度解析':'重新解析当前歌曲'}</Text>
      </Pressable>}
      {runs.length>0&&<Pressable testID="playback-diagnostics-share" accessibilityRole="button" accessibilityLabel="分享脱敏的播放链路诊断摘要" onPress={()=>{void share();}} style={styles.action}>
        <Ionicons name="share-outline" size={16} color={s.accent}/>
        <Text style={styles.actionText}>分享诊断摘要</Text>
      </Pressable>}
    </View>}
    {!!shareError&&<Text accessibilityRole="alert" style={styles.error}>{shareError}</Text>}
    {!runs.length&&<View style={[styles.empty,s.cardShadow]}><Text style={styles.emptyTitle}>还没有播放解析记录</Text><Text style={styles.caption}>播放一首在线、匹配、私服或本机歌曲后，这里会显示真实链路。已恢复但尚未解析的暂停队列不会伪造记录。</Text></View>}
    {runs.map(run=><View key={run.id} testID={`playback-diagnostic-run-${run.generation}`} style={[styles.card,s.cardShadow]}>
      <View style={styles.runHeader}>
        <View style={{flex:1,minWidth:0,gap:2}}><Text numberOfLines={1} style={styles.track}>{run.trackTitle}</Text><Text style={styles.caption}>{run.trackArtist} · 第 {run.generation} 代</Text></View>
        <View style={[styles.badge,run.status==='ready'?{backgroundColor:okBg}:run.status==='error'?{backgroundColor:s.accentSoft}:null]}>
          <Text style={[styles.badgeText,{color:run.status==='ready'?okColor:run.status==='error'?s.accent:s.ink}]}>{runLabels[run.status]}</Text>
        </View>
      </View>
      {run.events.map(event=><View key={`${run.id}:${event.sequence}`} testID={`playback-diagnostic-event-${event.stage}-${event.status}-${event.sequence}`} style={styles.event}>
        <Text style={styles.time}>+{elapsed(run,event).toFixed(2)}s</Text>
        <View style={{flex:1,gap:3}}>
          <Text style={styles.eventTitle}>{stageLabels[event.stage]} · {event.title}</Text>
          <Text style={styles.meta}>{[eventLabels[event.status],event.sourceName,event.quality&&`音质 ${event.quality}`,event.platform&&`平台 ${event.platform}`].filter(Boolean).join(' · ')}</Text>
          {!!event.detail&&<Text style={styles.detail}>{event.detail}</Text>}
        </View>
      </View>)}
      {!run.events.length&&<Text style={[styles.caption,{padding:14}]}>已开始解析，等待首个结构化阶段。</Text>}
    </View>)}
    <Text style={styles.caption}>“原生媒体已就绪”来自 AVPlayer ready 事件；“缓存文件解码成功”来自原生缓存标记。它们证明本次媒体容器已通过原生加载准备，仍不等同于完成全曲播放或真机音质验证。</Text>
  </View>;
}

const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return StyleSheet.create({
    root:{gap:14},
    title:{fontSize:25,lineHeight:31,fontWeight:'700',letterSpacing:-0.3,color:s.ink},
    caption:{fontSize:12,lineHeight:18.5,color:s.muted},
    actions:{flexDirection:'row',flexWrap:'wrap',gap:10},
    action:{minHeight:44,flexGrow:1,borderRadius:22,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder},
    actionText:{fontSize:13.5,fontWeight:'600',color:s.ink},
    error:{fontSize:12.5,lineHeight:19,color:s.accent},
    empty:{padding:18,borderRadius:20,borderWidth:1,borderColor:s.cardBorder,backgroundColor:s.card,gap:6},
    emptyTitle:{fontSize:15,fontWeight:'700',color:s.ink},
    card:{borderRadius:20,borderWidth:1,borderColor:s.cardBorder,backgroundColor:s.card,overflow:'hidden'},
    runHeader:{padding:14,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:s.hairline},
    track:{fontSize:15,fontWeight:'700',color:s.ink},
    badge:{paddingHorizontal:10,paddingVertical:4,borderRadius:10,backgroundColor:s.chip},
    badgeText:{fontSize:11,fontWeight:'700'},
    event:{paddingHorizontal:14,paddingVertical:11,flexDirection:'row',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:s.hairline},
    time:{width:48,fontSize:11,lineHeight:17,color:s.subtle,fontVariant:['tabular-nums']},
    eventTitle:{fontSize:13.5,lineHeight:19,fontWeight:'600',color:s.ink},
    meta:{fontSize:11,lineHeight:16,color:s.accent,fontWeight:'500'},
    detail:{fontSize:11.5,lineHeight:17,color:s.muted},
  });
};
