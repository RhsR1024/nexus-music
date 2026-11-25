import {requireOptionalNativeModule} from 'expo';
import type {LyricChineseMode} from '../app/preferences.ts';

type NativeScriptConverter={convertChinese?:(text:string,mode:string)=>string};
let nativeModule:NativeScriptConverter|null|undefined;
const cache=new Map<string,string>();

function converter():NativeScriptConverter|null{
  if(nativeModule!==undefined)return nativeModule;
  try{nativeModule=requireOptionalNativeModule<NativeScriptConverter>('NexusNative')??null;}
  catch{nativeModule=null;}
  return nativeModule;
}

export function convertLyricScript(text:string,mode:LyricChineseMode):string{
  if(!text||mode==='original')return text;
  const key=`${mode}:${text}`;
  const hit=cache.get(key);
  if(hit!==undefined)return hit;
  let result=text;
  try{
    const fn=converter()?.convertChinese;
    if(fn)result=fn(text,mode);
  }catch{result=text;}
  if(cache.size>512)cache.clear();
  cache.set(key,result);
  return result;
}
