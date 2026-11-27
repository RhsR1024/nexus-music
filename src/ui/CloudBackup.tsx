import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Alert,FlatList,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal} from './AdaptiveModal.tsx';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import type {Services} from '../app/services.ts';
import {backupDirectory,CloudBackupError,normalizeBackupDirectory} from '../storage/webdavBackups.ts';

export function CloudBackup({services,grouped=false}:{services:Services;grouped?:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets(),store=services.davBackups,state=useSyncExternalStore(store.subscribe,store.getSnapshot),accounts=useSyncExternalStore(services.davAccounts.subscribe,services.davAccounts.getSnapshot);
  const [open,setOpen]=useState(false),[accountId,setAccountId]=useState(''),[directory,setDirectory]=useState(backupDirectory),[message,setMessage]=useState(''),[visible,setVisible]=useState(20);
  useEffect(()=>{if(open&&!accounts.some(account=>account.id===accountId))setAccountId(accounts[0]?.id??'');},[accounts,open,accountId]);
  const busy=!!state.busy,committing=state.busy==='restore'||state.busy==='configure';let saved=false;
  try{saved=state.config?.accountId===accountId&&state.config.directory===normalizeBackupDirectory(directory);}catch{/* Invalid draft stays editable; no request is sent. */}
  function show(){setAccountId(state.config?.accountId??accounts[0]?.id??'');setDirectory(state.config?decodeURIComponent(state.config.directory):backupDirectory);setMessage('');setVisible(20);setOpen(true);}
  function close(){if(store.cancel())setOpen(false);}
  async function perform(action:()=>Promise<void>){setMessage('');try{await action();}catch(error){setMessage(error instanceof CloudBackupError?error.message:'操作未完成，请查看提示后重试');}}
  const pill=(label:string,action:()=>void,disabled=false,id?:string,primary=false)=>(
    <Pressable accessibilityRole="button" accessibilityLabel={label} testID={id} accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{paddingHorizontal:15,paddingVertical:10,minHeight:42,borderRadius:21,backgroundColor:primary?s.control:s.chip,borderWidth:primary?0:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:disabled?.42:1}}>
      <Text style={{color:primary?'#FFFFFF':s.ink,fontSize:13.5,fontWeight:'600'}}>{label}</Text>
    </Pressable>
  );
  const preview=state.preview,backup=preview?.backup,settingsScroll=useRef<ScrollView>(null);
  function confirmRestore(){if(!preview||!saved)return;Alert.alert('恢复云端备份？',`将替换本机音乐库和播放统计。${backup?.settings?'包含播放/歌词/EQ和外观设置，将一并恢复。':'此旧备份无设置，保留当前设置。'}音频/图片/字体文件、连接凭据与音源不包含在备份内。队列保留；若当前歌曲绑定改变，播放会停止。`,[{text:'取消',style:'cancel'},{text:'确认恢复云备份',style:'destructive',onPress:()=>{void perform(()=>store.restorePreview());}}]);}
  return <View style={grouped?undefined:{marginVertical:6}}>
    {grouped?<Pressable accessibilityRole="button" accessibilityLabel="WebDAV云备份" testID="cloud-backup-open" onPress={show} style={{minHeight:60,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="cloud-upload-outline" size={18} color={s.accent}/></View>
      <View style={{flex:1,minWidth:0,gap:2}}>
        <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>WebDAV 云备份</Text>
        <Text numberOfLines={1} style={{color:s.muted,fontSize:12}}>上传独立校验版本，恢复前支持预览</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
    </Pressable>:<Pressable accessibilityRole="button" accessibilityLabel="WebDAV云备份" testID="cloud-backup-open" onPress={show} style={[{minHeight:54,paddingHorizontal:16,paddingVertical:12,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
        <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="cloud-upload-outline" size={18} color={s.accent}/></View>
        <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>WebDAV云备份</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={s.subtle}/>
    </Pressable>}
    <Modal visible={open} onRequestClose={close} animationType="slide">
      <View style={{flex:1}}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={{flex:1,paddingHorizontal:18,paddingTop:Math.max(insets.top+12,50),paddingBottom:Math.max(insets.bottom+14,20),gap:12}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
            <Text style={{color:s.ink,fontSize:24,fontWeight:'700'}}>云端音乐库备份</Text>
            {pill('收起云备份',close,committing)}
          </View>
          <ScrollView ref={settingsScroll} testID="cloud-backup-settings" style={{flexGrow:0,maxHeight:'52%'}} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,paddingBottom:8}}>
            <Text style={{color:s.muted,fontSize:12.5,lineHeight:19}}>保存独立版本，上传后回读校验。恢复前先预览；备份包含收藏、歌单、历史、匹配、播放统计和播放/歌词/EQ/外观设置；图片/字体文件和凭据仍留本机。请保护服务端目录的访问权限。</Text>
            <View style={[{borderRadius:20,padding:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},s.cardShadow]}>
              {!accounts.length?<Text style={{color:s.ink,fontSize:13.5}}>请先收起此页，在音乐库的WebDAV入口验证并保存连接。</Text>:accounts.map(account=><Pressable key={account.id} accessibilityRole="button" disabled={busy} onPress={()=>{store.cancel();setAccountId(account.id);}} style={{minHeight:42,paddingHorizontal:14,borderRadius:14,backgroundColor:accountId===account.id?s.accentSoft:s.chip,borderWidth:1,borderColor:accountId===account.id?s.accent+'44':s.chipBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',opacity:busy?.45:1}}>
                <Text style={{color:accountId===account.id?s.accent:s.ink,fontSize:13.5,fontWeight:'600'}}>{accountId===account.id?'● ':''}备份连接：{account.label}</Text>
              </Pressable>)}
              <TextInput accessibilityLabel="云备份相对目录" placeholder="连接根目录内的相对文件夹" placeholderTextColor={s.subtle} autoCapitalize="none" autoCorrect={false} editable={!busy} value={directory} onChangeText={value=>{store.cancel();setDirectory(value);setMessage('');}} style={{color:s.ink,paddingHorizontal:13,paddingVertical:11,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,borderRadius:14,fontSize:14}}/>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                {pill('保存云备份目录',()=>{void perform(()=>store.configure(accountId,directory));},busy||!accountId||saved,'cloud-backup-save',!saved)}
                {pill('上传当前音乐库',()=>{void perform(()=>store.upload());},busy||!saved,'cloud-backup-upload',saved)}
                {pill('刷新云备份列表',()=>{setVisible(20);void perform(()=>store.list());},busy||!saved,'cloud-backup-list')}
              </View>
              {!saved&&<Text style={{color:s.muted,fontSize:12}}>保存目录后可上传或读取备份。</Text>}
            </View>
            {busy&&<View style={{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>
              <ActivityIndicator color={s.accent} accessibilityLabel="正在处理云备份"/>
              <Text style={{flex:1,color:s.muted,fontSize:13}}>{state.busy==='restore'?'正在恢复本机数据…':state.busy==='configure'?'正在保存目录…':'正在连接备份目录…'}</Text>
              {!committing&&pill('取消云备份请求',()=>store.cancel())}
            </View>}
            {!!(message||state.error||state.message)&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{color:state.error?s.ink:s.accent,fontSize:13,fontWeight:'600',paddingHorizontal:4}}>{state.error||message||state.message}</Text>}
            {backup&&<View key={preview!.file.path} onLayout={()=>settingsScroll.current?.scrollToEnd({animated:true})} testID="cloud-backup-preview" style={[{gap:8,padding:15,borderWidth:1,borderColor:s.accent+'44',borderRadius:20,backgroundColor:s.card},s.cardShadow]}>
              <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>备份恢复预览</Text>
              <Text style={{color:s.muted,fontSize:12.5}}>导出时间：{backup.exportedAt.slice(0,80)}</Text>
              <Text style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>歌单 {backup.library.playlists.length} · 收藏 {backup.library.favorites.length} · 历史 {backup.library.history.length} · 统计 {backup.statistics?.items.length??0}</Text>
              <Text style={{color:s.muted,fontSize:12}}>{backup.settings?`设置：包含 · EQ预设 ${backup.settings.preferences.eqPresets.length} · 单曲歌词偏移 ${Object.keys(backup.settings.preferences.lyricOffsets).length}`:'设置：旧备份未包含，恢复时保留当前设置'}</Text>
              <Text style={{color:s.muted,fontSize:12}}>{preview!.digestVerified?'内容摘要与格式已验证':'仅验证格式；此旧命名文件无内容摘要'}</Text>
              <View style={{alignSelf:'flex-start',marginTop:4}}>{pill('恢复此云备份',confirmRestore,busy||!saved,'cloud-backup-restore',true)}</View>
            </View>}
          </ScrollView>
          <Text style={{color:s.muted,fontSize:13,fontWeight:'600',paddingHorizontal:4}}>备份版本 · {state.files.length}</Text>
          <FlatList data={state.files.slice(0,visible)} keyExtractor={file=>file.path} initialNumToRender={10} windowSize={5} contentContainerStyle={{gap:8,paddingBottom:16}} ListEmptyComponent={<View style={{padding:18,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,alignItems:'center'}}><Text style={{color:s.muted,fontSize:13}}>刷新后查看此目录的JSON备份</Text></View>} renderItem={({item,index})=><View style={[{gap:8,padding:14,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>
            <Text numberOfLines={2} style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>{item.name}</Text>
            <Text style={{color:s.muted,fontSize:11.5}}>{item.bytes===undefined?'大小未知':`${Math.ceil(item.bytes/1024)} KiB`} · {item.digest?'含内容摘要':'旧命名，需验证格式'}</Text>
            <View style={{alignSelf:'flex-start'}}>{pill('下载并预览此备份',()=>{void perform(()=>store.preview(item));},busy||!saved,`cloud-backup-preview-${index}`)}</View>
          </View>}/>
          {state.files.length>visible&&pill('显示更多云备份',()=>setVisible(count=>count+20),busy)}
        </View>
      </View>
    </Modal>
  </View>;
}
