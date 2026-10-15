import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,FlatList,Modal,Pressable,Text,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import {activeLyric} from '../lyrics/parser.ts';
import type {LyricResult} from '../lyrics/normalize.ts';
import {lyricOffset} from '../lyrics/settings.ts';
import {NativeLyricLine} from './NativeLyricLine.tsx';
export function Lyrics({services,track,font,presentation}:{services:Services;track:Track;font?:string;presentation?:'am'|'immersive'|'photo'}){
  const theme=useTheme();
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [expanded,setExpanded]=useState(false),[scope,setScope]=useState<'track'|'global'>('track'),[screenReader,setScreenReader]=useState(false),[settingError,setSettingError]=useState('');
  const lastTap=useRef({index:-1,time:0,key:''});
  useEffect(()=>{void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);const listener=AccessibilityInfo.addEventListener('screenReaderChanged',setScreenReader);return()=>listener.remove();},[]);
  const [result,setResult]=useState<LyricResult>(),[error,setError]=useState(''),[retry,setRetry]=useState(0),[variant,setVariant]=useState(-1);
  const list=useRef<FlatList>(null),key=trackKey(track.origin),version=track.origin.kind==='webdav'?track.metadata.davVersion:undefined;
  useEffect(()=>{const abort=new AbortController();setResult(undefined);setError('');setVariant(-1);
    services.lyrics.load(track,abort.signal).then(value=>{if(!abort.signal.aborted)setResult(value);}).catch(()=>{if(!abort.signal.aborted)setError('歌词获取失败，可重试');});
    return()=>abort.abort();
  },[services,key,version,retry]);
  const offset=lyricOffset(preferences.lyricOffsetMs,preferences.lyricOffsets,key),center=preferences.lyricAlignment==='center'||preferences.lyricAlignment==='auto'&&presentation==='immersive';
  const seek=(startMs:number,index:number)=>{const now=Date.now();if(screenReader||lastTap.current.key===key&&lastTap.current.index===index&&now-lastTap.current.time<350){services.playback.controller.seek(Math.max(0,(startMs+offset)/1000));lastTap.current={index:-1,time:0,key:''};}else lastTap.current={index,time:now,key};};
  const settings=<View style={{gap:12}}><Text style={{color:theme.palette.secondary}}>歌词偏移：全局 {preferences.lyricOffsetMs}ms · 本曲 {preferences.lyricOffsets[key]??0}ms（正值延后）</Text><View style={{flexDirection:'row',gap:18}}>{(['track','global'] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{selected:scope===value}} onPress={()=>setScope(value)}><Text style={{color:scope===value?theme.palette.accent:theme.palette.secondary}}>{value==='track'?'调整本曲':'调整全局'}</Text></Pressable>)}</View><View style={{flexDirection:'row',flexWrap:'wrap',gap:18}}>{[-500,-100,0,100,500].map(delta=><Pressable key={delta} accessibilityRole="button" onPress={()=>{const current=scope==='global'?preferences.lyricOffsetMs:preferences.lyricOffsets[key]??0,next=delta===0?0:Math.max(-600000,Math.min(600000,current+delta));void (scope==='global'?services.preferences.update({lyricOffsetMs:next}):services.preferences.setLyricOffset(key,next)).then(()=>setSettingError('')).catch(()=>setSettingError('偏移未保存，原设置保留'));}}><Text style={{color:theme.palette.accent}}>{delta===0?'重置':`${delta>0?'+':''}${delta}ms`}</Text></Pressable>)}</View>{!!settingError&&<Text accessibilityRole="alert" style={{color:theme.palette.accent}}>{settingError}</Text>}</View>;
  const document=variant>=0?result?.variants[variant]?.document:result?.document;
  const active=document?activeLyric(document.lines,state.position*1000,offset):-1;
  useEffect(()=>{if(expanded&&active>=0)list.current?.scrollToIndex({index:active,animated:true,viewPosition:.45});},[active,expanded]);
  const size=(presentation==='am'?32:presentation==='photo'?26:presentation?22:20)*preferences.fontScale;
  const activeColor=presentation?'#FFFFFF':theme.color('#D9F49B'),inactiveColor=presentation?'rgba(255,255,255,0.38)':theme.color('#959EAC');
  return <View style={{gap:12}}>
    {!presentation&&settings}
    {error?<Pressable onPress={()=>setRetry(value=>value+1)}><Text style={{color:theme.color('#D6B69A')}}>{error}</Text></Pressable>:!result?<Text style={{color:theme.color('#959EAC')}}>正在获取歌词…</Text>:!document?.lines.length&&!document?.plain.length?<Text style={{color:theme.color('#959EAC')}}>暂无歌词</Text>:null}
    {(result?.variants.length??0)>1&&<View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{result!.variants.map((item,index)=><Pressable key={index} onPress={()=>setVariant(index)}><Text style={{color:variant===index?theme.color('#D9F49B'):theme.color('#959EAC')}}>{item.label}</Text></Pressable>)}</View>}
    {document?.synced&&!presentation&&<Pressable accessibilityRole="button" onPress={()=>setExpanded(true)}><Text style={{color:theme.color('#D9F49B')}}>全部歌词 · 双击行定位，长按打开设置</Text></Pressable>}
    {document?.synced&&!expanded&&document.lines.slice(Math.max(0,active-1),Math.max(0,active-1)+(presentation==='am'?3:4)).map((item,index)=>{
      const actual=Math.max(0,active-1)+index,time=state.position*1000-offset,singing=time>=item.startMs&&(item.endMs===undefined||time<item.endMs);
      return <Pressable key={actual} accessibilityRole="button" accessibilityLabel={item.text} onPress={()=>seek(item.startMs,actual)} onLongPress={()=>setExpanded(true)} accessibilityHint="双击歌词定位，长按歌词设置" style={{paddingVertical:item.background?4:presentation?16:8,opacity:item.background?.65:1}}>
        {(actual===active||item.background&&singing)&&item.words?<NativeLyricLine line={item} position={state.position*1000-offset} playing={state.intent==='playing'&&!state.buffering} size={size} font={font} fontURI={services.fonts.selectedURI()} color={activeColor} center={center}/>:<Text style={{fontSize:size,color:actual===active?activeColor:inactiveColor,fontFamily:font,fontWeight:presentation?'700':'400',textAlign:center?'center':'left'}}>{item.text}</Text>}
        {item.translation&&<Text style={{fontSize:14,color:theme.color('#BFC8D9')}}>{item.translation}</Text>}{item.romanization&&<Text style={{fontSize:13,color:theme.color('#959EAC')}}>{item.romanization}</Text>}
      </Pressable>;
    })}
    <Modal visible={expanded} onRequestClose={()=>setExpanded(false)} animationType="slide">
      <View style={{flex:1,backgroundColor:theme.color('#111318'),padding:24,paddingTop:64}}>
        <Pressable accessibilityRole="button" onPress={()=>setExpanded(false)}><Text style={{color:theme.color('#D9F49B'),padding:16}}>收起全部歌词</Text></Pressable>
        {settings}
        <FlatList ref={list} data={document?.lines??[]} extraData={[active,font,size,state.position,state.intent,offset]} keyExtractor={(_,index)=>String(index)} initialNumToRender={8} windowSize={5}
          onScrollToIndexFailed={info=>list.current?.scrollToOffset({offset:info.averageItemLength*info.index,animated:false})}
          renderItem={({item,index})=><Pressable accessibilityRole="button" accessibilityLabel={`定位歌词：${item.text}`} onPress={()=>seek(item.startMs,index)} accessibilityHint="双击歌词定位" style={{paddingVertical:18}}>
            <View>{index===active&&item.words?<NativeLyricLine line={item} position={state.position*1000-offset} playing={state.intent==='playing'&&!state.buffering} size={size} font={font} fontURI={services.fonts.selectedURI()} color={theme.palette.accent} center={center}/>:<Text style={{fontSize:size,color:index===active?theme.palette.accent:theme.palette.secondary,fontFamily:font,textAlign:center?'center':'left'}}>{item.text}</Text>}</View>{item.translation&&<Text style={{color:theme.color('#BFC8D9')}}>{item.translation}</Text>}{item.romanization&&<Text style={{color:theme.color('#959EAC')}}>{item.romanization}</Text>}
          </Pressable>}/>
      </View>
    </Modal>
    {!document?.synced&&document?.plain.slice(0,300).map((line,index)=><Text key={index} style={{fontSize:size,color:theme.color('#BFC8D9'),fontFamily:font}}>{line}</Text>)}
  </View>;
}
