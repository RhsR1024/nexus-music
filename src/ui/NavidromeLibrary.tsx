import {Cover} from './Cover.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Services } from '../app/services.ts';
import { NavidromeError, type ServerAlbum, type ServerPlaylist } from '../providers/navidrome.ts';
import { currentEntry } from '../domain/queue.ts';
import type { Track } from '../domain/track.ts';
type ViewState={kind:'songs'|'albums'|'artists'|'playlists'|'album'|'artist'|'playlist';id?:string;query?:string};
type Item={kind:'track';track:Track}|{kind:'album';album:ServerAlbum}|{kind:'artist';id:string;name:string}|{kind:'playlist';playlist:ServerPlaylist};
export function NavidromeLibrary({services,openSettings}:{services:Services;openSettings:()=>void}) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const accounts=useSyncExternalStore(services.accounts.subscribe,services.accounts.getSnapshot);
  const [accountId,setAccountId]=useState(accounts[0]?.id??'');
  const [view,setView]=useState<ViewState>({kind:'albums'}),[items,setItems]=useState<readonly Item[]>([]),[title,setTitle]=useState('');
  const [query,setQuery]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[more,setMore]=useState(false);
  const offset=useRef(0),generation=useRef(0),pending=useRef(new AbortController());
  useEffect(()=>{if(!accounts.some(item=>item.id===accountId))setAccountId(accounts[0]?.id??'');},[accounts,accountId]);
  async function load(append=false) {
    const version=++generation.current;pending.current.abort();pending.current=new AbortController();const signal=pending.current.signal;
    setLoading(true);setError('');const start=append?offset.current:0;
    try {
      const client=await services.accounts.client(accountId);let values:Item[]=[],hasMore=false,label='';
      if(view.kind==='songs') {const page=await client.songs(view.query??'',start,50,signal);values=page.items.map(track=>({kind:'track',track}));hasMore=page.hasMore;label='歌曲';}
      else if(view.kind==='albums') {const page=await client.albums('newest',start,50,signal);values=page.items.map(album=>({kind:'album',album}));hasMore=page.hasMore;label='最近添加的专辑';}
      else if(view.kind==='artists') {const artists=await client.artists(signal);values=artists.slice(start,start+100).map(artist=>({kind:'artist',...artist}));hasMore=start+100<artists.length;label='歌手';}
      else if(view.kind==='playlists') {const playlists=await client.playlists(signal);values=playlists.slice(start,start+100).map(playlist=>({kind:'playlist',playlist}));hasMore=start+100<playlists.length;label='服务端歌单';}
      else if(view.kind==='album') {const album=await client.albumDetail(view.id!,signal);values=album.tracks.map(track=>({kind:'track',track}));label=album.title;}
      else if(view.kind==='artist') {const artist=await client.artistDetail(view.id!,signal);values=artist.albums.map(album=>({kind:'album',album}));label=artist.name;}
      else {const playlist=await client.playlistDetail(view.id!,signal);values=playlist.tracks.map(track=>({kind:'track',track}));label=playlist.title;}
      if(version!==generation.current||signal.aborted)return;
      setItems(current=>append?[...current,...values]:values);setMore(hasMore);setTitle(label);setName(label);offset.current=start+values.length;
    } catch(value) {if(version===generation.current&&!signal.aborted)setError(value instanceof NavidromeError?value.message:'无法读取此连接，请重新连接后重试');}
    finally{if(version===generation.current)setLoading(false);}
  }
  useEffect(()=>{if(accountId){setItems([]);offset.current=0;void load();}return()=>{generation.current++;pending.current.abort();};},[accountId,view]);
  async function write(run:()=>Promise<void>) {
    setBusy(true);setError('');try{await run();await load();}catch(value){setError(value instanceof NavidromeError?value.message:'服务器操作未完成，原内容保留');}finally{setBusy(false);}
  }
  const button=(label:string,action:()=>void,disabled=busy)=><Pressable accessibilityRole="button" onPress={action} disabled={disabled} style={[styles.button,disabled&&{opacity:.4}]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const tracks=items.flatMap(item=>item.kind==='track'?[item.track]:[]);
  if(!accounts.length)return <View><Text style={styles.title}>私人曲库</Text><Text style={styles.caption}>连接Navidrome后，在这里浏览歌曲、专辑、歌手与服务端歌单。</Text>{button('前往连接设置',openSettings)}</View>;
  return <View>
    <Text style={styles.title}>私人曲库</Text>
    <View style={styles.row}>{accounts.map(account=><Pressable key={account.id} onPress={()=>{setAccountId(account.id);setView({kind:'albums'});}} style={styles.button}><Text style={styles.buttonText}>{account.id===accountId?'● ':''}{account.username}</Text></Pressable>)}</View>
    <View style={styles.row}>{(['songs','albums','artists','playlists']as const).map((kind,index)=><View key={kind}>{button(['歌曲','专辑','歌手','服务端歌单'][index]!,()=>setView({kind}))}</View>)}</View>
    <Text style={styles.heading}>{title}</Text>
    {view.kind==='songs'&&<View><TextInput accessibilityLabel="搜索私人曲库" value={query} onChangeText={setQuery} onSubmitEditing={()=>setView({kind:'songs',query})} placeholder="搜索自己的歌曲、歌手" placeholderTextColor="#768191" style={styles.input}/>{button('搜索私人曲库',()=>setView({kind:'songs',query}))}</View>}
    {tracks.length>0&&button('播放全部',()=>services.playTracks(tracks,0))}
    {(view.kind==='playlists'||view.kind==='playlist')&&<View>
      <TextInput accessibilityLabel="服务端歌单名称" value={name} onChangeText={setName} placeholder="歌单名称" placeholderTextColor="#768191" style={styles.input}/>
      <View style={styles.row}>{button(view.kind==='playlist'?'保存歌单名':'创建服务端歌单',()=>{void write(async()=>{const client=await services.accounts.client(accountId);if(view.kind==='playlist')await client.renamePlaylist(view.id!,name.trim());else await client.savePlaylist(name.trim(),[]);});},busy||!name.trim())}
      {view.kind==='playlist'&&button('删除服务端歌单',()=>Alert.alert('删除服务端歌单？','此操作会写回你的服务器。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void write(async()=>{await(await services.accounts.client(accountId)).deletePlaylist(view.id!);setView({kind:'playlists'});});}}]))}</View>
      {view.kind==='playlist'&&button('加入当前播放歌曲',()=>{void write(async()=>{
        const current=currentEntry(services.playback.controller.getSnapshot().queue)?.track;
        if(current?.origin.kind!=='navidrome'||current.origin.accountId!==accountId)throw new NavidromeError('protocol');
        await(await services.accounts.client(accountId)).changePlaylist(view.id!,[current.origin.id],[]);
      });})}
    </View>}
    {items.map((item,index)=>{
      if(item.kind==='track') {const track=item.track;return <View key={`${index}-${track.origin.id}`} style={styles.item}>
        <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)}><Text style={styles.track}>{track.title}</Text><Text style={styles.caption}>{track.artist} · {track.album}</Text></Pressable>
        <View style={styles.row}>
          {button(track.metadata.starred?'取消服务端星标':'服务端星标',()=>{void write(async()=>{await(await services.accounts.client(accountId)).star(track.origin.id,!track.metadata.starred);});})}
          {button('下一首',()=>services.addToQueue(track,true))}
          {view.kind==='playlist'&&button('从歌单移除',()=>{void write(async()=>{await(await services.accounts.client(accountId)).changePlaylist(view.id!,[],[index]);});})}
          {view.kind==='playlist'&&index>0&&button('上移',()=>{void write(async()=>{
            const moved=[...tracks];[moved[index-1],moved[index]]=[moved[index]!,moved[index-1]!];
            await(await services.accounts.client(accountId)).savePlaylist(title,moved.map(item=>item.origin.id),view.id!);
          });})}
        </View>
      </View>;}
      const label=item.kind==='album'?`${item.album.title} · ${item.album.artist}`:item.kind==='artist'?item.name:item.playlist.title;
      const id=item.kind==='album'?item.album.id:item.kind==='artist'?item.id:item.playlist.id;
      return <Pressable accessibilityRole="button" testID={`navidrome-item-${item.kind}-${id}`} key={`${item.kind}-${id}`} onPress={()=>setView(item.kind==='album'?{kind:'album',id}:item.kind==='artist'?{kind:'artist',id}:{kind:'playlist',id})} style={[styles.item,{flexDirection:'row',alignItems:'center',gap:12}]}>{item.kind==='album'&&item.album.coverArtId&&<Cover services={services} privateCover={{accountId,id:item.album.coverArtId}}/>}<Text style={styles.track}>{label}</Text></Pressable>;
    })}
    {loading&&<Text style={styles.caption}>正在读取服务器…</Text>}
    {!!error&&<Text style={styles.error}>{error}</Text>}
    {!loading&&!error&&!items.length&&<Text style={styles.caption}>此处暂无内容</Text>}
    {button(error?'重试':'刷新',()=>{void load();},loading||busy)}
    {more&&button('加载更多',()=>{void load(true);},loading||busy)}
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({title:{color:theme.color('#F1EDE7'),fontSize:27,fontWeight:'600'},heading:{color:theme.color('#D5DCE7'),fontSize:19,marginVertical:16},caption:{color:theme.color('#929CAB'),fontSize:11,lineHeight:20,marginTop:5},track:{color:theme.color('#DFE4EE'),fontSize:15,lineHeight:23},row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},button:{backgroundColor:theme.color('#303A32'),borderRadius:10,padding:12,marginVertical:5},buttonText:{color:theme.color('#D9F49B'),fontSize:12},input:{color:theme.color('#EEECE7'),borderColor:theme.color('#414754'),borderWidth:1,borderRadius:11,padding:12,fontSize:13},item:{paddingVertical:16,borderBottomWidth:1,borderColor:theme.color('#303744')},error:{color:theme.color('#D3AB94'),fontSize:12,marginVertical:14}});
