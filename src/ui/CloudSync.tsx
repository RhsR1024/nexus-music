import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,FlatList,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal} from './AdaptiveModal.tsx';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import type {Services} from '../app/services.ts';
import {syncDirectory} from '../storage/webdavSync.ts';
import {normalizeBackupDirectory} from '../storage/webdavBackups.ts';
import {describeSyncRecord,SyncError,type SyncChoices,type SyncRecord} from '../storage/multiDeviceSync.ts';
import type {LocalPlaylist} from '../storage/library.ts';

export function CloudSync({services,grouped=false}:{services:Services;grouped?:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets(),store=services.davSync,state=useSyncExternalStore(store.subscribe,store.getSnapshot),accounts=useSyncExternalStore(services.davAccounts.subscribe,services.davAccounts.getSnapshot);
  const [open,setOpen]=useState(false),[accountId,setAccountId]=useState(''),[directory,setDirectory]=useState(syncDirectory),[choices,setChoices]=useState<SyncChoices>({}),[message,setMessage]=useState(''),[details,setDetails]=useState<SyncRecord>();
  useEffect(()=>{setChoices({});setDetails(undefined);},[state.preview]);
  useEffect(()=>{if(open&&!accounts.some(value=>value.id===accountId))setAccountId(accounts[0]?.id??'');},[accounts,open,accountId]);
  const busy=!!state.busy,committing=state.busy==='commit'||state.busy==='configure';let saved=false;
  try{saved=state.config?.accountId===accountId&&state.config.directory===normalizeBackupDirectory(directory.trim()||syncDirectory);}catch{/* Keep an invalid draft editable. */}
  function show(){setAccountId(state.config?.accountId??accounts[0]?.id??'');setDirectory(state.config?decodeURIComponent(state.config.directory):syncDirectory);setMessage('');setOpen(true);}
  function close(){if(details){setDetails(undefined);return;}if(store.cancel())setOpen(false);}
  async function perform(action:()=>Promise<void>){setMessage('');try{await action();}catch(error){setMessage(error instanceof SyncError?error.message:'同步未确认完成，请重新预览并核对数据');}}
  const pill=(label:string,onPress:()=>void,disabled=false,id?:string,primary=false)=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} testID={id} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={{paddingHorizontal:15,paddingVertical:10,minHeight:42,borderRadius:21,backgroundColor:primary?s.control:s.chip,borderWidth:primary?0:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:disabled?.42:1}}>
      <Text style={{color:primary?'#FFFFFF':s.ink,fontSize:13.5,fontWeight:'600'}}>{label}</Text>
    </Pressable>
  );
  const plan=state.preview?.plan,conflicts=plan?.conflicts??[],ready=!!plan&&conflicts.every(value=>choices[value.id]);
  function confirm(){if(!ready||!state.preview)return;const preview=state.preview,confirmedChoices={...choices};Alert.alert('确认同步音乐库？','将按预览合并歌曲收藏、目录收藏、歌单、音频匹配和歌词选择；冲突按所选版本处理。历史、统计、队列与凭据保留本机。',[{text:'取消',style:'cancel'},{text:'确认同步两端',onPress:()=>{void perform(()=>store.commit(confirmedChoices,preview));}}]);}
  const version=(record:SyncRecord|undefined)=>record&&!record.deleted?record:undefined;
  const playlistDetails=details?.kind==='playlist'?details.payload as LocalPlaylist:undefined;
  return <View style={grouped?undefined:{marginVertical:6}}>
    {grouped?<Pressable accessibilityRole="button" accessibilityLabel="WebDAV多设备同步" testID="cloud-sync-open" onPress={show} style={{minHeight:60,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="sync-outline" size={18} color={s.accent}/></View>
      <View style={{flex:1,minWidth:0,gap:2}}>
        <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>WebDAV 多设备同步</Text>
        <Text numberOfLines={1} style={{color:s.muted,fontSize:12}}>跨设备预览合并歌单、收藏与歌词选择</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
    </Pressable>:<Pressable accessibilityRole="button" accessibilityLabel="WebDAV多设备同步" testID="cloud-sync-open" onPress={show} style={[{minHeight:54,paddingHorizontal:16,paddingVertical:12,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
        <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="sync-outline" size={18} color={s.accent}/></View>
        <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>WebDAV多设备同步</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={s.subtle}/>
    </Pressable>}
    <Modal visible={open} onRequestClose={close} animationType="slide">
      <View style={{flex:1}}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        {details?<View style={{flex:1,paddingHorizontal:18,paddingTop:Math.max(insets.top+12,50),paddingBottom:Math.max(insets.bottom+14,20),gap:14}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
            <Text style={{color:s.ink,fontSize:20,fontWeight:'700',flex:1}} numberOfLines={1}>版本预览</Text>
            {pill('关闭版本预览',()=>setDetails(undefined))}
          </View>
          <View style={[{padding:14,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>
            <Text style={{color:s.ink,fontSize:16,fontWeight:'600'}}>{describeSyncRecord(details)}</Text>
          </View>
          {playlistDetails?<FlatList data={playlistDetails.entries} keyExtractor={value=>value.id} initialNumToRender={16} windowSize={5} contentContainerStyle={{gap:8,paddingBottom:20}} renderItem={({item,index})=><View style={{padding:12,borderRadius:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}><Text style={{color:s.ink,fontWeight:'600'}}>{index+1}. {item.track.title}</Text><Text style={{color:s.muted,fontSize:12,marginTop:2}}>{item.track.artist}{item.track.album?` · ${item.track.album}`:''}</Text></View>}/>:<Text style={{color:s.muted,fontSize:13,lineHeight:20}}>此版本仅影响对应收藏或选择记录；未包含播放地址与连接凭据。</Text>}
        </View>:<View style={{flex:1,paddingHorizontal:18,paddingTop:Math.max(insets.top+12,50),paddingBottom:Math.max(insets.bottom+14,20),gap:12}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
            <Text style={{color:s.ink,fontSize:24,fontWeight:'700'}}>多设备音乐库同步</Text>
            {pill('收起多设备同步',close,committing)}
          </View>
          <FlatList data={conflicts} keyExtractor={value=>value.id} initialNumToRender={6} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,paddingBottom:24}}
            ListHeaderComponent={<View style={{gap:12,paddingBottom:6}}>
              <Text style={{color:s.muted,fontSize:12.5,lineHeight:19}}>各设备使用同一连接和目录，先预览再确认。本机收藏、歌单、音频匹配、歌词选择和目录收藏变更后会刷新合并预览，但不会自动提交。相同内容两端都有修改时，逐项选择版本；音频文件需在各设备另行配置。</Text>
              <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},s.cardShadow]}>
                {!accounts.length?<Text style={{color:s.ink,fontSize:13.5}}>请先在音乐库的WebDAV入口验证并保存连接。</Text>:accounts.map(value=><Pressable key={value.id} accessibilityRole="button" disabled={busy} onPress={()=>{store.cancel();setAccountId(value.id);}} style={{minHeight:42,paddingHorizontal:14,borderRadius:14,backgroundColor:accountId===value.id?s.accentSoft:s.chip,borderWidth:1,borderColor:accountId===value.id?s.accent+'44':s.chipBorder,justifyContent:'center',opacity:busy?.45:1}}>
                  <Text style={{color:accountId===value.id?s.accent:s.ink,fontSize:13.5,fontWeight:'600'}}>{accountId===value.id?'● ':''}同步连接：{value.label}</Text>
                </Pressable>)}
                <TextInput accessibilityLabel="多设备同步相对目录" autoCapitalize="none" autoCorrect={false} placeholder="根目录内的同步文件夹" placeholderTextColor={s.subtle} editable={!busy} value={directory} onChangeText={value=>{store.cancel();setDirectory(value);setMessage('');}} style={{color:s.ink,paddingHorizontal:13,paddingVertical:11,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,borderRadius:14,fontSize:14}}/>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                  {pill('保存同步目录',()=>{void perform(()=>store.configure(accountId,directory));},busy||!accountId||saved,'cloud-sync-save',!saved)}
                  {pill('读取合并预览',()=>{void perform(()=>store.preview());},busy||!saved,'cloud-sync-preview',saved)}
                </View>
              </View>
              {busy&&<View style={{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>
                <ActivityIndicator color={s.accent}/>
                <Text style={{flex:1,color:s.muted,fontSize:13}}>{state.busy==='commit'?'正在提交并验证同步…':state.busy==='configure'?'正在保存目录…':'正在读取云端音乐库…'}</Text>
                {!committing&&pill('取消同步读取',()=>store.cancel())}
              </View>}
              {!!(state.error||message||state.message)&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" testID="cloud-sync-status" style={{color:s.ink,fontSize:13,fontWeight:'600',paddingHorizontal:4}}>{state.error||message||state.message}</Text>}
              {plan&&<View testID="cloud-sync-summary" style={[{gap:8,padding:15,borderWidth:1,borderColor:s.accent+'44',borderRadius:20,backgroundColor:s.card},s.cardShadow]}>
                <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>待确认合并 · {conflicts.length} 项冲突</Text>
                <Text style={{color:s.muted,fontSize:12.5}}>无冲突记录 {plan.records.filter(value=>!value.deleted).length} · 删除标记 {plan.records.filter(value=>value.deleted).length}</Text>
                {!!state.preview?.deltaSummary&&<Text testID="cloud-sync-delta" style={{color:s.accent,fontSize:12,fontWeight:'600'}}>{state.preview.deltaSummary}</Text>}
                <View style={{alignSelf:'flex-start',marginTop:4}}>{pill('确认当前合并方案',confirm,busy||!saved||!ready,'cloud-sync-commit',true)}</View>
              </View>}
            </View>}
            renderItem={({item,index})=><View style={[{gap:10,padding:15,borderWidth:1,borderColor:s.cardBorder,borderRadius:20,backgroundColor:s.card},s.cardShadow]}>
              <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>冲突 {index+1} · {item.kind==='catalogFavorite'?'目录收藏':item.kind==='playlist'?'歌单':item.kind==='favorite'?'收藏':item.kind==='match'?'音频匹配':'歌词选择'}</Text>
              <Text style={{color:s.ink,fontSize:13}}>本机：{describeSyncRecord(item.local)}</Text>
              {version(item.local)&&<View style={{alignSelf:'flex-start'}}>{pill('预览本机版本',()=>setDetails(item.local),busy)}</View>}
              <Text style={{color:s.ink,fontSize:13}}>云端：{describeSyncRecord(item.remote)}</Text>
              {version(item.remote)&&<View style={{alignSelf:'flex-start'}}>{pill('预览云端版本',()=>setDetails(item.remote),busy)}</View>}
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,paddingTop:4}}>
                {pill(`${choices[item.id]==='local'?'● ':''}采用本机版本`,()=>setChoices(value=>({...value,[item.id]:'local'})),busy,`cloud-sync-local-${index}`,choices[item.id]==='local')}
                {pill(`${choices[item.id]==='remote'?'● ':''}采用云端版本`,()=>setChoices(value=>({...value,[item.id]:'remote'})),busy,`cloud-sync-remote-${index}`,choices[item.id]==='remote')}
              </View>
            </View>}/>
        </View>}
      </View>
    </Modal>
  </View>;
}
