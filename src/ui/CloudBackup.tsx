import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,FlatList,Pressable,ScrollView,View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import type {Services} from '../app/services.ts';
import {backupDirectory,CloudBackupError,normalizeBackupDirectory} from '../storage/webdavBackups.ts';
export function CloudBackup({services}:{services:Services}){
  const {palette:p}=useTheme(),store=services.davBackups,state=useSyncExternalStore(store.subscribe,store.getSnapshot),accounts=useSyncExternalStore(services.davAccounts.subscribe,services.davAccounts.getSnapshot);
  const [open,setOpen]=useState(false),[accountId,setAccountId]=useState(''),[directory,setDirectory]=useState(backupDirectory),[message,setMessage]=useState(''),[visible,setVisible]=useState(20);
  useEffect(()=>{if(open&&!accounts.some(account=>account.id===accountId))setAccountId(accounts[0]?.id??'');},[accounts,open,accountId]);
  const busy=!!state.busy,committing=state.busy==='restore'||state.busy==='configure';let saved=false;
  try{saved=state.config?.accountId===accountId&&state.config.directory===normalizeBackupDirectory(directory);}catch{/* Invalid draft stays editable; no request is sent. */}
  function show(){setAccountId(state.config?.accountId??accounts[0]?.id??'');setDirectory(state.config?decodeURIComponent(state.config.directory):backupDirectory);setMessage('');setVisible(20);setOpen(true);}
  function close(){if(store.cancel())setOpen(false);}
  async function perform(action:()=>Promise<void>){setMessage('');try{await action();}catch(error){setMessage(error instanceof CloudBackupError?error.message:'操作未完成，请查看提示后重试');}}
  const button=(label:string,action:()=>void,disabled=false,id?:string)=><Pressable accessibilityRole="button" testID={id} accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{padding:12,minHeight:44,borderRadius:14,backgroundColor:p.selected,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  const preview=state.preview,backup=preview?.backup;
  function confirmRestore(){if(!preview||!saved)return;Alert.alert('恢复云端备份？',`将替换本机音乐库和播放统计。音频文件、连接凭据、音源和外观不包含在备份内。队列保留；若当前歌曲绑定改变，播放会停止。`,[{text:'取消',style:'cancel'},{text:'确认恢复云备份',style:'destructive',onPress:()=>{void perform(()=>store.restorePreview());}}]);}
  return <View style={{marginVertical:10}}>{button('WebDAV云备份',show,false,'cloud-backup-open')}
    <Modal visible={open} onRequestClose={close} animationType="slide"><View style={{flex:1,padding:22,paddingTop:64,gap:12,backgroundColor:p.background[0]}}>
      {button('收起云备份',close,committing)}<Text style={{color:p.text,fontSize:28,fontWeight:'700'}}>云端音乐库备份</Text>
      <ScrollView testID="cloud-backup-settings" style={{flexGrow:0,maxHeight:'50%'}} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,paddingBottom:8}}>
        <Text style={{color:p.secondary,lineHeight:21}}>保存独立版本，上传后回读校验。恢复前先预览；备份包含收藏、歌单、历史、匹配与播放统计。请保护服务端目录的访问权限。</Text>
        {!accounts.length?<Text style={{color:p.text}}>请先收起此页，在音乐库的WebDAV入口验证并保存连接。</Text>:accounts.map(account=><View key={account.id}>{button(`${accountId===account.id?'● ':''}备份连接：${account.label}`,()=>{store.cancel();setAccountId(account.id);},busy)}</View>)}
        <TextInput accessibilityLabel="云备份相对目录" placeholder="连接根目录内的相对文件夹" placeholderTextColor={p.secondary} autoCapitalize="none" autoCorrect={false} editable={!busy} value={directory} onChangeText={value=>{store.cancel();setDirectory(value);setMessage('');}} style={{color:p.text,padding:12,borderWidth:1,borderColor:p.border,borderRadius:14}}/>
        {button('保存云备份目录',()=>{void perform(()=>store.configure(accountId,directory));},busy||!accountId||saved,'cloud-backup-save')}
        {!saved&&<Text style={{color:p.secondary}}>保存目录后可上传或读取备份。</Text>}
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{button('上传当前音乐库',()=>{void perform(()=>store.upload());},busy||!saved,'cloud-backup-upload')}{button('刷新云备份列表',()=>{setVisible(20);void perform(()=>store.list());},busy||!saved,'cloud-backup-list')}</View>
        {busy&&<View style={{gap:8}}><ActivityIndicator color={p.accent} accessibilityLabel="正在处理云备份"/><Text style={{color:p.secondary}}>{state.busy==='restore'?'正在恢复本机数据…':state.busy==='configure'?'正在保存目录…':'正在连接备份目录…'}</Text>{!committing&&button('取消云备份请求',()=>store.cancel())}</View>}
        {!!(message||state.error||state.message)&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{color:state.error?p.text:p.accent}}>{state.error||message||state.message}</Text>}
        {backup&&<View testID="cloud-backup-preview" style={{gap:8,padding:14,borderWidth:1,borderColor:p.border,borderRadius:16}}><Text style={{color:p.text,fontWeight:'700'}}>备份恢复预览</Text><Text style={{color:p.secondary}}>导出时间：{backup.exportedAt.slice(0,80)}</Text><Text style={{color:p.text}}>歌单 {backup.library.playlists.length} · 收藏 {backup.library.favorites.length} · 历史 {backup.library.history.length} · 统计 {backup.statistics?.items.length??0}</Text><Text style={{color:p.secondary}}>{preview!.digestVerified?'内容摘要与格式已验证':'仅验证格式；此旧命名文件无内容摘要'}</Text>{button('恢复此云备份',confirmRestore,busy||!saved,'cloud-backup-restore')}</View>}
      </ScrollView>
      <Text style={{color:p.secondary}}>备份版本 · {state.files.length}</Text>
      <FlatList data={state.files.slice(0,visible)} keyExtractor={file=>file.path} initialNumToRender={10} windowSize={5} ListEmptyComponent={<Text style={{color:p.secondary}}>刷新后查看此目录的JSON备份</Text>} renderItem={({item,index})=><View style={{gap:8,paddingVertical:12,borderBottomWidth:1,borderColor:p.border}}><Text numberOfLines={2} style={{color:p.text,fontSize:12}}>{item.name}</Text><Text style={{color:p.secondary,fontSize:11}}>{item.bytes===undefined?'大小未知':`${Math.ceil(item.bytes/1024)} KiB`} · {item.digest?'含内容摘要':'旧命名，需验证格式'}</Text>{button('下载并预览此备份',()=>{void perform(()=>store.preview(item));},busy||!saved,`cloud-backup-preview-${index}`)}</View>}/>
      {state.files.length>visible&&button('显示更多云备份',()=>setVisible(count=>count+20),busy)}
    </View></Modal>
  </View>;
}
