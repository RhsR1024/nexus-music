import {requireNativeModule} from 'expo';
import {useEffect,useState} from 'react';

interface PowerStateEvent {
  lowPowerModeEnabled: boolean;
}

interface PowerNative {
  isLowPowerModeEnabled(): boolean;
  addListener(event:'onPowerStateChange',listener:(event:PowerStateEvent)=>void):{remove():void};
}

function currentLowPowerMode(){
  try{return requireNativeModule<PowerNative>('NexusNative').isLowPowerModeEnabled();}
  catch{return false;}
}

export function useLowPowerMode(){
  const [enabled,setEnabled]=useState(currentLowPowerMode);
  useEffect(()=>{
    let subscription:{remove():void}|undefined;
    try{
      const native=requireNativeModule<PowerNative>('NexusNative');
      setEnabled(native.isLowPowerModeEnabled());
      subscription=native.addListener('onPowerStateChange',event=>setEnabled(event.lowPowerModeEnabled));
    }catch{
      setEnabled(false);
    }
    return()=>subscription?.remove();
  },[]);
  return enabled;
}
