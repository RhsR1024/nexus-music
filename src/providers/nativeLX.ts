import { requireNativeModule } from 'expo';
import { createNativeLX,createNativeDiagnosticLX,type NativeDiagnosticLX } from './nativeLXAdapter.ts';
export const loadNativeDiagnosticLX=()=>createNativeDiagnosticLX(requireNativeModule<NativeDiagnosticLX>('NexusNative'));
import {createAudioProbe,type AudioProbeNative} from './audioProbe.ts';
export const loadAudioProbe=(uuid:()=>string)=>createAudioProbe(requireNativeModule<AudioProbeNative>('NexusNative'),uuid);

export function loadNativeLX() {
  return createNativeLX(requireNativeModule<Parameters<typeof createNativeLX>[0]>('NexusNative'));
}
export function fetchSourceScript(url: string): Promise<string> {
  return requireNativeModule<{ fetchScript(url: string): Promise<string> }>('NexusNative').fetchScript(url);
}

export function loadNativeCovers(){return requireNativeModule<import('./covers.ts').CoverNative>('NexusNative');}

export const decodeImportText=(base64:string)=>requireNativeModule<{decodeImportText(value:string):Promise<string>}>('NexusNative').decodeImportText(base64);
export const decodeKRC=(base64:string)=>requireNativeModule<{decodeKRC(value:string):Promise<string>}>('NexusNative').decodeKRC(base64);
export const decodeQRC=(hex:string)=>requireNativeModule<{decodeQRC(value:string):Promise<string>}>('NexusNative').decodeQRC(hex);
