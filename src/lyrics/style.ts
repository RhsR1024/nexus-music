export type LyricFontStyle='normal'|'italic'|'oblique';
export type LyricFontWeight='normal'|'bold';
export type LyricTextDecoration='underline'|'lineThrough'|'overline';

export interface LyricInlineStyle {
  fontStyle?:LyricFontStyle;
  fontWeight?:LyricFontWeight;
  textDecoration?:readonly LyricTextDecoration[];
  color?:string;
  backgroundColor?:string;
}

export interface LyricStyleSpec {
  fontStyle?:LyricFontStyle;
  fontWeight?:LyricFontWeight;
  textDecoration?:Partial<Record<LyricTextDecoration,boolean>>;
  color?:string;
  backgroundColor?:string;
}

export interface LyricStyleState {
  fontStyle?:LyricFontStyle;
  fontWeight?:LyricFontWeight;
  textDecoration:Partial<Record<LyricTextDecoration,boolean>>;
  color?:string;
  backgroundColor?:string;
}

const namedColors:Record<string,string>={
  transparent:'#00000000',black:'#000000ff',silver:'#c0c0c0ff',gray:'#808080ff',
  white:'#ffffffff',maroon:'#800000ff',red:'#ff0000ff',purple:'#800080ff',
  fuchsia:'#ff00ffff',magenta:'#ff00ffff',green:'#008000ff',lime:'#00ff00ff',
  olive:'#808000ff',yellow:'#ffff00ff',navy:'#000080ff',blue:'#0000ffff',
  teal:'#008080ff',aqua:'#00ffffff',cyan:'#00ffffff',
};
const decorationNames:LyricTextDecoration[]=['underline','lineThrough','overline'];
const decorationOff:Record<string,{name:LyricTextDecoration;value:boolean}>={
  noUnderline:{name:'underline',value:false},
  noLineThrough:{name:'lineThrough',value:false},
  noOverline:{name:'overline',value:false},
};

export function emptyStyle():LyricStyleState {
  return{textDecoration:{}};
}

export function parseColor(raw:string):string {
  const value=raw.trim().toLowerCase();
  if(namedColors[value])return namedColors[value]!;
  if(/^#[0-9a-f]{6}$/.test(value))return`${value}ff`;
  if(/^#[0-9a-f]{8}$/.test(value))return value;
  const tuple=value.match(/^rgba?\((.*)\)$/);
  if(tuple){
    const parts=tuple[1]!.split(',').map(part=>part.trim());
    if(parts.length!==(value.startsWith('rgba(')?4:3)||parts.some(part=>!/^\d{1,3}$/.test(part)||Number(part)>255))throw new Error('TTML 颜色无效');
    const [r,g,b,a=255]=parts.map(Number);
    return`#${[r!,g!,b!,a].map(channel=>channel.toString(16).padStart(2,'0')).join('')}`;
  }
  throw new Error('TTML 颜色无效');
}

export function parseFontStyle(raw:string):LyricFontStyle {
  return raw.trim()==='italic'||raw.trim()==='oblique'?raw.trim() as LyricFontStyle:'normal';
}

export function parseFontWeight(raw:string):LyricFontWeight {
  return raw.trim()==='bold'?'bold':'normal';
}

export function parseTextDecoration(raw:string):Partial<Record<LyricTextDecoration,boolean>> {
  const tokens=raw.trim().split(/\s+/).filter(Boolean);
  if(tokens.length===1&&tokens[0]==='none')return{underline:false,lineThrough:false,overline:false};
  const result:Partial<Record<LyricTextDecoration,boolean>>={};
  for(const token of tokens){
    const name=decorationNames.find(value=>value===token)??decorationOff[token]?.name;
    if(!name)return{underline:false,lineThrough:false,overline:false};
    const value=decorationOff[token]?.value??true;
    if(result[name]!==undefined)throw new Error('TTML 文本装饰冲突');
    result[name]=value;
  }
  return result;
}

export function applyStyle(parent:LyricStyleState,spec:LyricStyleSpec,allowBackground:boolean):LyricStyleState {
  const textDecoration={...parent.textDecoration,...spec.textDecoration};
  const backgroundColor=!allowBackground?undefined:spec.backgroundColor===undefined?parent.backgroundColor:spec.backgroundColor==='#00000000'?undefined:spec.backgroundColor;
  return{
    ...(spec.fontStyle!==undefined||parent.fontStyle!==undefined?{fontStyle:spec.fontStyle??parent.fontStyle}:{}),
    ...(spec.fontWeight!==undefined||parent.fontWeight!==undefined?{fontWeight:spec.fontWeight??parent.fontWeight}:{}),
    ...(spec.color!==undefined||parent.color!==undefined?{color:spec.color??parent.color}:{}),
    textDecoration,
    ...(backgroundColor?{backgroundColor}:{}),
  };
}

export function documentedStyle(state:LyricStyleState):LyricInlineStyle|undefined {
  const active=decorationNames.filter(name=>state.textDecoration[name]===true);
  const declared=decorationNames.some(name=>state.textDecoration[name]!==undefined);
  if(state.fontStyle===undefined&&state.fontWeight===undefined&&!declared&&state.color===undefined&&state.backgroundColor===undefined)return;
  return{
    ...(state.fontStyle!==undefined?{fontStyle:state.fontStyle}:{}),
    ...(state.fontWeight!==undefined?{fontWeight:state.fontWeight}:{}),
    ...(declared?{textDecoration:active}:{}),
    ...(state.color!==undefined?{color:state.color}:{}),
    ...(state.backgroundColor!==undefined?{backgroundColor:state.backgroundColor}:{}),
  };
}
