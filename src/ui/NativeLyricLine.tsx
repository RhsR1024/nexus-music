import {memo} from 'react';
import {requireNativeView} from 'expo';
import {StyleSheet,Text,View,type ViewProps} from 'react-native';
import type {LyricLine} from '../lyrics/parser.ts';
const NativeLine=requireNativeView<ViewProps&{configuration:string}>('NexusLyrics');
// RN measures the same font/line height; native draws and animates visible ink.
export const NativeLyricLine=memo(function NativeLyricLine({line,position,playing,size,color,center,font,fontURI,lineHeight=1.35,blur=0,emphasis=true}:{line:LyricLine;position:number;playing:boolean;size:number;color:string;center:boolean;font?:string;fontURI?:string;lineHeight?:number;blur?:number;emphasis?:boolean}) {
  return <View pointerEvents="none"><Text accessible={false} style={{fontSize:size,lineHeight:Math.ceil(size*lineHeight),fontFamily:font,fontWeight:font?'400':'600',textAlign:center?'center':'left',opacity:0}}>{line.text}</Text>
    <NativeLine testID={line.words?'native-word-lyrics':'native-lyric-line'} accessible={false} style={StyleSheet.absoluteFill} configuration={JSON.stringify({text:line.text,words:line.words,position,playing,size,color,center,fontURI,lineHeight,blur,emphasis})}/>
  </View>;
});
