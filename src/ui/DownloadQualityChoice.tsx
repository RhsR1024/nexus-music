import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {fallbackQualities,normalizeQuality,qualityOrder,type Quality} from '../domain/quality.ts';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export function DownloadQualityChoice({services,track,busy,onBack,onConfirm,backLabel='返回歌曲操作'}:{services:Services;track:Track;busy:boolean;onBack:()=>void;onConfirm:(quality:Quality)=>void;backLabel?:string}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const sources=useSyncExternalStore(services.registry.subscribe,services.registry.getSnapshot),preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
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
  const okColor=s.dark?'#5EE0A0':'#1D8A56',okBg=s.dark?'rgba(94,224,160,0.14)':'rgba(29,138,86,0.11)';
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';

  return <View style={{flex:1}}>
    <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
    <ScrollView contentContainerStyle={{paddingHorizontal:18,paddingTop:12,paddingBottom:36,gap:14}}>
      <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.dark?'rgba(255,255,255,0.28)':'rgba(60,48,50,0.26)'}}/>
      <Pressable testID="download-choice-back" accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,minHeight:38,paddingHorizontal:13,borderRadius:19,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}>
        <Ionicons name="chevron-back" size={16} color={s.ink}/>
        <Text style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>{backLabel}</Text>
      </Pressable>

      <Text accessibilityRole="header" style={{fontSize:25,fontWeight:'700',letterSpacing:-0.3,color:s.ink}}>选择本次下载音质</Text>

      <View style={[{borderRadius:18,padding:13,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',gap:12},s.cardShadow]}>
        <Cover services={services} track={track} size={48} radius={11}/>
        <View style={{flex:1,minWidth:0,gap:3}}>
          <Text numberOfLines={1} style={{fontSize:15.5,fontWeight:'700',color:s.ink}}>{track.title}</Text>
          <Text numberOfLines={1} style={{fontSize:12.5,color:s.muted}}>{track.artist}</Text>
        </View>
      </View>

      <Text style={{fontSize:12.5,lineHeight:18,color:s.muted}}>档位由已启用音源声明。检测会请求解析，实际下载时会重新取址；来源标记不保证文件编码或码率。</Text>

      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
        {qualities.map((q,index)=>{
          const selected=choice===q;
          return <View key={q}>
            <Pressable testID={`download-choice-${q}`} accessibilityRole="radio" accessibilityLabel={`本次下载 ${q}`} accessibilityState={{selected,disabled:locked}} disabled={locked} onPress={()=>choose(q)} style={{minHeight:54,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,backgroundColor:selected?s.accentSoft:'transparent',opacity:locked?0.55:1}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <Ionicons name={selected?'radio-button-on':'radio-button-off'} size={20} color={selected?s.accent:s.subtle}/>
                <Text style={{fontSize:15,fontWeight:selected?'700':'500',color:selected?s.accent:s.ink}}>{q.toUpperCase()} · 音源声明</Text>
              </View>
              {selected&&<Ionicons name="checkmark" size={18} color={s.accent}/>}
            </Pressable>
            {index<qualities.length-1&&<View style={{height:StyleSheet.hairlineWidth,marginLeft:46,backgroundColor:s.hairline}}/>}
          </View>;
        })}
        {!qualities.length&&<View style={{padding:16}}><Text style={{fontSize:13.5,color:s.muted}}>当前没有为此平台声明下载档位的已启用音源。</Text></View>}
      </View>

      {!!estimate&&<Text style={{fontSize:12.5,color:s.muted,paddingHorizontal:4}}>目录估算 {(estimate/1048576).toFixed(1)} MB，未核对实际文件。</Text>}

      <View style={{flexDirection:'row',gap:10}}>
        <Pressable testID="download-choice-probe" accessibilityRole="button" accessibilityLabel={checking?'正在检测…':'检测所选音质'} disabled={!choice||locked} onPress={()=>{void probe();}} style={{flex:1,minHeight:46,paddingHorizontal:14,borderRadius:23,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:!choice||locked?0.45:1}}>
          {checking?<ActivityIndicator size="small" color={s.accent}/>:<Ionicons name="pulse-outline" size={17} color={s.accent}/>}
          <Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{checking?'正在检测…':'检测所选音质'}</Text>
        </Pressable>
        <Pressable testID="download-choice-confirm" accessibilityRole="button" accessibilityLabel={busy?'正在提交…':'开始下载'} disabled={!choice||locked} onPress={()=>{if(choice)onConfirm(choice);}} style={{flex:1,minHeight:46,paddingHorizontal:14,borderRadius:23,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:!choice||locked?0.45:1}}>
          <Ionicons name="cloud-download-outline" size={17} color="#FFFFFF"/>
          <Text style={{color:'#FFFFFF',fontSize:14.5,fontWeight:'700'}}>{busy?'正在提交…':'开始下载'}</Text>
        </Pressable>
      </View>

      {!!result&&result.requestedQuality===choice&&<View style={{flexDirection:'row',alignItems:'center',gap:8,padding:13,borderRadius:16,backgroundColor:okBg}}>
        <Ionicons name="checkmark-circle-outline" size={18} color={okColor}/>
        <Text testID="download-choice-probe-result" accessibilityLiveRegion="polite" style={{flex:1,fontSize:13,fontWeight:'600',color:okColor}}>已取得解析 · 请求 {result.requestedQuality} · 来源标记 {result.reportedQuality??'未确认'}</Text>
      </View>}
      {!!message&&<View style={{flexDirection:'row',alignItems:'center',gap:8,padding:13,borderRadius:16,backgroundColor:warnBg}}>
        <Ionicons name="alert-circle-outline" size={18} color={s.accent}/>
        <Text accessibilityRole="alert" style={{flex:1,fontSize:13,color:s.accent}}>{message}</Text>
      </View>}

      <Text testID="download-choice-summary" style={{fontSize:12,lineHeight:18,color:s.muted,paddingHorizontal:4}}>本次首选 {choice??'待选择'}；不足时向下尝试。任务会保存本次选择，播放与平台默认设置保持不变。已有任务沿用原选择，在任务页处理。</Text>
    </ScrollView>
  </View>;
}
