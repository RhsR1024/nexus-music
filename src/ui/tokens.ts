import type {TextStyle} from 'react-native';

// Measured from the 1290x2796 (430x932pt) Sollin reference captures in
// resource/reference-ui. Values are points, not device pixels.
export const space = {xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, page: 31, section: 44} as const;

export const radius = {deck: 10, sm: 8, md: 12, lg: 16, xl: 20, xxl: 22, sheet: 28, full: 9999} as const;

export const typography = {
  display: {fontSize: 30, lineHeight: 36, fontWeight: '700'},
  title: {fontSize: 22, lineHeight: 28, fontWeight: '700'},
  heading: {fontSize: 18, lineHeight: 24, fontWeight: '600'},
  body: {fontSize: 15, lineHeight: 22, fontWeight: '400'},
  caption: {fontSize: 13, lineHeight: 19, fontWeight: '400'},
  micro: {fontSize: 11, lineHeight: 16, fontWeight: '400'},
} as const satisfies Record<string, TextStyle>;

export const controls = {hit: 44, icon: 23, transport: 24, play: 46} as const;
export const catalogArtwork = {square:64,videoWidth:96,videoAspect:16/9} as const;

// 4855/4856 @3x: top86pt with a59pt safe area; handle centre110pt.
export const appearanceSheetLayout = {topGap:27,radius:24,topPadding:2,handleHeight:44,titleGap:3} as const;
export const themeChoiceLayout = {radius:22,inset:16,verticalInset:11,columnGap:7.6,rowGap:8,height:36,chipInset:10.5,chipRadius:10,primaryMinWidth:85.3,swatch:17.3} as const;

// Settings sheets use their own cool chrome rather than the warm player theme.
// Stops sampled from the reference sheet's centre column (x=645) in IMG_4855/
// IMG_4856, from the 86pt sheet top to the screen bottom. The left and right
// edges drift ±12 RGB from this wash, which a vertical gradient cannot carry.
// The appearance sheet is cool-neutral in IMG_4855/4856: title and slider ink
// sample #171717, not the warm player text #2A241F.
export const settingsInk = {light: '#171717', dark: '#F2F2F7'} as const;
// Sheet section labels and slider values use a cool grey (#7B848E) in
// IMG_4855/4856; the field legends and colour-filter glyphs use #524343.
export const settingsMuted = {light: '#7B848E', dark: '#B9BBC4'} as const;
export const settingsLegend = {light: '#524343', dark: '#C9BFC0'} as const;

export const settingsSheet = {
  // The reference wash is a blurred blue backdrop, identical in IMG_4855 and
  // IMG_4856 at the same screen y: near-white at the sheet top, deepest blue
  // around 50-65%, then warming to pink at the bottom. The earlier stops came
  // from the top band only and faded to paper by 77%, which washed the slider
  // card out against the reference.
  lightGradient: ['#F2F4F3', '#ECF1F2', '#E1ECF2', '#D8E7F1', '#D0E4F0', '#C9E0F0', '#C6DFF0', '#BCDAEF', '#BFDBEF', '#C5DCEF', '#CEDEEF', '#D6E2F0', '#DDE4F0', '#E4E6F1'] as const,
  locations: [0, 0.10, 0.20, 0.30, 0.38, 0.45, 0.50, 0.58, 0.65, 0.72, 0.80, 0.88, 0.95, 1] as const,
  card: '#F7F7F4',
  themeChip: 'rgba(229,234,240,0.58)',
  // Backdrops behind the floating outlined-field labels, sampled at the
  // reference's 216pt/299pt border positions so the border gap stays seamless.
  fieldBackdrop: ['#E3E9F2', '#EAEBF2'] as const,
} as const;

// Vinyl page paper surface, sampled from IMG_4851. Text/icon colors are fixed
// because the tinted gradient is always mixed toward white in light mode.
export const paper = {
  background: '#F7F0E8',
  text: '#221919',
  secondary: '#8C7F75',
  icon: '#4A423C',
  iconStrong: '#403A39',
  toolInk: '#5E514F',
  toolMuted: '#BEABAA',
  track: 'rgba(74,66,60,0.18)',
  accent: '#8E4A4E',
  // IMG_4851 ink samples: title #171717, artist #8E776F, heart #8E7A74,
  // time #A58E88, tool/skip strokes #221919/#3F3A39, caption #938382.
  titleInk: '#171717',
  artistInk: '#8E776F',
  heartInk: '#8E7A74',
  timeInk: '#A58E88',
  vinylIcon: '#221919',
  skipInk: '#3F3A39',
  captionInk: '#938382',
  deck: '#141416',
  deckEdge: '#2A2A2D',
  record: '#0B0B0C',
  grooveA: '#171719',
  grooveB: '#101012',
  arm: '#C7CBD2',
  armEdge: '#E4E7EB',
  armDark: '#5C6167',
} as const;

// Screenshot-driven classic blush skin approximation (4854 r21); not a recovered
// cover-color algorithm. Applied below user masks, only to the default theme.
export const classicBlushBackground = {
  colors: ['#F6F2EE', '#F2D4C6', '#F6D8CE', '#FCE7E6'],
  locations: [0, .39, .74, 1],
} as const;

// 4854 three-line block: reclaim 23pt before the lyrics and return 11pt after
// them, keeping the control stack anchored without moving its children.
export const classicLyricLayout = {before: -10, after: 11} as const;
// 4854 r49: inactive 17.5pt restores the reference advance; the active row
// keeps 17pt so its measured width (781px) stays exact. The 17pt box preserves
// the baseline rhythm for both rows. r53 matched the reference band ink by
// raising the synthetic Black dilation to .26 (20833 vs 20916) yet scored
// slightly lower (region SSIM 79.42 vs 79.52), so .1 remains the best state.
export const classicLyricTypography = {size:17,inactiveSize:17.5,activeWeight:'900',inactiveWeight:'600',activeEmbolden:.1} as const;
export const classicInk = {text:'#201919',secondary:'#5C4E4A',lyricInactive:'rgba(32,25,25,0.545)'} as const;
export function classicLyricRow(live:boolean,fontScale:number,styleLineHeight:number){
  const size=(live?classicLyricTypography.size:classicLyricTypography.inactiveSize)*fontScale;
  const height=Math.ceil(classicLyricTypography.size*fontScale*Math.max(styleLineHeight,2));
  return {size,height,lineHeight:height/size,weight:live?classicLyricTypography.activeWeight:classicLyricTypography.inactiveWeight,embolden:live?classicLyricTypography.activeEmbolden:0};
}

// 4854: cover top 127pt; keep the following title/lyrics/control anchors.
export const classicArtworkLayout = {before: 3, titleBefore: -3} as const;

// Same-text 4854 probes: 24pt title, native text optical baselines.
export const classicMetadataLayout = {titleSize:24,titleLineHeight:28,titleOffset:2.67,artistOffset:1} as const;

// Cupertino backward/forward fill: 28x16.67pt reference ink.
export const classicSkipIcon = {size:23.58,lineHeight:28,triangleWidth:13,gap:2,scaleX:.872} as const;

// Paper progress thumb: compact downward shadow; the 12pt entity is unchanged.
export const paperProgressShadow = {shadowColor:'#4A2325',shadowOpacity:.28,shadowRadius:2.5,shadowOffset:{width:0,height:1.5}} as const;
