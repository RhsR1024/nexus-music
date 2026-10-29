import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,FlatList,Pressable,View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import type {Services} from '../app/services.ts';
import {syncDirectory} from '../storage/webdavSync.ts';
import {normalizeBackupDirectory} from '../storage/webdavBackups.ts';
import {describeSyncRecord,SyncError,type SyncChoices,type SyncRecord} from '../storage/multiDeviceSync.ts';
import type {LocalPlaylist} from '../storage/library.ts';

export function CloudSync({services}:{services:Services}){
  const {palette:p}=useTheme(),store=services.davSync,state=useSyncExternalStore(store.subscribe,store.getSnapshot),accounts=useSyncExternalStore(services.davAccounts.subscribe,services.davAccounts.getSnapshot);
  const [open,setOpen]=useState(false),[accountId,setAccountId]=useState(''),[directory,setDirectory]=useState(syncDirectory),[choices,setChoices]=useState<SyncChoices>({}),[message,setMessage]=useState(''),[details,setDetails]=useState<SyncRecord>();
  useEffect(()=>{setChoices({});setDetails(undefined);},[state.preview]);
  useEffect(()=>{if(open&&!accounts.some(value=>value.id===accountId))setAccountId(accounts[0]?.id??'');},[accounts,open,accountId]);
  const busy=!!state.busy,committing=state.busy==='commit'||state.busy==='configure';let saved=false;
  try{saved=state.config?.accountId===accountId&&state.config.directory===normalizeBackupDirectory(directory.trim()||syncDirectory);}catch{/* Keep an invalid draft editable. */}
  function show(){setAccountId(state.config?.accountId??accounts[0]?.id??'');setDirectory(state.config?decodeURIComponent(state.config.directory):syncDirectory);setMessage('');setOpen(true);}
  function close(){if(store.cancel())setOpen(false);}
  async function perform(action:()=>Promise<void>){setMessage('');try{await action();}catch(error){setMessage(error instanceof SyncError?error.message:'同步未确认完成，请重新预览并核对数据');}}
  const button=(label:string,onPress:()=>void,disabled=false,id?:string)=><Pressable accessibilityRole="button" testID={id} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={{padding:12,minHeight:44,borderRadius:14,backgroundColor:p.selected,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  const plan=state.preview?.plan,conflicts=plan?.conflicts??[],ready=!!plan&&conflicts.every(value=>choices[value.id]);
  function confirm(){if(!ready)return;Alert.alert('确认同步音乐库？','将按预览合并歌曲收藏、目录收藏、歌单、音频匹配和歌词选择；冲突按所选版本处理。历史、统计、队列与凭据保留本机。',[{text:'取消',style:'cancel'},{text:'确认同步两端',onPress:()=>{void perform(()=>store.commit(choices));}}]);}
  const version=(record:SyncRecord|undefined)=>record&&!record.deleted?record:undefined;
  const playlistDetails=details?.kind==='playlist'?details.payload as LocalPlaylist:undefined;
  return <View style={{marginVertical:10}}>{button('WebDAV多设备同步',show,false,'cloud-sync-open')}
    <Modal visible={open} onRequestClose={close} animationType="slide"><View style={{flex:1,padding:22,paddingTop:64,gap:12,backgroundColor:p.background[0]}}>
      {button('收起多设备同步',close,committing)}<Text style={{color:p.text,fontSize:26,fontWeight:'700'}}>多设备音乐库同步</Text>
      <FlatList data={conflicts} keyExtractor={value=>value.id} initialNumToRender={6} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,paddingBottom:20}}
        ListHeaderComponent={<View style={{gap:12,paddingBottom:12}}>
          <Text style={{color:p.secondary,lineHeight:21}}>各设备使用同一连接和目录，先预览再确认。同步收藏、歌单、音频匹配和歌词选择；相同内容两端都有修改时，逐项选择版本。音频文件需在各设备另行配置。</Text>
          {!accounts.length?<Text style={{color:p.text}}>请先在音乐库的WebDAV入口验证并保存连接。</Text>:accounts.map(value=><View key={value.id}>{button(`${accountId===value.id?'● ':''}同步连接：${value.label}`,()=>{store.cancel();setAccountId(value.id);},busy)}</View>)}
          <TextInput accessibilityLabel="多设备同步相对目录" autoCapitalize="none" autoCorrect={false} placeholder="根目录内的同步文件夹" placeholderTextColor={p.secondary} editable={!busy} value={directory} onChangeText={value=>{store.cancel();setDirectory(value);setMessage('');}} style={{color:p.text,padding:12,borderWidth:1,borderColor:p.border,borderRadius:14}}/>
          {button('保存同步目录',()=>{void perform(()=>store.configure(accountId,directory));},busy||!accountId||saved,'cloud-sync-save')}
          {button('读取合并预览',()=>{void perform(()=>store.preview());},busy||!saved,'cloud-sync-preview')}
          {busy&&<View style={{gap:8}}><ActivityIndicator color={p.accent}/><Text style={{color:p.secondary}}>{state.busy==='commit'?'正在提交并验证同步…':state.busy==='configure'?'正在保存目录…':'正在读取云端音乐库…'}</Text>{!committing&&button('取消同步读取',()=>store.cancel())}</View>}
          {!!(state.error||message||state.message)&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" testID="cloud-sync-status" style={{color:p.text}}>{state.error||message||state.message}</Text>}
          {plan&&<View testID="cloud-sync-summary" style={{gap:8,padding:12,borderWidth:1,borderColor:p.border,borderRadius:14}}><Text style={{color:p.text}}>待确认合并 · {conflicts.length} 项冲突</Text><Text style={{color:p.secondary}}>无冲突记录 {plan.records.filter(value=>!value.deleted).length} · 删除标记 {plan.records.filter(value=>value.deleted).length}</Text>{button('确认当前合并方案',confirm,busy||!saved||!ready,'cloud-sync-commit')}</View>}
        </View>}
        renderItem={({item,index})=><View style={{gap:10,padding:14,borderWidth:1,borderColor:p.border,borderRadius:14}}>
          <Text style={{color:p.text,fontWeight:'700'}}>冲突 {index+1} · {item.kind==='catalogFavorite'?'目录收藏':item.kind==='playlist'?'歌单':item.kind==='favorite'?'收藏':item.kind==='match'?'音频匹配':'歌词选择'}</Text>
          <Text style={{color:p.text}}>本机：{describeSyncRecord(item.local)}</Text>{version(item.local)&&button('预览本机版本',()=>setDetails(item.local),busy)}
          <Text style={{color:p.text}}>云端：{describeSyncRecord(item.remote)}</Text>{version(item.remote)&&button('预览云端版本',()=>setDetails(item.remote),busy)}
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{button(`${choices[item.id]==='local'?'● ':''}采用本机版本`,()=>setChoices(value=>({...value,[item.id]:'local'})),busy,`cloud-sync-local-${index}`)}{button(`${choices[item.id]==='remote'?'● ':''}采用云端版本`,()=>setChoices(value=>({...value,[item.id]:'remote'})),busy,`cloud-sync-remote-${index}`)}</View>
        </View>}/>
    </View>
      <Modal visible={!!details} onRequestClose={()=>setDetails(undefined)} animationType="slide"><View style={{flex:1,padding:22,paddingTop:64,gap:12,backgroundColor:p.background[0]}}>{button('关闭版本预览',()=>setDetails(undefined))}<Text style={{color:p.text,fontSize:22}}>{describeSyncRecord(details)}</Text>{playlistDetails?<FlatList data={playlistDetails.entries} keyExtractor={value=>value.id} initialNumToRender={16} windowSize={5} renderItem={({item,index})=><View style={{paddingVertical:10,borderBottomWidth:1,borderColor:p.border}}><Text style={{color:p.text}}>{index+1}. {item.track.title}</Text><Text style={{color:p.secondary}}>{item.track.artist}{item.track.album?` · ${item.track.album}`:''}</Text></View>}/>:<Text style={{color:p.secondary}}>此版本仅影响对应收藏或选择记录；未包含播放地址与连接凭据。</Text>}</View></Modal>
    </Modal>
  </View>;
}
