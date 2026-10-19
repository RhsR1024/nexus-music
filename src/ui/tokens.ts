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

// Vinyl page paper surface, sampled from IMG_4851. Text/icon colors are fixed
// because the tinted gradient is always mixed toward white in light mode.
export const paper = {
  background: '#F7F0E8',
  text: '#2A241F',
  secondary: '#8C7F75',
  icon: '#4A423C',
  track: 'rgba(74,66,60,0.20)',
  accent: '#8E4A4E',
  deck: '#141416',
  deckEdge: '#2A2A2D',
  record: '#0B0B0C',
  grooveA: '#171719',
  grooveB: '#101012',
  arm: '#C7CBD2',
  armEdge: '#E4E7EB',
  armDark: '#5C6167',
} as const;
