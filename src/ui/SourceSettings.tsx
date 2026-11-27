import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,Switch,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import type {SourceCatalog,SourceView} from '../providers/sourceCatalog.ts';
import type {SourceHealth} from '../providers/sourceHealth.ts';
import {SourceHealthModal} from './SourceHealthModal.tsx';
import {SheetModal} from './AdaptiveModal.tsx';
import {fetchSourceScript,probeSourceUpdateAlert} from '../providers/nativeLX.ts';

class SourceInputError extends Error {}

async function downloadScript(url:string){
  let parsed:URL;
  try{parsed=new URL(url.trim());}catch{throw new SourceInputError('请输入完整的 HTTP(S) 音源地址');}
  if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname)throw new SourceInputError('请输入完整的 HTTP(S) 音源地址');
  return fetchSourceScript(parsed.toString());
}

type ActionModalMode='menu'|'alias'|'manualUpdate'|'updateDetail';

export function SourceSettings({catalog,health}:{catalog:SourceCatalog;health:SourceHealth}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),styles=useThemedStyles(makeStyles);
  const sources=useSyncExternalStore(catalog.subscribe,catalog.getSnapshot);
  const checkingAllUpdates=catalog.isCheckingUpdates();

  const [selected,setSelected]=useState<readonly string[]>([]);
  const [batchMode,setBatchMode]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [importOpen,setImportOpen]=useState(false),[importUrl,setImportUrl]=useState('');
  const [healthIds,setHealthIds]=useState<readonly string[]|null>(null);

  const [actionSourceId,setActionSourceId]=useState<string|null>(null);
  const [actionMode,setActionMode]=useState<ActionModalMode>('menu');
  const [aliasDraft,setAliasDraft]=useState('');
  const [updateUrlDraft,setUpdateUrlDraft]=useState('');
  const [actionBusy,setActionBusy]=useState(false);
  const [actionMessage,setActionMessage]=useState('');

  const actionSource:SourceView|undefined=actionSourceId?sources.find(item=>item.id===actionSourceId):undefined;
  const readyCount=sources.filter(item=>item.status==='ready').length;
  const updateSources=sources.filter(item=>item.hasUpdate);
  const visibleUpdateCount=sources.filter(item=>item.hasUpdate&&item.allowUpdateAlert).length;

  async function perform(work:()=>Promise<void>){
    setBusy(true);setMessage('');
    try{await work();}
    catch(error){setMessage(error instanceof SourceInputError?error.message:'操作失败，请检查文件、地址或网络后重试；已有数据已保留。');}
    finally{setBusy(false);}
  }

  function batch(action:'enable'|'disable'|'delete',ids=selected){
    void perform(async()=>{
      const result=await catalog.batch(ids,action);
      setSelected(current=>current.filter(id=>!result.succeeded.includes(id)));
      if(ids.length>1){
        setMessage(`完成 ${result.succeeded.length} 项${result.failed.length?`，失败 ${result.failed.length} 项已保留勾选`:''}`);
      }
    });
  }

  async function importFiles(){
    const result=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:true,copyToCacheDirectory:true});
    if(result.canceled)return;
    const batchEntries:{script:string;filename:string}[]=[];
    let preFailed=0;
    for(const asset of result.assets){
      const file=new File(asset.uri);
      try{
        if(!/\.js$/i.test(asset.name)||file.size>8*1024*1024){preFailed++;continue;}
        batchEntries.push({script:await file.text(),filename:asset.name});
      }catch{preFailed++;}
      finally{if(file.exists)file.delete();}
    }
    const imported=batchEntries.length?await catalog.importMany(batchEntries):{added:0,duplicates:0,failed:0};
    setImportOpen(false);
    setMessage(`导入 ${imported.added} 个 · 已存在 ${imported.duplicates} 个 · 失败 ${preFailed+imported.failed} 个。新音源默认停用，点击可启用。`);
  }

  function openMenu(source:SourceView,mode:ActionModalMode='menu'){
    setActionSourceId(source.id);
    setActionMode(mode);
    setAliasDraft(source.alias??'');
    const prefill=source.subscriptionUrl
      ??(source.updateInfo?.updateUrl&&/\.js(?:$|\?)/i.test(source.updateInfo.updateUrl)?source.updateInfo.updateUrl:'');
    setUpdateUrlDraft(prefill);
    setActionMessage('');
  }

  function closeMenu(){
    if(actionBusy)return;
    setActionSourceId(null);
    setActionMode('menu');
    setActionMessage('');
  }

  async function runSingleCheckUpdate(source:SourceView){
    setActionBusy(true);setActionMessage('');
    try{
      const res=await catalog.checkUpdate(source.id,{
        probeAlert:probeSourceUpdateAlert,
        fetchScript:fetchSourceScript,
      });
      if(res.hasUpdate){
        setActionMode('updateDetail');
        setActionMessage('检测到新版本更新信息');
      }else{
        setActionMessage('未检测到更新，当前脚本已是最新或未提供更新通知');
      }
    }catch{
      setActionMessage('检查更新未完成，请检查网络后重试');
    }finally{
      setActionBusy(false);
    }
  }

  async function runManualUpdate(source:SourceView,targetUrl:string){
    setActionBusy(true);setActionMessage('');
    const wasEnabled=source.enabled;
    try{
      const script=await downloadScript(targetUrl);
      const changed=await catalog.update(source.id,script,targetUrl.trim());
      if(!changed){
        setActionMessage('远端脚本内容与当前一致，已同步订阅地址');
        return;
      }
      if(wasEnabled){
        const reEnabled=await catalog.batch([source.id],'enable');
        setActionMessage(reEnabled.succeeded.includes(source.id)
          ?'音源已更新并重新启用（如异常可在更多中恢复上一版本）'
          :'音源已更新，但初始化未通过，请重试或恢复上一版本');
      }else{
        setActionMessage('音源已更新（如需使用请点击启用；可恢复上一版本）');
      }
      setActionMode('menu');
    }catch(error){
      setActionMessage(error instanceof SourceInputError?error.message:'拉取更新脚本失败，请检查地址或网络后重试');
    }finally{
      setActionBusy(false);
    }
  }

  function openSingleHealth(source:SourceView){
    closeMenu();
    if(!source.enabled){
      Alert.alert('启用并检测此音源？',`「${source.displayName}」当前未启用，需要先启用初始化后再检测平台音质可用性。`,[
        {text:'取消',style:'cancel'},
        {text:'启用并检测',onPress:()=>{
          void perform(async()=>{
            const res=await catalog.batch([source.id],'enable');
            if(res.succeeded.includes(source.id))setHealthIds([source.id]);
            else setMessage(`「${source.displayName}」初始化未通过，请稍后重试`);
          });
        }},
      ]);
      return;
    }
    setHealthIds([source.id]);
  }

  function confirmDelete(source:SourceView){
    Alert.alert(`删除「${source.displayName}」？`,'仅删除该音源脚本配置，收藏与歌单不受影响。',[
      {text:'取消',style:'cancel'},
      {text:'删除',style:'destructive',onPress:()=>{
        if(actionSourceId===source.id)setActionSourceId(null);
        batch('delete',[source.id]);
      }},
    ]);
  }

  const updateAlertColor='#E53935';
  const updateBadgeBg=s.dark?'rgba(229,57,53,0.20)':'rgba(229,57,53,0.11)';

  return <View style={{gap:12}}>
    {/* Top header matching Sollin LX source management bar */}
    <View style={styles.headerRow}>
      <View style={{flex:1,minWidth:0,gap:3}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Text accessibilityRole="header" style={styles.heading}>LX 音源管理</Text>
          {visibleUpdateCount>0&&<Pressable testID="sources-update-summary-badge" accessibilityRole="button" accessibilityLabel={`有 ${visibleUpdateCount} 个音源发现更新`} onPress={()=>{
            const first=sources.find(item=>item.hasUpdate&&item.allowUpdateAlert)??updateSources[0];
            if(first)openMenu(first,'updateDetail');
          }} style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:999,backgroundColor:updateBadgeBg}}>
            <View style={{width:6,height:6,borderRadius:3,backgroundColor:updateAlertColor}}/>
            <Text style={{color:updateAlertColor,fontSize:11,fontWeight:'700'}}>{visibleUpdateCount} 个有更新</Text>
          </Pressable>}
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          {checkingAllUpdates&&<ActivityIndicator size="small" color={s.accent}/>}
          <Text style={styles.caption}>{checkingAllUpdates?'正在后台检查音源更新…':`${readyCount} / ${sources.length} 已启用 · 点击行可切换启用状态`}</Text>
        </View>
      </View>

      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
        <Pressable testID="sources-batch-health" accessibilityRole="button" accessibilityLabel="音源健康批测" disabled={busy||!sources.length} onPress={()=>setHealthIds(selected.length?selected:sources.filter(item=>item.enabled).map(item=>item.id))} style={[styles.ghostBtn,(busy||!sources.length)&&styles.disabled]}>
          <Text style={styles.ghostBtnText}>批量检测</Text>
        </Pressable>
        <Pressable testID="sources-open-import" accessibilityRole="button" accessibilityLabel="导入 LX 音源" disabled={busy} onPress={()=>{setMessage('');setImportOpen(true);}} style={[styles.primaryPill,busy&&styles.disabled]}>
          <Ionicons name="add" size={16} color="#FFFFFF"/>
          <Text style={styles.primaryPillText}>导入</Text>
        </Pressable>
      </View>
    </View>

    {/* Subtle sub-toolbar: check all updates & optional batch selection toggle */}
    {!!sources.length&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:4,gap:8}}>
      <Pressable testID="sources-check-all-updates" accessibilityRole="button" accessibilityLabel="检查全部音源更新" disabled={busy||checkingAllUpdates} onPress={()=>{
        void perform(async()=>{
          const res=await catalog.checkAllUpdates({probeAlert:probeSourceUpdateAlert,fetchScript:fetchSourceScript});
          setMessage(res.updatedIds.length?`已检查 ${res.checked} 个音源，发现 ${res.updatedIds.length} 个有更新`:`已检查 ${res.checked} 个音源，暂未发现新版本`);
        });
      }} style={{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:4,opacity:busy||checkingAllUpdates?.5:1}}>
        <Ionicons name="refresh-outline" size={14} color={s.muted}/>
        <Text style={{color:s.muted,fontSize:12,fontWeight:'600'}}>检查全部更新</Text>
      </Pressable>
      <Pressable testID="sources-batch-toggle" accessibilityRole="button" accessibilityLabel={batchMode?'完成批量管理':'批量管理'} onPress={()=>{setBatchMode(v=>!v);setSelected([]);}} style={{paddingVertical:4}}>
        <Text style={{color:batchMode?s.accent:s.muted,fontSize:12,fontWeight:'600'}}>{batchMode?'完成批量':'批量管理'}</Text>
      </Pressable>
    </View>}

    {batchMode&&!!sources.length&&<View style={styles.batchBar}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setSelected(selected.length===sources.length?[]:sources.map(item=>item.id))} style={[styles.compactChip,busy&&styles.disabled]}><Text style={styles.compactChipText}>{selected.length===sources.length?'取消全选':'全选'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy||!selected.length} onPress={()=>batch('enable')} style={[styles.compactChip,(busy||!selected.length)&&styles.disabled]}><Text style={styles.compactChipText}>启用 ({selected.length})</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy||!selected.length} onPress={()=>batch('disable')} style={[styles.compactChip,(busy||!selected.length)&&styles.disabled]}><Text style={styles.compactChipText}>停用</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy||!selected.length} onPress={()=>Alert.alert('删除所选音源？','仅删除音源配置，歌曲和歌单保留。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>batch('delete')}])} style={[styles.compactChip,{backgroundColor:updateBadgeBg,borderColor:'transparent'},(busy||!selected.length)&&styles.disabled]}><Text style={[styles.compactChipText,{color:updateAlertColor}]}>删除</Text></Pressable>
    </View>}

    {/* Compact Sollin-style source list */}
    {sources.length===0?<View style={[styles.emptyCard,s.cardShadow]}>
      <Ionicons name="document-text-outline" size={32} color={s.subtle}/>
      <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>还没有导入 LX 音源</Text>
      <Text style={[styles.caption,{textAlign:'center'}]}>点击右上角「+ 导入」添加本地 JS 脚本或网络订阅地址，多个音源可协同解析。</Text>
    </View>:<View style={[styles.listCard,s.cardShadow]}>
      {sources.map((source,index)=>{
        const checked=selected.includes(source.id);
        const ready=source.status==='ready';
        const initializing=source.status==='initializing';
        const failed=source.status==='failed';
        const showUpdate=source.hasUpdate;
        const metaLine=[source.version,source.author].filter(Boolean).join(' · ')||(source.alias?source.name:'未提供版本信息');

        return <View key={source.id}>
          {index>0&&<View accessible={false} style={styles.rowDivider}/>}
          <View testID={`source-row-${source.id}`} style={styles.sourceRow}>
            <Pressable
              accessibilityRole={batchMode?'checkbox':'button'}
              accessibilityLabel={batchMode?`选择音源：${source.displayName}`:`${source.enabled?'停用':'启用'}音源：${source.displayName}`}
              accessibilityState={batchMode?{checked,disabled:busy}:{selected:source.enabled,disabled:busy}}
              disabled={busy}
              onPress={()=>{
                if(batchMode){
                  setSelected(current=>current.includes(source.id)?current.filter(id=>id!==source.id):[...current,source.id]);
                }else{
                  batch(source.enabled?'disable':'enable',[source.id]);
                }
              }}
              style={styles.sourceMain}
            >
              <View style={{width:28,height:28,alignItems:'center',justifyContent:'center'}}>
                <Ionicons
                  name={batchMode?(checked?'checkbox':'square-outline'):'document-text-outline'}
                  size={21}
                  color={batchMode?(checked?s.accent:s.subtle):(source.enabled?s.accent:s.muted)}
                />
                {showUpdate&&<View testID={`source-update-dot-${source.id}`} style={{position:'absolute',top:1,right:1,width:8,height:8,borderRadius:4,backgroundColor:updateAlertColor,borderWidth:1.5,borderColor:s.card}}/>}
              </View>

              <View style={{flex:1,minWidth:0,gap:2}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <Text numberOfLines={1} style={[styles.name,source.enabled&&{color:s.ink}]}>{source.displayName}</Text>
                  {showUpdate&&<Pressable testID={`source-update-pill-${source.id}`} accessibilityRole="button" accessibilityLabel={`查看 ${source.displayName} 更新说明`} onPress={()=>openMenu(source,'updateDetail')} style={{flexDirection:'row',alignItems:'center',gap:2,paddingHorizontal:6,paddingVertical:1.5,borderRadius:999,backgroundColor:updateBadgeBg}}>
                    <Ionicons name="arrow-up-circle" size={11} color={updateAlertColor}/>
                    <Text style={{color:updateAlertColor,fontSize:10,fontWeight:'700'}}>更新</Text>
                  </Pressable>}
                </View>
                <Text numberOfLines={1} style={styles.metaText}>{failed?'初始化失败 · 点按重试':metaLine}</Text>
              </View>
            </Pressable>

            <View style={styles.rowActions}>
              {initializing?<ActivityIndicator size="small" color={s.accent} style={{width:28}}/>
                :ready?<Pressable testID={`source-toggle-${source.id}`} accessibilityRole="button" accessibilityLabel={`停用音源：${source.displayName}`} disabled={busy} onPress={()=>batch('disable',[source.id])} style={styles.iconBtn}>
                  <Ionicons name="checkmark" size={20} color={s.accent}/>
                </Pressable>
                :failed?<Pressable testID={`source-toggle-${source.id}`} accessibilityRole="button" accessibilityLabel={`重试音源：${source.displayName}`} disabled={busy} onPress={()=>batch('enable',[source.id])} style={styles.iconBtn}>
                  <Ionicons name="alert-circle-outline" size={19} color={updateAlertColor}/>
                </Pressable>
                :<View testID={`source-toggle-${source.id}`} style={{width:6}}/>}

              <Pressable testID={`source-more-${source.id}`} accessibilityRole="button" accessibilityLabel={`更多操作：${source.displayName}`} disabled={busy} onPress={()=>openMenu(source,'menu')} style={styles.iconBtn}>
                <Ionicons name="ellipsis-horizontal-circle-outline" size={21} color={s.muted}/>
              </Pressable>

              <Pressable testID={`source-delete-${source.id}`} accessibilityRole="button" accessibilityLabel={`删除音源：${source.displayName}`} disabled={busy} onPress={()=>confirmDelete(source)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={19} color={s.muted}/>
              </Pressable>

              <View style={styles.orderStack}>
                <Pressable accessibilityRole="button" accessibilityLabel={`上移优先级：${source.displayName}`} disabled={busy||index===0} onPress={()=>{void perform(()=>catalog.move(source.id,-1));}} style={[styles.orderBtn,(busy||index===0)&&{opacity:0.24}]}>
                  <Ionicons name="chevron-up" size={14} color={s.muted}/>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`下移优先级：${source.displayName}`} disabled={busy||index===sources.length-1} onPress={()=>{void perform(()=>catalog.move(source.id,1));}} style={[styles.orderBtn,(busy||index===sources.length-1)&&{opacity:0.24}]}>
                  <Ionicons name="chevron-down" size={14} color={s.muted}/>
                </Pressable>
              </View>
            </View>
          </View>
        </View>;
      })}
    </View>}

    {!!message&&<Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    {busy&&<Text accessibilityLiveRegion="polite" style={styles.caption}>正在处理，其他音源会继续工作…</Text>}

    {/* Import Modal (+ 导入) */}
    <SheetModal allowSwipeDismissal visible={importOpen} animationType="slide" onRequestClose={()=>{if(!busy)setImportOpen(false);}}>
      <SafeAreaView style={{flex:1,backgroundColor:s.sheetGradient[0]}} edges={['bottom']}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.subtle+'66',marginTop:10,marginBottom:4}}/>
        <View style={styles.sheetHeader}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>导入 LX 音源</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭导入面板" disabled={busy} onPress={()=>setImportOpen(false)} style={styles.sheetCloseBtn}>
            <Ionicons name="close" size={20} color={s.ink}/>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:20,paddingBottom:36,gap:14}} showsVerticalScrollIndicator={false}>
          <View style={[styles.sheetCard,s.cardShadow]}>
            <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>从本地文件导入</Text>
            <Text style={styles.caption}>支持一次多选多个 `.js` 音源脚本文件（单文件最大 8 MiB），导入后默认停用。</Text>
            <Pressable testID="sources-import-local" accessibilityRole="button" accessibilityLabel="导入本地 JS（可多选）" disabled={busy} onPress={()=>{void perform(importFiles);}} style={[styles.fullPrimaryBtn,busy&&styles.disabled]}>
              <Ionicons name="folder-open-outline" size={17} color="#FFFFFF"/>
              <Text style={{color:'#FFFFFF',fontSize:14.5,fontWeight:'700'}}>选择本地 JS 文件（可多选）</Text>
            </Pressable>
          </View>

          <View style={[styles.sheetCard,s.cardShadow]}>
            <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>从网络地址 / 订阅导入</Text>
            <Text style={styles.caption}>输入 HTTP(S) 脚本直链，导入后将记录订阅地址，支持启动自动检查更新与一键升级。</Text>
            <TextInput testID="sources-import-url-input" accessibilityLabel="音源订阅地址" placeholder="https://example.com/source.js" placeholderTextColor={s.subtle} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="url" textContentType="URL" value={importUrl} onChangeText={setImportUrl} editable={!busy} style={styles.input}/>
            <Pressable testID="sources-import-url-submit" accessibilityRole="button" accessibilityLabel="从地址导入" disabled={busy||!importUrl.trim()} onPress={()=>{
              void perform(async()=>{
                const cleanUrl=importUrl.trim();
                const result=await catalog.import(await downloadScript(cleanUrl),'网络音源',cleanUrl);
                setImportUrl('');
                setImportOpen(false);
                setMessage(result.duplicate?'此音源已存在':'已导入网络音源，点击该行即可启用');
              });
            }} style={[styles.fullSecondaryBtn,(busy||!importUrl.trim())&&styles.disabled]}>
              {busy?<ActivityIndicator size="small" color={s.control}/>:<Ionicons name="cloud-download-outline" size={17} color={s.control}/>}
              <Text style={{color:s.ink,fontSize:14,fontWeight:'700'}}>下载并导入</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SheetModal>

    {/* Sollin-style More Action Sheet (5 capabilities + rollback + update detail) */}
    <SheetModal allowSwipeDismissal visible={!!actionSource} animationType="slide" onRequestClose={closeMenu}>
      <SafeAreaView style={{flex:1,backgroundColor:s.sheetGradient[0]}} edges={['bottom']}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.subtle+'66',marginTop:10,marginBottom:4}}/>
        {actionSource&&<>
          <View style={styles.sheetHeader}>
            {actionMode!=='menu'?<Pressable accessibilityRole="button" accessibilityLabel="返回音源操作菜单" disabled={actionBusy} onPress={()=>{setActionMode('menu');setActionMessage('');}} style={styles.sheetCloseBtn}>
              <Ionicons name="chevron-back" size={22} color={s.ink}/>
            </Pressable>:<View style={{width:36}}/>}
            <View style={{flex:1,alignItems:'center'}}>
              <Text numberOfLines={1} style={{color:s.ink,fontSize:16.5,fontWeight:'700'}}>{actionSource.displayName}</Text>
              <Text numberOfLines={1} style={{color:s.muted,fontSize:11.5}}>{[actionSource.version,actionSource.author].filter(Boolean).join(' · ')||actionSource.name}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭更多操作" disabled={actionBusy} onPress={closeMenu} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={20} color={s.ink}/>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:20,paddingBottom:36,gap:12}} showsVerticalScrollIndicator={false}>
            {actionMode==='menu'&&<>
              {actionSource.updateInfo&&<Pressable onPress={()=>setActionMode('updateDetail')} style={{padding:13,borderRadius:16,backgroundColor:updateBadgeBg,borderWidth:1,borderColor:updateAlertColor+'33',flexDirection:'row',alignItems:'center',gap:10}}>
                <Ionicons name="arrow-up-circle" size={20} color={updateAlertColor}/>
                <View style={{flex:1,gap:2}}>
                  <Text style={{color:updateAlertColor,fontSize:13.5,fontWeight:'700'}}>发现音源新版本</Text>
                  <Text numberOfLines={2} style={{color:s.ink,fontSize:12,lineHeight:17}}>{actionSource.updateInfo.log}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={updateAlertColor}/>
              </Pressable>}

              <View style={[styles.menuCard,s.cardShadow]}>
                {/* 1. 音源别名 */}
                <Pressable testID="source-action-alias" accessibilityRole="button" accessibilityLabel="音源别名" disabled={actionBusy} onPress={()=>{setAliasDraft(actionSource.alias??'');setActionMessage('');setActionMode('alias');}} style={styles.menuRow}>
                  <View style={styles.menuIconWrap}><Ionicons name="pencil-outline" size={19} color={s.ink}/></View>
                  <View style={{flex:1,minWidth:0,gap:2}}>
                    <Text style={styles.menuTitle}>音源别名</Text>
                    <Text numberOfLines={1} style={styles.menuSub}>{actionSource.alias?`已设置：${actionSource.alias}（原名：${actionSource.name}）`:'未设置 · 当前使用脚本原名'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
                </Pressable>
                <View style={styles.menuDivider}/>

                {/* 2. 检查更新 */}
                <Pressable testID="source-action-check-update" accessibilityRole="button" accessibilityLabel="检查更新" disabled={actionBusy} onPress={()=>{void runSingleCheckUpdate(actionSource);}} style={styles.menuRow}>
                  <View style={styles.menuIconWrap}>{actionBusy?<ActivityIndicator size="small" color={s.accent}/>:<Ionicons name="sync-outline" size={19} color={s.ink}/>}</View>
                  <View style={{flex:1,minWidth:0,gap:2}}>
                    <Text style={styles.menuTitle}>检查更新</Text>
                    <Text numberOfLines={1} style={styles.menuSub}>{actionSource.hasSubscription?'运行脚本捕获 updateAlert 并比对订阅地址':'运行脚本并捕获 updateAlert'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
                </Pressable>
                <View style={styles.menuDivider}/>

                {/* 3. 一键/手动更新 */}
                <Pressable testID="source-action-manual-update" accessibilityRole="button" accessibilityLabel="一键或手动更新" disabled={actionBusy} onPress={()=>{setActionMessage('');setActionMode('manualUpdate');}} style={styles.menuRow}>
                  <View style={styles.menuIconWrap}><Ionicons name="cloud-download-outline" size={19} color={s.ink}/></View>
                  <View style={{flex:1,minWidth:0,gap:2}}>
                    <Text style={styles.menuTitle}>一键/手动更新</Text>
                    <Text numberOfLines={1} style={styles.menuSub}>{actionSource.subscriptionUrl?'已记录订阅 URL · 点击一键或换链更新':'输入脚本 URL 更新'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
                </Pressable>
                <View style={styles.menuDivider}/>

                {/* 4. 可用性检查 */}
                <Pressable testID="source-action-health" accessibilityRole="button" accessibilityLabel="可用性检查" disabled={actionBusy} onPress={()=>openSingleHealth(actionSource)} style={styles.menuRow}>
                  <View style={styles.menuIconWrap}><Ionicons name="pulse-outline" size={19} color={s.ink}/></View>
                  <View style={{flex:1,minWidth:0,gap:2}}>
                    <Text style={styles.menuTitle}>可用性检查</Text>
                    <Text numberOfLines={1} style={styles.menuSub}>检测所选平台音质并查看文件大小</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
                </Pressable>
                <View style={styles.menuDivider}/>

                {/* 5. 已允许更新弹窗 */}
                <View style={styles.menuRow}>
                  <View style={styles.menuIconWrap}><Ionicons name={actionSource.allowUpdateAlert?'notifications-outline':'notifications-off-outline'} size={19} color={s.ink}/></View>
                  <View style={{flex:1,minWidth:0,gap:2}}>
                    <Text style={styles.menuTitle}>{actionSource.allowUpdateAlert?'已允许更新弹窗':'已关闭更新弹窗'}</Text>
                    <Text numberOfLines={1} style={styles.menuSub}>脚本触发 updateAlert 时是否提醒</Text>
                  </View>
                  <Switch testID="source-action-allow-update-alert" accessibilityLabel="脚本触发更新提示开关" value={actionSource.allowUpdateAlert} disabled={actionBusy} onValueChange={next=>{void catalog.setAllowUpdateAlert(actionSource.id,next);}} trackColor={s.switchTrack} thumbColor={s.switchThumb(actionSource.allowUpdateAlert)}/>
                </View>

                {actionSource.canRollback&&<>
                  <View style={styles.menuDivider}/>
                  <Pressable testID="source-action-rollback" accessibilityRole="button" accessibilityLabel="恢复上一版本" disabled={actionBusy} onPress={()=>{
                    setActionBusy(true);setActionMessage('');
                    void catalog.rollback(actionSource.id).then(()=>{
                      setActionMessage('已恢复上一版本脚本，请重新启用');
                    }).catch(()=>{
                      setActionMessage('恢复旧版本失败，请重试');
                    }).finally(()=>setActionBusy(false));
                  }} style={styles.menuRow}>
                    <View style={styles.menuIconWrap}><Ionicons name="arrow-undo-outline" size={19} color={s.ink}/></View>
                    <View style={{flex:1,minWidth:0,gap:2}}>
                      <Text style={styles.menuTitle}>恢复上一版本</Text>
                      <Text numberOfLines={1} style={styles.menuSub}>回退到最近一次更新前的脚本内容</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
                  </Pressable>
                </>}
              </View>
            </>}

            {actionMode==='alias'&&<View style={[styles.sheetCard,s.cardShadow]}>
              <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>设置音源别名</Text>
              <Text style={styles.caption}>脚本原名：{actionSource.name}。留空保存可恢复使用脚本原名。</Text>
              <TextInput testID="source-alias-input" accessibilityLabel="音源别名输入框" placeholder="输入自定义显示名称" placeholderTextColor={s.subtle} maxLength={64} value={aliasDraft} onChangeText={setAliasDraft} editable={!actionBusy} style={styles.input}/>
              <View style={{flexDirection:'row',gap:8}}>
                <Pressable testID="source-alias-save" accessibilityRole="button" disabled={actionBusy} onPress={()=>{
                  setActionBusy(true);setActionMessage('');
                  void catalog.setAlias(actionSource.id,aliasDraft).then(()=>{
                    setActionMode('menu');
                    setActionMessage(aliasDraft.trim()?'音源别名已保存':'已恢复脚本原名');
                  }).catch(()=>setActionMessage('保存别名失败，请重试')).finally(()=>setActionBusy(false));
                }} style={[styles.fullPrimaryBtn,{flex:1},actionBusy&&styles.disabled]}>
                  <Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'700'}}>保存别名</Text>
                </Pressable>
                {!!actionSource.alias&&<Pressable accessibilityRole="button" disabled={actionBusy} onPress={()=>{
                  setActionBusy(true);
                  void catalog.setAlias(actionSource.id,'').then(()=>{
                    setAliasDraft('');setActionMode('menu');setActionMessage('已恢复脚本原名');
                  }).finally(()=>setActionBusy(false));
                }} style={[styles.fullSecondaryBtn,{paddingHorizontal:16},actionBusy&&styles.disabled]}>
                  <Text style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>恢复原名</Text>
                </Pressable>}
              </View>
            </View>}

            {actionMode==='manualUpdate'&&<View style={[styles.sheetCard,s.cardShadow]}>
              <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>一键 / 手动更新脚本</Text>
              <Text style={styles.caption}>输入该音源最新 JS 脚本的 HTTP(S) 直链，更新前将自动保留旧版本供回退。</Text>
              <TextInput testID="source-update-url-input" accessibilityLabel="更新脚本 URL" placeholder="https://example.com/latest-source.js" placeholderTextColor={s.subtle} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="url" textContentType="URL" value={updateUrlDraft} onChangeText={setUpdateUrlDraft} editable={!actionBusy} style={styles.input}/>
              <Pressable testID="source-update-url-submit" accessibilityRole="button" disabled={actionBusy||!updateUrlDraft.trim()} onPress={()=>{void runManualUpdate(actionSource,updateUrlDraft);}} style={[styles.fullPrimaryBtn,(actionBusy||!updateUrlDraft.trim())&&styles.disabled]}>
                {actionBusy?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="cloud-download-outline" size={17} color="#FFFFFF"/>}
                <Text style={{color:'#FFFFFF',fontSize:14.5,fontWeight:'700'}}>{actionBusy?'正在拉取更新…':'立即拉取并更新'}</Text>
              </Pressable>
              {actionSource.updateInfo?.updateUrl&&<Pressable accessibilityRole="button" onPress={()=>{void Linking.openURL(actionSource.updateInfo!.updateUrl!).catch(()=>{});}} style={styles.fullSecondaryBtn}>
                <Ionicons name="open-outline" size={16} color={s.control}/>
                <Text style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>在浏览器打开作者更新页</Text>
              </Pressable>}
            </View>}

            {actionMode==='updateDetail'&&actionSource.updateInfo&&<View style={[styles.sheetCard,s.cardShadow]}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <Ionicons name="arrow-up-circle" size={22} color={updateAlertColor}/>
                <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>音源更新说明</Text>
              </View>
              <Text style={{color:s.ink,fontSize:13.5,lineHeight:21}}>{actionSource.updateInfo.log}</Text>
              {actionSource.updateInfo.updateUrl&&<Text selectable style={{color:s.muted,fontSize:12,lineHeight:18}}>{actionSource.updateInfo.updateUrl}</Text>}
              <View style={{gap:8,paddingTop:4}}>
                {actionSource.subscriptionUrl&&<Pressable accessibilityRole="button" disabled={actionBusy} onPress={()=>{void runManualUpdate(actionSource,actionSource.subscriptionUrl!);}} style={[styles.fullPrimaryBtn,actionBusy&&styles.disabled]}>
                  {actionBusy?<ActivityIndicator size="small" color="#FFFFFF"/>:<Ionicons name="cloud-download-outline" size={17} color="#FFFFFF"/>}
                  <Text style={{color:'#FFFFFF',fontSize:14.5,fontWeight:'700'}}>一键拉取订阅更新</Text>
                </Pressable>}
                {actionSource.updateInfo.updateUrl&&<Pressable accessibilityRole="button" onPress={()=>{void Linking.openURL(actionSource.updateInfo!.updateUrl!).catch(()=>{});}} style={styles.fullSecondaryBtn}>
                  <Ionicons name="open-outline" size={16} color={s.control}/>
                  <Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>前往更新地址</Text>
                </Pressable>}
                <Pressable accessibilityRole="button" disabled={actionBusy} onPress={()=>setActionMode('manualUpdate')} style={styles.fullSecondaryBtn}>
                  <Ionicons name="link-outline" size={16} color={s.muted}/>
                  <Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>输入脚本 URL 手动更新</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={actionBusy} onPress={()=>{
                  void catalog.dismissUpdate(actionSource.id).then(()=>{setActionMode('menu');setActionMessage('已忽略此次更新提醒');});
                }} style={{minHeight:38,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{color:s.muted,fontSize:12.5,fontWeight:'600'}}>忽略此更新提醒</Text>
                </Pressable>
              </View>
            </View>}

            {!!actionMessage&&<View style={{paddingHorizontal:12,paddingVertical:10,borderRadius:14,backgroundColor:s.accentSoft}}>
              <Text accessibilityLiveRegion="polite" style={{color:s.control,fontSize:13,lineHeight:18,fontWeight:'600'}}>{actionMessage}</Text>
            </View>}
          </ScrollView>
        </>}
      </SafeAreaView>
    </SheetModal>

    <SourceHealthModal health={health} ids={healthIds??[]} visible={healthIds!==null} onClose={()=>setHealthIds(null)}/>
  </View>;
}

const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return StyleSheet.create({
    headerRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingHorizontal:2},
    heading:{color:s.ink,fontSize:20,fontWeight:'700',letterSpacing:-0.3},
    caption:{color:s.muted,fontSize:12,lineHeight:17,flexShrink:1},
    ghostBtn:{minHeight:36,paddingHorizontal:10,justifyContent:'center',alignItems:'center'},
    ghostBtnText:{color:s.control,fontSize:13.5,fontWeight:'600'},
    primaryPill:{minHeight:36,paddingHorizontal:14,borderRadius:18,backgroundColor:s.control,flexDirection:'row',alignItems:'center',gap:4},
    primaryPillText:{color:'#FFFFFF',fontSize:13.5,fontWeight:'700'},
    batchBar:{flexDirection:'row',flexWrap:'wrap',gap:8},
    compactChip:{minHeight:34,paddingHorizontal:12,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,justifyContent:'center',alignItems:'center'},
    compactChipText:{color:s.ink,fontSize:12.5,fontWeight:'600'},
    emptyCard:{padding:26,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,alignItems:'center',gap:8},
    listCard:{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},
    rowDivider:{height:StyleSheet.hairlineWidth,marginLeft:52,backgroundColor:s.hairline},
    sourceRow:{minHeight:62,paddingLeft:14,paddingRight:8,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:8},
    sourceMain:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:11},
    name:{color:s.ink,fontSize:15,fontWeight:'600',flexShrink:1},
    metaText:{color:s.muted,fontSize:12,lineHeight:16},
    rowActions:{flexDirection:'row',alignItems:'center',gap:2},
    iconBtn:{width:34,height:36,alignItems:'center',justifyContent:'center'},
    orderStack:{width:26,alignItems:'center',justifyContent:'center',gap:2},
    orderBtn:{width:26,height:17,alignItems:'center',justifyContent:'center'},
    disabled:{opacity:0.42},
    message:{color:s.control,fontSize:12.5,lineHeight:18,paddingHorizontal:4},
    sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:10,gap:8},
    sheetTitle:{color:s.ink,fontSize:19,fontWeight:'700'},
    sheetCloseBtn:{width:36,height:36,borderRadius:18,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'},
    sheetCard:{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},
    menuCard:{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},
    menuRow:{minHeight:60,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:13},
    menuIconWrap:{width:28,alignItems:'center',justifyContent:'center'},
    menuTitle:{color:s.ink,fontSize:15.5,fontWeight:'600'},
    menuSub:{color:s.muted,fontSize:12,lineHeight:17},
    menuDivider:{height:StyleSheet.hairlineWidth,marginLeft:56,backgroundColor:s.hairline},
    input:{color:s.ink,backgroundColor:s.inputBg,borderColor:s.cardBorder,borderWidth:1,borderRadius:14,paddingHorizontal:13,paddingVertical:11,minHeight:44,fontSize:14},
    fullPrimaryBtn:{minHeight:44,borderRadius:22,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:16},
    fullSecondaryBtn:{minHeight:44,borderRadius:22,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:16},
  });
};
