import {useRef,useState} from 'react';
import {PanResponder,StyleSheet,View} from 'react-native';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export const ALPHABET_LETTERS=['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','#'] as const;
export type AlphabetLetter=typeof ALPHABET_LETTERS[number];

// Standard GB2312/Chinese collator boundary anchors for A-Z initial mapping.
const ZH_BOUNDARIES:[AlphabetLetter,string][]=[
  ['A','阿'],['B','芭'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],
  ['H','哈'],['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],
  ['P','啪'],['Q','期'],['R','然'],['S','撒'],['T','塌'],['W','挖'],['X','昔'],
  ['Y','压'],['Z','匝'],
];

export function indexLetterForText(raw:string):AlphabetLetter {
  const trimmed=raw.trim();
  if(!trimmed)return '#';
  const ch=trimmed[0]!;
  const upper=ch.toUpperCase();
  if(upper>='A'&&upper<='Z')return upper as AlphabetLetter;
  if(/[\u4e00-\u9fff]/.test(ch)){
    let matched:AlphabetLetter='A';
    for(const [letter,anchor] of ZH_BOUNDARIES){
      if(ch.localeCompare(anchor,'zh-Hans-CN')>=0)matched=letter;
      else break;
    }
    return matched;
  }
  return '#';
}

export function buildAlphabetIndexMap<T>(items:readonly T[],getTitle:(item:T)=>string):ReadonlyMap<AlphabetLetter,number> {
  const map=new Map<AlphabetLetter,number>();
  for(let i=0;i<items.length;i++){
    const letter=indexLetterForText(getTitle(items[i]!));
    if(!map.has(letter))map.set(letter,i);
  }
  return map;
}

export function AlphabetIndexBar({
  available,
  activeLetter,
  onSelect,
}:{
  available?:ReadonlySet<AlphabetLetter>;
  activeLetter?:AlphabetLetter;
  onSelect:(letter:AlphabetLetter)=>void;
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const [dragging,setDragging]=useState<AlphabetLetter|null>(null);
  const barLayout=useRef({y:0,height:1});
  const lastLetter=useRef<AlphabetLetter|null>(null);
  const containerRef=useRef<View>(null);

  const pickAtPageY=(pageY:number)=>{
    const {y,height}=barLayout.current;
    if(height<=0)return;
    const ratio=Math.max(0,Math.min(0.9999,(pageY-y)/height));
    const idx=Math.floor(ratio*ALPHABET_LETTERS.length);
    const letter=ALPHABET_LETTERS[idx]!;
    if(letter!==lastLetter.current){
      lastLetter.current=letter;
      setDragging(letter);
      onSelect(letter);
    }
  };

  const measureBar=()=>{
    containerRef.current?.measureInWindow((_x,y,_w,h)=>{
      if(h>0)barLayout.current={y,height:h};
    });
  };

  const pan=useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:()=>true,
      onMoveShouldSetPanResponder:()=>true,
      onPanResponderGrant:evt=>{
        measureBar();
        pickAtPageY(evt.nativeEvent.pageY);
      },
      onPanResponderMove:evt=>{
        pickAtPageY(evt.nativeEvent.pageY);
      },
      onPanResponderRelease:()=>{
        lastLetter.current=null;
        setDragging(null);
      },
      onPanResponderTerminate:()=>{
        lastLetter.current=null;
        setDragging(null);
      },
    }),
  ).current;

  return <>
    {dragging&&<View pointerEvents="none" style={[styles.bubble,{backgroundColor:s.dark?'rgba(42,34,48,0.92)':'rgba(255,252,251,0.92)',borderColor:s.cardBorder},s.dockShadow]}>
      <Text style={{color:s.accent,fontSize:28,fontWeight:'800'}}>{dragging}</Text>
    </View>}
    <View
      ref={containerRef}
      testID="local-alphabet-index"
      onLayout={measureBar}
      style={[styles.bar,{backgroundColor:s.dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.38)'}]}
      {...pan.panHandlers}>
      {ALPHABET_LETTERS.map(letter=>{
        const hasItems=!available||available.has(letter);
        const focused=dragging===letter||(!dragging&&activeLetter===letter);
        return <View key={letter} style={[styles.cell,focused&&{backgroundColor:s.accent}]}>
          <Text style={[styles.letter,{color:focused?'#FFFFFF':hasItems?s.ink:s.subtle,opacity:focused||hasItems?1:0.42}]}>{letter}</Text>
        </View>;
      })}
    </View>
  </>;
}

const styles=StyleSheet.create({
  bar:{position:'absolute',right:2,top:'8%',bottom:'14%',width:20,borderRadius:10,paddingVertical:4,alignItems:'center',justifyContent:'space-between',zIndex:10},
  cell:{width:16,height:14,borderRadius:7,alignItems:'center',justifyContent:'center'},
  letter:{fontSize:9.5,lineHeight:11,fontWeight:'700'},
  bubble:{position:'absolute',right:36,top:'40%',width:56,height:56,borderRadius:28,borderWidth:1,alignItems:'center',justifyContent:'center',zIndex:20},
});
