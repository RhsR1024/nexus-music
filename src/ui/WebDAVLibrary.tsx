import {Text,TextInput} from './Typography.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {WebDAVError,type DAVEntry} from '../providers/webdav.ts';
import {isDAVAudio} from '../providers/webdavMedia.ts';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {useTheme} from './theme.tsx';
type Row={entry:DAVEntry;track?:Track;cover?:string};
export function WebDAVLibrary({services}:{services:Services}){
  const {palette:p}=useTheme(),accounts=useSyncExternalStore(services.davAccounts.subscribe,services.davAccounts.getSnapshot);
  const [open,setOpen]=useState(false),[manage,setManage]=useState(false),[accountId,setAccountId]=useState(accounts[0]?.id??''),[path,setPath]=useState('');
  const [rows,setRows]=useState<Row[]>([]),[visible,setVisible]=useState(20),[query,setQuery]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [url,setURL]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[label,setLabel]=useState(''),[adding,setAdding]=useState<readonly Track[]>();
  const revision=useRef(0),pending=useRef(new AbortController()),inspecting=useRef(new Set<string>());
  useEffect(()=>{if(!accounts.some(item=>item.id===accountId)){setAccountId(accounts[0]?.id??'');setPath('');setRows([]);}},[accounts,accountId]);
  async function scan(values:Row[],signal:AbortSignal,generation:number){
    let index=0;const worker=async()=>{while(index<values.length&&!signal.aborted){const row=values[index++]!,key=`${generation}:${row.entry.path}`;if(!row.track||row.track.metadata.davMetadata!=='pending'||inspecting.current.has(key))continue;inspecting.current.add(key);
      let next:Row;try{const result=await services.davMedia.inspectTrack(row.track,signal);next={entry:row.entry,track:result.track,cover:result.metadata.artwork};}
      catch{if(signal.aborted)return;next={entry:row.entry,track:{...row.track,metadata:{...row.track.metadata,davMetadata:'failed'}}};}
      finally{inspecting.current.delete(key);}
      if(generation===revision.current&&!signal.aborted)setRows(current=>current.map(item=>item.entry.path===row.entry.path?next:item));
    }};await Promise.all([worker(),worker()]);
  }
  async function load(){
    const generation=++revision.current;pending.current.abort();const abort=new AbortController();pending.current=abort;setLoading(true);setMessage('');
    try{const entries=await(await services.davAccounts.client(accountId)).list(path,abort.signal);
      if(generation!==revision.current||abort.signal.aborted)return;
      const values=entries.filter(entry=>entry.directory||isDAVAudio(entry)).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name,'zh')).map(entry=>({entry,...(!entry.directory?{track:services.davMedia.track(accountId,entry)}:{})}));
      setRows(values);setVisible(20);setLoading(false);void scan(values.slice(0,20),abort.signal,generation);
    }catch(error){if(generation===revision.current&&!abort.signal.aborted)setMessage(error instanceof WebDAVError?error.message:'无法读取WebDAV目录，请重试');}
    finally{if(generation===revision.current)setLoading(false);}
  }
  useEffect(()=>{setRows([]);setQuery('');if(open&&accountId&&!manage)void load();return()=>{revision.current++;pending.current.abort();};},[open,accountId,path,manage]);
  const button=(text:string,run:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={run} style={{padding:12,borderRadius:14,backgroundColor:p.selected,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{text}</Text></Pressable>;
  const input=(name:string,value:string,setValue:(value:string)=>void,secret=false)=><TextInput accessibilityLabel={name} placeholder={name} placeholderTextColor={p.secondary} value={value} onChangeText={setValue} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} editable={!busy} style={{padding:12,borderRadius:14,borderColor:p.border,borderWidth:1,color:p.text}}/>;
  const showManage=manage||!accounts.length;
  const filtered=rows.filter(row=>!query.trim()||`${row.entry.name} ${row.track?.title??''} ${row.track?.artist??''} ${row.track?.album??''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(()=>{if(!open||showManage||!query.trim())return;const timer=setTimeout(()=>{void scan(filtered.slice(0,visible),pending.current.signal,revision.current);},300);return()=>clearTimeout(timer);},[query,open,showManage]);
  return <View style={{marginBottom:18}}>{button(`WebDAV · ${accounts.length}个连接`,()=>{setManage(false);setOpen(true);})}
    <Modal visible={open} onRequestClose={()=>setOpen(false)} animationType="slide"><View style={{flex:1,padding:22,paddingTop:64,gap:12,backgroundColor:p.background[0]}}>
      {button('收起WebDAV',()=>setOpen(false))}<Text style={{fontSize:30,fontWeight:'700',color:p.text}}>WebDAV音乐</Text>
      {button(showManage?'返回WebDAV目录':'管理WebDAV连接',()=>setManage(!showManage),!accounts.length&&showManage)}
      {showManage?<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,paddingBottom:32}}>
        <Text style={{color:p.secondary,lineHeight:20}}>连接自己的音乐目录，密码保存在本机Keychain。支持Basic认证；只读取配置根目录内的音频。</Text>
        {accounts.map(account=><View key={account.id} style={{gap:8,padding:12,borderRadius:16,backgroundColor:p.surface}}><Text style={{color:p.text}}>{account.label} · {account.username}</Text><Text style={{color:p.secondary,fontSize:12}}>{account.url}</Text>
          <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{button('修改WebDAV凭据',()=>{setURL(account.url);setUsername(account.username);setLabel(account.label);setPassword('');},busy)}{button(`移除WebDAV连接：${account.label}`,()=>Alert.alert('移除WebDAV连接？','停止当前WebDAV播放并删除本机凭据，歌单中的引用仍保留。',[{text:'取消',style:'cancel'},{text:'移除',style:'destructive',onPress:()=>{setBusy(true);void services.davAccounts.remove(account.id).then(()=>setMessage('WebDAV连接与凭据已移除')).catch(()=>setMessage('移除失败，原连接保留')).finally(()=>setBusy(false));}}]),busy)}</View>
        </View>)}
        {input('WebDAV服务器根目录',url,setURL)}{input('WebDAV用户名',username,setUsername)}{input('WebDAV密码',password,setPassword,true)}{input('WebDAV连接名称',label,setLabel)}
        {button(busy?'验证WebDAV中…':'验证并保存WebDAV',()=>{setBusy(true);setMessage('');void services.davAccounts.connect(url,username,password,label).then(result=>{setPassword('');setAccountId(result.account.id);setPath('');setManage(false);setMessage('WebDAV连接成功');}).catch(error=>setMessage(error instanceof WebDAVError?error.message:'WebDAV连接未保存，请检查本机凭据存储')).finally(()=>setBusy(false));},busy||!url.trim()||!username.trim()||!password)}
      </ScrollView>:<>
        <ScrollView horizontal style={{flexGrow:0}} contentContainerStyle={{gap:8}}>{accounts.map(account=><View key={account.id}>{button(`${account.id===accountId?'● ':''}${account.label}`,()=>{setAccountId(account.id);setPath('');})}</View>)}</ScrollView>
        <Text numberOfLines={2} style={{color:p.secondary,fontSize:12}}>{path?decodeURIComponent(path):'根目录'} · {filtered.length}项</Text>
        <View style={{flexDirection:'row',gap:10}}>{button('刷新WebDAV目录',()=>{void load();},loading)}{path&&button('返回上级目录',()=>setPath(path.replace(/[^/]+\/$/,'')),loading)}</View>
        <TextInput accessibilityLabel="搜索当前WebDAV目录" placeholder="搜索当前目录已读取的歌曲、艺术家" placeholderTextColor={p.secondary} value={query} onChangeText={setQuery} style={{padding:12,color:p.text,borderColor:p.border,borderWidth:1,borderRadius:14}}/>
        <FlatList data={filtered.slice(0,visible)} keyExtractor={row=>row.entry.path} initialNumToRender={12} windowSize={5} ListEmptyComponent={!loading?<Text style={{color:p.secondary}}>此目录没有匹配的文件夹或支持的音频</Text>:null} renderItem={({item})=><View style={{paddingVertical:14,gap:10,borderBottomWidth:1,borderColor:p.border}}>
          {item.entry.directory?button(`文件夹：${item.entry.name}`,()=>setPath(item.entry.path)):<>
            <Pressable accessibilityRole="button" testID={`webdav-track-${item.entry.path}`} accessibilityState={{disabled:item.track?.metadata.davMetadata==='pending'}} disabled={item.track?.metadata.davMetadata==='pending'} onPress={()=>{const tracks=filtered.flatMap(row=>row.track?[row.track]:[]);const index=tracks.findIndex(track=>track.origin.id===item.entry.path);services.playTracks(tracks,index);}} style={{flexDirection:'row',alignItems:'center',gap:12}}>
              {item.cover?<Image source={{uri:item.cover}} style={{width:54,height:54,borderRadius:12}}/>:<Text style={{fontSize:30,color:p.secondary}}>♫</Text>}<View style={{flex:1}}><Text style={{color:p.text,fontWeight:'600'}}>{item.track?.title}</Text><Text style={{color:p.secondary,fontSize:12}}>{item.track?.artist} · {item.track?.album}</Text><Text style={{color:p.secondary,fontSize:11}}>{item.track?.metadata.davMetadata==='pending'?'读取远程标签…':item.track?.metadata.davMetadata==='read'?(item.track.metadata.davTitleFromFile?'已读取音频信息 · 标题按文件名显示':'已读取远程音频标签'):'按文件名显示 · 标签未能读取，可刷新重试'}</Text></View>
            </Pressable>
            <View style={{flexDirection:'row',gap:10}}>{button('收藏WebDAV歌曲',()=>{void services.library.favorite(item.track!).catch(()=>setMessage('收藏未保存'));})}{button('加入歌单',()=>setAdding([item.track!]))}</View>
          </>}
        </View>}/>
        {filtered.length>visible&&button('显示更多WebDAV项目',()=>{const next=visible+20;setVisible(next);void scan(filtered.slice(visible,next),pending.current.signal,revision.current);})}
      </>}
      {loading&&<ActivityIndicator accessibilityLabel="读取WebDAV目录" color={p.accent}/>}{!!message&&<Text accessibilityRole="alert" style={{color:p.accent}}>{message}</Text>}
      <PlaylistPicker services={services} tracks={adding??[]} visible={!!adding} onClose={()=>setAdding(undefined)}/>
    </View></Modal>
  </View>;
}
