import {Text as NativeText,type StyleProp,type TextStyle} from 'react-native';
// Official CupertinoIcons font is loaded by createServices before UI startup.
// Keep glyph ink independent of the enclosing >=44pt interactive hit area.
const glyphs={playFill:0xf488,backwardFill:0xf57c,forwardFill:0xf683,circleFill:0xf400,layersAltFill:0xf8e7,photoFill:0xf768} as const;
export function CupertinoGlyph({name,size=24,color,style}:{name:keyof typeof glyphs;size?:number;color:string;style?:StyleProp<TextStyle>}){
  return <NativeText accessible={false} allowFontScaling={false} style={[{fontFamily:'CupertinoIcons',fontSize:size,color},style]}>{String.fromCodePoint(glyphs[name])}</NativeText>;
}
