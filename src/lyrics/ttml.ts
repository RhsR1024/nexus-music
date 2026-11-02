import {createLyricBudget} from './budget.ts';
import type {LyricDocument,LyricLine,LyricWord} from './parser.ts';
// Original bounded TTML lyric subset. No DOM, entity expansion, DTD or networking.
import {parseBoundedXML,type XMLElement as Element} from '../formats/xml.ts';
const local=(name:string)=>name.split(':').at(-1)!;
const maxTime=86400000;
function attr(node:Element,name:string):string|undefined {return Object.entries(node.attrs).find(([key])=>local(key)===name)?.[1];}
export function parseTTML(input:string):LyricDocument {
  const root=parseBoundedXML(input);if(local(root.name)!=='tt')throw new Error('TTML 根节点无效');
  const frameRate=Number(attr(root,'frameRate')??30);
  const multiplier=(attr(root,'frameRateMultiplier')??'1 1').trim().split(/\s+/).map(Number),fps=frameRate*multiplier[0]!/multiplier[1]!,tickRate=Number(attr(root,'tickRate')??(attr(root,'frameRate')?fps:1));
  if(multiplier.length!==2||!Number.isFinite(fps)||fps<=0||fps>240||!Number.isFinite(tickRate)||tickRate<=0||tickRate>1000000)throw new Error('TTML 时间基准无效');
  const time=(raw:string)=>{
    const value=raw.trim();let result:number;
    const clock=value.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+)|:(\d+))?$/),offset=value.match(/^(\d+(?:\.\d+)?)(ms|h|m|s|f|t)$/);
    if(clock){if(Number(clock[2])>=60||Number(clock[3])>=60||(clock[5]!==undefined&&Number(clock[5])>=frameRate))throw new Error('TTML 时钟无效');result=(Number(clock[1])*3600+Number(clock[2])*60+Number(clock[3]))*1000+(clock[5]?Number(clock[5])/fps*1000:Number(`0.${clock[4]??0}`)*1000);}
    else if(offset){const factors:Record<string,number>={ms:1,h:3600000,m:60000,s:1000,f:1000/fps,t:1000/tickRate};result=Number(offset[1])*factors[offset[2]!]!;}
    else throw new Error('TTML 时间格式不支持');
    if(!Number.isFinite(result)||result<0||result>maxTime)throw new Error('TTML 时间越界');return result;
  };
  if((attr(root,'timeBase')??'media')!=='media'||(attr(root,'subFrameRate')??'1')!=='1')throw new Error('TTML 时间基准暂不支持');
  const lines:LyricLine[]=[],charge=createLyricBudget();
  interface Timing {start:number;end:number;agent?:string;preserve:boolean}
  type Container='par'|'seq';
  const container=(node:Element):Container=>{
    const value=attr(node,'timeContainer');if(value===undefined||value==='par')return'par';if(value==='seq')return'seq';throw new Error('TTML 时间容器不支持');
  };
  function implicitEnd(node:Element,parent:Timing,parentContainer:Container):number {
    if(!node.children.some(child=>typeof child!=='string')){
      const relation=local(node.name)==='span'||local(node.name)==='br'?parentContainer:container(node);
      return relation==='seq'?parent.start:parent.end;
    }
    const ownContainer=container(node);
    if(ownContainer==='seq'){
      let cursor=parent.start;
      for(const child of node.children)if(typeof child!=='string')cursor=timing(child,parent,cursor,ownContainer).end;
      return cursor;
    }
    let end=parent.start,hasTimedChild=false;
    for(const child of node.children){
      if(typeof child==='string'){if(child.trim())return parent.end;continue;}
      hasTimedChild=true;end=Math.max(end,timing(child,parent,parent.start,ownContainer).end);
    }
    return hasTimedChild?end:parent.end;
  }
  function timing(node:Element,parent:Timing,syncBase:number,parentContainer:Container):Timing {
    const begin=attr(node,'begin'),endValue=attr(node,'end'),duration=attr(node,'dur');
    const start=syncBase+(begin?time(begin):0);
    const knownEnd=Math.min(parent.end,endValue?syncBase+time(endValue):maxTime,duration?start+time(duration):maxTime);
    if(start>knownEnd||start>maxTime)throw new Error('TTML 时间范围无效');
    const provisional:Timing={start,end:knownEnd,agent:attr(node,'agent')??parent.agent,preserve:attr(node,'space')?attr(node,'space')==='preserve':parent.preserve};
    const end=endValue||duration?knownEnd:implicitEnd(node,provisional,parentContainer);
    if(start>end)throw new Error('TTML 时间范围无效');return{...provisional,end};
  }
  const visit=(node:Element,parent:Timing,syncBase:number,parentContainer:Container):Timing=>{
    const context=timing(node,parent,syncBase,parentContainer);
    if(local(node.name)==='p'){
      const main:LyricWord[]=[],bg:LyricWord[]=[],translation:string[]=[],romanization:string[]=[];
      const addText=(child:string,leaf:Timing,role:string)=>{
        const text=leaf.preserve?child:child.replace(/\s+/g,' ');if(!text)return;
        if(!leaf.preserve&&!text.trim()&&role!=='x-translation'&&role!=='x-roman'){const words=role==='x-bg'?bg:main;if(words.length&&!words.at(-1)!.text.endsWith(' '))words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text+' '};return;}
        if(role==='x-translation'){translation.push(text);return;}if(role==='x-roman'){romanization.push(text);return;}
        (role==='x-bg'?bg:main).push({text,startMs:leaf.start,endMs:leaf.end});
      };
      const collect=(containerNode:Element,context:Timing,role:string)=>{
        const sequential=container(containerNode)==='seq';let cursor=context.start;
        for(const child of containerNode.children){
          const relation=sequential?cursor:context.start;
          if(typeof child==='string'){
            addText(child,sequential?{...context,start:cursor,end:cursor}:context,role);
            continue;
          }
          const next=timing(child,context,relation,sequential?'seq':'par'),nextRole=attr(child,'role')??role;
          if(local(child.name)==='br')addText('\n',{...next,preserve:true},nextRole);else collect(child,next,nextRole);
          if(sequential)cursor=next.end;
        }
      };
      collect(node,context,attr(node,'role')??'');
      const append=(words:LyricWord[],background:boolean)=>{
        if(!context.preserve){while(words.length&&!words[0]!.text.trim())words.shift();while(words.length&&!words.at(-1)!.text.trim())words.pop();if(words.length){words[0]={...words[0]!,text:words[0]!.text.trimStart()};words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text.trimEnd()};}}
        if(!words.length)return;if(words.length>2000||lines.length>=10000)throw new Error('TTML 歌词过多');
        charge(words.length);
        const ordered=words.every((word,i)=>i===0||word.startMs>=words[i-1]!.startMs);
        lines.push({startMs:Math.min(...words.map(word=>word.startMs)),endMs:Math.max(...words.map(word=>word.endMs)),text:words.map(word=>word.text).join(''),...(ordered?{words}:{}),...(background?{background:true}:{}),...(context.agent?{agent:context.agent}:{}),...(!background&&translation.length?{translation:translation.join('').trim()}:{}),...(!background&&romanization.length?{romanization:romanization.join('').trim()}: {})});
      };
      append(main,false);append(bg,true);return context;
    }
    if(local(node.name)==='head'||local(node.name)==='metadata')return context;
    const sequential=container(node)==='seq';let cursor=context.start;
    for(const child of node.children)if(typeof child!=='string'){
      const next=visit(child,context,sequential?cursor:context.start,sequential?'seq':'par');
      if(sequential)cursor=next.end;
    }
    return context;
  };
  visit(root,{start:0,end:maxTime,preserve:false},0,'par');
  lines.sort((a,b)=>a.startMs-b.startMs||Number(!!a.background)-Number(!!b.background));
  return{lines,plain:[],synced:lines.length>0};
}
