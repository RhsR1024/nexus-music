import {useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,SectionList,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {OfflineDownloadInUse,type OfflineDownloadRecord} from '../storage/offlineDownloads.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';

export function DownloadSettings({services,openTasks}:{services:Services;openTasks:()=>void}){
  const {palette:p}=useTheme();
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.offlineDownloads.subscribe,services.offlineDownloads.getSnapshot);
  const stats=services.offlineDownloads.getStatistics(),[message,setMessage]=useState('');
  return <View style={{gap:20,paddingTop:12}}>
    <Text style={{color:p.secondary,lineHeight:22}}>在线下载音质跟随播放偏好；私人曲库按服务端返回保存。仅完整保存并通过校验的文件可离线播放。</Text>
    <View style={{borderRadius:22,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,overflow:'hidden'}}>
      <View style={{padding:18,flexDirection:'row',alignItems:'center',gap:14}}><Ionicons name="cloud-download-outline" size={24} color={p.accent}/><View style={{flex:1,gap:5}}><Text style={{color:p.text,fontSize:17,fontWeight:'600'}}>在线下载音质</Text><Text testID="download-quality-summary" style={{color:p.secondary,fontSize:13}}>跟随播放设置 · {preferences.quality}</Text></View></View>
      <Pressable testID="settings-open-downloadTasks" accessibilityRole="button" accessibilityLabel="查看下载任务与文件" onPress={openTasks} style={{minHeight:82,padding:18,borderTopWidth:1,borderTopColor:p.border,flexDirection:'row',alignItems:'center',gap:14}}>
        <Ionicons name="download-outline" size={24} color={p.accent}/><View style={{flex:1,gap:5}}><Text style={{color:p.text,fontSize:17,fontWeight:'600'}}>下载任务与文件</Text><Text style={{color:p.secondary,fontSize:13}}>{stats.pending} 个待处理 · {stats.files} 个已保存</Text></View><Ionicons name="chevron-forward" size={20} color={p.secondary}/>
      </Pressable>
    </View>
    <View style={{gap:12}}><Text accessibilityRole="header" style={{color:p.secondary,fontSize:13}}>离线文件容量上限</Text>
      <Text testID="offline-capacity-summary" style={{color:p.secondary}}>{(stats.bytes/1048576).toFixed(1)} MB / {preferences.offlineLimitMB} MB</Text>
      <View style={{borderRadius:22,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,overflow:'hidden'}}>{[512,1024,2048,4096,8192].map((limit,index)=><Pressable key={limit} testID={`offline-limit-${limit}`} accessibilityRole="radio" accessibilityState={{selected:preferences.offlineLimitMB===limit}} accessibilityLabel={`${limit} MB`} onPress={()=>{void services.preferences.update({offlineLimitMB:limit}).then(()=>setMessage('')).catch(()=>setMessage('离线容量未保存，原设置保留'));}} style={{paddingHorizontal:18,minHeight:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:index===0?0:1,borderTopColor:p.border}}><Text style={{color:p.text,fontSize:16}}>{limit} MB</Text><Ionicons name={preferences.offlineLimitMB===limit?'checkmark-circle':'ellipse-outline'} size={22} color={preferences.offlineLimitMB===limit?p.accent:p.secondary}/></Pressable>)}</View>
      <Text style={{color:p.secondary,fontSize:12,lineHeight:21}}>减少上限不会自动删除已有文件；空间不足时可在任务页清理已保存文件。临时播放缓存单独管理。</Text>
    </View>
    {!!message&&<Text accessibilityRole="alert" style={{color:p.secondary}}>{message}</Text>}
  </View>;
}

