import {useEffect,useLayoutEffect,useState,useSyncExternalStore} from 'react';
import {AppState,Pressable,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export function QQAccountTransferCard({services,active,disabled}:{services:Services;active:boolean;disabled:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const state=useSyncExternalStore(services.qqAccountTransfer.subscribe,services.qqAccountTransfer.getSnapshot);
  const [open,setOpen]=useState(false),[code,setCode]=useState('');
  const busy=['scanning','connecting','verifying','confirm','saving'].includes(state.status);
  const close=()=>{services.qqAccountTransfer.cancel();setCode('');setOpen(false);};
  useLayoutEffect(()=>{if(!active){services.qqAccountTransfer.cancel();setCode('');setOpen(false);}},[active,services]);
  useEffect(()=>{const sub=AppState.addEventListener('change',value=>{if(value==='background'){services.qqAccountTransfer.cancel();setCode('');}});return()=>{sub.remove();services.qqAccountTransfer.cancel();};},[services]);
  const start=(scan:boolean)=>{const value=code;setCode('');void services.qqAccountTransfer.connect(scan?undefined:value.trim());};
  const message=state.status==='confirm'?'已取得音乐账号资料，请核对后确认':state.status==='scanning'?'正在扫描电脑配对码':state.status==='connecting'?'正在连接自己的电脑':state.status==='verifying'?'正在验证官方音乐账号':state.status==='saving'?'正在保存登录':state.status==='succeeded'?'账号已保存，可在音乐库选择该账号获取私人雷达，或读取账号歌单':state.status==='cancelled'?'电脑配对已取消':state.status==='expired'?'配对已过期，请在电脑重新生成':state.status==='failed'?(state.reason==='camera'?'无法使用相机，仍可直接粘贴电脑配对码连接。':state.reason==='storage'?'未能完成账号保存，请重新配对后再试。':'未能验证配对。请检查同一局域网连接，并在电脑重新生成配对码。'):'';
  const wxTint=s.dark?'rgba(7,193,96,0.16)':'rgba(7,193,96,0.11)';
  const wxInk=s.dark?'#5EE0A0':'#079C4D';

  return <View style={{paddingHorizontal:16,paddingVertical:14,gap:10,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <View style={{width:30,height:30,borderRadius:9,backgroundColor:wxTint,alignItems:'center',justifyContent:'center'}}>
        <Ionicons name="laptop-outline" size={16} color={wxInk}/>
      </View>
      <View style={{flex:1,minWidth:0,gap:2}}>
        <Text style={{fontSize:14.5,fontWeight:'700',color:s.ink}}>微信登录（电脑配对）</Text>
        <Text style={{fontSize:12,lineHeight:17,color:s.muted}}>在自己的电脑完成官方微信授权，通过同一局域网导入。</Text>
      </View>
    </View>
    <Pressable testID="qq-transfer-open" accessibilityRole="button" accessibilityLabel="微信登录（电脑配对）" disabled={disabled||busy} onPress={()=>{setCode('');setOpen(true);}} style={{alignSelf:'flex-start',minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',gap:6,opacity:disabled||busy?.5:1}}>
      <Ionicons name="qr-code-outline" size={15} color={wxInk}/>
      <Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>微信登录（电脑配对）</Text>
    </Pressable>

    <SheetModal allowSwipeDismissal visible={open} onRequestClose={close}>
      <SafeAreaView style={{flex:1,backgroundColor:s.sheetGradient[0]}} edges={['bottom']}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.subtle+'66',marginTop:10}}/>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:12}}>
          <Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700',color:s.ink}}>连接电脑音乐账号</Text>
          <Pressable testID="qq-transfer-close" accessibilityRole="button" accessibilityLabel="关闭电脑配对" onPress={close} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}>
            <View style={{width:34,height:34,borderRadius:17,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}>
              <Ionicons name="close" size={19} color={s.ink}/>
            </View>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:36,gap:14}} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
          <View style={[{borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,gap:8},s.cardShadow]}>
            <Text style={{fontSize:14,lineHeight:21,color:s.ink}}>在支持此配对协议的 Q-music 电脑端，进入音乐账号管理，用微信登录 QQ 音乐后选择“连接手机”。两端连接同一局域网。</Text>
            <Text style={{fontSize:12,lineHeight:18,color:s.muted}}>配对码包含短时连接密钥，仅用于自己的设备。不要发送给他人；过期或领取失败时请在电脑重新生成。音枢不自动读取剪贴板，也不通过云端中转。</Text>
          </View>
          <View style={[{borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,gap:12},s.cardShadow]}>
            <Pressable testID="qq-transfer-scan" accessibilityRole="button" accessibilityLabel="扫描电脑二维码" disabled={busy||disabled} onPress={()=>start(true)} style={{minHeight:46,borderRadius:23,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:busy||disabled?.5:1}}>
              <Ionicons name="scan-outline" size={18} color="#FFFFFF"/>
              <Text style={{fontSize:15,fontWeight:'700',color:'#FFFFFF'}}>扫描电脑二维码</Text>
            </Pressable>
            <TextInput testID="qq-transfer-code" accessibilityLabel="电脑配对码" value={code} onChangeText={setCode} placeholder="或在此粘贴电脑配对码" placeholderTextColor={s.subtle} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={1024} editable={!busy} style={{minHeight:46,borderWidth:1,borderColor:s.cardBorder,borderRadius:14,paddingHorizontal:14,color:s.ink,backgroundColor:s.inputBg,fontSize:14.5}}/>
            <Pressable testID="qq-transfer-connect" accessibilityRole="button" accessibilityLabel="连接并验证账号" disabled={busy||disabled||!code.trim()} onPress={()=>start(false)} style={{minHeight:44,borderRadius:22,backgroundColor:s.accentSoft,borderWidth:1,borderColor:s.control+'44',alignItems:'center',justifyContent:'center',opacity:busy||disabled||!code.trim()?.45:1}}>
              <Text style={{fontSize:14.5,fontWeight:'700',color:s.control}}>连接并验证账号</Text>
            </Pressable>
            {busy&&<Pressable testID="qq-transfer-cancel" accessibilityRole="button" accessibilityLabel="取消电脑配对" onPress={()=>{services.qqAccountTransfer.cancel();setCode('');}} style={{minHeight:40,borderRadius:20,backgroundColor:s.chip,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13.5,fontWeight:'600',color:s.ink}}>取消电脑配对</Text></Pressable>}
          </View>
          {state.status==='confirm'&&<View testID="qq-transfer-confirmation" style={[{padding:16,gap:10,borderRadius:18,backgroundColor:s.card,borderWidth:1.5,borderColor:s.control+'66'},s.cardShadow]}>
            <Text style={{fontSize:16,fontWeight:'700',color:s.ink}}>{state.name}</Text>
            <Text style={{fontSize:12.5,color:s.muted}}>{state.hint}</Text>
            <Text style={{fontSize:12,lineHeight:18,color:s.muted}}>请核对账号后确认。凭据仅存本机，不导入歌单或开放账号播放。不同身份的原账号保留；更新同一账号会替换登录状态并清除原独立日推授权。</Text>
            <Pressable testID="qq-transfer-confirm" accessibilityRole="button" accessibilityLabel="确认使用此账号" onPress={()=>{void services.qqAccountTransfer.confirm();}} style={{minHeight:44,borderRadius:22,backgroundColor:s.control,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:14.5,fontWeight:'700',color:'#FFFFFF'}}>确认使用此账号</Text></Pressable>
          </View>}
          {!!message&&<View style={{padding:12,borderRadius:14,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}><Text testID={`qq-transfer-${state.status}`} accessibilityLiveRegion="polite" style={{fontSize:13,lineHeight:19,color:state.status==='failed'?s.accent:s.muted}}>{message}</Text></View>}
        </ScrollView>
      </SafeAreaView>
    </SheetModal>
  </View>;
}
