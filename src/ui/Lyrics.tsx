import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Animated,FlatList,Modal,Pressable,Text,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import {activeLyric,type LyricWord} from '../lyrics/parser.ts';
import type {LyricResult} from '../lyrics/normalize.ts';
function Word({word,position,playing,size,font}:{word:LyricWord;position:number;playing:boolean;size:number;font?:string}){
  const theme=useTheme();
  const opacity=useRef(new Animated.Value(.35)).current;
  useEffect(()=>{
    const span=Math.max(1,word.endMs-word.startMs),progress=Math.min(1,Math.max(0,(position-word.startMs)/span));
    opacity.stopAnimation();opacity.setValue(.35+.65*progress);
    if(!playing||position>=word.endMs)return;
    const animation=Animated.sequence([Animated.delay(Math.max(0,word.startMs-position)),Animated.timing(opacity,{toValue:1,duration:Math.max(1,word.endMs-Math.max(position,word.startMs)),useNativeDriver:true})]);
    animation.start();return()=>animation.stop();
  },[word,position,playing,opacity]);
  return <Animated.Text style={{color:theme.color('#D9F49B'),fontSize:size,fontFamily:font,opacity}}>{word.text}</Animated.Text>;
}
export function Lyrics({services,track,font}:{services:Services;track:Track;font?:string}){
  const theme=useTheme();
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [expanded,setExpanded]=useState(false);
  const [result,setResult]=useState<LyricResult>(),[error,setError]=useState(''),[retry,setRetry]=useState(0),[variant,setVariant]=useState(-1);
  const list=useRef<FlatList>(null),key=trackKey(track.origin);
  useEffect(()=>{const abort=new AbortController();setResult(undefined);setError('');setVariant(-1);
    services.lyrics.load(track,abort.signal).then(value=>{if(!abort.signal.aborted)setResult(value);}).catch(()=>{if(!abort.signal.aborted)setError('歌词获取失败，可重试');});
    return()=>abort.abort();
  },[services,key,retry]);
  const document=variant>=0?result?.variants[variant]?.document:result?.document;
  const active=document?activeLyric(document.lines,state.position*1000,preferences.lyricOffsetMs):-1;
  useEffect(()=>{if(expanded&&active>=0)list.current?.scrollToIndex({index:active,animated:true,viewPosition:.45});},[active,expanded]);
  const size=20*preferences.fontScale;
  return <View style={{gap:12}}>
    <Text style={{color:theme.color('#959EAC')}}>歌词 · 偏移 {preferences.lyricOffsetMs}ms（正值延后）</Text>
    <View style={{flexDirection:'row',gap:16}}>{[-200,0,200].map(delta=><Pressable key={delta} accessibilityRole="button" onPress={()=>{void services.preferences.update({lyricOffsetMs:delta===0?0:preferences.lyricOffsetMs+delta});}}><Text style={{color:theme.color('#D9F49B')}}>{delta===0?'重置':`${delta>0?'+':''}${delta}ms`}</Text></Pressable>)}</View>
    {error?<Pressable onPress={()=>setRetry(value=>value+1)}><Text style={{color:theme.color('#D6B69A')}}>{error}</Text></Pressable>:!result?<Text style={{color:theme.color('#959EAC')}}>正在获取歌词…</Text>:!document?.lines.length&&!document?.plain.length?<Text style={{color:theme.color('#959EAC')}}>暂无歌词</Text>:null}
    {(result?.variants.length??0)>1&&<View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{result!.variants.map((item,index)=><Pressable key={index} onPress={()=>setVariant(index)}><Text style={{color:variant===index?theme.color('#D9F49B'):theme.color('#959EAC')}}>{item.label}</Text></Pressable>)}</View>}
    {document?.synced&&<Pressable accessibilityRole="button" onPress={()=>setExpanded(true)}><Text style={{color:theme.color('#D9F49B')}}>全部歌词 · 点击行可定位</Text></Pressable>}
    {document?.synced&&!expanded&&document.lines.slice(Math.max(0,active-1),Math.max(0,active-1)+4).map((item,index)=>{
      const actual=Math.max(0,active-1)+index;
      return <Pressable key={actual} accessibilityRole="button" onPress={()=>services.playback.controller.seek(Math.max(0,(item.startMs+preferences.lyricOffsetMs)/1000))} style={{paddingVertical:8}}>
        {actual===active&&item.words?<Text>{item.words.map((word,i)=><Word key={i} word={word} position={state.position*1000-preferences.lyricOffsetMs} playing={state.intent==='playing'&&!state.buffering} size={size} font={font}/>)}</Text>:<Text style={{fontSize:size,color:actual===active?theme.color('#D9F49B'):theme.color('#959EAC'),fontFamily:font}}>{item.text}</Text>}
        {item.translation&&<Text style={{fontSize:14,color:theme.color('#BFC8D9')}}>{item.translation}</Text>}{item.romanization&&<Text style={{fontSize:13,color:theme.color('#959EAC')}}>{item.romanization}</Text>}
      </Pressable>;
    })}
    <Modal visible={expanded} onRequestClose={()=>setExpanded(false)} animationType="slide">
      <View style={{flex:1,backgroundColor:theme.color('#111318'),padding:24,paddingTop:64}}>
        <Pressable accessibilityRole="button" onPress={()=>setExpanded(false)}><Text style={{color:theme.color('#D9F49B'),padding:16}}>收起全部歌词</Text></Pressable>
        <FlatList ref={list} data={document?.lines??[]} extraData={[active,font,size]} keyExtractor={(_,index)=>String(index)} initialNumToRender={8} windowSize={5}
          onScrollToIndexFailed={info=>list.current?.scrollToOffset({offset:info.averageItemLength*info.index,animated:false})}
          renderItem={({item,index})=><Pressable accessibilityRole="button" accessibilityLabel={`定位歌词：${item.text}`} onPress={()=>services.playback.controller.seek(Math.max(0,(item.startMs+preferences.lyricOffsetMs)/1000))} style={{paddingVertical:18}}>
            <Text style={{fontSize:size,color:index===active?theme.color('#D9F49B'):theme.color('#959EAC'),fontFamily:font}}>{item.text}</Text>{item.translation&&<Text style={{color:theme.color('#BFC8D9')}}>{item.translation}</Text>}{item.romanization&&<Text style={{color:theme.color('#959EAC')}}>{item.romanization}</Text>}
          </Pressable>}/>
      </View>
    </Modal>
    {!document?.synced&&document?.plain.slice(0,300).map((line,index)=><Text key={index} style={{fontSize:size,color:theme.color('#BFC8D9'),fontFamily:font}}>{line}</Text>)}
  </View>;
}
