import {Text,TextInput} from './Typography.tsx';
import {Cover} from './Cover.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {useThemedStyles,type Theme} from './theme.tsx';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {NavidromeBrowser} from '../app/navidromeBrowser.ts';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import type { Services } from '../app/services.ts';
import { NavidromeError,type NavidromeClient } from '../providers/navidrome.ts';
import { currentEntry } from '../domain/queue.ts';
import type { Track } from '../domain/track.ts';
export function NavidromeLibrary({services,openSettings}:{services:Services;openSettings:()=>void}) {
  const styles=useThemedStyles(makeStyles);
  const accounts=useSyncExternalStore(services.accounts.subscribe,services.accounts.getSnapshot);
  const [browser]=useState(()=>new NavidromeBrowser(id=>services.accounts.client(id)));
  const state=useSyncExternalStore(browser.subscribe,browser.getSnapshot);
  const {accountId,frame,parents,loading}=state;
  const {view,items,title,query,name,error,more,visiblePage}=frame;
  const [busy,setBusy]=useState(false),[adding,setAdding]=useState<readonly Track[]>([]);
  const writeGeneration=useRef(0);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  useEffect(()=>{
    writeGeneration.current++;setBusy(false);setAdding([]);
    browser.setAccount(accounts.some(item=>item.id===browser.getSnapshot().accountId)?browser.getSnapshot().accountId:accounts[0]?.id??'',true);
    return()=>{writeGeneration.current++;browser.cancel();};
  },[accounts,browser]);
  async function write(run:(client:NavidromeClient)=>Promise<void>,after?:()=>void,refresh=true) {
    const version=++writeGeneration.current;
    setBusy(true);browser.error('');
    try{const client=await services.accounts.client(accountId);if(version!==writeGeneration.current)return;await run(client);if(version===writeGeneration.current){after?.();if(refresh)await browser.load();}}
    catch(value){if(version===writeGeneration.current)browser.error(value instanceof NavidromeError?value.message:'服务器操作未完成，原内容保留');}
    finally{if(version===writeGeneration.current)setBusy(false);}
  }
  const button=(label:string,action:()=>void,disabled=busy)=><Pressable accessibilityRole="button" onPress={action} disabled={disabled||busy} style={[styles.button,(disabled||busy)&&{opacity:.4}]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const tracks=items.flatMap(item=>item.kind==='track'?[item.track]:[]);
  if(!accounts.length)return <View><Text style={styles.title}>私人曲库</Text><Text style={styles.caption}>连接Navidrome后，在这里浏览歌曲、专辑、歌手与服务端歌单。</Text>{button('前往连接设置',openSettings)}</View>;
  return <View>
    <Text style={styles.title}>私人曲库</Text>
    <View style={styles.row}>{accounts.map(account=><Pressable key={account.id} testID={`navidrome-account-${account.username}`} accessibilityState={{selected:account.id===accountId}} disabled={busy} onPress={()=>{setAdding([]);browser.setAccount(account.id);}} style={styles.button}><Text style={styles.buttonText}>{account.id===accountId?'● ':''}{account.username}</Text></Pressable>)}</View>
    <View style={styles.row}>{(['songs','albums','artists','playlists']as const).map((kind,index)=><View key={kind}>{button(['歌曲','专辑','歌手','服务端歌单'][index]!,()=>browser.selectRoot(kind))}</View>)}</View>
    {parents.length>0&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>browser.back()} style={[styles.button,{minHeight:44,justifyContent:'center',opacity:busy?0.4:1}]}><Text style={styles.buttonText}>返回{parents.at(-1)!.title}</Text></Pressable>}
    <Text testID="navidrome-browser-title" style={styles.heading}>{title}</Text>
    {view.kind==='songs'&&<View><TextInput accessibilityLabel="搜索私人曲库" value={query} onChangeText={value=>browser.setQuery(value)} onSubmitEditing={()=>browser.search()} placeholder="搜索自己的歌曲、歌手" placeholderTextColor="#768191" style={styles.input}/>{button('搜索私人曲库',()=>browser.search())}</View>}
    {tracks.length>0&&button('播放全部',()=>services.playTracks(tracks,0))}
    {(view.kind==='playlists'||view.kind==='playlist')&&<View>
      <TextInput accessibilityLabel="服务端歌单名称" value={name} onChangeText={value=>browser.setName(value)} placeholder="歌单名称" placeholderTextColor="#768191" style={styles.input}/>
      <View style={styles.row}>{button(view.kind==='playlist'?'保存歌单名':'创建服务端歌单',()=>{void write(async client=>{if(view.kind==='playlist')await client.renamePlaylist(view.id,name.trim());else await client.savePlaylist(name.trim(),[]);},()=>{if(view.kind==='playlist')browser.renameSavedPlaylist(view.id,name.trim());});},busy||!name.trim())}
      {view.kind==='playlist'&&button('删除服务端歌单',()=>Alert.alert('删除服务端歌单？','此操作会写回你的服务器。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void write(async client=>{await client.deletePlaylist(view.id!);},()=>browser.selectRoot('playlists'));}}]))}</View>
      {view.kind==='playlist'&&button('加入当前播放歌曲',()=>{void write(async client=>{
        const current=currentEntry(services.playback.controller.getSnapshot().queue)?.track;
        if(current?.origin.kind!=='navidrome'||current.origin.accountId!==accountId)throw new NavidromeError('protocol');
        await client.changePlaylist(view.id!,[current.origin.id],[]);
      });})}
    </View>}
    {items.slice(visiblePage*50,(visiblePage+1)*50).map((item,relativeIndex)=>{
      const index=visiblePage*50+relativeIndex;
      if(item.kind==='track') {const track=item.track;return <View key={`${index}-${track.origin.id}`} style={styles.item}>
        <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)}><Text style={styles.track}>{track.title}</Text><Text style={styles.caption}>{track.artist} · {track.album}</Text></Pressable>
        <View style={styles.row}>
          {button(track.metadata.starred?'取消服务端星标':'服务端星标',()=>{void write(async client=>{await client.star(track.origin.id,!track.metadata.starred);},()=>browser.setStarred(track.origin.id,!track.metadata.starred),false);})}
          {button('下一首',()=>services.addToQueue(track,true))}
          {button(services.library.isFavorite(track)?'取消本地收藏':'本地收藏',()=>{void services.library.favorite(track).catch(()=>browser.error('本地收藏保存失败，请重试。'));})}
          {button('加入本地歌单',()=>setAdding([track]))}
          {view.kind==='playlist'&&button('从歌单移除',()=>{void write(async client=>{await client.changePlaylist(view.id!,[],[index]);});})}
          {view.kind==='playlist'&&index>0&&button('上移',()=>{void write(async client=>{
            const moved=[...tracks];[moved[index-1],moved[index]]=[moved[index]!,moved[index-1]!];
            await client.savePlaylist(title,moved.map(item=>item.origin.id),view.id!);
          });})}
        </View>
      </View>;}
      const label=item.kind==='album'?`${item.album.title} · ${item.album.artist}`:item.kind==='artist'?item.name:item.playlist.title;
      const id=item.kind==='album'?item.album.id:item.kind==='artist'?item.id:item.playlist.id;
      return <Pressable accessibilityRole="button" testID={`navidrome-item-${item.kind}-${id}`} key={`${item.kind}-${id}`} disabled={busy} onPress={()=>browser.open(item.kind==='album'?{kind:'album',id}:item.kind==='artist'?{kind:'artist',id}:{kind:'playlist',id})} style={[styles.item,{flexDirection:'row',alignItems:'center',gap:12}]}>{item.kind==='album'&&item.album.coverArtId&&<Cover services={services} privateCover={{accountId,id:item.album.coverArtId}}/>}<Text style={styles.track}>{label}</Text></Pressable>;
    })}
    {items.length>50&&<View style={styles.row}>
      {button('上一页歌曲/项目',()=>browser.page(visiblePage-1),visiblePage===0)}
      <Text style={styles.caption}>第 {visiblePage+1} / {Math.ceil(items.length/50)} 页 · 已载入 {items.length} 项</Text>
      {button('下一页歌曲/项目',()=>browser.page(visiblePage+1),(visiblePage+1)*50>=items.length)}
    </View>}
    {loading&&<Text style={styles.caption}>正在读取服务器…</Text>}
    {!!error&&<Text style={styles.error}>{error}</Text>}
    {!loading&&!error&&!items.length&&<Text style={styles.caption}>此处暂无内容</Text>}
    {button(error?'重试':'刷新',()=>{void browser.load(!!error&&frame.retryAppend);},loading||busy)}
    {more&&button('加载更多',()=>{void browser.load(true);},loading||busy)}
    <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({title:{color:theme.color('#F1EDE7'),fontSize:27,fontWeight:'600'},heading:{color:theme.color('#D5DCE7'),fontSize:19,marginVertical:16},caption:{color:theme.color('#929CAB'),fontSize:11,lineHeight:20,marginTop:5},track:{color:theme.color('#DFE4EE'),fontSize:15,lineHeight:23},row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},button:{backgroundColor:theme.color('#303A32'),borderRadius:10,padding:12,marginVertical:5},buttonText:{color:theme.color('#D9F49B'),fontSize:12},input:{color:theme.color('#EEECE7'),borderColor:theme.color('#414754'),borderWidth:1,borderRadius:11,padding:12,fontSize:13},item:{paddingVertical:16,borderBottomWidth:1,borderColor:theme.color('#303744')},error:{color:theme.color('#D3AB94'),fontSize:12,marginVertical:14}});
