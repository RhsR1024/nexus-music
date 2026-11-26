import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal} from './AdaptiveModal.tsx';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {statisticsDirectory,StatisticsSyncError} from '../storage/webdavStatistics.ts';
import {CloudBackupError,normalizeBackupDirectory} from '../storage/webdavBackups.ts';
import {WebDAVError} from '../providers/webdav.ts';
import {listeningDuration} from '../domain/listeningStatistics.ts';
import type {Services} from '../app/services.ts';

export function StatisticsCloud({services}:{services:Services}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets(),store=services.davStatistics,state=useSyncExternalStore(store.subscribe,store.getSnapshot),accounts=useSyncExternalStore(services.davAccounts.subscribe,services.davAccounts.getSnapshot);
  const [open,setOpen]=useState(false),[accountId,setAccountId]=useState(''),[directory,setDirectory]=useState(statisticsDirectory),[message,setMessage]=useState('');
  useEffect(()=>{if(open&&!accounts.some(x=>x.id===accountId))setAccountId(accounts[0]?.id??'');},[accounts,open,accountId]);
  const busy=!!state.busy,committing=state.busy==='configure'||state.busy==='merge';let saved=false;
  try{saved=state.config?.accountId===accountId&&state.config.directory===normalizeBackupDirectory(directory);}catch{}
  const pill=(label:string,action:()=>void,disabled=false,id?:string,primary=false)=>(
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{minHeight:42,paddingHorizontal:15,paddingVertical:10,borderRadius:21,backgroundColor:primary?s.control:s.chip,borderWidth:primary?0:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:disabled?.42:1}}>
      <Text style={{color:primary?'#FFFFFF':s.ink,fontSize:13.5,fontWeight:'600'}}>{label}</Text>
    </Pressable>
  );
  async function perform(action:()=>Promise<void>){setMessage('');try{await action();}catch(error){setMessage(error instanceof StatisticsSyncError||error instanceof CloudBackupError||error instanceof WebDAVError?error.message:'统计操作未确认完成，请查看提示后重试');}}
  function show(){setAccountId(state.config?.accountId??accounts[0]?.id??'');setDirectory(state.config?decodeURIComponent(state.config.directory):statisticsDirectory);setMessage('');setOpen(true);}
  function close(){if(store.cancel())setOpen(false);}
  async function upload(){await store.prepareUpload();const preview=store.getSnapshot().preview;if(!preview)return;Alert.alert('上传听歌统计？',`将用预览快照覆盖云端统计：${preview.local.tracks}首、${preview.local.playCount}次、${listeningDuration(preview.local.listenedMs)}。${preview.remote?`云端当前修订 #${preview.remote.revision}。`:'云端目前没有统计。'}此操作不上传歌单、账号、音源或音频文件。`,[{text:'取消',style:'cancel',onPress:()=>store.cancel()},{text:'继续上传统计',style:'destructive',onPress:()=>{void perform(()=>store.uploadPrepared());}}]);}
  return <>
    <Pressable testID="statistics-cloud-open" accessibilityRole="button" accessibilityLabel="听歌统计手动同步" onPress={show} style={[{minHeight:54,paddingHorizontal:16,paddingVertical:12,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
        <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="bar-chart-outline" size={18} color={s.accent}/></View>
        <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>听歌统计手动同步</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={s.subtle}/>
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={{flex:1}}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={{flex:1,paddingTop:Math.max(insets.top+12,50),paddingBottom:Math.max(insets.bottom+14,20),paddingLeft:Math.max(18,insets.left+12),paddingRight:Math.max(18,insets.right+12),gap:12}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
            <Text accessibilityRole="header" style={{color:s.ink,fontSize:24,fontWeight:'700'}}>听歌统计手动同步</Text>
            {pill('收起统计同步',close,committing)}
          </View>
          <ScrollView testID="statistics-cloud-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:14,paddingBottom:32}}>
            <Text style={{color:s.muted,fontSize:12.5,lineHeight:19}}>统计与收藏/歌单实时同步分开。上传须确认覆盖；下载合并不重复累加同一副本，新副本可累加。旧无身份记录按累计最大值保守合并，冲突分时不叠加。</Text>
            <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},s.cardShadow]}>
              {!accounts.length&&<Text style={{color:s.ink,fontSize:13.5}}>请先在音乐库的WebDAV入口验证并保存连接。</Text>}
              {accounts.map(account=><Pressable key={account.id} accessibilityRole="button" disabled={busy} onPress={()=>{store.cancel();setAccountId(account.id);}} style={{minHeight:42,paddingHorizontal:14,borderRadius:14,backgroundColor:accountId===account.id?s.accentSoft:s.chip,borderWidth:1,borderColor:accountId===account.id?s.accent+'44':s.chipBorder,justifyContent:'center',opacity:busy?.45:1}}>
                <Text style={{color:accountId===account.id?s.accent:s.ink,fontSize:13.5,fontWeight:'600'}}>{accountId===account.id?'● ':''}统计连接：{account.label}</Text>
              </Pressable>)}
              <Text style={{color:s.muted,fontSize:12}}>相对目录（连接根目录内）</Text>
              <TextInput accessibilityLabel="统计同步相对目录" autoCapitalize="none" autoCorrect={false} editable={!busy} value={directory} onChangeText={value=>{store.cancel();setDirectory(value);setMessage('');}} style={{minHeight:44,paddingHorizontal:13,paddingVertical:10,borderRadius:14,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,color:s.ink,fontSize:14}}/>
              <View style={{alignSelf:'flex-start'}}>{pill('保存统计同步目录',()=>{void perform(()=>store.configure(accountId,directory));},busy||!accountId||saved,'statistics-cloud-save',!saved)}</View>
            </View>
            <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
              <Text testID="statistics-cloud-state" style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{state.cloud===undefined?'云端统计尚未读取':state.cloud===null?'云端暂无听歌统计':`云端修订 #${state.cloud.revision} · ${state.cloud.tracks}首 · ${state.cloud.playCount}次 · ${listeningDuration(state.cloud.listenedMs)}`}</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                {pill('读取云端统计',()=>{void perform(()=>store.refresh());},busy||!saved,'statistics-cloud-refresh')}
                {pill('上传本机统计',()=>{void perform(upload);},busy||!saved,'statistics-cloud-upload',true)}
                {pill('下载并合并统计',()=>{void perform(()=>store.downloadAndMerge());},busy||!saved,'statistics-cloud-download')}
              </View>
            </View>
            {busy&&<View style={{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>
              <ActivityIndicator color={s.accent} accessibilityLabel={committing?'正在保存本机统计':'正在处理统计同步'}/>
              <Text style={{flex:1,color:s.muted,fontSize:13}}>{committing?'正在保存本机统计…':'正在处理统计同步…'}</Text>
              {!committing&&pill('取消统计请求',()=>{store.cancel();})}
            </View>}
            {!!(state.error||message||state.message)&&<Text testID="statistics-cloud-message" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{color:state.error?s.ink:s.accent,fontSize:13,fontWeight:'600',paddingHorizontal:4}}>{state.error||message||state.message}</Text>}
            <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>清空只作用于本机；之后显式下载可能恢复云端保留的数据。上传使用预览时的快照，期间新增聆听留待下次上传。请保护统计目录的访问权限。</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
