import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal} from './AdaptiveModal.tsx';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';
import {statisticsDirectory,StatisticsSyncError} from '../storage/webdavStatistics.ts';
import {CloudBackupError,normalizeBackupDirectory} from '../storage/webdavBackups.ts';
import {WebDAVError} from '../providers/webdav.ts';
import {listeningDuration} from '../domain/listeningStatistics.ts';
import type {Services} from '../app/services.ts';
export function StatisticsCloud({services}:{services:Services}){
  const {palette:p}=useTheme(),insets=useSafeAreaInsets(),store=services.davStatistics,state=useSyncExternalStore(store.subscribe,store.getSnapshot),accounts=useSyncExternalStore(services.davAccounts.subscribe,services.davAccounts.getSnapshot);
  const [open,setOpen]=useState(false),[accountId,setAccountId]=useState(''),[directory,setDirectory]=useState(statisticsDirectory),[message,setMessage]=useState('');
  useEffect(()=>{if(open&&!accounts.some(x=>x.id===accountId))setAccountId(accounts[0]?.id??'');},[accounts,open,accountId]);
  const busy=!!state.busy,committing=state.busy==='configure'||state.busy==='merge';let saved=false;
  try{saved=state.config?.accountId===accountId&&state.config.directory===normalizeBackupDirectory(directory);}catch{}
  const button=(label:string,action:()=>void,disabled=false,id?:string)=><Pressable testID={id} accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:p.selected,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  async function perform(action:()=>Promise<void>){setMessage('');try{await action();}catch(error){setMessage(error instanceof StatisticsSyncError||error instanceof CloudBackupError||error instanceof WebDAVError?error.message:'统计操作未确认完成，请查看提示后重试');}}
  function show(){setAccountId(state.config?.accountId??accounts[0]?.id??'');setDirectory(state.config?decodeURIComponent(state.config.directory):statisticsDirectory);setMessage('');setOpen(true);}
  function close(){if(store.cancel())setOpen(false);}
  async function upload(){await store.prepareUpload();const preview=store.getSnapshot().preview;if(!preview)return;Alert.alert('上传听歌统计？',`将用预览快照覆盖云端统计：${preview.local.tracks}首、${preview.local.playCount}次、${listeningDuration(preview.local.listenedMs)}。${preview.remote?`云端当前修订 #${preview.remote.revision}。`:'云端目前没有统计。'}此操作不上传歌单、账号、音源或音频文件。`,[{text:'取消',style:'cancel',onPress:()=>store.cancel()},{text:'继续上传统计',style:'destructive',onPress:()=>{void perform(()=>store.uploadPrepared());}}]);}
  return <>{button('听歌统计手动同步',show,false,'statistics-cloud-open')}
    <Modal visible={open} animationType="slide" onRequestClose={close}><View style={{flex:1,padding:space.xxl,paddingTop:insets.top+space.md,paddingBottom:insets.bottom+space.md,paddingLeft:Math.max(space.xxl,insets.left+space.md),paddingRight:Math.max(space.xxl,insets.right+space.md),backgroundColor:p.background[0],gap:space.md}}>
      {button('收起统计同步',close,committing)}<Text accessibilityRole="header" style={{color:p.text,...typography.title}}>听歌统计手动同步</Text>
      <ScrollView testID="statistics-cloud-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:space.md,paddingBottom:space.xxl}}>
        <Text style={{color:p.secondary,...typography.caption}}>统计与收藏/歌单实时同步分开。上传须确认覆盖；下载合并不重复累加同一副本，新副本可累加。旧无身份记录按累计最大值保守合并，冲突分时不叠加。</Text>
        {!accounts.length&&<Text style={{color:p.text}}>请先在音乐库的WebDAV入口验证并保存连接。</Text>}
        {accounts.map(account=><View key={account.id}>{button(`${accountId===account.id?'● ':''}统计连接：${account.label}`,()=>{store.cancel();setAccountId(account.id);},busy)}</View>)}
        <Text style={{color:p.secondary,...typography.caption}}>相对目录（连接根目录内）</Text><TextInput accessibilityLabel="统计同步相对目录" autoCapitalize="none" autoCorrect={false} editable={!busy} value={directory} onChangeText={value=>{store.cancel();setDirectory(value);setMessage('');}} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,borderWidth:1,borderColor:p.border,color:p.text}}/>
        {button('保存统计同步目录',()=>{void perform(()=>store.configure(accountId,directory));},busy||!accountId||saved,'statistics-cloud-save')}
        <Text testID="statistics-cloud-state" style={{color:p.text}}>{state.cloud===undefined?'云端统计尚未读取':state.cloud===null?'云端暂无听歌统计':`云端修订 #${state.cloud.revision} · ${state.cloud.tracks}首 · ${state.cloud.playCount}次 · ${listeningDuration(state.cloud.listenedMs)}`}</Text>
        {button('读取云端统计',()=>{void perform(()=>store.refresh());},busy||!saved,'statistics-cloud-refresh')}
        {button('上传本机统计',()=>{void perform(upload);},busy||!saved,'statistics-cloud-upload')}
        {button('下载并合并统计',()=>{void perform(()=>store.downloadAndMerge());},busy||!saved,'statistics-cloud-download')}
        {busy&&<ActivityIndicator color={p.accent} accessibilityLabel={committing?'正在保存本机统计':'正在处理统计同步'}/>}
        {busy&&!committing&&button('取消统计请求',()=>{store.cancel();})}
        {!!(state.error||message||state.message)&&<Text testID="statistics-cloud-message" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{color:state.error?p.text:p.accent}}>{state.error||message||state.message}</Text>}
        <Text style={{color:p.secondary,...typography.caption}}>清空只作用于本机；之后显式下载可能恢复云端保留的数据。上传使用预览时的快照，期间新增聆听留待下次上传。请保护统计目录的访问权限。</Text>
      </ScrollView>
    </View></Modal>
  </>;
}
