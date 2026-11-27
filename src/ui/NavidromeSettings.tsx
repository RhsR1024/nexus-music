import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import { useState, useSyncExternalStore } from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import type { Services } from '../app/services.ts';
import { NavidromeError } from '../providers/navidrome.ts';
import {CredentialStorageError} from '../providers/navidromeAccounts.ts';
export function NavidromeSettings({services}:{services:Services}) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const accounts=useSyncExternalStore(services.accounts.subscribe,services.accounts.getSnapshot);
  const [url,setURL]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function perform(run:()=>Promise<void>) {
    setBusy(true);setMessage('');try{await run();}catch(error){setMessage(error instanceof NavidromeError||error instanceof CredentialStorageError?error.message:'操作未完成，请检查连接配置或本机凭据存储');}finally{setBusy(false);}
  }
  const button=(label:string,action:()=>void,disabled=busy,accessibilityLabel=label)=><Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={action} style={[styles.button,disabled&&{opacity:.4}]}><Text style={styles.text}>{label}</Text></Pressable>;
  return <View style={[styles.card,sollinTokens(theme.mode,theme.palette.accent,theme.appearance).cardShadow]}>
    <Text style={styles.title}>Navidrome 私人曲库</Text><Text style={styles.caption}>连接自己的 Subsonic / Navidrome 服务器。密码保存在本机钥匙串；支持星标与服务端歌单编辑。</Text>
    {accounts.map(account=><View key={account.id} style={styles.account}>
      <Text style={styles.text}>{account.username}</Text><Text style={styles.caption}>{account.url}</Text>
      <View style={styles.row}>
        {button('测试连接',()=>{void perform(async()=>{const result=await(await services.accounts.client(account.id)).connect();setMessage(`连接成功 · ${result.serverType||'Subsonic'} ${result.serverVersion||result.protocolVersion}`);});})}
        {button('修改凭据',()=>{setURL(account.url);setUsername(account.username);setPassword('');})}
        {button('移除连接',()=>Alert.alert('移除此连接？','本机凭据会删除；收藏与歌单中的歌曲记录仍保留。',[{text:'取消',style:'cancel'},{text:'移除',style:'destructive',onPress:()=>{void perform(async()=>{await services.accounts.remove(account.id);setMessage('连接与凭据已移除');});}}]),busy,`移除连接：${account.username}`)}
      </View>
    </View>)}
    <TextInput accessibilityLabel="Navidrome服务器地址" placeholder="http(s)://服务器:端口/路径" placeholderTextColor="#768191" value={url} onChangeText={setURL} style={styles.input} keyboardType="url" textContentType="URL" autoCapitalize="none" autoCorrect={false} editable={!busy}/>
    <TextInput accessibilityLabel="Navidrome用户名" placeholder="用户名" placeholderTextColor="#768191" value={username} onChangeText={setUsername} style={styles.input} textContentType="username" autoCapitalize="none" autoCorrect={false} editable={!busy}/>
    <TextInput accessibilityLabel="Navidrome密码" placeholder="密码（仅保存在本机）" placeholderTextColor="#768191" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} textContentType="password" autoCapitalize="none" autoCorrect={false} editable={!busy}/>
    {button(busy?'连接中…':'验证并保存连接',()=>{void perform(async()=>{
      const result=await services.accounts.connect(url,username,password);setPassword('');setMessage(`连接成功 · ${result.info.serverType||'Subsonic'} ${result.info.serverVersion||result.info.protocolVersion}`);
    });},busy||!url.trim()||!username.trim()||!password)}
    {!!message&&<Text accessibilityLiveRegion="polite" style={styles.caption}>{message}</Text>}
  </View>;
}
const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return StyleSheet.create({card:{marginTop:10,padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},title:{color:s.ink,fontSize:17,fontWeight:'700'},caption:{color:s.muted,fontSize:12,lineHeight:18},text:{color:s.ink,fontSize:13,fontWeight:'600'},button:{backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,borderRadius:19,paddingHorizontal:14,paddingVertical:10},row:{flexDirection:'row',flexWrap:'wrap',gap:8},input:{color:s.ink,backgroundColor:s.inputBg,borderColor:s.cardBorder,borderWidth:1,borderRadius:14,paddingHorizontal:14,paddingVertical:11,fontSize:13},account:{borderBottomWidth:StyleSheet.hairlineWidth,borderColor:s.hairline,paddingBottom:12,gap:6}});
};
