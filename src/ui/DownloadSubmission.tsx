import {Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {DownloadSubmission} from '../app/downloadSubmission.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {DownloadTasks} from './DownloadSettings.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,space,typography} from './tokens.ts';
export function DownloadSubmissionView({services,report,onClose,backLabel='返回歌曲列表'}:{services:Services;report:DownloadSubmission;onClose:()=>void;backLabel?:string}){
 const {palette:p}=useTheme(),counts=(kind:string)=>report.entries.filter(e=>e.disposition===kind).length;
 const receipt=<View style={{gap:space.sm}}><Text accessibilityRole="header" style={{...typography.title,color:p.text}}>下载任务提交结果</Text><Text testID="download-submission-summary" accessibilityLiveRegion="polite" style={{color:p.secondary}}>已受理 {counts('submitted')} 项 · 已有 {counts('existing')} 项 · 未受理 {counts('failed')} 项</Text><Text style={{...typography.caption,color:p.secondary}}>涉及 {new Set(report.entries.flatMap(e=>e.id?[e.id]:[])).size} 个下载任务，实际状态以下方列表为准。</Text>{report.entries.map((e,i)=><Text key={i} testID={`download-submission-item-${i}`} style={{color:e.disposition==='failed'?p.accent:p.secondary}}>{e.track.title} · {e.disposition==='submitted'?'已受理':e.disposition==='existing'?'保留已有任务':e.reason}</Text>)}</View>;
 return <View style={{flex:1,backgroundColor:p.background[0]}}><Pressable testID="download-submission-back" accessibilityRole="button" accessibilityLabel={backLabel} onPress={onClose} style={{minHeight:controls.hit,paddingHorizontal:space.lg,justifyContent:'center'}}><Text style={{color:p.accent}}>{backLabel}</Text></Pressable><DownloadTasks services={services} header={receipt} focusIds={report.entries.flatMap(e=>e.id?[e.id]:[])}/></View>;
}
export function DownloadSubmissionModal({services,report,onClose}:{services:Services;report:DownloadSubmission|null;onClose:()=>void}){
 if(!report)return null;
 return <SheetModal visible animationType="slide" onRequestClose={onClose}><DownloadSubmissionView services={services} report={report} onClose={onClose}/></SheetModal>;
}
