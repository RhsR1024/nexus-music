import {createLyricBudget} from './budget.ts';
import {parseTTML} from './ttml.ts';
export interface LyricWord {startMs:number;endMs:number;text:string}
export interface LyricCue extends LyricWord {byteStart:number;byteEnd:number}
export interface LyricLine {layerGroup?:number;primary?:boolean;timedCues?:readonly LyricCue[];timingFallback?:'untimed_text'|'invalid_cues';background?:boolean;agent?:string;startMs:number;endMs?:number;text:string;words?:readonly LyricWord[];translation?:string;romanization?:string}
export interface LyricDocument {lines:readonly LyricLine[];plain:readonly string[];synced:boolean}
const maxTime=86400000;
function timestamp(minutes:string,seconds:string,fraction='') {
  const m=Number(minutes),s=Number(seconds),ms=Number(fraction.padEnd(3,'0'));
  return s>=0&&s<60&&m>=0&&m*60000+s*1000+ms<=maxTime?m*60000+s*1000+ms:undefined;
}
function tokens(body:string,start:number,kind:'lx'|'yrc'|'krc'|'qrc'):{text:string;words?:LyricWord[]} {
  const regex=kind==='lx'?/<(\d+),(\d+)>([^<]*)/g:kind==='krc'?/<(\d+),(\d+),\d+>([^<]*)/g:kind==='yrc'?/\((\d+),(\d+),\d+\)([^()]*)/g:/([^()]*?)\((\d+),(\d+)\)/g;
  const matches=[...body.matchAll(regex)];
  if(!matches.length)return{text:body};
  const words=matches.map(match=>{
    const time=Number(match[kind==='qrc'?2:1]),duration=Number(match[kind==='qrc'?3:2]);
    const offset=kind==='yrc'||kind==='qrc'?time:start+time;
    return{startMs:offset,endMs:offset+duration,text:match[kind==='qrc'?1:3]??''};
  });
  const tag=kind==='lx'?/<\d+,\d+>/g:kind==='krc'?/<\d+,\d+,\d+>/g:kind==='yrc'?/\(\d+,\d+,\d+\)/g:/\(\d+,\d+\)/g;
  const text=body.replace(tag,'');
  if(words.length>2000||words.map(word=>word.text).join('')!==text||words.some((word,index)=>!Number.isFinite(word.startMs)||word.startMs<0||word.endMs>maxTime||word.endMs<word.startMs||(index>0&&word.startMs<words[index-1]!.startMs)))return{text};
  return{text,words};
}
export function parseLyrics(input:string):LyricDocument {
  if(/<(?:[\w-]+:)?tt[\s/>]/.test(input.replace(/^\uFEFF/,'')))return parseTTML(input);
  if(input.length>2*1024*1024)throw new Error('歌词数据过大');
  const offset=Number([...input.matchAll(/\[offset:([+-]?\d+)\]/gi)].at(-1)?.[1]??0);
  const shift=Number.isFinite(offset)?offset:0;
  const lines:LyricLine[]=[],plain:string[]=[],charge=createLyricBudget();
  for(const raw of input.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    const value=raw.trim();if(!value||/^\[(ar|ti|al|by|offset|re|ve|length):/i.test(value)||value.startsWith('{'))continue;
    const enhanced=value.match(/^\[(\d+),(\d+)\](.*)$/);
    if(enhanced) {
      const start=Number(enhanced[1]),duration=Number(enhanced[2]);
      if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||start+duration>maxTime)continue;
      const body=enhanced[3]!,kind=/<\d+,\d+,\d+>/.test(body)?'krc':/\(\d+,\d+,\d+\)/.test(body)?'yrc':'qrc';
      const parsed=tokens(body,start,kind);
      charge(parsed.words?.length??0);
      lines.push({startMs:Math.max(0,start-shift),endMs:Math.max(0,start+duration-shift),text:parsed.text,
        ...(parsed.words?{words:parsed.words.map(word=>({...word,startMs:Math.max(0,word.startMs-shift),endMs:Math.max(0,word.endMs-shift)}))}:{})});
      continue;
    }
    const tags=[...value.matchAll(/\[(\d{1,4}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if(!tags.length){charge();plain.push(value);continue;}
    const end=tags.at(-1)!.index!+tags.at(-1)![0].length,body=value.slice(end);
    for(const tag of tags) {
      const start=timestamp(tag[1]!,tag[2]!,tag[3]);if(start===undefined)continue;
      const parsed=tokens(body,start,'lx');
      charge(parsed.words?.length??0);
      lines.push({startMs:Math.max(0,start-shift),text:parsed.text,...(parsed.words?{words:parsed.words.map(word=>({...word,startMs:Math.max(0,word.startMs-shift),endMs:Math.max(0,word.endMs-shift)}))}:{})});
    }
  }
  lines.sort((a,b)=>a.startMs-b.startMs);
  let group=lines.at(-1)?.startMs,nextStart:number|undefined;
  for(let i=lines.length-1;i>=0;i--){const line=lines[i]!;if(group!==undefined&&line.startMs<group){nextStart=group;group=line.startMs;}if(line.endMs===undefined&&nextStart!==undefined)lines[i]={...line,endMs:nextStart};}
  return{lines,plain:lines.length?[]:plain,synced:lines.length>0};
}
export function mergeLyrics(base:LyricDocument,translation?:string,romanization?:string):LyricDocument {
  const translations=new Map(parseLyrics(translation??'').lines.map(line=>[line.startMs,line.text]));
  const romanizations=new Map(parseLyrics(romanization??'').lines.map(line=>[line.startMs,line.text]));
  return{...base,lines:base.lines.map(line=>({...line,...(translations.has(line.startMs)?{translation:translations.get(line.startMs)!}:{}),...(romanizations.has(line.startMs)?{romanization:romanizations.get(line.startMs)!}:{})}))};
}
export function activeLyric(lines:readonly LyricLine[],positionMs:number,userOffsetMs=0):number {
  const time=positionMs-userOffsetMs;let low=0,high=lines.length-1,result=-1;
  while(low<=high){const middle=(low+high)>>>1;if(lines[middle]!.startMs<=time){result=middle;low=middle+1;}else high=middle-1;}
  for(let i=result;i>=0;i--){
    const line=lines[i]!;
    if(line.background||line.endMs!==undefined&&time>=line.endMs)continue;
    // Structured agent layers share a parent group. Prefer its still-active
    // main layer even when a guest enters later; other formats retain their
    // existing last-onset selection.
    if(line.layerGroup!==undefined){
      for(let j=i;j>=0;j--){const lead=lines[j]!;if(lead.primary&&lead.layerGroup===line.layerGroup&&!lead.background&&(lead.endMs===undefined||time<lead.endMs))return j;}
    }
    return i;
  }
  return -1;
}
