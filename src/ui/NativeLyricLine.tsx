import {requireNativeView} from 'expo';
import {StyleSheet,Text,View,type ViewProps} from 'react-native';
import type {LyricLine} from '../lyrics/parser.ts';
const NativeLine=requireNativeView<ViewProps&{configuration:string}>('NexusLyrics');
// Invisible RN text supplies wrapping height; native TextKit alone animates ink.
export function NativeLyricLine({line,position,playing,size,color,center,font,fontURI}:{line:LyricLine;position:number;playing:boolean;size:number;color:string;center:boolean;font?:string;fontURI?:string}) {
  return <View pointerEvents="none"><Text accessible={false} style={{fontSize:size,lineHeight:Math.ceil(size*1.35),fontFamily:font,fontWeight:font?'400':'600',textAlign:center?'center':'left',opacity:0}}>{line.text}</Text>
    <NativeLine testID="native-word-lyrics" accessible={false} style={StyleSheet.absoluteFill} configuration={JSON.stringify({text:line.text,words:line.words,position,playing,size,color,center,fontURI})}/>
  </View>;
}
