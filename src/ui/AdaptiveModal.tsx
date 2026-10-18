import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {Modal as NativeModal,Platform,type ModalProps} from 'react-native';
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
