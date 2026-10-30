import {DownloadDestinationSettings} from './DownloadDestinationSettings.tsx';
import {DownloadCoverSettings} from './DownloadCoverSettings.tsx';
import {DownloadQualitySettings} from './DownloadQualitySettings.tsx';
import {downloadBasename} from '../domain/downloadNaming.ts';
import {exportOfflineAudio,OfflineExportUnavailable} from '../storage/offlineExport.ts';
import {offlineAudioExportFiles} from './OfflineAudioExport.ts';
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Alert,Pressable,SectionList,Switch,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {OfflineDownloadInUse,type OfflineDownloadRecord} from '../storage/offlineDownloads.ts';
import {BatchSelectionBar} from './BatchSelectionBar.tsx';
import {selectionAll,selectionByListOrder,selectionCount,selectionEnter,selectionHas,selectionNone,selectionToggle,type SelectionModel} from '../domain/selection.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';

export function DownloadSettings({services,openTasks}:{services:Services;openTasks:()=>void}){
  const {palette:p}=useTheme();
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const downloads=useSyncExternalStore(services.offlineDownloads.subscribe,services.offlineDownloads.getSnapshot),preview=downloads.find(item=>item.status==='completed');
  const [separator,setSeparator]=useState(preferences.downloadNameSeparator),[showQuality,setShowQuality]=useState(false);
  const stats=services.offlineDownloads.getStatistics(),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),locked=useRef(false);
  const applyConcurrency=(value:1|2|3)=>{if(locked.current)return;locked.current=true;setSaving(true);setMessage('');void services.offlineDownloads.updateConcurrency(value,()=>services.preferences.update({downloadConcurrency:value})).then(()=>setMessage(`下载并发已设为 ${value}`)).catch(()=>setMessage('下载并发未保存，请重试；已开始的任务继续结算。')).finally(()=>{locked.current=false;setSaving(false);});};
  const chooseConcurrency=(value:1|2|3)=>{if(saving||value===preferences.downloadConcurrency)return;if(value===1){applyConcurrency(value);return;}Alert.alert('提高下载并发？',`同时下载 ${value} 个任务可能增加平台限流、网络失败和设备资源占用。失败任务可稍后重试。`,[{text:'保持当前',style:'cancel'},{text:`使用 ${value} 并发`,onPress:()=>applyConcurrency(value)}]);};
  return <View style={{gap:20,paddingTop:12}}>
    <Text style={{color:p.secondary,lineHeight:22}}>在线下载可按平台设置首选音质，未单独设置时跟随播放；私人曲库按服务端返回保存。仅完整保存并通过校验的文件可离线播放。</Text>
    <View style={{borderRadius:22,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,overflow:'hidden'}}>
      <Pressable testID="download-quality-open" accessibilityRole="button" accessibilityLabel="设置各平台下载音质" accessibilityState={{expanded:showQuality}} onPress={()=>setShowQuality(value=>!value)} style={{padding:18,flexDirection:'row',alignItems:'center',gap:14}}><Ionicons name="cloud-download-outline" size={24} color={p.accent}/><View style={{flex:1,gap:5}}><Text style={{color:p.text,fontSize:17,fontWeight:'600'}}>在线下载音质</Text><Text testID="download-quality-summary" style={{color:p.secondary,fontSize:13}}>{Object.keys(preferences.downloadQualities).length?`已分别设置 ${Object.keys(preferences.downloadQualities).length} 个平台`:`跟随播放设置 · ${preferences.quality}`}</Text></View></Pressable>
      <Pressable testID="settings-open-downloadTasks" accessibilityRole="button" accessibilityLabel="查看下载任务与文件" onPress={openTasks} style={{minHeight:82,padding:18,borderTopWidth:1,borderTopColor:p.border,flexDirection:'row',alignItems:'center',gap:14}}>
        <Ionicons name="download-outline" size={24} color={p.accent}/><View style={{flex:1,gap:5}}><Text style={{color:p.text,fontSize:17,fontWeight:'600'}}>下载任务与文件</Text><Text style={{color:p.secondary,fontSize:13}}>{stats.pending} 个未完成 · {stats.files} 个已保存</Text></View><Ionicons name="chevron-forward" size={20} color={p.secondary}/>
      </Pressable>
    </View>
    {showQuality&&<DownloadQualitySettings services={services}/>}
    <View style={{gap:space.md}}><Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>同时下载任务数</Text>
      <Text testID="download-concurrency-summary" accessibilityLiveRegion="polite" style={{...typography.body,color:p.secondary}}>最多 {preferences.downloadConcurrency} 个任务{saving?' · 正在保存':''}</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{([1,2,3] as const).map(value=><Pressable key={value} testID={`download-concurrency-${value}`} accessibilityRole="radio" accessibilityLabel={`${value} 个并发${value===1?'（推荐）':''}`} accessibilityState={{selected:preferences.downloadConcurrency===value,disabled:saving}} disabled={saving} onPress={()=>chooseConcurrency(value)} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:preferences.downloadConcurrency===value?p.selected:p.surface,opacity:saving?.5:1}}><Text style={{...typography.body,color:p.accent}}>{value} 个{value===1?'（推荐）':''}</Text></Pressable>)}</View>
      <Text style={{...typography.caption,color:p.secondary}}>限制后续启动的任务；降低上限不强行中断已开始的传输。暂停、取消或完成后释放名额，等待任务按提交顺序启动；部分设备会依次下载，实际并行数量受系统限制。</Text>
    </View>
    <View style={{gap:space.md}}><Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>下载与导出附加文件</Text>
      {([['downloadAttachLyrics','歌词（LRC）'],['downloadAttachCover','封面（JPG）'],['downloadAttachMetadata','歌曲信息（meta.json）']] as const).map(([key,label])=><View key={key} style={{minHeight:controls.hit,flexDirection:'row',gap:space.md,alignItems:'center',justifyContent:'space-between'}}><Text style={{...typography.body,color:p.text,flex:1}}>{label}</Text><Switch testID={`download-attach-${key}`} accessibilityLabel={label} value={preferences[key]} onValueChange={value=>{void services.preferences.update({[key]:value}).then(()=>setMessage('附加文件选项已保存')).catch(()=>setMessage('附加文件选项未保存，请重试'));}}/></View>)}
      <Text style={{...typography.caption,color:p.secondary}}>新任务入队时固定附加选项，音频保存后单独准备；失败不影响音频，可在任务页重试或取消。旧任务不会自动补取。导出时附加文件使用相同文件名前缀。导出优先使用已保存附加文件，缺失时再获取；歌词保留时间轴，不可用时可重试或关闭该项。歌曲信息只含名称、专辑、时长和文件校验，不包含账号或请求地址。</Text>
    </View>
    <DownloadDestinationSettings services={services}/>
    <DownloadCoverSettings services={services}/>
    <View style={{gap:space.md}}><Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>音频导出命名</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{(['title-artist','artist-title'] as const).map(order=><Pressable key={order} testID={`download-name-${order}`} accessibilityRole="radio" accessibilityState={{selected:preferences.downloadNameOrder===order}} onPress={()=>{void services.preferences.update({downloadNameOrder:order}).then(()=>setMessage('命名顺序已保存')).catch(()=>setMessage('命名顺序未保存，请重试'));}} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:preferences.downloadNameOrder===order?p.selected:p.surface}}><Text style={{...typography.body,color:p.accent}}>{order==='title-artist'?'歌名在前':'歌手在前'}</Text></Pressable>)}</View>
      <Text testID="download-name-preview" style={{...typography.body,color:p.secondary}}>{preview?`文件名前缀：${downloadBasename(preview.track,preferences)}`:'下载完成后显示实际歌曲的文件名前缀'}</Text>
      <TextInput testID="download-name-separator" accessibilityLabel="文件名分隔符" value={separator} onChangeText={setSeparator} maxLength={24} autoCapitalize="none" autoCorrect={false} style={{...typography.body,color:p.text,minHeight:controls.hit,padding:space.md,borderWidth:1,borderColor:p.border,borderRadius:radius.md}}/>
      <Pressable testID="download-name-save" accessibilityRole="button" accessibilityLabel="保存文件名分隔符" onPress={()=>{void services.preferences.update({downloadNameSeparator:separator}).then(()=>setMessage('命名分隔符已保存')).catch(()=>setMessage('分隔符未保存：最多12个字符，不能含路径或文件名保留字符'));}} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:p.surface}}><Text style={{...typography.body,color:p.accent}}>保存分隔符</Text></Pressable>
      <Text style={{...typography.caption,color:p.secondary}}>在已完成文件中导出音频时使用；文件格式按实际内容识别。由系统选择保存位置，库内音频和播放队列保持不变。附加文件按上方选项准备。</Text>
    </View>
    <View style={{gap:12}}><Text accessibilityRole="header" style={{color:p.secondary,fontSize:13}}>离线文件容量上限</Text>
      <Text testID="offline-capacity-summary" style={{color:p.secondary}}>{(stats.bytes/1048576).toFixed(1)} MB / {preferences.offlineLimitMB} MB</Text>
      <View style={{borderRadius:22,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,overflow:'hidden'}}>{[512,1024,2048,4096,8192].map((limit,index)=><Pressable key={limit} testID={`offline-limit-${limit}`} accessibilityRole="radio" accessibilityState={{selected:preferences.offlineLimitMB===limit}} accessibilityLabel={`${limit} MB`} onPress={()=>{void services.preferences.update({offlineLimitMB:limit}).then(()=>setMessage('')).catch(()=>setMessage('离线容量未保存，原设置保留'));}} style={{paddingHorizontal:18,minHeight:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:index===0?0:1,borderTopColor:p.border}}><Text style={{color:p.text,fontSize:16}}>{limit} MB</Text><Ionicons name={preferences.offlineLimitMB===limit?'checkmark-circle':'ellipse-outline'} size={22} color={preferences.offlineLimitMB===limit?p.accent:p.secondary}/></Pressable>)}</View>
      <Text style={{color:p.secondary,fontSize:12,lineHeight:21}}>减少上限不会自动删除已有文件；空间不足时可在任务页清理已保存文件。临时播放缓存单独管理。</Text>
    </View>
    {!!message&&<Text accessibilityRole="alert" style={{color:p.secondary}}>{message}</Text>}
  </View>;
}

