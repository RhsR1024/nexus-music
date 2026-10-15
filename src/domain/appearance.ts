export type VisualTheme = 'classic' | 'blush' | 'soft';
export type Accent = 'rose' | 'coral' | 'purple' | 'blue' | 'orange';
export interface AppearanceOptions {visualTheme:VisualTheme;accent:Accent;backgroundStyle:'gradient'|'solid';glassNavigation:boolean}
export const appearanceDefaults:AppearanceOptions={visualTheme:'blush',accent:'rose',backgroundStyle:'gradient',glassNavigation:true};
export const accentColors:Record<Accent,readonly[string,string]>={rose:['#BE3458','#FF94B0'],coral:['#BA4240','#FF9B94'],purple:['#7650AB','#D4B4FF'],blue:['#2E64A0','#9AC8FF'],orange:['#A65A14','#FFC485']};
export function appearancePalette(mode:'light'|'dark',options:AppearanceOptions){
  const dark=mode==='dark';
  const backgrounds:Record<VisualTheme,readonly[string,string,string]>={
    classic:dark?['#17202C','#1D2533','#222434']:['#F5F6FA','#E1EAF5','#F7F1F4'],
    blush:dark?['#241C27','#35232F','#222334']:['#FAF1EE','#F1D5DF','#E1E8F7'],
    soft:dark?['#1A242C','#24303A','#242839']:['#EEF3F7','#DAE6EF','#ECE7F0'],
  };
  return {background:backgrounds[options.visualTheme],text:dark?'#F6F0F2':'#242026',secondary:dark?'#C2B6C2':'#756A75',
    accent:accentColors[options.accent][dark?1:0],surface:dark?'#332B38':'#FFF5F5',border:dark?'#514454':'#E4CCD3',
    glass:dark?'rgba(41,33,46,0.75)':'rgba(255,245,249,0.68)',selected:dark?'#503044':'#EDD0DB'};
}
