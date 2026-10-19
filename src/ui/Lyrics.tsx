import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {memo,useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,FlatList,Pressable,ScrollView,Text as LyricText,View,useWindowDimensions,type GestureResponderEvent,type PressableProps} from 'react-native';
import {SheetModal} from './AdaptiveModal.tsx';
import {Text} from './Typography.tsx';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import {buildStageTimeline,activeStageGroup} from '../lyrics/stage.ts';
import type {LyricLine} from '../lyrics/parser.ts';
import type {LyricStyle} from '../lyrics/settings.ts';
import {activeLyric} from '../lyrics/parser.ts';
import type {SelectedLyrics} from '../lyrics/selection.ts';
import {lyricSignature} from '../domain/matching.ts';
import {LyricChoiceModal,lyricPlatformLabel} from './LyricChoiceModal.tsx';
import {lyricOffset} from '../lyrics/settings.ts';
import {NativeLyricLine} from './NativeLyricLine.tsx';
export function Lyrics({services,track,font,presentation,visibleLines}:{services:Services;track:Track;font?:string;presentation?:'am'|'immersive'|'photo'|'stage'|'am2';visibleLines?:number}){
  const theme=useTheme();
  const state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const choice=services.library.lyricChoiceFor(track),signature=lyricSignature(track);
  const [choosing,setChoosing]=useState(false);
  const [expanded,setExpanded]=useState(false),[scope,setScope]=useState<'track'|'global'>('track'),[screenReader,setScreenReader]=useState(false),[settingError,setSettingError]=useState('');
  const previousPosition=useRef(state.position),[seekRevision,setSeekRevision]=useState(0);
  const lastTap=useRef({index:-1,time:0,key:''});
  useEffect(()=>{void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);const listener=AccessibilityInfo.addEventListener('screenReaderChanged',setScreenReader);return()=>listener.remove();},[]);
  const [loaded,setLoaded]=useState<{identity:string;value:SelectedLyrics}>(),[error,setError]=useState(''),[retry,setRetry]=useState(0),[variant,setVariant]=useState(-1);
  const list=useRef<FlatList>(null),key=trackKey(track.origin),version=track.origin.kind==='webdav'?track.metadata.davVersion:undefined;
  const loadIdentity=JSON.stringify([key,signature,version,choice]);
  const result=loaded?.identity===loadIdentity?loaded.value:undefined;
  useEffect(()=>{const abort=new AbortController();setLoaded(undefined);setError('');setVariant(-1);
    services.lyrics.load(track,abort.signal).then(value=>{if(!abort.signal.aborted)setLoaded({identity:loadIdentity,value});}).catch(()=>{if(!abort.signal.aborted)setError('歌词获取失败，可重试');});
    return()=>abort.abort();
  },[services,loadIdentity,retry]);
  useEffect(()=>{setChoosing(false);setExpanded(false);},[signature]);
  // NativeLyricLine owns word-level animation. Refresh the virtualized list only
  // after a meaningful seek jump, rather than once for every playback tick.
  useEffect(()=>{
    const delta=Math.abs(state.position-previousPosition.current);
    previousPosition.current=state.position;
    if(delta>1.5)setSeekRevision(value=>value+1);
  },[state.position]);
  const chooser=<LyricChoiceModal services={services} track={choosing?track:null} onClose={()=>setChoosing(false)}/>;
  const offset=lyricOffset(preferences.lyricOffsetMs,preferences.lyricOffsets,key),center=preferences.lyricAlignment==='center'||preferences.lyricAlignment==='auto'&&presentation==='immersive';
  const seek=useCallback((startMs:number,index:number,now:number)=>{const elapsed=now-lastTap.current.time;if(screenReader||lastTap.current.key===key&&lastTap.current.index===index&&elapsed>=0&&elapsed<350){services.playback.controller.seek(Math.max(0,(startMs+offset)/1000));lastTap.current={index:-1,time:0,key:''};}else lastTap.current={index,time:now,key};},[services,key,offset,screenReader]);
  const openAllLyrics=useCallback(()=>setExpanded(true),[]);
  const settings=<View style={{gap:12}}><Text style={{color:theme.palette.secondary}}>歌词偏移：全局 {preferences.lyricOffsetMs}ms · 本曲 {preferences.lyricOffsets[key]??0}ms（正值延后）</Text><View style={{flexDirection:'row',gap:18}}>{(['track','global'] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{selected:scope===value}} onPress={()=>setScope(value)}><Text style={{color:scope===value?theme.palette.accent:theme.palette.secondary}}>{value==='track'?'调整本曲':'调整全局'}</Text></Pressable>)}</View><View style={{flexDirection:'row',flexWrap:'wrap',gap:18}}>{[-500,-100,0,100,500].map(delta=><Pressable key={delta} accessibilityRole="button" onPress={()=>{const current=scope==='global'?preferences.lyricOffsetMs:preferences.lyricOffsets[key]??0,next=delta===0?0:Math.max(-600000,Math.min(600000,current+delta));void (scope==='global'?services.preferences.update({lyricOffsetMs:next}):services.preferences.setLyricOffset(key,next)).then(()=>setSettingError('')).catch(()=>setSettingError('偏移未保存，原设置保留'));}}><Text style={{color:theme.palette.accent}}>{delta===0?'重置':`${delta>0?'+':''}${delta}ms`}</Text></Pressable>)}</View>{!!settingError&&<Text accessibilityRole="alert" style={{color:theme.palette.accent}}>{settingError}</Text>}</View>;
  const document=variant>=0?result?.variants[variant]?.document:result?.document;
  const stageLines=useMemo(()=>document&&presentation==='stage'?buildStageTimeline(document,state.duration*1000):[],[document,presentation,state.duration]);
  const stageGroup=activeStageGroup(stageLines,state.position*1000,offset);
  const active=document?activeLyric(document.lines,state.position*1000,offset):-1;
  const {fontScale:systemFontScale}=useWindowDimensions();
  const fullPage=presentation==='am'||presentation==='am2'||presentation==='photo',alignStart=(presentation==='am'||presentation==='photo')&&systemFontScale>1.8;
  const count=visibleLines??(presentation==='am'?3:presentation?2:4),firstVisible=Math.max(0,active-(count===1?0:1));
  useEffect(()=>{if(expanded&&active>=0)list.current?.scrollToIndex({index:active,animated:true,viewPosition:.45});},[active,expanded]);
  const size=(presentation==='stage'?80:presentation==='am'||presentation==='am2'?32:presentation==='photo'?26:presentation?22:20)*preferences.fontScale;
  const style=preferences.lyricStyle;
  const auxiliaryFont={fontFamily:font,fontSize:14,lineHeight:Math.ceil(14*style.lineHeight)};
  const activeColor=style.activeColor==='auto'?(presentation?'#FFFFFF':theme.color('#D9F49B')):style.activeColor,inactiveColor=style.inactiveColor==='auto'?(presentation?'#A0A0A8':theme.color('#959EAC')):style.inactiveColor;
  return <View style={{gap:12,...(presentation?{height:'100%'}:{})}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <Pressable accessibilityRole="button" accessibilityLabel="选择歌词来源" onPress={()=>setChoosing(true)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:presentation?'#FFFFFF':theme.palette.accent,fontSize:13}}>选择歌词来源</Text></Pressable>
    {result&&<Text testID="lyric-source" numberOfLines={presentation?1:undefined} style={{flex:1,color:presentation?'#FFFFFF':theme.palette.secondary,fontSize:12}}>{result.mode==='original'?'歌词来源：原歌词':`歌词来源：${result.mode==='automatic'?'自动优选':'手动指定'} · ${lyricPlatformLabel(result.source)} · ${result.source.title}`}</Text>}
    </View>
    {!!result?.warning&&<Pressable accessibilityRole="button" accessibilityLabel="重试歌词" onPress={()=>setRetry(value=>value+1)}><Text style={{color:presentation?'#FFFFFF':theme.palette.accent}}>{result.warning} · 重试</Text></Pressable>}
    {!expanded&&chooser}
    {!presentation&&!expanded&&settings}
    <View style={{gap:12,...(presentation?{flex:1,overflow:'hidden',justifyContent:'center'}:{})}}>
    {error?<Pressable onPress={()=>setRetry(value=>value+1)}><Text style={{color:theme.color('#D6B69A')}}>{error}</Text></Pressable>:!result?<Text style={{color:theme.color('#959EAC')}}>正在获取歌词…</Text>:!document?.lines.length&&!document?.plain.length?<Text style={{color:theme.color('#959EAC')}}>暂无歌词</Text>:null}
    {(result?.variants.length??0)>1&&<View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{result!.variants.map((item,index)=><Pressable key={index} onPress={()=>setVariant(index)}><Text style={{color:variant===index?theme.color('#D9F49B'):theme.color('#959EAC')}}>{item.label}</Text></Pressable>)}</View>}
    {document?.synced&&!presentation&&<Pressable accessibilityRole="button" onPress={()=>setExpanded(true)}><Text style={{color:theme.color('#D9F49B')}}>全部歌词 · 双击行定位，长按打开设置</Text></Pressable>}
    {fullPage&&document?.synced&&!expanded&&<View style={{flex:1}}>
      <AM2LyricRows alignStart={alignStart} testID={presentation==='photo'?'photo-lyrics-list':presentation==='am'?'am-lyrics-list':'am2-lyrics-list'} services={services} lines={document.lines} active={active} center={center} font={font} size={size} offset={offset} style={style} activeColor={activeColor} inactiveColor={inactiveColor} seek={seek} openSettings={openAllLyrics}/>
    </View>}
    {presentation==='stage'&&document?.synced&&!expanded&&<View testID="lyric-stage" style={{flex:1,gap:12}}>
      <ScrollView key={stageGroup?.id??'gap'} contentContainerStyle={{flexGrow:1,justifyContent:'center'}}>
        {stageGroup?<Pressable testID="lyric-stage-group" accessibilityRole="button" accessibilityLabel={stageGroup.line.text}
          accessibilityValue={{text:stageGroup.line.words?'逐字歌词':'行级歌词'}} accessibilityHint="双击定位到当前段，长按打开歌词设置"
          onPress={event=>seek(stageGroup.line.startMs,Number(stageGroup.id.split(':')[0])*2001+Number(stageGroup.id.split(':')[1]),event.nativeEvent.timestamp)} onLongPress={()=>setExpanded(true)}>
          <NativeLyricLine line={stageGroup.line} position={state.position*1000-offset} playing={state.intent==='playing'&&!state.buffering} size={size} font={font} fontURI={services.fonts.selectedURI()} color={activeColor} center lineHeight={style.lineHeight} emphasis={style.emphasis} stageStyle={preferences.stageStyle}/>
          {stageGroup.line.translation&&<LyricText style={{...auxiliaryFont,textAlign:'center',color:'#D5D5DA',marginTop:12}}>{stageGroup.line.translation}</LyricText>}
          {stageGroup.line.romanization&&<LyricText style={{...auxiliaryFont,textAlign:'center',color:'#D5D5DA',marginTop:8}}>{stageGroup.line.romanization}</LyricText>}
        </Pressable>:<Text testID="lyric-stage-gap" style={{textAlign:'center',color:inactiveColor}}>等待下一句…</Text>}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="打开全部歌词与偏移设置" onPress={()=>setExpanded(true)} style={{minHeight:44,justifyContent:'center'}}>
        <Text style={{textAlign:'center',color:'#D5D5DA',fontSize:13}}>全部歌词与偏移设置</Text>
      </Pressable>
    </View>}
    {presentation!=='stage'&&!fullPage&&document?.synced&&!expanded&&document.lines.slice(firstVisible,firstVisible+count).map((item,index)=>{
      const actual=firstVisible+index,time=state.position*1000-offset,singing=time>=item.startMs&&(item.endMs===undefined||time<item.endMs);
      return <Pressable key={actual} accessibilityRole="button" accessibilityLabel={item.text} onPress={event=>seek(item.startMs,actual,event.nativeEvent.timestamp)} onLongPress={()=>setExpanded(true)} accessibilityHint="双击歌词定位，长按歌词设置" style={{paddingVertical:item.background?4:count===1?0:style.spacing,opacity:item.background?.65:1}}>
        <NativeLyricLine line={actual===active||item.background&&singing?item:{...item,words:undefined}} position={actual===active||item.background&&singing?state.position*1000-offset:0} playing={(actual===active||!!item.background&&singing)&&state.intent==='playing'&&!state.buffering} size={size} font={font} fontURI={services.fonts.selectedURI()} color={actual===active||item.background&&singing?activeColor:inactiveColor} center={center} lineHeight={style.lineHeight} blur={actual===active||item.background&&singing?0:style.blur} emphasis={style.emphasis}/>
        {item.translation&&<LyricText style={{...auxiliaryFont,color:theme.color('#BFC8D9')}}>{item.translation}</LyricText>}{item.romanization&&<LyricText style={{...auxiliaryFont,fontSize:13,color:theme.color('#959EAC')}}>{item.romanization}</LyricText>}
      </Pressable>;
    })}
    {!document?.synced&&(fullPage||presentation==='stage')&&<FlatList data={document?.plain.slice(0,300)??[]} keyExtractor={(_,index)=>String(index)} initialNumToRender={8} windowSize={5} renderItem={({item})=><LyricText style={{fontSize:size,lineHeight:Math.ceil(size*style.lineHeight),color:activeColor,fontFamily:font,marginVertical:style.spacing}}>{item}</LyricText>}/>}
    {!document?.synced&&!fullPage&&presentation!=='stage'&&document?.plain.slice(0,300).map((line,index)=><LyricText key={index} style={{fontSize:size,lineHeight:Math.ceil(size*style.lineHeight),color:activeColor,fontFamily:font,marginVertical:style.spacing}}>{line}</LyricText>)}
    </View>
    <SheetModal visible={expanded} onRequestClose={()=>setExpanded(false)} animationType="slide">
      <View style={{flex:1,backgroundColor:theme.color('#111318'),padding:24,paddingTop:64}}>
        <Pressable accessibilityRole="button" onPress={()=>setExpanded(false)}><Text style={{color:theme.color('#D9F49B'),padding:16}}>收起全部歌词</Text></Pressable>
        {settings}
        <Pressable accessibilityRole="button" accessibilityLabel="选择歌词来源" onPress={()=>setChoosing(true)} style={{paddingVertical:12}}><Text style={{color:theme.palette.accent}}>选择歌词来源</Text></Pressable>
        {expanded&&chooser}
        <FlatList ref={list} data={document?.lines??[]} extraData={[active,font,size,state.intent,offset,seekRevision]} keyExtractor={(_,index)=>String(index)} initialNumToRender={8} windowSize={5}
          onScrollToIndexFailed={info=>list.current?.scrollToOffset({offset:info.averageItemLength*info.index,animated:false})}
          renderItem={({item,index})=><Pressable accessibilityRole="button" accessibilityLabel={`定位歌词：${item.text}`} onPress={event=>seek(item.startMs,index,event.nativeEvent.timestamp)} accessibilityHint="双击歌词定位" style={{paddingVertical:style.spacing}}>
            <View><NativeLyricLine line={index===active?item:{...item,words:undefined}} position={index===active?state.position*1000-offset:0} playing={index===active&&state.intent==='playing'&&!state.buffering} size={size} font={font} fontURI={services.fonts.selectedURI()} color={index===active?activeColor:inactiveColor} center={center} lineHeight={style.lineHeight} blur={index===active?0:style.blur} emphasis={style.emphasis}/></View>{item.translation&&<LyricText style={{...auxiliaryFont,color:theme.color('#BFC8D9')}}>{item.translation}</LyricText>}{item.romanization&&<LyricText style={{...auxiliaryFont,color:theme.color('#959EAC')}}>{item.romanization}</LyricText>}
          </Pressable>}/>
      </View>
    </SheetModal>
  </View>;
}

