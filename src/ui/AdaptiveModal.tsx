import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {Animated,Modal as NativeModal,PanResponder,Platform,Pressable,View,useWindowDimensions,type ModalProps} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {appearanceSheetLayout} from './tokens.ts';
import {PresentationRegistry,coversPresentation,rootPresentation} from '../appearance/presentation.ts';

const orientations:NonNullable<ModalProps['supportedOrientations']>=['portrait','portrait-upside-down','landscape-left','landscape-right'];

type Scope={registry:PresentationRegistry;id:symbol};
const PresentationContext=createContext<Scope|undefined>(undefined);
const noSubscribe=()=>()=>{},rootSnapshot=()=>rootPresentation;
export function PresentationProvider({children}:PropsWithChildren){
  const [registry]=useState(()=>new PresentationRegistry());
  const scope=useMemo(()=>({registry,id:rootPresentation}),[registry]);
  return <PresentationContext.Provider value={scope}>{children}</PresentationContext.Provider>;
}
export function usePresentationVisible(){
  const scope=useContext(PresentationContext);
  const current=useSyncExternalStore(scope?.registry.subscribe??noSubscribe,scope?.registry.getSnapshot??rootSnapshot);
  return !scope||scope.id===current;
}

// Keep the four orientations, and retain ownership through iOS dismissal.
export function Modal(props:ModalProps){
  const parent=useContext(PresentationContext),[id]=useState(()=>Symbol('full screen'));
  const visible=props.visible!==false,covers=coversPresentation(props);
  const latestVisible=useRef(visible);latestVisible.current=visible;
  const cleanup=useRef<(()=>void)|undefined>(undefined);
  const release=useCallback(()=>{cleanup.current?.();cleanup.current=undefined;},[]);
  useLayoutEffect(()=>()=>release(),[parent?.registry,parent?.id,release]);
  useLayoutEffect(()=>{
    if(parent&&covers&&visible)cleanup.current=parent.registry.activate(id,parent.id);
    else if(!covers||Platform.OS!=='ios')release();
  },[parent?.registry,parent?.id,id,covers,visible,release]);
  const scope=useMemo(()=>parent&&covers?{registry:parent.registry,id}:parent,[parent,id,covers]);
  const dismiss=()=>{if(!latestVisible.current)release();props.onDismiss?.();};
  return <NativeModal supportedOrientations={orientations} {...props} onDismiss={dismiss}><PresentationContext.Provider value={scope}>{props.children}</PresentationContext.Provider></NativeModal>;
}
export function SheetModal(props:ModalProps){return <Modal presentationStyle="pageSheet" {...props}/>;}

// A production inset sheet for appearance controls. iOS's large pageSheet top
// changed across OS versions, so this surface owns its measured container.
// Dragging is restricted to its handle band and never competes with scrolling.
export function AppearanceSheetModal(props:ModalProps){
  const {width,height}=useWindowDimensions(),insets=useSafeAreaInsets();
  const offset=useRef(new Animated.Value(0)).current,latest=useRef(props);latest.current=props;
  useEffect(()=>{if(props.visible)offset.setValue(0);},[props.visible,offset]);
  const gesture=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,event)=>event.y0<insets.top+appearanceSheetLayout.topGap+appearanceSheetLayout.handleHeight&&event.dy>6&&Math.abs(event.dy)>Math.abs(event.dx),
    onPanResponderMove:(_,event)=>offset.setValue(Math.max(0,event.dy)),
    onPanResponderRelease:(event,state)=>{
      if(state.dy>80||state.vy>0.8)latest.current.onRequestClose?.(event);
      else Animated.spring(offset,{toValue:0,useNativeDriver:true,damping:24,stiffness:260,mass:1}).start();
    },
    onPanResponderTerminate:()=>Animated.spring(offset,{toValue:0,useNativeDriver:true,damping:24,stiffness:260,mass:1}).start(),
  }),[insets.top,offset]);
  if(Platform.OS!=='ios'||width>=600||width>height)return <SheetModal {...props}/>;
  return <Modal {...props} transparent presentationStyle="overFullScreen">
    <View style={{flex:1}}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭主题与背景" onPress={props.onRequestClose} style={{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(0,0,0,0.34)'}}/>
      <Animated.View testID="appearance-sheet-container" {...gesture.panHandlers} style={{flex:1,marginTop:insets.top+appearanceSheetLayout.topGap,borderTopLeftRadius:appearanceSheetLayout.radius,borderTopRightRadius:appearanceSheetLayout.radius,overflow:'hidden',transform:[{translateY:offset}]}}>{props.children}</Animated.View>
    </View>
  </Modal>;
}
