import {createContext,useContext,useMemo,useSyncExternalStore} from 'react';
import {useColorScheme} from 'react-native';
import {defaults,type PreferenceStore} from '../app/preferences.ts';
import {appearancePalette,type AppearanceOptions} from '../domain/appearance.ts';
export interface Theme {mode:'light'|'dark';color:(original:string)=>string;palette:ReturnType<typeof appearancePalette>;appearance:AppearanceOptions}
const lightColors:Record<string,string>={};
function assign(colors:string[],target:string){for(const color of colors)lightColors[color]=target;}
assign(['#111318','#171A20'],'#F5F7FA');
assign(['#1B1D2C','#1D222B','#222534','#22272A','#242934','#25283A','#292C3F'],'#E7EBF1');
assign(['#252D2A','#263329','#2B3730','#303A32'],'#E0EAD9');
assign(['#262A32','#2A2D35','#2A303A','#2E3440','#303744','#303745','#333946','#343B49','#353A46','#414754','#4B4D62'],'#C7D0DC');
assign(['#6E7788','#767D80','#768191','#777E89','#7C808C','#7E8592','#9296A2','#929CAB','#939AA6','#959EAC','#9D9EA9','#B3BBAF','#B5B4BF'],'#606D7F');
assign(['#A0BE79','#B6C993','#BCD994','#D9E1CE','#D9F49B'],'#3C6015');
assign(['#C6B7D9','#C7A1E2'],'#74528C');
assign(['#B9B39F','#C7AC90','#D3AB94','#D6B69A'],'#8F4C25');
assign(['#B7C3DA','#BFC8D9','#C2C7D3','#C4C8D4','#D5D7DF','#D5DCE7','#D8DFEA','#DFE4EE','#E1E6F0','#E5E8E0','#E5E8EE','#E8E9E4','#ECEBF3','#EEECE7','#F1EDE7','#F3F0E9','#F7F3ED'],'#253142');
lightColors['#202919']='#F5F9ED';
function createTheme(mode:'light'|'dark',appearance:AppearanceOptions):Theme{
  const palette=appearancePalette(mode,appearance);
  const targets:Record<string,string>={'#F5F7FA':palette.background[0],'#E7EBF1':palette.surface,'#E0EAD9':palette.selected,'#C7D0DC':palette.border,'#606D7F':palette.secondary,'#3C6015':palette.accent,'#253142':palette.text};
  return {mode,palette,appearance,color:original=>{const mapped=lightColors[original.toUpperCase()];return mapped?(targets[mapped]??(mode==='light'?mapped:original)):original;}};
}
export const darkTheme=createTheme('dark',defaults);
export const lightTheme=createTheme('light',defaults);
export const ThemeContext=createContext<Theme>(darkTheme);
export const useTheme=()=>useContext(ThemeContext);
const emptySubscribe=()=>()=>{};
const defaultSnapshot=()=>defaults;
export function useAppearance(store?:PreferenceStore){
  const preferences=useSyncExternalStore(store?.subscribe??emptySubscribe,store?.getSnapshot??defaultSnapshot),system=useColorScheme();
  const mode=(preferences.theme==='system'?system==='light':preferences.theme==='light')?'light':'dark';
  return useMemo(()=>createTheme(mode,preferences),[mode,preferences.visualTheme,preferences.accent,preferences.backgroundStyle,preferences.glassNavigation]);
}
export function useThemedStyles<T>(factory:(theme:Theme)=>T):T {const theme=useTheme();return useMemo(()=>factory(theme),[factory,theme]);}
