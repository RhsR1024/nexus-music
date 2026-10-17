import type {LyricDocument,LyricLine,LyricWord} from './parser.ts';

export interface StageGroup {readonly id:string;readonly line:LyricLine;readonly onsetMs:number}
export interface StageLine {readonly sourceIndex:number;readonly startMs:number;readonly endMs:number;readonly groups:readonly StageGroup[]}
const maxTime=86400000;
// A presentation budget, not an assertion that all Sollin splitting rules match.
// Keeping a word whole preserves its real timing and Unicode clusters on Hermes.
function characterCount(text:string):number {return Array.from(text).length;}
function joinedCluster(left:string,right:string):boolean {
  const before=Array.from(left).at(-1),after=Array.from(right)[0];
  if(!before||!after)return false;
  const cp=after.codePointAt(0)!;
  return before==='\u200d'||after==='\u200d'||/\p{Mark}/u.test(after)||cp>=0xfe00&&cp<=0xfe0f||cp>=0x1f3fb&&cp<=0x1f3ff||before==='\r'&&after==='\n'||/^[\u{1f1e6}-\u{1f1ff}]$/u.test(before)&&/^[\u{1f1e6}-\u{1f1ff}]$/u.test(after);
}
export function buildStageTimeline(document:LyricDocument,durationMs=0):readonly StageLine[] {
  if(!document.synced)return [];
  const lines=document.lines.slice(0,10000),result:StageLine[]=[];
  const nextStarts:(number|undefined)[]=Array(lines.length);
  let start:number|undefined,next:number|undefined;
  for(let i=lines.length-1;i>=0;i--) {
    const line=lines[i]!;
    if(!line.background&&Number.isFinite(line.startMs)) {
      if(start!==undefined&&line.startMs<start)next=start;
      start=line.startMs;
    }
    nextStarts[i]=next;
  }
  for(let i=0;i<lines.length;i++) {
    const line=lines[i]!;
    if(line.background||!line.text.trim()||line.text.length>20000||!Number.isFinite(line.startMs)||line.startMs<0||line.startMs>=maxTime)continue;
    let end=line.endMs;
    if(end===undefined) {
      // Equal-onset translations/background rows do not terminate the lead row.
      end=nextStarts[i];
      if(end===undefined)end=Number.isFinite(durationMs)&&durationMs>line.startMs?Math.min(maxTime,durationMs):maxTime;
    }
    if(!Number.isFinite(end)||end<=line.startMs||end>maxTime)continue;
    const words=line.words;
    const timed=words&&words.length>0&&words.length<=2000&&words.map(word=>word.text).join('')===line.text&&words.every((word,index)=>Number.isFinite(word.startMs)&&Number.isFinite(word.endMs)&&word.startMs>=line.startMs&&word.endMs>=word.startMs&&word.endMs<=end!&&(index===0||word.startMs>=words[index-1]!.startMs));
    const batches:LyricWord[][]=[];
    if(timed) {
      let batch:LyricWord[]=[],count=0;
      for(const word of words) {
        const length=characterCount(word.text.trim());
        if(batch.length&&count+length>4&&!joinedCluster(batch.at(-1)!.text,word.text)){batches.push(batch);batch=[];count=0;}
        batch.push(word);count+=length;
      }
      if(batch.length)batches.push(batch);
    }
    const groups:StageGroup[]=timed?batches.map((batch,index)=>({id:`${i}:${index}`,onsetMs:batch[0]!.startMs,line:{...line,text:batch.map(word=>word.text).join(''),words:batch,startMs:batch[0]!.startMs,endMs:batch.at(-1)!.endMs}})):[{id:`${i}:0`,onsetMs:line.startMs,line:{...line,words:undefined}}];
    result.push({sourceIndex:i,startMs:line.startMs,endMs:end,groups});
  }
  return result;
}
// Half-open outer intervals; gaps are empty. Within a row the last onset holds
// until the next group or row end, independent of the last word's fill duration.
export function activeStageGroup(lines:readonly StageLine[],positionMs:number,offsetMs=0):StageGroup|undefined {
  const time=positionMs-offsetMs;
  if(!Number.isFinite(time))return;
  const line=lines.find(line=>line.startMs<=time&&time<line.endMs);
  if(!line)return;
  let selected:StageGroup|undefined;
  for(const group of line.groups)if(group.onsetMs<=time)selected=group;
  return selected;
}
