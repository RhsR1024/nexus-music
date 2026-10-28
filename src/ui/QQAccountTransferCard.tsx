import {useEffect,useLayoutEffect,useState,useSyncExternalStore} from 'react';
import {AppState,Pressable,ScrollView,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import {SheetModal} from './AdaptiveModal.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';
export function QQAccountTransferCard({services,active,disabled}:{services:Services;active:boolean;disabled:boolean}){
  const {palette:p}=useTheme(),state=useSyncExternalStore(services.qqAccountTransfer.subscribe,services.qqAccountTransfer.getSnapshot);
  const [open,setOpen]=useState(false),[code,setCode]=useState('');
  const busy=['scanning','connecting','verifying','confirm','saving'].includes(state.status);
  const close=()=>{services.qqAccountTransfer.cancel();setCode('');setOpen(false);};
  useLayoutEffect(()=>{if(!active){services.qqAccountTransfer.cancel();setCode('');setOpen(false);}},[active,services]);
  useEffect(()=>{const sub=AppState.addEventListener('change',value=>{if(value==='background'){services.qqAccountTransfer.cancel();setCode('');}});return()=>{sub.remove();services.qqAccountTransfer.cancel();};},[services]);
  const button=(id:string,label:string,run:()=>void,locked=false)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={locked} onPress={run} style={{minHeight:controls.hit,paddingHorizontal:space.md,borderRadius:radius.md,backgroundColor:p.selected,justifyContent:'center',opacity:locked?.5:1}}><Text style={{...typography.body,color:p.accent}}>{label}</Text></Pressable>;
  const start=(scan:boolean)=>{const value=code;setCode('');void services.qqAccountTransfer.connect(scan?undefined:value.trim());};
  const message=state.status==='confirm'?'已取得音乐账号资料，请核对后确认':state.status==='scanning'?'正在扫描电脑配对码':state.status==='connecting'?'正在连接自己的电脑':state.status==='verifying'?'正在验证官方音乐账号':state.status==='saving'?'正在保存登录':state.status==='succeeded'?'账号已保存，可在音乐库选择该账号获取私人雷达，或读取账号歌单':state.status==='cancelled'?'电脑配对已取消':state.status==='expired'?'配对已过期，请在电脑重新生成':state.status==='failed'?(state.reason==='camera'?'无法使用相机，仍可直接粘贴电脑配对码连接。':state.reason==='storage'?'未能完成账号保存，请重新配对后再试。':'未能验证配对。请检查同一局域网连接，并在电脑重新生成配对码。'):'';
  return <View style={{padding:space.lg,gap:space.md,borderTopWidth:1,borderColor:p.border}}>
    {button('qq-transfer-open','微信登录（电脑配对）',()=>{setCode('');setOpen(true);},disabled||busy)}
    <Text style={{...typography.caption,color:p.secondary}}>在自己的电脑完成官方微信授权，再通过同一局域网导入音乐账号。</Text>
    <SheetModal visible={open} onRequestClose={close}>
      <SafeAreaView style={{flex:1,backgroundColor:p.surface}}>
        <View style={{padding:space.lg,gap:space.md}}><Text style={{...typography.title,color:p.text}}>连接电脑音乐账号</Text>{button('qq-transfer-close','关闭电脑配对',close)}</View>
        <ScrollView contentContainerStyle={{padding:space.lg,gap:space.md}} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Text style={{...typography.body,color:p.text}}>在支持此配对协议的 Q-music 电脑端，进入音乐账号管理，用微信登录 QQ 音乐后选择“连接手机”。两端连接同一局域网。</Text>
          <Text style={{...typography.caption,color:p.secondary}}>配对码包含短时连接密钥，仅用于自己的设备。不要发送给他人；过期或领取失败时请在电脑重新生成。音枢不自动读取剪贴板，也不通过云端中转。</Text>
          {button('qq-transfer-scan','扫描电脑二维码',()=>start(true),busy||disabled)}
          <TextInput testID="qq-transfer-code" accessibilityLabel="电脑配对码" value={code} onChangeText={setCode} placeholder="或在此粘贴电脑配对码" placeholderTextColor={p.secondary} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={1024} editable={!busy} style={{...typography.body,minHeight:controls.hit,borderWidth:1,borderColor:p.border,borderRadius:radius.md,padding:space.md,color:p.text,backgroundColor:p.surface}}/>
          {button('qq-transfer-connect','连接并验证账号',()=>start(false),busy||disabled||!code.trim())}
          {busy&&button('qq-transfer-cancel','取消电脑配对',()=>{services.qqAccountTransfer.cancel();setCode('');})}
          {state.status==='confirm'&&<View testID="qq-transfer-confirmation" style={{padding:space.lg,gap:space.md,borderRadius:radius.md,backgroundColor:p.surface}}>
            <Text style={{...typography.body,color:p.text}}>{state.name}</Text><Text style={{...typography.caption,color:p.secondary}}>{state.hint}</Text>
            <Text style={{...typography.caption,color:p.secondary}}>请核对账号后确认。凭据仅存本机，不导入歌单或开放账号播放。不同身份的原账号保留；更新同一账号会替换登录状态并清除原独立日推授权。</Text>
            {button('qq-transfer-confirm','确认使用此账号',()=>{void services.qqAccountTransfer.confirm();})}
          </View>}
          {!!message&&<Text testID={`qq-transfer-${state.status}`} accessibilityLiveRegion="polite" style={{...typography.body,color:p.secondary}}>{message}</Text>}
        </ScrollView>
      </SafeAreaView>
    </SheetModal>
  </View>;
}
