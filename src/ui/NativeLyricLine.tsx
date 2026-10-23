import {memo} from 'react';
import {requireNativeView} from 'expo';
import {StyleSheet,Text,View,useWindowDimensions,type ViewProps} from 'react-native';
import type {StageStyle} from '../app/preferences.ts';
import type {LyricLine} from '../lyrics/parser.ts';
const NativeLine=requireNativeView<ViewProps&{configuration:string}>('NexusLyrics');
// RN measures the same font/line height; native draws and animates visible ink.
export const NativeLyricLine=memo(function NativeLyricLine({line,position,playing,size,color,center,font,fontURI,lineHeight=1.35,blur=0,emphasis=true,stageStyle='classic',weight='600'}:{line:LyricLine;position:number;playing:boolean;size:number;color:string;center:boolean;font?:string;fontURI?:string;lineHeight?:number;blur?:number;emphasis?:boolean;stageStyle?:StageStyle;weight?:'600'|'700'|'800'|'900'}) {
  // TextKit receives explicit points. Measure with those same points instead
  // of scaling only the invisible RN placeholder at accessibility text sizes.
  const points=Math.min(100,Math.max(10,size*useWindowDimensions().fontScale));
  return <View pointerEvents="none"><Text accessible={false} allowFontScaling={false} style={{fontSize:points,lineHeight:Math.ceil(points*lineHeight),fontFamily:font,fontWeight:font?'400':weight,textAlign:center?'center':'left',opacity:0}}>{line.text}</Text>
    <NativeLine testID={line.words?'native-word-lyrics':'native-lyric-line'} accessible={false} style={StyleSheet.absoluteFill} configuration={JSON.stringify({text:line.text,words:line.words,position,playing,size:points,color,center,fontURI,lineHeight,blur,emphasis,stageStyle,weight})}/>
  </View>;
});
