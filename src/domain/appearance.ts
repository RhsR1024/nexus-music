export type VisualTheme = 'classic' | 'blush' | 'soft';
export type Accent = 'rose' | 'coral' | 'purple' | 'blue' | 'orange';
export interface AppearanceOptions {visualTheme:VisualTheme;accent:Accent;backgroundStyle:'gradient'|'solid'|'image';backgroundOpacity:number;playerBackground:'artwork'|'solid'|'photo';playerBlur:number;playerDarkness:number;coverRadius:number;coverColor:boolean;globalBackgroundMotion:boolean;dynamicBackground:boolean;glassNavigation:boolean}
export const appearanceDefaults:AppearanceOptions={visualTheme:'blush',accent:'rose',backgroundStyle:'gradient',backgroundOpacity:.25,playerBackground:'artwork',playerBlur:55,playerDarkness:.55,coverRadius:24,coverColor:false,globalBackgroundMotion:false,dynamicBackground:false,glassNavigation:true};
export const accentColors:Record<Accent,readonly[string,string]>={rose:['#BE3458','#FF94B0'],coral:['#BA4240','#FF9B94'],purple:['#7650AB','#D4B4FF'],blue:['#2E64A0','#9AC8FF'],orange:['#A65A14','#FFC485']};
export function appearancePalette(mode:'light'|'dark',options:AppearanceOptions,coverColor?:string){
  const dark=mode==='dark';
  const backgrounds:Record<VisualTheme,readonly[string,string,string]>={
    classic:dark?['#17202C','#1D2533','#222434']:['#F5F6FA','#E1EAF5','#F7F1F4'],
    blush:dark?['#241C27','#35232F','#222334']:['#FAF1EE','#F1D5DF','#E1E8F7'],
    soft:dark?['#1A242C','#24303A','#242839']:['#EEF3F7','#DAE6EF','#ECE7F0'],
  };
  const tinted=(options.coverColor||options.globalBackgroundMotion)&&coverColor&&/^#[0-9a-f]{6}$/i.test(coverColor);
  return {background:tinted?coverThemeGradient(coverColor!,mode):backgrounds[options.visualTheme],text:dark?'#F6F0F2':'#242026',secondary:dark?'#C2B6C2':tinted?'#625762':'#756A75',
    accent:accentColors[options.accent][dark?1:0],surface:dark?'#332B38':'#FFF5F5',border:dark?'#514454':'#E4CCD3',
    glass:dark?'rgba(41,33,46,0.75)':'rgba(255,245,249,0.68)',selected:dark?'#503044':'#EDD0DB'};
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

export function playerBackgroundImage(mode:AppearanceOptions['playerBackground'],photoSkin:boolean,custom:string|undefined,cover:string|undefined,failed:readonly string[]=[]):string|undefined {
  if(mode==='solid')return;
  const preferred=custom&&(photoSkin||mode==='photo')?custom:cover;
  return preferred&&failed.includes(preferred)?(cover&&failed.includes(cover)?undefined:cover):preferred;
}
