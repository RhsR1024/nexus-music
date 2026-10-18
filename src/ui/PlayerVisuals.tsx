import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {AccessibilityInfo,Animated,AppState,Easing,View,type GestureResponderEvent} from 'react-native';
import {RingSeekGesture,ringFraction} from '../domain/ringSeek.ts';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {Cover} from './Cover.tsx';
import {usePresentationVisible} from './AdaptiveModal.tsx';
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
  // coordinates. Keep stable non-rotating geometry for layout/accessibility.
  const disc=size*.728,label=disc*.46,armWidth=Math.max(7,size*.035),armLength=size*.54;
  return <View testID="vinyl-turntable" collapsable={false} accessible={false} pointerEvents="none" style={{height:size+12,alignItems:'center',justifyContent:'center'}}>
    <View testID="vinyl-canvas" collapsable={false} style={{width:size,height:size}}>
      <View testID="vinyl-deck" collapsable={false} style={{position:'absolute',left:size*.015,right:size*.015,top:size*.055,bottom:size*.025,borderRadius:size*.06,backgroundColor:'#353B40',borderWidth:1,borderColor:'#697176',boxShadow:'0px 4px 7px rgba(0,0,0,0.24)'}}>
        <View style={{position:'absolute',left:3,right:3,top:3,bottom:3,borderRadius:size*.05,borderWidth:1,borderColor:'rgba(255,255,255,0.10)'}}/>
      </View>
      <View testID="vinyl-platter" collapsable={false} style={{position:'absolute',left:size*.035,top:size*.135,width:size*.8,height:size*.8,borderRadius:size*.4,backgroundColor:'#7D8589',borderWidth:2,borderColor:'#AAB0B2',alignItems:'center',justifyContent:'center',boxShadow:'0px 2px 4px rgba(0,0,0,0.4)'}}>
        <Animated.View testID="vinyl-record" collapsable={false} style={{width:disc,height:disc,borderRadius:disc/2,backgroundColor:'#111214',borderWidth:2,borderColor:'#333638',alignItems:'center',justifyContent:'center',transform:[{rotate:rotation.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}>
          {Array.from({length:14},(_,i)=><View key={i} style={{position:'absolute',width:disc-i*disc*.035,height:disc-i*disc*.035,borderWidth:1,borderColor:i%2?'#252729':'#1A1C1E',borderRadius:disc/2}}/>)}
          <View style={{width:label,height:label,borderRadius:label/2,overflow:'hidden'}}><Cover services={services} track={track} size={label}/></View>
        </Animated.View>
        <View testID="vinyl-spindle" collapsable={false} style={{position:'absolute',width:8,height:8,borderRadius:4,backgroundColor:'#D7DDDF',borderWidth:2,borderColor:'#53585B'}}/>
      </View>
      <Animated.View testID="vinyl-tonearm" collapsable={false} style={{position:'absolute',width:armWidth,height:armLength,left:size*.835-armWidth/2,top:size*.175,transform:[{rotate:tonearm.interpolate({inputRange:[0,1],outputRange:['4deg','24deg']})}],transformOrigin:'top'}}>
        <View style={{position:'absolute',top:0,left:0,width:armWidth,height:armLength*.86,borderRadius:armWidth/2,backgroundColor:'#A6ADB1',borderWidth:1,borderColor:'#D6DCDF'}}/>
        <View style={{position:'absolute',top:armLength*.78,left:-armWidth*.3,width:armWidth*1.6,height:armLength*.22,borderRadius:2,backgroundColor:'#515A60',borderWidth:1,borderColor:'#C0C7CB',transform:[{rotate:'-12deg'}]}}/>
      </Animated.View>
      <View testID="vinyl-pivot" collapsable={false} style={{position:'absolute',width:size*.10,height:size*.10,left:size*.785,top:size*.125,borderRadius:size*.05,backgroundColor:'#535D64',borderWidth:2,borderColor:'#B5BEC3',alignItems:'center',justifyContent:'center'}}><View style={{width:size*.035,height:size*.035,borderRadius:size*.018,backgroundColor:'#D8DFE2'}}/></View>
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
