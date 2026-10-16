import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
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
  return <View style={styles.card}>
    <Text style={styles.title}>Navidrome</Text><Text style={styles.caption}>连接自己的曲库。密码保存在本机Keychain；支持星标与服务端歌单编辑。</Text>
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
const makeStyles=(theme:Theme)=>StyleSheet.create({card:{marginTop:24,padding:18,borderRadius:20,backgroundColor:theme.color('#1D222B'),gap:12},title:{color:theme.color('#ECEBF3'),fontSize:18,fontWeight:'600'},caption:{color:theme.color('#929CAB'),fontSize:11,lineHeight:20},text:{color:theme.color('#D9E1CE'),fontSize:12},button:{backgroundColor:theme.color('#303A32'),borderRadius:10,padding:12},row:{flexDirection:'row',flexWrap:'wrap',gap:8},input:{color:theme.color('#EEECE7'),borderColor:theme.color('#414754'),borderWidth:1,borderRadius:11,padding:12,fontSize:13},account:{borderBottomWidth:1,borderColor:theme.color('#343B49'),paddingBottom:14,gap:8}});