// Only the active row subscribes to the playback clock. FlatList props remain
// stable during position ticks; inactive rows never receive per-tick positions.
const AM2LyricRows=memo(function AM2LyricRows({alignStart,testID,services,lines,active,center,font,size,offset,style,activeColor,inactiveColor,seek,openSettings}:{alignStart:boolean;testID:string;services:Services;lines:readonly LyricLine[];active:number;center:boolean;font?:string;size:number;offset:number;style:LyricStyle;activeColor:string;inactiveColor:string;seek:(start:number,index:number,time:number)=>void;openSettings:()=>void}){
  const list=useRef<FlatList<LyricLine>>(null),actions=useRef({seek,openSettings});actions.current={seek,openSettings};
  const extra=useMemo(()=>[active,center,font,size,offset,style,activeColor,inactiveColor],[active,center,font,size,offset,style,activeColor,inactiveColor]);
  useEffect(()=>{if(active>=0)list.current?.scrollToIndex({index:active,viewPosition:alignStart?0:.35,animated:false});},[active,alignStart]);
  const render=useCallback(({item,index}:{item:LyricLine;index:number})=><AM2LyricPressable accessibilityRole="button" accessibilityLabel={`定位歌词：${item.text}`} onTap={time=>actions.current.seek(item.startMs,index,time)} onLongPress={()=>actions.current.openSettings()} accessibilityHint="双击定位，长按调整偏移" style={{paddingVertical:style.spacing}}>
    {index===active?<AM2ActiveLyric services={services} line={item} center={center} offset={offset} size={size} font={font} color={activeColor} style={style}/>:<NativeLyricLine line={{...item,words:undefined}} position={0} playing={false} center={center} size={size} font={font} fontURI={services.fonts.selectedURI()} color={inactiveColor} lineHeight={style.lineHeight} blur={style.blur} emphasis={style.emphasis}/>}
    {item.translation&&<LyricText style={{fontFamily:font,color:'#D5D5DA',fontSize:14,marginTop:8}}>{item.translation}</LyricText>}{item.romanization&&<LyricText style={{fontFamily:font,color:'#D5D5DA',fontSize:14,marginTop:6}}>{item.romanization}</LyricText>}
  </AM2LyricPressable>,[services,active,center,font,size,offset,style,activeColor,inactiveColor]);
  const failed=useCallback((info:{averageItemLength:number;index:number})=>list.current?.scrollToOffset({offset:info.averageItemLength*info.index,animated:false}),[]);
  const footer=useMemo(()=><Pressable accessibilityRole="button" accessibilityLabel="打开全部歌词与偏移设置" onPress={openSettings} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:'#D5D5DA'}}>全部歌词与偏移设置</Text></Pressable>,[openSettings]);
  return <FlatList testID={testID} ref={list} data={lines} extraData={extra} keyExtractor={lyricRowKey} initialNumToRender={8} windowSize={5} renderItem={render} onScrollToIndexFailed={failed} ListFooterComponent={footer} contentContainerStyle={{paddingVertical:30}}/>;
});
const lyricRowKey=(_:LyricLine,index:number)=>String(index);
function AM2ActiveLyric({services,line,center,offset,size,font,color,style}:{services:Services;line:LyricLine;center:boolean;offset:number;size:number;font?:string;color:string;style:LyricStyle}){
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  return <NativeLyricLine line={line} position={playback.position*1000-offset} playing={playback.intent==='playing'&&!playback.buffering} center={center} size={size} font={font} fontURI={services.fonts.selectedURI()} color={color} lineHeight={style.lineHeight} emphasis={style.emphasis}/>;
}

