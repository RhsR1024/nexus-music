import {Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import type {Services} from '../app/services.ts';
import type {DownloadSubmission} from '../app/downloadSubmission.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {DownloadTasks} from './DownloadSettings.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export function DownloadSubmissionView({services,report,onClose,backLabel='返回歌曲列表'}:{services:Services;report:DownloadSubmission;onClose:()=>void;backLabel?:string}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),counts=(kind:string)=>report.entries.filter(e=>e.disposition===kind).length;
  const okColor=s.dark?'#5EE0A0':'#1D8A56',okBg=s.dark?'rgba(94,224,160,0.14)':'rgba(29,138,86,0.11)';
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';
  const receipt=<View style={[{gap:10,padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>
    <Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700',color:s.ink}}>下载任务提交结果</Text>
    <Text testID="download-submission-summary" accessibilityLiveRegion="polite" style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>已受理 {counts('submitted')} 项 · 已有 {counts('existing')} 项 · 未受理 {counts('failed')} 项</Text>
    <Text style={{fontSize:12,color:s.muted}}>涉及 {new Set(report.entries.flatMap(e=>e.id?[e.id]:[])).size} 个下载任务，实际状态以下方列表为准。</Text>
    <View style={{gap:6,paddingTop:4}}>
      {report.entries.map((e,i)=>{
        const failed=e.disposition==='failed',submitted=e.disposition==='submitted';
        return <View key={i} style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:11,paddingVertical:8,borderRadius:12,backgroundColor:failed?warnBg:submitted?okBg:s.chip}}>
          <Ionicons name={failed?'close-circle-outline':submitted?'checkmark-circle-outline':'time-outline'} size={15} color={failed?s.accent:submitted?okColor:s.muted}/>
          <Text testID={`download-submission-item-${i}`} style={{flex:1,fontSize:12.5,color:failed?s.accent:s.ink}}>{e.track.title} · {submitted?'已受理':e.disposition==='existing'?'保留已有任务':e.reason}</Text>
        </View>;
      })}
    </View>
  </View>;
  return <View style={{flex:1}}>
    <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
    <View style={{paddingHorizontal:18,paddingTop:12,paddingBottom:4}}>
      <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.dark?'rgba(255,255,255,0.28)':'rgba(60,48,50,0.26)',marginBottom:10}}/>
      <Pressable testID="download-submission-back" accessibilityRole="button" accessibilityLabel={backLabel} onPress={onClose} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,minHeight:38,paddingHorizontal:13,borderRadius:19,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder}}>
        <Ionicons name="chevron-back" size={16} color={s.ink}/>
        <Text style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>{backLabel}</Text>
      </Pressable>
    </View>
    <DownloadTasks services={services} header={receipt} focusIds={report.entries.flatMap(e=>e.id?[e.id]:[])}/>
  </View>;
}
export function DownloadSubmissionModal({services,report,onClose}:{services:Services;report:DownloadSubmission|null;onClose:()=>void}){
  if(!report)return null;
  return <SheetModal allowSwipeDismissal visible animationType="slide" onRequestClose={onClose}><DownloadSubmissionView services={services} report={report} onClose={onClose}/></SheetModal>;
}
