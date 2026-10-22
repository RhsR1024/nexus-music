import {requireNativeModule} from 'expo';

let appearanceCapture:boolean|undefined;

export function appearanceCaptureFixture(){
  if(appearanceCapture===undefined){
    try{appearanceCapture=requireNativeModule<{launchArgument(name:string):string|null}>('NexusNative').launchArgument('NEXUS_UI_APPEARANCE_SCROLL_ANCHOR')==='1';}
    catch{appearanceCapture=false;}
  }
  return appearanceCapture;
}
