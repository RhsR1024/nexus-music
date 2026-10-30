import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {fallbackQualities,normalizeQuality,qualityOrder,type Quality} from '../domain/quality.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';

export function DownloadQualityChoice({services,track,busy,onBack,onConfirm}:{services:Services;track:Track;busy:boolean;onBack:()=>void;onConfirm:(quality:Quality)=>void}){
 const {palette:p}=useTheme(),sources=useSyncExternalStore(services.registry.subscribe,services.registry.getSnapshot),preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
 const platform=track.origin.kind==='online'?track.origin.platform:undefined;
 const declared=new Set(sources.filter(source=>services.registry.isCurrent(source)).flatMap(source=>source.capabilities.filter(c=>c.platform===platform&&c.actions.includes('musicUrl')).flatMap(c=>c.qualities.map(normalizeQuality).filter((q):q is Quality=>q!==undefined))));
 const qualities=qualityOrder.filter(q=>declared.has(q)),preferred=(platform?preferences.downloadQualities[platform]:undefined)??preferences.quality;
 const initial=()=>fallbackQualities(preferred).find(q=>declared.has(q));
 const [choice,setChoice]=useState<Quality|undefined>(initial),[checking,setChecking]=useState(false),[message,setMessage]=useState('');
 const [result,setResult]=useState<{requestedQuality:Quality;reportedQuality?:string}|null>(null),version=useRef(0),abort=useRef<AbortController|null>(null);
 useEffect(()=>{version.current++;abort.current?.abort();setChecking(false);setResult(null);setMessage('');if(choice&&!declared.has(choice))setChoice(initial());return()=>{version.current++;abort.current?.abort();};},[track,sources]);
 const choose=(q:Quality)=>{version.current++;abort.current?.abort();setChecking(false);setResult(null);setMessage('');setChoice(q);};
 const probe=async()=>{
  if(!choice||checking||busy)return;const selected=choice,owner=sources,serial=++version.current,controller=new AbortController();abort.current?.abort();abort.current=controller;setChecking(true);setResult(null);setMessage('');
  try{const value=await services.probeDownloadQuality(track,selected,controller.signal);if(serial===version.current&&services.registry.getSnapshot()===owner&&!controller.signal.aborted)setResult(value);}
  catch{if(serial===version.current&&!controller.signal.aborted)setMessage('未检测到可用解析，请检查音源或更换档位后重试');}
  finally{if(serial===version.current)setChecking(false);}
 };
 const locked=busy||checking,estimate=choice?track.qualities.find(q=>normalizeQuality(q.id)===choice)?.sizeBytes:undefined;
 const button=(id:string,label:string,action:()=>void,disabled=false)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:p.surface,opacity:disabled?0.5:1}}><Text style={{...typography.body,color:p.accent}}>{label}</Text></Pressable>;
 return <ScrollView style={{backgroundColor:p.background[0]}} contentContainerStyle={{padding:space.lg,gap:space.md,paddingBottom:space.xl}}>
  {button('download-choice-back','返回歌曲操作',onBack)}
  <Text accessibilityRole="header" style={{...typography.title,color:p.text}}>选择本次下载音质</Text><Text style={{...typography.body,color:p.text}}>{track.title} · {track.artist}</Text>
  <Text style={{...typography.caption,color:p.secondary}}>档位由已启用音源声明。检测会请求解析，实际下载时会重新取址；来源标记不保证文件编码或码率。</Text>
  <View style={{gap:space.sm}}>{qualities.map(q=><Pressable key={q} testID={`download-choice-${q}`} accessibilityRole="radio" accessibilityLabel={`本次下载 ${q}`} accessibilityState={{selected:choice===q,disabled:locked}} disabled={locked} onPress={()=>choose(q)} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:choice===q?p.selected:p.surface}}><Text style={{...typography.body,color:choice===q?p.accent:p.text}}>{q} · 音源声明</Text></Pressable>)}</View>
  {!qualities.length&&<Text style={{...typography.body,color:p.secondary}}>当前没有为此平台声明下载档位的已启用音源。</Text>}
  {!!estimate&&<Text style={{...typography.caption,color:p.secondary}}>目录估算 {(estimate/1048576).toFixed(1)} MB，未核对实际文件。</Text>}
  {button('download-choice-probe',checking?'正在检测…':'检测所选音质',()=>{void probe();},!choice||locked)}
  {!!result&&result.requestedQuality===choice&&<Text testID="download-choice-probe-result" accessibilityLiveRegion="polite" style={{...typography.body,color:p.secondary}}>已取得解析 · 请求 {result.requestedQuality} · 来源标记 {result.reportedQuality??'未确认'}</Text>}
  {!!message&&<Text accessibilityRole="alert" style={{...typography.body,color:p.accent}}>{message}</Text>}
  <Text testID="download-choice-summary" style={{...typography.caption,color:p.secondary}}>本次首选 {choice??'待选择'}；不足时向下尝试。任务会保存本次选择，播放与平台默认设置保持不变。已有任务沿用原选择，在任务页处理。</Text>
  {button('download-choice-confirm',busy?'正在提交…':'开始下载',()=>{if(choice)onConfirm(choice);},!choice||locked)}
 </ScrollView>;
}
