import {structuredLyrics} from './structured.ts';
import {mergeLyrics,parseLyrics,type LyricDocument} from './parser.ts';
type Row=Record<string,unknown>;
const object=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const string=(value:unknown)=>typeof value==='string'?value:'';
export function decodeEntities(value:string) {
  const names:Record<string,string>={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(all,key:string)=>{
    if(key[0]!=='#')return names[key.toLowerCase()]??all;
    const number=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    return number>=0&&number<=0x10ffff?String.fromCodePoint(number):'�';
  });
}
export interface LyricVariant {label:string;document:LyricDocument}
export interface LyricResult {document:LyricDocument;variants:readonly LyricVariant[]}
function lyricText(value:string) {
  // QRC can wrap decoded timing in a QrcInfos XML attribute. Extract before
  // unescaping so a quoted lyric cannot prematurely terminate the attribute.
  if(/<(?:[\w-]+:)?tt[\s>]/.test(value))return value;
  const content=value.match(/\bLyricContent\s*=\s*(?:"([^"]*)"|'([^']*)')/);
  return decodeEntities(content?(content[1]??content[2]??''):value);
}
export function normalizeLyrics(raw:unknown):LyricResult {
  if(JSON.stringify(raw)?.length>2097152)throw new Error('歌词数据过大');
  if(typeof raw==='string')return{document:parseLyrics(lyricText(raw)),variants:[]};
  const value=object(raw);
  const direct=array(value.structuredLyrics),sets=(direct.length?direct:array(object(value.lyricsList).structuredLyrics)).map(object);
  if(sets.length>16)throw new Error('结构化歌词版本过多');
  if(sets.length){const budget={lines:0,words:0},variants=sets.map((value,index)=>({label:[string(value.lang),string(value.kind)||`版本${index+1}`].filter(Boolean).join(' · '),document:structuredLyrics(value,budget)}));
    const selected=Math.max(0,sets.findIndex(value=>!value.kind||value.kind==='main'));return{document:variants[selected]!.document,variants};}
  // Providers can return several representations, including empty/failed
  // preferred fields. Prefer the first usable timed document, then readable
  // plain fields; a broken optional variant must not discard the main lyric.
  const select=(inputs:readonly {value:unknown;rich?:boolean}[],required=false)=>{
    let plain:{document:LyricDocument;text:string}|undefined,richPlain:typeof plain,failure:unknown;
    for(const input of inputs){
      const raw=typeof input.value==='string'?input.value:string(object(input.value).lyric);
      if(!raw.trim())continue;
      try{
        const text=lyricText(raw),document=parseLyrics(text),candidate={document,text};
        if(document.synced&&document.lines.some(line=>line.text.trim()))return candidate;
        if(document.plain.some(line=>line.trim())){
          if(input.rich)richPlain??=candidate;else plain??=candidate;
        }
      }catch(error){failure??=error;}
    }
    const fallback=plain??richPlain;
    if(!fallback&&required&&failure)throw failure;
    return fallback;
  };
  const main=select([...['ttml','lxlyric','yrc','krc','qrc'].map(key=>({value:value[key],rich:true})),...['lyric','lrc','value'].map(key=>({value:value[key]}))],true);
  const base=main?.document??{lines:[],plain:[],synced:false};
  const translation=select([{value:value.tlyric},{value:value.tlrc}]);
  const romanization=select([{value:value.rlyric},{value:value.romalrc}]);
  return{document:mergeLyrics(base,translation?.text,romanization?.text),variants:[]};
}
