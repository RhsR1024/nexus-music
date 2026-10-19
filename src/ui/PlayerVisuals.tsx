import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {AccessibilityInfo,Animated,AppState,Easing,View,type GestureResponderEvent} from 'react-native';
import {RingSeekGesture,ringFraction} from '../domain/ringSeek.ts';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {Cover} from './Cover.tsx';
import {usePresentationVisible} from './AdaptiveModal.tsx';
import {paper,radius} from './tokens.ts';
export function Vinyl({services,track,size,playing}:{services:Services;track:Track;size:number;playing:boolean}){
  const visible=usePresentationVisible();
  const identity=trackKey(track.origin);
  const rotation=useMemo(()=>new Animated.Value(0),[identity]),tonearm=useRef(new Animated.Value(playing?1:0)).current;
  const [reduce,setReduce]=useState(true),[foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduce(value);});const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce),app=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>{active=false;motion.remove();app.remove();};},[]);
  useEffect(()=>{let active=true,animation:Animated.CompositeAnimation|undefined;
    // Wrap at complete turns so long sessions do not accumulate float error.
    // stopAnimation returns the actual native phase; stale callbacks cannot
    // restart a hidden, replaced or unmounted turntable.
    const turn=(value:number)=>{
      if(!active)return;
      const phase=((value%1)+1)%1;rotation.setValue(phase);
      animation=Animated.timing(rotation,{toValue:phase+1,duration:13513.514,easing:Easing.linear,useNativeDriver:true,isInteraction:false});
      animation.start(({finished})=>{if(finished&&active)turn(phase);});
    };
    rotation.stopAnimation(value=>{if(active&&playing&&visible&&!reduce&&foreground)turn(value);});
    return()=>{active=false;animation?.stop();rotation.stopAnimation();};
  },[identity,playing,visible,reduce,foreground,rotation]);
  useEffect(()=>{
    const target=playing?1:0;
    tonearm.stopAnimation();
    if(reduce||!foreground||!visible){tonearm.setValue(target);return;}
    // Separate from the disc: pausing returns the needle without seeking or
    // restarting audio. RN performs interpolation on the native animation driver.
    const animation=Animated.timing(tonearm,{toValue:target,duration:playing?620:480,easing:Easing.inOut(Easing.cubic),useNativeDriver:true,isInteraction:false});
    animation.start();return()=>{animation.stop();tonearm.stopAnimation();};
  },[playing,visible,reduce,foreground,tonearm]);
  // The square is the complete deck; record and tonearm use separate local
  // coordinates. The audited direction (cos theta, sin theta) maps to a
  // downward View rotated by theta - pi/2. Keep stable layout geometry.
  // Proportions follow IMG_4851: the record fills the matte deck, leaving a
  // narrow visible edge instead of a raised grey platter.
  const platterSide=size*.94,disc=platterSide*.985,label=disc*.43,armWidth=Math.max(6,size*.028),armLength=size*.445;
  const platterLeft=(size-platterSide)/2-1;
  return <View testID="vinyl-turntable" collapsable={false} accessible={false} pointerEvents="none" style={{height:size,alignItems:'center',justifyContent:'center'}}>
    <View testID="vinyl-canvas" collapsable={false} style={{width:size,height:size}}>
      <View testID="vinyl-deck" collapsable={false} style={{position:'absolute',left:0,top:0,width:size,height:size,borderRadius:radius.deck,backgroundColor:paper.deck,borderWidth:1,borderColor:paper.deckEdge,boxShadow:'0px 10px 22px rgba(46,36,30,0.26)'}}>
        <View style={{position:'absolute',left:1,right:1,top:1,height:size*.5,borderTopLeftRadius:radius.deck,borderTopRightRadius:radius.deck,backgroundColor:'rgba(255,255,255,0.035)'}}/>
      </View>
      <View testID="vinyl-platter" collapsable={false} style={{position:'absolute',left:platterLeft,top:(size-platterSide)/2,width:platterSide,height:platterSide,borderRadius:platterSide/2,backgroundColor:'#0F0F10',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
        <Animated.View testID="vinyl-record" collapsable={false} style={{width:disc,height:disc,borderRadius:disc/2,backgroundColor:paper.record,alignItems:'center',justifyContent:'center',transform:[{rotate:rotation.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}>
          {Array.from({length:24},(_,i)=>{const d=disc-(i*disc*.0245);return <View key={i} style={{position:'absolute',width:d,height:d,borderWidth:1,borderColor:i%2?paper.grooveA:paper.grooveB,borderRadius:d/2,opacity:Math.max(.25,1-i*.03)}}/>;})}
          <View style={{width:label,height:label,borderRadius:label/2,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.10)'}}><Cover services={services} track={track} size={label}/></View>
        </Animated.View>
        <View testID="vinyl-spindle" collapsable={false} style={{position:'absolute',width:9,height:9,borderRadius:5,backgroundColor:'#D7DDDF',borderWidth:2,borderColor:'#53585B'}}/>
      </View>
      <Animated.View testID="vinyl-tonearm" collapsable={false} style={{position:'absolute',width:armWidth,height:armLength,left:size*.835-armWidth/2,top:size*.175,transform:[{rotate:tonearm.interpolate({inputRange:[0,1],outputRange:['0deg','21.6deg']})}],transformOrigin:'top'}}>
        <View style={{position:'absolute',top:size*.03,left:0,width:armWidth,height:size*.34,borderRadius:armWidth/2,backgroundColor:paper.arm,borderWidth:1,borderColor:paper.armEdge}}/>
        <View testID="vinyl-cartridge" collapsable={false} style={{position:'absolute',top:size*.335,left:-armWidth*.45,width:armWidth*1.9,height:size*.082,borderRadius:3,backgroundColor:paper.armDark,borderWidth:1,borderColor:paper.armEdge}}>
          <View style={{position:'absolute',right:3,top:4,width:3,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.55)'}}/>
          <View style={{position:'absolute',right:3,bottom:4,width:3,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.55)'}}/>
        </View>
        <View testID="vinyl-counterweight" collapsable={false} style={{position:'absolute',top:-size*.155,left:(armWidth-size*.072)/2,width:size*.072,height:size*.115,borderRadius:size*.014,backgroundColor:paper.arm,borderWidth:1,borderColor:paper.armEdge}}><View style={{position:'absolute',left:2,right:2,top:'42%',height:2,backgroundColor:'rgba(0,0,0,0.22)'}}/></View>
      </Animated.View>
      <View testID="vinyl-pivot" collapsable={false} style={{position:'absolute',width:size*.105,height:size*.105,left:size*.7825,top:size*.1225,borderRadius:size*.0525,backgroundColor:'#3A3F45',borderWidth:2,borderColor:paper.armEdge,alignItems:'center',justifyContent:'center'}}><View style={{width:size*.036,height:size*.036,borderRadius:size*.018,backgroundColor:'#D8DFE2'}}/></View>
    </View>
  </View>;
}
export function FrequencyHalo({services,playing,children}:PropsWithChildren<{services:Services;playing:boolean}>){
  const spectrum=useSyncExternalStore(services.playback.spectrum.subscribe,services.playback.spectrum.getSnapshot);
  const controller=services.playback.controller,state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const gesture=useRef(new RingSeekGesture()).current,[preview,setPreview]=useState<number>();
  const token=state.phase==='ready'&&state.token?JSON.stringify(state.token):undefined;
  const current=()=>{const value=controller.getSnapshot();return {token:value.phase==='ready'&&value.token?JSON.stringify(value.token):undefined,duration:value.duration};};
  useEffect(()=>{setPreview(gesture.preview(token,state.duration));},[gesture,token,state.duration]);
  useEffect(()=>()=>gesture.cancel(),[gesture]);
  useEffect(()=>{const listener=AppState.addEventListener('change',value=>{if(value!=='active'){gesture.cancel();setPreview(undefined);}});return()=>listener.remove();},[gesture]);
  const cancel=()=>{gesture.cancel();setPreview(undefined);};
  const fraction=(event:GestureResponderEvent)=>ringFraction(event.nativeEvent.locationX,event.nativeEvent.locationY,148,26);
  const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const enabled=!!token&&Number.isFinite(state.duration)&&state.duration>0;
  const effectivePreview=gesture.preview(token,state.duration)===undefined?undefined:preview;
  const progress=effectivePreview??(enabled?Math.max(0,Math.min(1,state.position/state.duration)):0);
  const position=effectivePreview===undefined?state.position:effectivePreview*state.duration;
  const showSpectrum=playing&&spectrum.supported&&spectrum.bands.length>=32;
  return <View style={{width:148,height:148,alignItems:'center',justifyContent:'center'}}>
    <View testID="wave-seek-ring" accessible accessibilityRole="adjustable" accessibilityLabel="环形播放进度" accessibilityHint="沿外环拖动，松手定位；中心按钮播放或暂停" accessibilityState={{disabled:!enabled}} accessibilityValue={{min:0,max:Math.floor(state.duration),now:Math.floor(position),text:`${clock(position)} / ${clock(state.duration)}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]}
      onAccessibilityAction={event=>{if(enabled){cancel();controller.seek(controller.getSnapshot().position+(event.nativeEvent.actionName==='increment'?10:-10));}}}
      onStartShouldSetResponder={event=>{const {locationX:x,locationY:y,touches}=event.nativeEvent,radius=Math.hypot(x-74,y-74);return enabled&&touches.length===1&&radius>=52&&radius<=74;}}
      onResponderGrant={event=>{const value=current();setPreview(gesture.begin(value.token,value.duration,fraction(event)));}}
      onResponderMove={event=>{if(event.nativeEvent.touches.length!==1){cancel();return;}const value=current();setPreview(gesture.move(value.token,value.duration,fraction(event)));}}
      onResponderRelease={event=>{const value=current();if(fraction(event)===undefined){cancel();return;}gesture.move(value.token,value.duration,fraction(event));const seconds=gesture.finish(value.token,value.duration);setPreview(undefined);if(seconds!==undefined)controller.seek(seconds);}}
      onResponderTerminationRequest={()=>false} onResponderTerminate={cancel} style={{position:'absolute',width:148,height:148}}>
      <View pointerEvents="none" accessible={false} style={{width:148,height:148}}>{Array.from({length:60},(_,i)=>{const angle=i/60*Math.PI*2-Math.PI/2;return <View key={i} style={{position:'absolute',left:72+Math.cos(angle)*57,top:72+Math.sin(angle)*57,width:3,height:3,borderRadius:2,backgroundColor:i/60<progress?'#FFFFFF':'rgba(255,255,255,0.22)'}}/>;})}</View>
    </View>
    {showSpectrum&&<View testID="wave-spectrum-bars" pointerEvents="none" accessible={false} style={{position:'absolute',width:148,height:148}}>{Array.from({length:32},(_,i)=>{const angle=(i/32)*Math.PI*2,length=3+Math.min(1,Math.max(0,spectrum.bands[i]??0))*13;return <View key={i} accessible={false} style={{position:'absolute',width:3,height:length,borderRadius:2,backgroundColor:'rgba(255,255,255,0.66)',left:72+Math.cos(angle)*64,top:72+Math.sin(angle)*64-length/2,transform:[{rotate:`${angle+Math.PI/2}rad`}]}}/>;})}</View>}
    <View style={{width:104,height:104,borderRadius:52,borderWidth:3,borderColor:'rgba(255,255,255,0.5)',alignItems:'center',justifyContent:'center'}}>{children}</View>
  </View>;
}
