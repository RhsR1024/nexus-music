import {View} from 'react-native';

export function SkipGlyph({direction,width,height,gap,color}:{direction:'back'|'forward';width:number;height:number;gap:number;color:string}){
  return <View style={{flexDirection:'row',gap,transform:direction==='forward'?[{scaleX:-1}]:undefined}}>
    <View style={{width:0,height:0,borderTopWidth:height/2,borderBottomWidth:height/2,borderRightWidth:width,borderTopColor:'transparent',borderBottomColor:'transparent',borderRightColor:color}}/>
    <View style={{width:0,height:0,borderTopWidth:height/2,borderBottomWidth:height/2,borderRightWidth:width,borderTopColor:'transparent',borderBottomColor:'transparent',borderRightColor:color}}/>
  </View>;
}