export function DownloadTasks({services}:{services:Services}){
  const {palette:p}=useTheme(),[message,setMessage]=useState('');
  const downloads=useSyncExternalStore(services.offlineDownloads.subscribe,services.offlineDownloads.getSnapshot);
  const tasks=downloads.filter(item=>item.status!=='completed'),completed=downloads.filter(item=>item.status==='completed');
  const pauseable=tasks.some(item=>item.status==='queued'||item.status==='downloading'),resumable=tasks.some(item=>item.status==='queued'||item.status==='paused');
  const perform=(action:()=>Promise<unknown>)=>{setMessage('');void action().catch(error=>setMessage(error instanceof OfflineDownloadInUse?error.message:'操作未完成，原任务保留，可重试'));};
  const button=(id:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],action:()=>void,disabled=false,accessibilityLabel=label)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{minHeight:44,paddingHorizontal:12,paddingVertical:10,borderRadius:22,backgroundColor:p.selected,opacity:disabled?0.4:1,flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name={icon} size={18} color={p.accent}/><Text style={{color:p.accent,fontSize:13}}>{label}</Text></Pressable>;
  const confirmRemove=(item:OfflineDownloadRecord)=>Alert.alert(item.status==='completed'?'删除离线文件？':'移除下载记录？',`${item.track.title}；${item.status==='completed'?'删除后需要重新下载。':'仅移除任务记录及临时文件，不影响已保存音频。'}`,[{text:'保留',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>perform(()=>services.offlineDownloads.remove(item.id))}]);
  const renderItem=({item}:{item:OfflineDownloadRecord})=><View testID={`offline-download-${item.id}`} style={{padding:16,marginBottom:10,gap:10,borderRadius:20,backgroundColor:p.surface,borderWidth:1,borderColor:p.border}}>
    <View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Ionicons name={item.status==='completed'?'checkmark-circle-outline':item.status==='failed'?'alert-circle-outline':item.status==='cancelled'?'stop-circle-outline':'cloud-download-outline'} size={27} color={p.accent}/><View style={{flex:1,gap:5}}><Text numberOfLines={2} style={{color:p.text,fontSize:16,fontWeight:'600'}}>{item.track.title}</Text><Text numberOfLines={1} style={{color:p.secondary,fontSize:13}}>{item.track.artist}</Text><Text testID={`offline-status-${item.id}`} style={{color:p.secondary,fontSize:12}}>{item.status==='completed'?`${(item.bytes/1048576).toFixed(1)} MB · 已保存`:item.status==='downloading'?'正在下载…':item.status==='paused'?`已暂停 · ${((item.partialBytes??0)/1048576).toFixed(1)} MB`:item.status==='queued'?'等待下载':item.status==='cancelled'?'下载已取消':`下载失败：${item.error??'请重试'}`}</Text></View></View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {item.status==='completed'&&button(`offline-play-${item.id}`,'播放离线文件','play-outline',()=>services.playTracks([item.track],0))}
      {item.status==='queued'&&button(`offline-start-${item.id}`,'开始下载','play-outline',()=>perform(()=>services.offlineDownloads.start(item.id)))}
      {(item.status==='failed'||item.status==='cancelled')&&button(`offline-retry-${item.id}`,'重试下载','refresh-outline',()=>perform(()=>services.offlineDownloads.retry(item.id)))}
      {item.status==='paused'&&button(`offline-resume-${item.id}`,'继续下载','play-outline',()=>perform(()=>services.offlineDownloads.resume(item.id)))}
      {(item.status==='downloading'||item.status==='queued')&&button(`offline-pause-${item.id}`,'暂停下载','pause-outline',()=>perform(()=>services.offlineDownloads.pause(item.id)))}
      {item.status==='queued'||item.status==='downloading'||item.status==='paused'?button(`offline-cancel-${item.id}`,'取消下载','close-circle-outline',()=>perform(()=>services.offlineDownloads.cancel(item.id)),false,`取消下载：${item.track.title} · ${item.track.artist}`):null}
      {button(`offline-remove-${item.id}`,item.status==='completed'?'删除离线文件':'移除记录','trash-outline',()=>confirmRemove(item),false,`${item.status==='completed'?'删除离线文件':'移除记录'}：${item.track.title} · ${item.track.artist}`)}
    </View>
  </View>;
  return <SectionList testID="offline-task-list" sections={[{title:'下载任务',key:'pending',data:tasks},{title:'已完成文件',key:'completed',data:completed}]} keyExtractor={item=>item.id} renderItem={renderItem} stickySectionHeadersEnabled={false} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} contentContainerStyle={{paddingHorizontal:22,paddingBottom:32}}
    ListHeaderComponent={<View style={{gap:14,paddingVertical:12}}><Text testID="offline-task-summary" style={{color:p.secondary}}>{tasks.filter(item=>item.status==='downloading').length} 个正在下载 · {tasks.length} 个待处理 · {completed.length} 个已保存</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {button('offline-pause-all','全部暂停','pause-circle-outline',()=>perform(()=>services.offlineDownloads.pauseAll()),!pauseable)}
      {button('offline-resume-all','全部继续','play-circle-outline',()=>perform(()=>services.offlineDownloads.resumeAll()),!resumable)}
      {button('offline-cancel-all','全部取消','close-circle-outline',()=>Alert.alert('取消全部未完成下载？','未完成任务将标记为下载已取消，可稍后重试或移除记录；已保存的音频保留。',[{text:'保留',style:'cancel'},{text:'取消任务',style:'destructive',onPress:()=>perform(()=>services.offlineDownloads.cancelAll())}]),tasks.every(item=>!['queued','downloading','paused'].includes(item.status)))}
    </View>{!!message&&<Text testID="offline-operation-message" accessibilityRole="alert" style={{color:p.secondary,lineHeight:22}}>{message}</Text>}</View>}
    renderSectionHeader={({section})=><View style={{gap:10,paddingVertical:14}}><Text testID={`offline-section-${section.key}`} accessibilityRole="header" style={{color:p.secondary,fontSize:14}}>{section.title}</Text>{section.data.length===0&&<View style={{padding:28,borderRadius:22,backgroundColor:p.surface,alignItems:'center'}}><Text style={{color:p.secondary}}>{section.key==='pending'?'暂无下载任务':'暂无已下载音频'}</Text></View>}</View>}
    ListFooterComponent={completed.length>0?<View style={{marginTop:12}}>{button('offline-clear-completed','清理已保存离线文件','trash-outline',()=>Alert.alert('清理已保存离线文件？','当前正在播放的文件会保留；其他文件需要重新下载。',[{text:'保留',style:'cancel'},{text:'清理',style:'destructive',onPress:()=>perform(()=>services.offlineDownloads.clearCompleted())}]))}</View>:null}
  />;
}
