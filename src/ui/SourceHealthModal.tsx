import {Text,TextInput} from './Typography.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,FlatList,Keyboard,Pressable,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {shareLocalFile} from '../storage/shareLocalFiles.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {File,Paths} from 'expo-file-system';
import type {SourceHealth,HealthStatus} from '../providers/sourceHealth.ts';
import type {Quality} from '../domain/quality.ts';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

const labels:Record<HealthStatus,string>={pending:'等待检查',initializing:'初始化独立诊断会话','init-error':'诊断初始化失败',searching:'搜索测试曲目',resolving:'解析地址',probing:'检查媒体响应',header:'媒体头已识别',unrecognized:'响应未识别为媒体','http-error':'服务器状态错误','network-error':'响应获取失败',timeout:'检查超时','invalid-url':'地址无效','redirect-error':'重定向被拒绝','range-error':'分段响应无效',cancelled:'已取消','not-ready':'音源未就绪',unsupported:'未声明所选档位','search-error':'平台搜索暂不可用','no-song':'未找到测试歌曲','url-error':'未取得有效地址','source-changed':'音源已变化，请重新检查'};
const busy=new Set<HealthStatus>(['pending','initializing','searching','resolving','probing']);
const names={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'};

export function SourceHealthModal({health,ids,visible,onClose}:{health:SourceHealth;ids:readonly string[];visible:boolean;onClose:()=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const state=useSyncExternalStore(health.subscribe,health.getSnapshot);
  const [keyword,setKeyword]=useState(''),[mode,setMode]=useState<'basic'|'common'|'all'>('common'),[error,setError]=useState('');
  useEffect(()=>()=>health.cancel(),[health]);
  const close=()=>{health.cancel();onClose();};
  const run=(query:string)=>{if(state.running)return;Keyboard.dismiss();setError('');const qualities:readonly Quality[]|undefined=mode==='basic'?['128k']:mode==='common'?['flac','320k','128k']:undefined;void health.run(ids,query,qualities).catch(()=>setError('无法开始检查，请重新选择音源并输入关键词。'));};
  async function exportReport(){const file=new File(Paths.cache,`nexus-source-health-${Date.now()}.json`);try{file.write(health.report());await shareLocalFile(file.uri,'音枢音源检查报告');}catch{setError('报告未导出，请重试。');}finally{if(file.exists)file.delete();}}
  const done=state.rows.filter(row=>!busy.has(row.status)&&row.status!=='cancelled').length;
  const passed=state.rows.filter(row=>row.status==='header').length;
  const failed=done-passed;
  const ratio=state.rows.length>0?Math.min(1,done/state.rows.length):0;
  const okColor=s.dark?'#5EE0A0':'#1D8A56';
  const okBg=s.dark?'rgba(94,224,160,0.14)':'rgba(29,138,86,0.11)';
  const warnBg=s.dark?'rgba(255,107,129,0.14)':'rgba(217,67,85,0.10)';
  const canStart=!!ids.length&&!!keyword.trim();

  return <SheetModal allowSwipeDismissal visible={visible} animationType="slide" onRequestClose={close}>
    <SafeAreaProvider>
      <SafeAreaView style={{flex:1,backgroundColor:s.sheetGradient[0]}} edges={['bottom']}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.subtle+'66',marginTop:10,marginBottom:4}}/>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:6,paddingBottom:12,gap:12}}>
          <View style={{flex:1,minWidth:0,gap:4}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700',color:s.ink,letterSpacing:-0.3}}>音源健康批测</Text>
              <View style={{paddingHorizontal:9,paddingVertical:3,borderRadius:999,backgroundColor:s.accentSoft}}>
                <Text style={{fontSize:11.5,fontWeight:'600',color:s.control,fontVariant:['tabular-nums']}}>{ids.length} 个音源</Text>
              </View>
            </View>
            <Text style={{fontSize:12.5,color:s.muted}}>独立会话逐项验证，不降档也不影响当前播放</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="收起音源检查" onPress={close} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}>
            <View style={{width:34,height:34,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}>
              <Ionicons name="close" size={19} color={s.ink}/>
            </View>
          </Pressable>
        </View>

        <FlatList keyboardShouldPersistTaps="handled" data={state.rows} keyExtractor={row=>row.id} initialNumToRender={12} windowSize={5} contentContainerStyle={{paddingHorizontal:20,paddingBottom:48,gap:10}}
          ListHeaderComponent={<View style={{gap:12,paddingBottom:6}}>
            <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,gap:12},s.cardShadow]}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8,borderRadius:14,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,paddingHorizontal:12,minHeight:46}}>
                <Ionicons name="search-outline" size={18} color={s.subtle}/>
                <TextInput accessibilityLabel="音源检查关键词" value={keyword} onChangeText={setKeyword} editable={!state.running} maxLength={250} placeholder="输入歌曲或歌手作为本次样本" placeholderTextColor={s.subtle} style={{flex:1,paddingVertical:10,color:s.ink,fontSize:14.5}} onSubmitEditing={event=>run(event.nativeEvent.text)}/>
                {!!keyword&&!state.running&&<Pressable accessibilityRole="button" accessibilityLabel="清空样本关键词" onPress={()=>setKeyword('')} style={{padding:4}}><Ionicons name="close-circle" size={18} color={s.subtle}/></Pressable>}
              </View>
              <View style={{gap:6}}>
                <Text style={{fontSize:12,fontWeight:'600',color:s.muted,marginLeft:2}}>检查音质范围</Text>
                <View style={{flexDirection:'row',gap:8}}>
                  {([['basic','128k'],['common','常用三档'],['all','全部声明档位']]as const).map(([id,title])=>{
                    const active=mode===id;
                    return <Pressable key={id} testID={`health-mode-${id}`} accessibilityRole="radio" accessibilityState={{selected:active}} disabled={state.running} onPress={()=>setMode(id)} style={{flex:1,minHeight:40,paddingHorizontal:8,borderRadius:12,backgroundColor:active?s.accentSoft:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:state.running?.6:1}}>
                      <Text numberOfLines={1} style={{fontSize:12.5,fontWeight:active?'700':'500',color:active?s.control:s.ink}}>{title}</Text>
                    </Pressable>;
                  })}
                </View>
              </View>
              {state.running?<Pressable testID="health-cancel" accessibilityRole="button" accessibilityLabel="取消检查" onPress={()=>health.cancel()} style={{minHeight:46,borderRadius:23,backgroundColor:warnBg,borderWidth:1,borderColor:s.accent+'44',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}>
                <ActivityIndicator size="small" color={s.accent}/>
                <Text style={{color:s.accent,fontSize:15,fontWeight:'700'}}>取消检查</Text>
              </Pressable>:<Pressable testID="health-start" accessibilityRole="button" accessibilityLabel="开始逐项检查" disabled={!canStart} onPress={()=>run(keyword)} style={{minHeight:46,borderRadius:23,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:canStart?1:.42}}>
                <Ionicons name="pulse-outline" size={18} color="#FFFFFF"/>
                <Text style={{color:'#FFFFFF',fontSize:15,fontWeight:'700'}}>开始逐项检查</Text>
              </Pressable>}
            </View>

            <View style={[{borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:14,gap:10},s.cardShadow]}>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                  <View style={{width:8,height:8,borderRadius:4,backgroundColor:state.running?s.control:state.finishedAt?okColor:s.subtle}}/>
                  <Text testID="health-progress" style={{color:s.ink,fontSize:13.5,fontWeight:'600',fontVariant:['tabular-nums']}}>{state.running?'检查中':state.cancelled?'已取消，已完成项保留':state.finishedAt?'检查结束':'尚未开始'} · {done} / {state.rows.length}</Text>
                </View>
                {!!state.rows.length&&<Pressable accessibilityRole="button" accessibilityLabel="导出检查报告" disabled={state.running} onPress={()=>{void exportReport();}} style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:6,borderRadius:999,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,opacity:state.running?.45:1}}>
                  <Ionicons name="share-outline" size={14} color={s.control}/>
                  <Text style={{color:s.control,fontSize:12,fontWeight:'600'}}>导出检查报告</Text>
                </Pressable>}
              </View>
              <View style={{height:5,borderRadius:3,backgroundColor:s.chip,overflow:'hidden'}}>
                <View style={{width:`${Math.round(ratio*100)}%`,height:5,borderRadius:3,backgroundColor:state.cancelled?s.muted:s.control}}/>
              </View>
              {done>0&&<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
                <View style={{paddingHorizontal:9,paddingVertical:3,borderRadius:999,backgroundColor:okBg}}><Text style={{fontSize:11.5,fontWeight:'600',color:okColor,fontVariant:['tabular-nums']}}>可用 {passed}</Text></View>
                {failed>0&&<View style={{paddingHorizontal:9,paddingVertical:3,borderRadius:999,backgroundColor:warnBg}}><Text style={{fontSize:11.5,fontWeight:'600',color:s.accent,fontVariant:['tabular-nums']}}>未通过 {failed}</Text></View>}
              </View>}
            </View>

            {!!error&&<View style={{flexDirection:'row',alignItems:'center',gap:8,padding:12,borderRadius:14,backgroundColor:warnBg,borderWidth:1,borderColor:s.accent+'33'}}>
              <Ionicons name="alert-circle-outline" size={17} color={s.accent}/>
              <Text accessibilityRole="alert" style={{flex:1,color:s.accent,fontSize:13,lineHeight:18}}>{error}</Text>
            </View>}

            <View style={{flexDirection:'row',alignItems:'flex-start',gap:8,padding:12,borderRadius:14,backgroundColor:s.dark?'rgba(255,255,255,0.04)':'rgba(42,36,31,0.035)'}}>
              <Ionicons name="information-circle-outline" size={16} color={s.subtle} style={{marginTop:1}}/>
              <Text style={{flex:1,color:s.muted,fontSize:11.5,lineHeight:17.5}}>媒体头识别仅证明本次响应，不保证完整文件或真实无损；MP4 等可能仅识别容器。检查不播放音频、不更改播放队列，单项失败不代表全部歌曲不可用。</Text>
            </View>
          </View>}
          renderItem={({item:row})=>{
            const ok=row.status==='header',inProgress=busy.has(row.status);
            const badgeBg=ok?okBg:inProgress?s.accentSoft:warnBg;
            const badgeInk=ok?okColor:inProgress?s.control:s.accent;
            return <View testID={`health-row-${row.platform??'none'}-${row.quality??'none'}`} style={[{borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:14,gap:7},s.cardShadow]}>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <Text numberOfLines={1} style={{color:s.ink,fontSize:14.5,fontWeight:'700',flexShrink:1}}>{row.sourceName}</Text>
                  <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:s.chip}}><Text style={{color:s.muted,fontSize:11,fontWeight:'600'}}>{row.platform?names[row.platform]:'音源'}</Text></View>
                  {!!row.quality&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:s.chip}}><Text style={{color:s.muted,fontSize:11,fontWeight:'600'}}>{row.quality.toUpperCase()}</Text></View>}
                </View>
                <View style={{paddingHorizontal:9,paddingVertical:3,borderRadius:999,backgroundColor:badgeBg}}>
                  <Text style={{color:badgeInk,fontSize:11.5,fontWeight:'700'}}>{labels[row.status]}{row.format?` · ${row.format.toUpperCase()}`:''}{row.httpStatus?` · HTTP ${row.httpStatus}`:''}</Text>
                </View>
              </View>
              {!!row.song&&<View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                <Ionicons name="musical-note-outline" size={13} color={s.subtle}/>
                <Text numberOfLines={1} style={{flex:1,color:s.muted,fontSize:12.5}}>{row.song}</Text>
              </View>}
              <Text style={{color:s.subtle,fontSize:11.5,fontVariant:['tabular-nums']}}>本项 {(row.elapsedMs/1000).toFixed(2)} 秒{row.initializationMs!==undefined?` · 初始化 ${(row.initializationMs/1000).toFixed(2)} 秒`:''}{row.resolutionMs!==undefined?` · 解析 ${(row.resolutionMs/1000).toFixed(2)} 秒`:''}{row.probeMs!==undefined?` · 响应 ${(row.probeMs/1000).toFixed(2)} 秒`:''}{row.bytes!==undefined?` · ${row.bytes} B`:''}</Text>
            </View>;
          }}
          ListEmptyComponent={<View style={{alignItems:'center',paddingVertical:28,gap:8}}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color={s.subtle}/>
            <Text style={{color:s.muted,fontSize:13,textAlign:'center',lineHeight:19}}>输入关键词后开始；未启用或不支持所选档位的音源会单独说明。</Text>
          </View>}
         showsVerticalScrollIndicator={false}/>
      </SafeAreaView>
    </SafeAreaProvider>
  </SheetModal>;
}
