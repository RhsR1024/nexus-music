import {defaults,validatePreferences} from '../app/preferences.ts';
import type {AppearanceOptions} from '../domain/appearance.ts';

export const themeConfigLimit=64*1024;
const fields=['visualTheme','accent','backgroundStyle','backgroundOpacity','cardOpacity','backgroundMask','maskColor','playerBackground','playerBlur','playerDarkness','coverRadius','coverColor','globalBackgroundMotion','dynamicBackground','glassNavigation'] as const satisfies readonly(keyof AppearanceOptions)[];
const legacyFields=['visualTheme','accent','backgroundStyle','cardOpacity'] as const;
export interface ThemeConfig {format:'nexus-theme';version:1;appearance:AppearanceOptions}
function size(text:string){let bytes=0;for(const char of text){const code=char.codePointAt(0)!;bytes+=code<128?1:code<2048?2:code<65536?3:4;if(bytes>themeConfigLimit)throw Error('主题配置超过64KiB');}}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function select(value:Record<string,unknown>,keys:readonly string[]){if(keys.some(key=>!Object.hasOwn(value,key)))throw Error('主题配置不完整');return Object.fromEntries(keys.map(key=>[key,value[key]]));}
function clean(value:Record<string,unknown>):AppearanceOptions{
  const valid=validatePreferences({...defaults,...select(value,fields)});
  return Object.fromEntries(fields.map(key=>[key,valid[key]])) as unknown as AppearanceOptions;
}
export function encodeThemeConfig(value:AppearanceOptions):string{
  const text=JSON.stringify({format:'nexus-theme',version:1,appearance:clean(value as unknown as Record<string,unknown>)} satisfies ThemeConfig,null,2);size(text);return text;
}
export function decodeThemeConfig(text:string):{appearance:Partial<AppearanceOptions>;legacy:boolean}{
  size(text);const value:unknown=JSON.parse(text);if(!object(value))throw Error('主题配置无效');
  if(Object.hasOwn(value,'format')||Object.hasOwn(value,'version')){
    if(value.format!=='nexus-theme'||value.version!==1||!object(value.appearance))throw Error('无法识别的音枢主题版本');
    return {appearance:clean(value.appearance),legacy:false};
  }
  // Older Nexus exports contained exactly these four theme parameters. Keep
  // every other setting on the receiving device rather than filling defaults.
  if(Object.keys(value).length!==legacyFields.length)throw Error('无法识别的主题配置');
  const patch=select(value,legacyFields);validatePreferences({...defaults,...patch});
  return {appearance:patch,legacy:true};
}
