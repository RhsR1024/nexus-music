import {useRef,useState,type ReactNode} from 'react';
import {PanResponder,Pressable,View} from 'react-native';
import {Text} from './Typography.tsx';
export function SwipeRemoveRow({children,onRemove,label,disabled=false}:{children:ReactNode;onRemove:()=>void;label:string;disabled?:boolean}){
  const [open,setOpen]=useState(false),latest=useRef({disabled,onRemove});latest.current={disabled,onRemove};
  const responder=useRef(PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>!latest.current.disabled&&Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy)*1.5,
    onPanResponderRelease:(_,g)=>{if(!latest.current.disabled&&Math.abs(g.dx)>50)setOpen(g.dx<0);},onPanResponderTerminationRequest:()=>true})).current;
  return <View {...responder.panHandlers} accessibilityActions={[{name:'delete',label:`移除${label}`}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='delete'&&!disabled)latest.current.onRemove();}}>
    {children}{open&&<Pressable accessibilityRole="button" accessibilityLabel={`确认移除：${label}`} disabled={disabled} onPress={()=>latest.current.onRemove()} style={{backgroundColor:'#9D3333',padding:16,borderRadius:10,alignItems:'center',marginBottom:8}}><Text style={{color:'#FFFFFF'}}>移除此条</Text></Pressable>}
  </View>;
}
