export type VisualTheme = 'classic' | 'blush' | 'soft' | 'blushpink' | 'pearl' | 'mint' | 'sunset' | 'azure' | 'marigold' | 'violet' | 'khaki' | 'plumtea' | 'lotus';
export const visualThemes: readonly VisualTheme[] = ['classic','blush','soft','blushpink','pearl','mint','sunset','azure','marigold','violet','khaki','plumtea','lotus'];
export const visualThemeLabels: Record<VisualTheme,string> = {classic:'经典',blush:'粉雾',soft:'柔和',blushpink:'脸红佳人',pearl:'Pearl',mint:'Mint',sunset:'Sunset',azure:'琉璃鸢蓝',marigold:'向日朱栗',violet:'黛紫蒲霞',khaki:'卡其浅缥',plumtea:'藤紫金茶',lotus:'黄赤藕荷'};
export type Accent = 'rose' | 'coral' | 'purple' | 'blue' | 'orange';
export type FlowPalette=readonly[string,string,string];
export function isFlowPalette(value:unknown):value is FlowPalette {return Array.isArray(value)&&value.length===3&&[0,1,2].every(index=>typeof value[index]==='string'&&/^#[0-9a-f]{6}$/i.test(value[index]));}
export interface AppearanceOptions {visualTheme:VisualTheme;accent:Accent;backgroundStyle:'gradient'|'solid'|'image';backgroundOpacity:number;cardOpacity:number;backgroundMask:number;maskColor:string;playerBackground:'artwork'|'solid'|'photo';playerBlur:number;playerDarkness:number;coverRadius:number;coverColor:boolean;globalBackgroundMotion:boolean;dynamicBackground:boolean;glassNavigation:boolean}
// IMG_4856 exposes 背景透明度/卡片透明度/背景遮罩/遮罩颜色/背景模糊. `cardOpacity`
// starts at 100% so existing cards stay opaque until the user lowers it; the
// reference screenshot itself is at 30%.
export const appearanceDefaults:AppearanceOptions={visualTheme:'blush',accent:'rose',backgroundStyle:'gradient',backgroundOpacity:.25,cardOpacity:1,backgroundMask:0,maskColor:'#FFFFFF',playerBackground:'artwork',playerBlur:55,playerDarkness:.55,coverRadius:24,coverColor:false,globalBackgroundMotion:false,dynamicBackground:false,glassNavigation:true};
export const accentColors:Record<Accent,readonly[string,string]>={rose:['#E83D56','#FF94B0'],coral:['#BA4240','#FF9B94'],purple:['#7650AB','#D4B4FF'],blue:['#2E64A0','#9AC8FF'],orange:['#A65A14','#FFC485']};
// Theme gradients are identified by the swatch hues in IMG_4855. The sampled
// swatch colours are keyed with their raw values; light stops are blended toward
// paper white and dark stops toward the app's dark foundation so body text keeps
// its contrast contract. Only the first three themes are original to this app;
// the rest are derived from the reference swatches, not recovered constants.
const themeHues:Record<VisualTheme,readonly[string,string,string]>={
  classic:['#F5F6FA','#E1EAF5','#F7F1F4'],
  // Light stops sampled from IMG_4851/4854/4855 (warm paper, not cool lavender).
  blush:['#FBF4EF','#F7E9DE','#F3EDE6'],
  soft:['#EEF3F7','#DAE6EF','#ECE7F0'],
  blushpink:['#EDEBEA','#F0DCDD','#F1BAC0'],
  pearl:['#F2F4F8','#F5F8FE','#F1F6FE'],
  mint:['#EEF3EE','#F2F9F3','#EDF7F0'],
  sunset:['#F5EBE3','#FCF0E6','#FBE9DD'],
  azure:['#8C99B8','#BBABBE','#D0BAC7'],
  marigold:['#DBDAC5','#DAB16C','#CE9368'],
  violet:['#B8BAC6','#9A787F','#CB9483'],
  khaki:['#D6DBD2','#D6BB8F','#D0A18D'],
  plumtea:['#DFEAF1','#A8A4C2','#807494'],
  lotus:['#DDE8F0','#CE9C86','#D2917A'],
};
function blend(color:string,target:readonly[number,number,number],amount:number){
  if(!/^#[0-9a-f]{6}$/i.test(color))return color;
  const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16));
  return '#'+rgb.map((value,index)=>Math.round(value*(1-amount)+target[index]!*amount).toString(16).padStart(2,'0')).join('');
}
const paper:[number,number,number]=[255,251,247],ink:[number,number,number]=[27,23,32];
// The three original themes keep their hand-tuned stops in both modes.
const originalThemeDark:Partial<Record<VisualTheme,readonly[string,string,string]>>={
  classic:['#17202C','#1D2533','#222434'],
  blush:['#241C27','#35232F','#222334'],
  soft:['#1A242C','#24303A','#242839'],
};
export function themeBackground(theme:VisualTheme,mode:'light'|'dark'):readonly[string,string,string]{
  if(themeHues[theme].length&&originalThemeDark[theme]){
    return (mode==='dark'?originalThemeDark[theme]:themeHues[theme])!;
  }
  const amounts:[number,number,number]=mode==='dark'?[.86,.82,.78]:[.6,.42,.3];
  return themeHues[theme].map((hue,index)=>blend(hue,mode==='dark'?ink:paper,amounts[index]!)) as unknown as readonly[string,string,string];
}
function withAlpha(color:string,alpha:number){
  if(alpha>=.999)return color;
  if(!/^#[0-9a-f]{6}$/i.test(color))return color;
  const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Number(alpha.toFixed(3))})`;
}
export function appearancePalette(mode:'light'|'dark',options:AppearanceOptions,coverColor?:string){
  const dark=mode==='dark';
  const backgrounds:Record<VisualTheme,readonly[string,string,string]>=Object.fromEntries(visualThemes.map(theme=>[theme,themeBackground(theme,mode)])) as Record<VisualTheme,readonly[string,string,string]>;
  const tinted=(options.coverColor||options.globalBackgroundMotion)&&coverColor&&/^#[0-9a-f]{6}$/i.test(coverColor);
  // 100% cards keep the previous solid fill; lower values fade toward the glass tint.
  const cardAlpha=Math.max(.35,Math.min(1,options.cardOpacity));
  const surface=dark?'#332B38':'#FFF9F5',selected=dark?'#503044':'#F3E2D8';
  return {background:tinted?coverThemeGradient(coverColor!,mode):backgrounds[options.visualTheme],text:dark?'#F6F0F2':'#2A241F',secondary:dark?'#C2B6C2':tinted?'#625762':'#8C7F75',
    accent:accentColors[options.accent][dark?1:0],surface:withAlpha(surface,cardAlpha),border:dark?'#514454':'#EADFD6',
    glass:dark?'rgba(41,33,46,0.75)':'rgba(255,249,245,0.72)',selected:withAlpha(selected,cardAlpha)};
}

// Original bounded tint mapping, not a recovered Sollin palette algorithm.
// Keep theme luminance predictable for semantic text and controls.
export function coverThemeGradient(color:string,mode:'light'|'dark'):readonly[string,string,string]{
  const rgb=/^#[0-9a-f]{6}$/i.test(color)?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):[82,104,120];
  const base=mode==='light'?[255,252,254]:[22,19,27];
  const mix=(amount:number)=>'#'+rgb.map((value,index)=>Math.round(base[index]!*(1-amount)+value*amount).toString(16).padStart(2,'0')).join('');
  return [mix(.12),mix(.06),mix(.09)];
}

export function darkenCoverColor(color:string):string {
  if(!/^#[0-9a-f]{6}$/i.test(color))return '#183647';
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  // A dark tinted foundation keeps white player controls legible even without artwork.
  const scale=Math.min(1,72/Math.max(...rgb,1));return '#'+rgb.map(value=>Math.round(value*scale).toString(16).padStart(2,'0')).join('');
}

// Bounded static fallback behind the native scene, also used before it mounts.
// The native scene receives the raw palette and owns its HSL/gradient math.
export function flowThemeGradient(palette:FlowPalette,mode:'light'|'dark'):FlowPalette {
  return [coverThemeGradient(palette[0],mode)[0],coverThemeGradient(palette[1],mode)[1],coverThemeGradient(palette[2],mode)[2]];
}

export function playerBackgroundImage(mode:AppearanceOptions['playerBackground'],photoSkin:boolean,custom:string|undefined,cover:string|undefined,failed:readonly string[]=[]):string|undefined {
  if(mode==='solid')return;
  const preferred=custom&&(photoSkin||mode==='photo')?custom:cover;
  return preferred&&failed.includes(preferred)?(cover&&failed.includes(cover)?undefined:cover):preferred;
}