// Observe bounded taps without claiming the list's scroll responder. A native
// cancellation, movement, multiple fingers or long press cannot seek a lyric.
function AM2LyricPressable({onTap,onLongPress,...props}:PressableProps&{onTap:(time:number)=>void}){
  const touch=useRef<{x:number;y:number;time:number}|undefined>(undefined),handled=useRef<number|undefined>(undefined);
  const end=(event:GestureResponderEvent)=>{
    const point=event.nativeEvent;handled.current=point.timestamp;
    const start=touch.current;touch.current=undefined;if(!start)return;
    const elapsed=point.timestamp-start.time;
    if(point.touches.length||elapsed<0||elapsed>350||Math.hypot(point.pageX-start.x,point.pageY-start.y)>10)return;
    onTap(point.timestamp);
  };
  return <Pressable {...props} onTouchStart={event=>{const point=event.nativeEvent;touch.current=point.touches.length===1?{x:point.pageX,y:point.pageY,time:point.timestamp}:undefined;}}
    onTouchMove={event=>{const start=touch.current,point=event.nativeEvent;if(start&&(point.touches.length!==1||Math.hypot(point.pageX-start.x,point.pageY-start.y)>10))touch.current=undefined;}}
    onTouchEnd={end} onTouchCancel={event=>{touch.current=undefined;handled.current=event.nativeEvent.timestamp;}}
    onLongPress={event=>{touch.current=undefined;onLongPress?.(event);}}
    onPress={event=>{if(event.nativeEvent.timestamp!==handled.current)onTap(event.nativeEvent.timestamp);}}/>;
}
