import {mergeLyrics,parseLyrics,type LyricDocument,type LyricLine,type LyricWord} from './parser.ts';
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
function bytes(value:string) {const result:number[]=[];for(const character of value){let point=character.codePointAt(0)!;if(point>=0xd800&&point<=0xdfff)point=0xfffd;if(point<128)result.push(point);else if(point<2048)result.push(192|(point>>6),128|(point&63));else if(point<65536)result.push(224|(point>>12),128|((point>>6)&63),128|(point&63));else result.push(240|(point>>18),128|((point>>12)&63),128|((point>>6)&63),128|(point&63));}return result;}
function decodedBytes(value:readonly number[]) {try{return decodeURIComponent(value.map(byte=>`%${byte.toString(16).padStart(2,'0')}`).join(''));}catch{return undefined;}}
function structured(raw:unknown):LyricDocument {
  const value=object(raw),rows=array(value.line).slice(0,10000).map(object),offset=Number(value.offset)||0;
  if(value.synced!==true||rows.some(line=>!Number.isFinite(Number(line.start))||Number(line.start)<0))return{lines:[],plain:rows.map(line=>string(line.value)),synced:false};
  const cueMap=new Map<number,Row[]>(),lines:LyricLine[]=[];
  for(const item of array(value.cueLine).slice(0,10000)){const cue=object(item),index=Number(cue.index);if(!Number.isInteger(index)||index<0||index>=rows.length)continue;const list=cueMap.get(index)??[];if(list.length<8)list.push(cue);cueMap.set(index,list);}
  for(let index=0;index<rows.length;index++) {
    const original=rows[index]!,cues=cueMap.get(index)??[],base={startMs:Math.max(0,Number(original.start)-offset),text:string(original.value)};
    if(!cues.length){lines.push(base);continue;}
    for(const cueLine of cues){
      const text=string(cueLine.value),rawBytes=bytes(text),words:LyricWord[]=[];let previousEnd=-1,valid=true;
      for(const raw of array(cueLine.cue).slice(0,2000)){
        const cue=object(raw),first=Number(cue.byteStart),last=Number(cue.byteEnd),start=Number(cue.start),end=Number(cue.end);
        if(!Number.isInteger(first)||!Number.isInteger(last)||first<=previousEnd||last<first||last>=rawBytes.length||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start){valid=false;break;}
        const gap=decodedBytes(rawBytes.slice(previousEnd+1,first)),word=decodedBytes(rawBytes.slice(first,last+1));
        if(gap===undefined||word===undefined||gap.trim()||(typeof cue.value==='string'&&cue.value!==word)){valid=false;break;}
        words.push({startMs:Math.max(0,start-offset),endMs:Math.max(0,end-offset),text:gap+word});previousEnd=last;
      }
      const tail=decodedBytes(rawBytes.slice(previousEnd+1));if(tail===undefined||tail.trim())valid=false;else if(words.length)words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text+tail};
      const start=Number(cueLine.start),end=Number(cueLine.end);
      if(!Number.isFinite(start)||!Number.isFinite(end)||end<start){lines.push(base);continue;}
      lines.push({startMs:Math.max(0,start-offset),endMs:Math.max(0,end-offset),text:text||base.text,...(valid&&words.length?{words}:{})});
    }
  }
  lines.sort((a,b)=>a.startMs-b.startMs);
  return{lines,plain:[],synced:lines.length>0};
}
export function normalizeLyrics(raw:unknown):LyricResult {
  if(JSON.stringify(raw)?.length>2097152)throw new Error('歌词数据过大');
  if(typeof raw==='string')return{document:parseLyrics(lyricText(raw)),variants:[]};
  const value=object(raw);
  const sets=array(value.structuredLyrics??object(value.lyricsList).structuredLyrics).slice(0,16).map(object);
  if(sets.length){const variants=sets.map((value,index)=>({label:[string(value.lang),string(value.kind)||`版本${index+1}`].filter(Boolean).join(' · '),document:structured(value)}));
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