export function DownloadTasks({services,header,focusIds=[]}:{services:Services;header?:ReactNode;focusIds?:readonly string[]}){
  const {palette:p}=useTheme(),[message,setMessage]=useState(''),[exporting,setExporting]=useState(false),exportLock=useRef(false);
  const exportAbort=useRef<AbortController|null>(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;exportAbort.current?.abort();};},[]);
  const exportAudio=(id:string)=>{
    if(exportLock.current)return;exportLock.current=true;setExporting(true);setMessage('正在准备导出文件…');const abort=new AbortController();exportAbort.current=abort;
    void exportOfflineAudio(services.offlineDownloads,id,services.preferences.getSnapshot(),offlineAudioExportFiles,{...services.preferences.getSnapshot(),signal:abort.signal,prepared:(record,maximum)=>services.managedAttachments.prepared(record.fileName,maximum),lyrics:async(track,signal)=>(await services.lyrics.load(track,signal)).document,cover:(track,signal,maximum)=>services.covers.loadForExport(track,signal,maximum)})
      .then(()=>{if(alive.current)setMessage('');}).catch(error=>{if(alive.current)setMessage(abort.signal.aborted?'已取消准备导出':error instanceof OfflineExportUnavailable?error.message:'文件未导出，请检查文件或存储空间后重试');}).finally(()=>{exportLock.current=false;exportAbort.current=null;if(alive.current)setExporting(false);});
  };
  const downloads=useSyncExternalStore(services.offlineDownloads.subscribe,services.offlineDownloads.getSnapshot);
  const attachments=useSyncExternalStore(services.managedAttachments.subscribe,services.managedAttachments.getSnapshot);
  const deliveries=useSyncExternalStore(services.downloadDelivery.subscribe,services.downloadDelivery.getSnapshot);
  const destination=useSyncExternalStore(services.downloadDestination.subscribe,services.downloadDestination.getSnapshot);
  const focused=new Set(focusIds),ordered=focusIds.length?[...downloads.filter(item=>focused.has(item.id)),...downloads.filter(item=>!focused.has(item.id))]:downloads;
  const tasks=ordered.filter(item=>item.status!=='completed'),completed=ordered.filter(item=>item.status==='completed');
  // Sollin E-1300: a page-scoped multi-select over the task list offering
  // pause/continue/cancel/retry/remove-records; completed files keep their
  // own delete path and are not part of this selection.
  const [selection,setSelection]=useState<SelectionModel>(selectionNone);
  const selectedIds=new Set(selectionByListOrder(selection,tasks.map(item=>({id:item.id})),row=>row.id).map(row=>row.id));
  const runBatch=(action:'pause'|'resume'|'cancel'|'retry'|'remove')=>{
    const targets=tasks.filter(item=>selectedIds.has(item.id));
    if(!targets.length)return;
    void (async()=>{
      let ok=0;
      for(const item of targets){try{if(action==='pause')await services.offlineDownloads.pause(item.id);else if(action==='resume')await services.offlineDownloads.resume(item.id);else if(action==='cancel')await services.offlineDownloads.cancel(item.id);else if(action==='retry')await services.offlineDownloads.retry(item.id);else await services.offlineDownloads.remove(item.id);ok++;}catch{/* keep remaining targets schedulable */}}
      const labels={pause:'已暂停',resume:'已继续',cancel:'已取消',retry:'已重试',remove:'已移除'};
      setMessage(`${labels[action]} ${ok} / ${targets.length} 个任务`);
      setSelection(selectionNone);
    })();
  };
  const pauseable=tasks.some(item=>item.status==='queued'||item.status==='downloading'),resumable=tasks.some(item=>item.status==='queued'||item.status==='paused');
  const perform=(action:()=>Promise<unknown>)=>{setMessage('');void action().catch(error=>setMessage(error instanceof OfflineDownloadInUse?error.message:'操作未完成，原任务保留，可重试'));};
  const button=(id:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],action:()=>void,disabled=false,accessibilityLabel=label)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{minHeight:44,paddingHorizontal:12,paddingVertical:10,borderRadius:22,backgroundColor:p.selected,opacity:disabled?0.4:1,flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name={icon} size={18} color={p.accent}/><Text style={{color:p.accent,fontSize:13}}>{label}</Text></Pressable>;
  const confirmRemove=(item:OfflineDownloadRecord)=>Alert.alert(item.status==='completed'?'删除离线文件？':'移除下载记录？',`${item.track.title}；${item.status==='completed'?'删除后需要重新下载。':'仅移除任务记录及临时文件，不影响已保存音频。'}`,[{text:'保留',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>perform(()=>services.offlineDownloads.remove(item.id))}]);
  const renderItem=({item}:{item:OfflineDownloadRecord})=><View testID={`offline-download-${item.id}`} style={{padding:16,marginBottom:10,gap:10,borderRadius:20,backgroundColor:p.surface,borderWidth:1,borderColor:p.border}}>
    <Pressable accessibilityRole={selection.active?'button':undefined} accessibilityLabel={selection.active?`选择下载任务：${item.track.title}`:undefined} accessibilityState={selection.active?{selected:selectedIds.has(item.id)}:undefined} onLongPress={()=>setSelection(selectionEnter(item.id))} onPress={()=>{if(selection.active)setSelection(selectionToggle(selection,item.id));}} style={{flexDirection:'row',gap:12,alignItems:'center'}}>
    {selection.active&&<Ionicons name={selectedIds.has(item.id)?'checkmark-circle':'ellipse-outline'} size={22} color={selectedIds.has(item.id)?p.accent:p.secondary}/>}
    <Ionicons name={item.status==='completed'?'checkmark-circle-outline':item.status==='failed'?'alert-circle-outline':item.status==='cancelled'?'stop-circle-outline':'cloud-download-outline'} size={27} color={p.accent}/><View style={{flex:1,gap:5}}><Text numberOfLines={2} style={{color:p.text,fontSize:16,fontWeight:'600'}}>{item.track.title}</Text><Text numberOfLines={1} style={{color:p.secondary,fontSize:13}}>{item.track.artist}</Text><Text testID={`offline-status-${item.id}`} style={{color:p.secondary,fontSize:12}}>{item.status==='completed'?`${(item.bytes/1048576).toFixed(1)} MB · 已保存`:item.status==='downloading'?'正在下载…':item.status==='paused'?`已暂停 · ${((item.partialBytes??0)/1048576).toFixed(1)} MB`:item.status==='queued'?'等待下载':item.status==='cancelled'?'下载已取消':`下载失败：${item.error??'请重试'}`}</Text></View></Pressable>
    {item.preferredQuality&&<Text testID={`offline-choice-${item.id}`} style={{...typography.caption,color:p.secondary}}>本次首选 {item.preferredQuality} · 来源标记 {item.quality??'未确认'}</Text>}
    {item.status==='completed'&&item.attachmentPolicy&&(()=>{const state=attachments.find(row=>row.fileName===item.fileName)?.state??'queued';return <View style={{gap:space.sm}}><Text testID={`offline-attachments-${item.id}`} accessibilityLiveRegion="polite" style={{...typography.caption,color:p.secondary}}>附加文件 · {state==='ready'?'已保存':state==='preparing'?'正在准备':state==='queued'?'等待准备':state==='cancelled'?'已取消，音频保留':'准备失败，音频已保存'}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{(state==='failed'||state==='cancelled')&&button(`offline-attachments-retry-${item.id}`,'重试附加文件','refresh-outline',()=>perform(()=>services.managedAttachments.retry(item.fileName)))}{(state==='queued'||state==='preparing')&&button(`offline-attachments-cancel-${item.id}`,'取消附加准备','close-outline',()=>perform(()=>services.managedAttachments.cancel(item.fileName)))}</View></View>;})()}
    {item.status==='completed'&&(()=>{const delivery=deliveries.find(row=>row.fileName===item.fileName);return <View style={{gap:space.sm}}>{delivery&&<Text testID={`offline-delivery-${item.id}`} accessibilityLiveRegion="polite" style={{...typography.caption,color:p.secondary}}>{delivery.state==='saved'?`已另存 ${delivery.names?.length??1} 个文件 · ${delivery.intent.name}`:delivery.state==='copying'?'正在另存到所选目录…':delivery.state==='waiting'?'目录另存等待附加文件就绪':delivery.state==='cancelled'?'目录授权已改变，未另存；原文件保留':'目录另存失败，原文件保留'}</Text>}{delivery?.state==='saved'&&delivery.names?.[0]&&<Text testID={`offline-delivery-name-${item.id}`} numberOfLines={2} style={{...typography.caption,color:p.secondary}}>{delivery.names[0]}</Text>}{button(`offline-delivery-save-${item.id}`,delivery?.state==='saved'?'再次另存到目录':delivery?.state==='failed'?'重试目录另存':'另存到所选目录','folder-outline',()=>perform(()=>services.downloadDelivery.retry(item.id)),!destination.root||deliveries.some(row=>row.state==='copying')||destination.busy)}</View>;})()}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {item.status==='completed'&&button(`offline-export-${item.id}`,'导出音频文件','share-outline',()=>exportAudio(item.id),exporting,`导出音频文件：${item.track.title} · ${item.track.artist}`)}
      {item.status==='completed'&&button(`offline-play-${item.id}`,'播放离线文件','play-outline',()=>services.playTracks([item.track],0))}
      {item.status==='queued'&&button(`offline-start-${item.id}`,'开始下载','play-outline',()=>perform(()=>services.offlineDownloads.start(item.id)))}
      {(item.status==='failed'||item.status==='cancelled')&&button(`offline-retry-${item.id}`,'重试下载','refresh-outline',()=>perform(()=>services.offlineDownloads.retry(item.id)))}
      {item.status==='paused'&&button(`offline-resume-${item.id}`,'继续下载','play-outline',()=>perform(()=>services.offlineDownloads.resume(item.id)))}
      {(item.status==='downloading'||item.status==='queued')&&button(`offline-pause-${item.id}`,'暂停下载','pause-outline',()=>perform(()=>services.offlineDownloads.pause(item.id)))}
      {item.status==='queued'||item.status==='downloading'||item.status==='paused'?button(`offline-cancel-${item.id}`,'取消下载','close-circle-outline',()=>perform(()=>services.offlineDownloads.cancel(item.id)),false,`取消下载：${item.track.title} · ${item.track.artist}`):null}
      {!selection.active&&button(`offline-remove-${item.id}`,item.status==='completed'?'删除离线文件':'移除记录','trash-outline',()=>confirmRemove(item),false,`${item.status==='completed'?'删除离线文件':'移除记录'}：${item.track.title} · ${item.track.artist}`)}
    </View>
  </View>;
  return <SectionList testID="offline-task-list" sections={[{title:'下载任务',key:'pending',data:tasks},{title:'已完成文件',key:'completed',data:completed}]} keyExtractor={item=>item.id} renderItem={renderItem} stickySectionHeadersEnabled={false} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} contentContainerStyle={{paddingHorizontal:22,paddingBottom:32}}
    ListHeaderComponent={<View style={{gap:14,paddingVertical:12}}>{header}
      {selection.active&&<BatchSelectionBar testPrefix="offline-batch" unit="个任务" count={selectedIds.size} total={tasks.length}
        allSelected={tasks.length>0&&selectedIds.size===tasks.length}
        actions={['dl-pause','dl-resume','dl-cancel','dl-retry','dl-remove']}
        onSelectAll={()=>setSelection(selectionAll(selection,tasks.map(item=>item.id)))}
        onCancel={()=>setSelection(selectionNone)}
        onAction={action=>runBatch(action==='dl-pause'?'pause':action==='dl-resume'?'resume':action==='dl-cancel'?'cancel':action==='dl-retry'?'retry':'remove')}/>}<Text testID="offline-task-summary" style={{color:p.secondary}}>{tasks.length} 个未完成（其中 {tasks.filter(item=>item.status==='downloading').length} 个下载中）· {completed.length} 个已保存</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {button('offline-pause-all','全部暂停','pause-circle-outline',()=>perform(()=>services.offlineDownloads.pauseAll()),!pauseable)}
      {button('offline-resume-all','全部继续','play-circle-outline',()=>perform(()=>services.offlineDownloads.resumeAll()),!resumable)}
      {button('offline-cancel-all','全部取消','close-circle-outline',()=>Alert.alert('取消全部未完成下载？','未完成任务将标记为下载已取消，可稍后重试或移除记录；已保存的音频保留。',[{text:'保留',style:'cancel'},{text:'取消任务',style:'destructive',onPress:()=>perform(()=>services.offlineDownloads.cancelAll())}]),tasks.every(item=>!['queued','downloading','paused'].includes(item.status)))}
    </View>{exporting&&button('offline-export-abort','取消准备导出','close-outline',()=>exportAbort.current?.abort())}{!!message&&<Text testID="offline-operation-message" accessibilityRole="alert" style={{color:p.secondary,lineHeight:22}}>{message}</Text>}</View>}
    renderSectionHeader={({section})=><View style={{gap:10,paddingVertical:14}}><Text testID={`offline-section-${section.key}`} accessibilityRole="header" style={{color:p.secondary,fontSize:14}}>{section.title}</Text>{section.data.length===0&&<View style={{padding:28,borderRadius:22,backgroundColor:p.surface,alignItems:'center'}}><Text style={{color:p.secondary}}>{section.key==='pending'?'暂无下载任务':'暂无已下载音频'}</Text></View>}</View>}
    ListFooterComponent={completed.length>0?<View style={{marginTop:12}}>{button('offline-clear-completed','清理已保存离线文件','trash-outline',()=>Alert.alert('清理已保存离线文件？','当前正在播放的文件会保留；其他文件需要重新下载。',[{text:'保留',style:'cancel'},{text:'清理',style:'destructive',onPress:()=>perform(()=>services.offlineDownloads.clearCompleted())}]))}</View>:null}
  />;
}
