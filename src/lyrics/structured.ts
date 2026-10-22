import type {LyricDocument,LyricLine,LyricWord,LyricCue} from './parser.ts';
type Row=Record<string,unknown>;
const object=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:'';
const maxTime=86400000;
const time=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=maxTime;
export interface StructuredBudget {lines:number;words:number}
function charge(budget:StructuredBudget,kind:keyof StructuredBudget,count:number){
  budget[kind]+=count;
  if(budget[kind]>20000)throw new Error('结构化歌词行或词数量过多');
}
function utf8(value:string){const result:number[]=[];for(const character of value){let point=character.codePointAt(0)!;if(point>=0xd800&&point<=0xdfff)point=0xfffd;if(point<128)result.push(point);else if(point<2048)result.push(192|(point>>6),128|(point&63));else if(point<65536)result.push(224|(point>>12),128|((point>>6)&63),128|(point&63));else result.push(240|(point>>18),128|((point>>12)&63),128|((point>>6)&63),128|(point&63));}return result;}
function decode(value:readonly number[]){try{return decodeURIComponent(value.map(byte=>`%${byte.toString(16).padStart(2,'0')}`).join(''));}catch{return undefined;}}

/** Original bounded OpenSubsonic reader. Bad enhanced timing falls back to the
 * parent's combined line; no word timing is invented for untimed text. */
export function structuredLyrics(raw:unknown,budget:StructuredBudget):LyricDocument {
  const value=object(raw),rows=array(value.line).map(object);
  if(rows.length>10000||array(value.cueLine).length>10000)throw new Error('结构化歌词条目过多');
  const offset=value.offset===undefined?0:value.offset;
  const validOffset=typeof offset==='number'&&Number.isFinite(offset)&&Math.abs(offset)<=maxTime;
  const shifted=(v:number)=>Math.max(0,v-(validOffset?offset:0));
  const plain=()=>{charge(budget,'lines',rows.length);return{lines:[],plain:rows.map(line=>text(line.value)),synced:false};};
  if(value.synced!==true||!validOffset||rows.some(line=>!time(line.start)||shifted(line.start)>maxTime))return plain();
  const starts=[...new Set(rows.map(line=>line.start as number))].sort((a,b)=>a-b);
  const nextStart=new Map(starts.slice(0,-1).map((start,index)=>[start,starts[index+1]!]));
  const agents=new Map<string,string>();let validAgents=true;
  if(value.agents!==undefined){
    const entries=array(value.agents);
    validAgents=entries.length>0&&entries.length<=32;
    for(const entry of entries){const a=object(entry);if(typeof a.id!=='string'||!a.id||agents.has(a.id)||typeof a.role!=='string'||!['main','voice','bg','group'].includes(a.role)){validAgents=false;break;}agents.set(a.id,String(a.role));}
    if([...agents.values()].filter(role=>role==='main').length!==1)validAgents=false;
  }
  const cueMap=new Map<number,Row[]>();
  for(const entry of array(value.cueLine)){
    const cue=object(entry),index=cue.index;
    if(typeof index!=='number'||!Number.isSafeInteger(index)||index<0||index>=rows.length)continue;
    const list=cueMap.get(index)??[];list.push(cue);cueMap.set(index,list);
  }
  const lines:LyricLine[]=[];
  for(let index=0;index<rows.length;index++){
    const original=rows[index]!,rawStart=original.start as number,next=nextStart.get(rawStart);
    const base:LyricLine={startMs:shifted(rawStart),text:text(original.value),...(next===undefined?{}:{endMs:shifted(next)})};
    const cues=cueMap.get(index)??[],expanded:LyricLine[]=[];let valid=validAgents&&cues.length<=8;
    for(const cueLine of cues){
      const rawCues=array(cueLine.cue).map(object);charge(budget,'words',rawCues.length);
      if(!valid||rawCues.length>2000){valid=false;continue;}
      const agent=cueLine.agentId,role=typeof agent==='string'?agents.get(agent):undefined;
      if(typeof cueLine.value!=='string'||!Array.isArray(cueLine.cue)||
        (value.agents!==undefined?typeof agent!=='string'||!role:agent!==undefined)) {valid=false;continue;}
      const body=cueLine.value,rawBytes=utf8(body),endCount=rawCues.filter(c=>c.end!==undefined).length;
      const start=cueLine.start===undefined?(rawCues[0]?.start??rawStart):cueLine.start;
      const end=cueLine.end===undefined?((endCount===rawCues.length?rawCues.at(-1)?.end:undefined)??next):cueLine.end;
      if(!time(start)||shifted(start)>maxTime||(end!==undefined&&(!time(end)||end<start||shifted(end)>maxTime))||(endCount!==0&&endCount!==rawCues.length)){valid=false;continue;}
      const words:LyricWord[]=[],timedCues:LyricCue[]=[];let previousByte=-1,previousStart=-1,previousEnd=-1,partial=false;
      for(let i=0;i<rawCues.length;i++){
        const c=rawCues[i]!,first=c.byteStart,last=c.byteEnd,wordStart=c.start;
        const wordEnd=c.end===undefined?(rawCues[i+1]?.start??end??wordStart):c.end;
        if(typeof first!=='number'||typeof last!=='number'||!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<=previousByte||last<first||last>=rawBytes.length||
          !time(wordStart)||!time(wordEnd)||wordStart<start||wordStart<previousStart||wordStart<previousEnd||wordEnd<wordStart||(end!==undefined&&wordEnd>end)||shifted(wordEnd)>maxTime){valid=false;break;}
        const gap=decode(rawBytes.slice(previousByte+1,first)),word=decode(rawBytes.slice(first,last+1));
        if(gap===undefined||word===undefined||(c.value!==undefined&&c.value!==word)){valid=false;break;}
        if(gap.trim())partial=true;
        words.push({startMs:shifted(wordStart),endMs:shifted(wordEnd),text:gap+word});
        timedCues.push({startMs:shifted(wordStart),endMs:shifted(wordEnd),text:word,byteStart:first,byteEnd:last});
        previousByte=last;previousStart=wordStart;previousEnd=wordEnd;
      }
      const tail=decode(rawBytes.slice(previousByte+1));
      if(tail===undefined)valid=false;else if(tail.trim())partial=true;else if(words.length)words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text+tail};
      expanded.push({layerGroup:index,startMs:shifted(start),...(end===undefined?{}:{endMs:shifted(end)}),text:body,...(partial?{timedCues,timingFallback:'untimed_text' as const}:words.length?{words}:{}),...(role==='main'?{primary:true}:{}),...(typeof agent==='string'?{agent}:{}),...(role==='bg'?{background:true}:{})});
    }
    const accepted=valid&&expanded.length?expanded:[{...base,...(cues.length?{timingFallback:'invalid_cues' as const}:{})}];
    if(lines.length+accepted.length>10000)throw new Error('结构化歌词展开行过多');
    // Canonical main-before-background order, preserving all independent layers.
    if(agents.size)accepted.sort((a,b)=>Number(agents.get(b.agent??'')==='main')-Number(agents.get(a.agent??'')==='main'));
    charge(budget,'lines',accepted.length);lines.push(...accepted);
  }
  lines.sort((a,b)=>a.startMs-b.startMs);
  return{lines,plain:[],synced:lines.length>0};
}
