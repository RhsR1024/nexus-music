import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,Keyboard,Pressable,ScrollView,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text,TextInput} from './Typography.tsx';
import {controls,radius,space,typography} from './tokens.ts';
import {useTheme} from './theme.tsx';
import {scanFolderKey,type ScanRoot} from '../domain/localScan.ts';
import type {LocalAudioStore} from '../storage/localAudio.ts';

export function LocalScanSettings({store,visible,onClose}:{store:LocalAudioStore;visible:boolean;onClose:()=>void}){
  const state=useSyncExternalStore(store.subscribe,store.getScanSnapshot),{palette:p}=useTheme(),insets=useSafeAreaInsets();
  const [roots,setRoots]=useState<readonly ScanRoot[]>([]),[minimum,setMinimum]=useState('0'),[blocked,setBlocked]=useState<readonly string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[recursive,setRecursive]=useState(true);
  useEffect(()=>{if(visible){setRoots(state.roots);setMinimum(String(state.minimumSeconds));setBlocked(state.blocked);setMessage('');}},[visible]);
  if(!visible)return null;
  const button=(label:string,action:()=>void,id?:string,selected?:boolean)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected,disabled:busy}} disabled={busy} onPress={action} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:selected?p.selected:p.surface,justifyContent:'center'}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  const rules=(values=roots)=>({roots:values,minimumSeconds:minimum.trim()===''?NaN:Number(minimum),blocked:blocked.filter(key=>values.some(root=>key.startsWith(root.id+'/')))});
  async function run(action:()=>Promise<string>){if(busy)return;Keyboard.dismiss();setBusy(true);setMessage('');try{setMessage(await action());}catch(error){setMessage(error instanceof Error?error.message:'扫描操作未完成，原索引保留');}finally{setBusy(false);}}
  function summary(result:{count:number;unreadable:number}){return `扫描完成 · ${result.count} 首${result.unreadable?` · ${result.unreadable} 个文件无法读取，原有引用保留`:''}`;}
  return <View accessibilityViewIsModal style={{position:'absolute',top:0,bottom:0,left:0,right:0,padding:space.xl,paddingTop:insets.top+space.md,paddingBottom:insets.bottom+space.md,backgroundColor:p.background[0],gap:space.md}}>
    {button('返回本地音频',onClose,'local-scan-close')}
    <Text style={{...typography.title,color:p.text}}>文件夹与扫描</Text>
    <ScrollView testID="local-scan-viewport" style={{flex:1}} keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:space.md,paddingBottom:space.xxl}}>
      <Text style={{...typography.caption,color:p.secondary}}>只读取你授权的目录，音频复制到此设备。移除目录或屏蔽文件夹后需重新扫描；不会删除原文件或正在播放的副本。</Text>
      {!!message&&<Text testID="local-scan-message" accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
      {busy&&<ActivityIndicator accessibilityLabel="正在扫描本地目录" color={p.accent}/>}
      {button(recursive?'新目录：包含子目录':'新目录：仅当前文件夹',()=>setRecursive(value=>!value),'local-scan-recursive',recursive)}
      {button('添加文件夹并扫描',()=>{void run(async()=>{const picked=await store.pickFolder();if(!picked)return '已取消，目录和索引保留';const next=[...roots.filter(root=>root.id!==picked.id),{...picked,recursive}];await store.saveScanRules(rules(next));setRoots(next);return summary(await store.rescan());});},'local-scan-add')}
      {button('重新扫描',()=>{void run(async()=>summary(await store.rescan()));},'local-scan-rescan')}
      <Text testID="local-scan-pending" style={{...typography.caption,color:p.secondary}}>{state.dirty?'已保存的目录或规则有变化，请重新扫描':'当前索引已按保存的规则扫描'}</Text>
      <Text style={{...typography.heading,color:p.text}}>扫描目录</Text>
      {!roots.length&&<Text style={{color:p.secondary}}>尚未添加文件夹</Text>}
      {roots.map((root,index)=><View key={root.id} style={{gap:space.sm,borderBottomWidth:1,borderBottomColor:p.border,paddingBottom:space.md}}>
        <Text style={{color:p.text}}>{root.name}</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>
          {button(root.recursive?'包含子目录':'仅当前目录',()=>setRoots(values=>values.map(item=>item.id===root.id?{...item,recursive:!item.recursive}:item)),`local-scan-root-recursive-${index}`,root.recursive)}
          {button('移除此扫描目录',()=>setRoots(values=>values.filter(item=>item.id!==root.id)),`local-scan-root-remove-${index}`)}
        </View>
      </View>)}
      <Text style={{...typography.heading,color:p.text}}>屏蔽低于多少秒的音频</Text>
      <TextInput accessibilityLabel="扫描最小时长秒" value={minimum} onChangeText={setMinimum} editable={!busy} keyboardType="decimal-pad" placeholder="0 表示不过滤时长" style={{minHeight:controls.hit,padding:space.md,color:p.text,borderWidth:1,borderColor:p.border,borderRadius:radius.md}}/>
      <Text style={{...typography.heading,color:p.text}}>屏蔽文件夹</Text>
      <Text style={{...typography.caption,color:p.secondary}}>目录会在首次扫描后列出，屏蔽同时作用于其子目录。</Text>
      {state.folders.filter(folder=>roots.some(root=>root.id===folder.rootId)).map((folder,index)=>{const key=scanFolderKey(folder),active=blocked.includes(key);return <View key={key} style={{gap:space.sm}}><Text style={{color:p.text}}>{folder.rootName}{folder.path?` / ${folder.path}`:''}</Text>{button(active?'已屏蔽 · 点击取消':'屏蔽此文件夹',()=>setBlocked(values=>active?values.filter(value=>value!==key):[...values,key]),`local-scan-block-${index}`,active)}</View>;})}
      {button('保存扫描规则',()=>{void run(async()=>{await store.saveScanRules(rules());return '规则已保存，重新扫描后生效';});},'local-scan-save')}
      <Text style={{...typography.caption,color:p.secondary}}>“重新扫描”使用已保存规则；未保存的编辑可返回放弃。授权失效时移除该目录，保存后重新添加。</Text>
    </ScrollView>
  </View>;
}
