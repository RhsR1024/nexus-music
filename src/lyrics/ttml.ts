import {createLyricBudget} from './budget.ts';
import type {LyricDocument,LyricLine,LyricWord,RubyAlign} from './parser.ts';
// Original bounded TTML lyric subset. No DOM, entity expansion, DTD or networking.
import {parseBoundedXML,type XMLElement as Element} from '../formats/xml.ts';
const local=(name:string)=>name.split(':').at(-1)!;
const maxTime=86400000;
function attr(node:Element,name:string):string|undefined {return Object.entries(node.attrs).find(([key])=>local(key)===name)?.[1];}
function plainText(node:Element):string {
  return node.children.map(child=>typeof child==='string'?child:local(child.name)==='br'?'\n':plainText(child)).join('');
}
function hasTiming(node:Element):boolean {return attr(node,'begin')!==undefined||attr(node,'end')!==undefined||attr(node,'dur')!==undefined;}
function rubyValue(raw:string,preserve:boolean):string {
  const value=(preserve?raw:raw.replace(/\s+/g,' ')).trim();
  if(!value||value.length>512||/[\u0000-\u001f\u007f]/.test(value))throw new Error('TTML 注音文字无效');
  return value;
}
type RubyPosition='before'|'after'|'outside';
function rubyPosition(node:Element):RubyPosition|undefined {
  const value=attr(node,'rubyPosition');
  if(value===undefined)return;
  if(value!=='before'&&value!=='after'&&value!=='outside')throw new Error('TTML 注音位置不支持');
  return value;
}
const resolveRubyPosition=(value:RubyPosition):'before'|'after'=>value==='outside'?'before':value;
function rubyAlign(node:Element):RubyAlign {
  const value=attr(node,'rubyAlign');
  // TTML2 resolves unsupported annotation alignment to the initial center.
  if(value==='start'||value==='center'||value==='end'||value==='spaceAround'||value==='spaceBetween'||value==='withBase')return value;
  return'center';
}
export function parseTTML(input:string):LyricDocument {
  const root=parseBoundedXML(input);if(local(root.name)!=='tt')throw new Error('TTML 根节点无效');
  // AMLL's explicitly namespaced lyric profile uses media-absolute timestamps,
  // including shortened clocks. Standard TTML keeps its relative time model.
  const amll=Object.entries(root.attrs).some(([name,value])=>name.startsWith('xmlns:')&&value==='http://www.example.com/ns/amll');
  const frameRate=Number(attr(root,'frameRate')??30);
  const multiplier=(attr(root,'frameRateMultiplier')??'1 1').trim().split(/\s+/).map(Number),fps=frameRate*multiplier[0]!/multiplier[1]!,tickRate=Number(attr(root,'tickRate')??(attr(root,'frameRate')?fps:1));
  if(multiplier.length!==2||!Number.isFinite(fps)||fps<=0||fps>240||!Number.isFinite(tickRate)||tickRate<=0||tickRate>1000000)throw new Error('TTML 时间基准无效');
  const time=(raw:string)=>{
    const value=raw.trim();let result:number;
    const profileClock=amll?value.match(/^(?:(?:(\d+):)?(\d{1,2}):)?(\d+)(?:\.(\d{1,3}))?$/):null;
    if(amll&&!profileClock&&!/^\d+(?:\.\d+)?s$/.test(value))throw new Error('TTML 时间格式不支持');
    const clock=value.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+)|:(\d+))?$/),offset=value.match(/^(\d+(?:\.\d+)?)(ms|h|m|s|f|t)$/);
    if(profileClock){if(profileClock[2]!==undefined&&(Number(profileClock[2])>=60||Number(profileClock[3])>=60))throw new Error('TTML 时钟无效');result=Math.round((Number(profileClock[1]??0)*3600+Number(profileClock[2]??0)*60+Number(profileClock[3]))*1000+Number(`0.${profileClock[4]??0}`)*1000);}
    else if(clock){if(Number(clock[2])>=60||Number(clock[3])>=60||(clock[5]!==undefined&&Number(clock[5])>=frameRate))throw new Error('TTML 时钟无效');result=(Number(clock[1])*3600+Number(clock[2])*60+Number(clock[3]))*1000+(clock[5]?Number(clock[5])/fps*1000:Number(`0.${clock[4]??0}`)*1000);}
    else if(offset){const factors:Record<string,number>={ms:1,h:3600000,m:60000,s:1000,f:1000/fps,t:1000/tickRate};result=Number(offset[1])*factors[offset[2]!]!;}
    else throw new Error('TTML 时间格式不支持');
    if(!Number.isFinite(result)||result<0||result>maxTime)throw new Error('TTML 时间越界');return result;
  };
  if((attr(root,'timeBase')??'media')!=='media'||(attr(root,'subFrameRate')??'1')!=='1')throw new Error('TTML 时间基准暂不支持');
  const lines:LyricLine[]=[],charge=createLyricBudget();
  interface Timing {start:number;end:number;agent?:string;preserve:boolean}
  type Container='par'|'seq';
  const container=(node:Element):Container=>{
    const value=attr(node,'timeContainer');if(value===undefined||value==='par')return'par';if(value==='seq'&&!amll)return'seq';throw new Error('TTML 时间容器不支持');
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
    const start=begin?(amll?0:syncBase)+time(begin):syncBase;
    const knownEnd=Math.min(parent.end,endValue?(amll?0:syncBase)+time(endValue):maxTime,duration?start+time(duration):maxTime);
    if(start>knownEnd||start>maxTime||amll&&start<parent.start)throw new Error('TTML 时间范围无效');
    const provisional:Timing={start,end:knownEnd,agent:attr(node,'agent')??parent.agent,preserve:attr(node,'space')?attr(node,'space')==='preserve':parent.preserve};
    const end=endValue||duration?knownEnd:implicitEnd(node,provisional,parentContainer);
    if(start>end)throw new Error('TTML 时间范围无效');return{...provisional,end};
  }
  const visit=(node:Element,parent:Timing,syncBase:number,parentContainer:Container):Timing=>{
    const context=timing(node,parent,syncBase,parentContainer);
    if(local(node.name)==='p'){
      const main:LyricWord[]=[],bg:LyricWord[]=[],translation:string[]=[],romanization:string[]=[],bgTranslation:string[]=[],bgRomanization:string[]=[];
      const addText=(child:string,leaf:Timing,role:string,background:boolean,ruby?:string,rubyAfter?:string,alignment:RubyAlign='center')=>{
        const text=leaf.preserve?child:child.replace(/\s+/g,' ');if(!text)return;
        if(!leaf.preserve&&!text.trim()&&role!=='x-translation'&&role!=='x-roman'){const words=background?bg:main;if(words.length&&!words.at(-1)!.text.endsWith(' '))words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text+' '};return;}
        if(role==='x-translation'){(background?bgTranslation:translation).push(text);return;}if(role==='x-roman'){(background?bgRomanization:romanization).push(text);return;}
        (background?bg:main).push({text,startMs:leaf.start,endMs:leaf.end,...(ruby?{ruby}:{}),...(rubyAfter?{rubyAfter}:{}),...((ruby||rubyAfter)?{rubyAlign:alignment}:{})});
      };
      const collect=(containerNode:Element,context:Timing,role:string,background:boolean,containerKind:Container)=>{
        // AMLL encodes ruby with tts:ruby roles on spans. The annotation is
        // pronunciation metadata, never an additional sung word.
        const rubyRole=attr(containerNode,'ruby');
        if(rubyRole!==undefined){
          if(rubyRole!=='container')throw new Error('TTML 注音结构不完整');
          if(local(containerNode.name)!=='span'||containerKind!=='par')throw new Error('TTML 注音容器不支持');
          const elements=containerNode.children.filter((child):child is Element=>typeof child!=='string');
          if(containerNode.children.some(child=>typeof child==='string'&&!!child.trim()))throw new Error('TTML 注音容器包含游离文字');
          const bases=elements.filter(child=>attr(child,'ruby')==='base');
          const annotationContainers=elements.filter(child=>attr(child,'ruby')==='textContainer');
          if(bases.length!==1||annotationContainers.length<1||annotationContainers.length>2||elements.length!==1+annotationContainers.length)throw new Error('TTML 注音容器结构不支持');
          const baseNode=bases[0]!;
          const inheritedPosition=rubyPosition(containerNode),alignment=rubyAlign(containerNode);
          const records=annotationContainers.map(annotationContainer=>{
            if(annotationContainer.children.some(child=>typeof child==='string'&&!!child.trim()))throw new Error('TTML 注音文字结构不支持');
            const annotations=annotationContainer.children.filter((child):child is Element=>typeof child!=='string');
            if(annotations.length!==1||attr(annotations[0]!,'ruby')!=='text')throw new Error('TTML 注音文字结构不支持');
            const declaredPosition=rubyPosition(annotationContainer),leafPosition=rubyPosition(annotations[0]!);
            if(declaredPosition&&leafPosition&&resolveRubyPosition(declaredPosition)!==resolveRubyPosition(leafPosition))throw new Error('TTML 注音位置冲突');
            const explicitPosition=declaredPosition??leafPosition;
            if(annotationContainers.length===2&&explicitPosition===undefined)throw new Error('TTML 双侧注音位置不明确');
            if(inheritedPosition&&explicitPosition&&resolveRubyPosition(inheritedPosition)!==resolveRubyPosition(explicitPosition))throw new Error('TTML 注音位置冲突');
            const position=explicitPosition??inheritedPosition??'before';
            const annotationNode=annotations[0]!,annotationParent=timing(annotationContainer,context,context.start,'par');
            return{position:resolveRubyPosition(position),annotationNode,annotationParent,annotationTiming:timing(annotationNode,annotationParent,annotationParent.start,'par'),ruby:rubyValue(plainText(annotationNode),context.preserve),containerTimed:hasTiming(annotationContainer),nodeTimed:hasTiming(annotationNode)};
          });
          if(new Set(records.map(record=>record.position)).size!==records.length)throw new Error('TTML 注音位置重复');
          const base=plainText(baseNode);if(!base)throw new Error('TTML 注音缺少基础文字');
          const baseTiming=timing(baseNode,context,context.start,'par');
          const ordered=[...records].sort((a,b)=>Number(a.position==='after')-Number(b.position==='after'));
          const leaf=hasTiming(baseNode)?baseTiming:ordered.find(record=>record.nodeTimed)?.annotationTiming??ordered.find(record=>record.containerTimed)?.annotationTiming??ordered[0]!.annotationTiming;
          const before=ordered.find(record=>record.position==='before'),after=ordered.find(record=>record.position==='after');
          addText(base,leaf,role,background,before?.ruby,after?.ruby,alignment);return;
        }
        if(local(containerNode.name)==='ruby'){
          // Standard TTML ruby: ruby contains base text/rb plus one or more rt
          // annotations. rp is a non-authoritative fallback and is ignored.
          // A grouped rbc may carry one or two explicitly positioned rtc
          // tracks. Unique before/after tracks map to the two annotation slots.
          const rubyElements=containerNode.children.filter((child):child is Element=>typeof child!=='string');
          const explicitBaseContainers=rubyElements.filter(child=>local(child.name)==='rbc');
          if(explicitBaseContainers.length){
            const rtcContainers=rubyElements.filter(child=>local(child.name)==='rtc');
            if(containerNode.children.some(child=>typeof child==='string'&&!!child.trim())||
               explicitBaseContainers.length!==1||rtcContainers.length<1||rtcContainers.length>2||rubyElements.length!==1+rtcContainers.length||
               local(rubyElements[0]!.name)!=='rbc'||rubyElements.slice(1).some(child=>local(child.name)!=='rtc')){
              throw new Error('TTML 注音分组结构不支持');
            }
            const baseContainer=rubyElements[0]!;
            const baseContext=hasTiming(baseContainer)?timing(baseContainer,context,context.start,'par'):context;
            const baseNodes=baseContainer.children.filter((child):child is Element=>typeof child!=='string');
            if(baseContainer.children.some(child=>typeof child==='string'&&!!child.trim())||
               baseNodes.some(child=>local(child.name)!=='rb')||!baseNodes.length){
              throw new Error('TTML 注音基础容器结构不支持');
            }
            const inheritedPosition=rubyPosition(containerNode),alignment=rubyAlign(containerNode);
            const tracks=rtcContainers.map(annotationContainer=>{
              const annotationContext=hasTiming(annotationContainer)?timing(annotationContainer,context,context.start,'par'):context;
              const annotationElements=annotationContainer.children.filter((child):child is Element=>typeof child!=='string');
              if(annotationContainer.children.some(child=>typeof child==='string'&&!!child.trim())||
                 annotationElements.some(child=>local(child.name)!=='rt'&&local(child.name)!=='rp')){
                throw new Error('TTML 注音文字容器结构不支持');
              }
              const annotationNodes=annotationElements.filter(child=>local(child.name)==='rt');
              if(!annotationNodes.length||annotationNodes.length!==baseNodes.length)throw new Error('TTML 注音基础与注解数量不匹配');
              const declaredPosition=rubyPosition(annotationContainer),leafPositions=annotationNodes.map(node=>rubyPosition(node));
              if(new Set(leafPositions.filter((value):value is RubyPosition=>value!==undefined).map(resolveRubyPosition)).size>1)throw new Error('TTML 注音位置冲突');
              const explicitPosition=declaredPosition??leafPositions.find(value=>value!==undefined);
              if(rtcContainers.length===2&&explicitPosition===undefined)throw new Error('TTML 双侧注音位置不明确');
              if(inheritedPosition&&explicitPosition&&resolveRubyPosition(inheritedPosition)!==resolveRubyPosition(explicitPosition))throw new Error('TTML 注音位置冲突');
              const timings=annotationNodes.map(node=>hasTiming(node)?timing(node,annotationContext,annotationContext.start,'par'):annotationContext);
              const position=explicitPosition??inheritedPosition??'before';
              return{position:resolveRubyPosition(position),containerTimed:hasTiming(annotationContainer),
                timings,rubies:annotationNodes.map((node,index)=>rubyValue(plainText(node),timings[index]!.preserve)),nodeTimed:annotationNodes.map(hasTiming)};
            });
            if(new Set(tracks.map(track=>track.position)).size!==tracks.length)throw new Error('TTML 注音位置重复');
            const ordered=[...tracks].sort((a,b)=>Number(a.position==='after')-Number(b.position==='after'));
            baseNodes.forEach((baseNode,index)=>{
              const before=ordered.find(track=>track.position==='before'),after=ordered.find(track=>track.position==='after');
              const leaf=hasTiming(baseNode)?timing(baseNode,baseContext,baseContext.start,'par'):
                ordered.find(track=>track.nodeTimed[index])?.timings[index]??ordered.find(track=>track.containerTimed)?.timings[index]??ordered[0]!.timings[index]!;
              const base=plainText(baseNode);if(!base.trim())throw new Error('TTML 注音缺少基础文字');
              addText(base,leaf,role,background,before?.rubies[index]!,after?.rubies[index]!,alignment);
            });
            return;
          }
          let pending='';let count=0,baseElements=0,baseText=false,sawRtc=false;
          const alignment=rubyAlign(containerNode);
          const addRuby=(annotationNode:Element)=>{
            const base=pending;pending='';if(!base.trim())throw new Error('TTML 注音缺少基础文字');
            const leaf=timing(annotationNode,context,context.start,'par');
            const inheritedPosition=rubyPosition(containerNode),declaredPosition=rubyPosition(annotationNode);
            if(inheritedPosition&&declaredPosition&&resolveRubyPosition(inheritedPosition)!==resolveRubyPosition(declaredPosition))throw new Error('TTML 注音位置冲突');
            const position=declaredPosition??inheritedPosition??'before',resolved=resolveRubyPosition(position),ruby=rubyValue(plainText(annotationNode),leaf.preserve);
            addText(base,leaf,role,background,resolved==='before'?ruby:undefined,resolved==='after'?ruby:undefined,alignment);count++;
          };
          for(const child of containerNode.children){
            if(typeof child==='string'){
              if(sawRtc){if(child.trim())throw new Error('TTML 注音分组后包含游离文字');continue;}
              pending+=child;baseText||=!!child.trim();continue;
            }
            const kind=local(child.name);
            if(kind==='rt'){if(sawRtc)throw new Error('TTML 注音分组混用');addRuby(child);}
            else if(kind==='rp')continue;
            else if(kind==='rb'){if(sawRtc)throw new Error('TTML 注音分组混用');baseElements++;pending+=plainText(child);}
            else if(kind==='rtc'){
              if(sawRtc||count||baseElements>1||baseElements&&baseText)throw new Error('TTML 注音分组结构不支持');
              const base=pending;pending='';if(!base.trim())throw new Error('TTML 注音缺少基础文字');
              const rtcContext=hasTiming(child)?timing(child,context,context.start,'par'):context;
              const children=child.children.filter((item):item is Element=>typeof item!=='string');
              if(child.children.some(item=>typeof item==='string'&&!!item.trim()))throw new Error('TTML 注音分组包含游离文字');
              const annotations=children.filter(item=>local(item.name)==='rt');
              if(children.some(item=>local(item.name)!=='rt'&&local(item.name)!=='rp')||annotations.length!==1)throw new Error('TTML 注音分组结构不支持');
              const annotationNode=annotations[0]!,leaf=hasTiming(annotationNode)?timing(annotationNode,rtcContext,rtcContext.start,'par'):rtcContext;
              const inheritedPosition=rubyPosition(containerNode),containerPosition=rubyPosition(child),leafPosition=rubyPosition(annotationNode);
              if(new Set([inheritedPosition,containerPosition,leafPosition].filter((value):value is RubyPosition=>value!==undefined).map(resolveRubyPosition)).size>1)throw new Error('TTML 注音位置冲突');
              const position=leafPosition??containerPosition??inheritedPosition??'before',resolved=resolveRubyPosition(position),ruby=rubyValue(plainText(annotationNode),leaf.preserve);
              addText(base,leaf,role,background,resolved==='before'?ruby:undefined,resolved==='after'?ruby:undefined,alignment);count++;sawRtc=true;
            }
            else {
              if(sawRtc)throw new Error('TTML 注音分组混用');
              baseElements++;pending+=plainText(child);
            }
          }
          if(pending.trim())throw new Error('TTML 注音缺少注解文字');
          if(!count)throw new Error('TTML 注音结构为空');
          return;
        }
        const sequential=containerKind==='seq';let cursor=context.start;
        for(const child of containerNode.children){
          const relation=sequential?cursor:context.start;
          if(typeof child==='string'){
            addText(child,sequential?{...context,start:cursor,end:cursor}:context,role,background);
            continue;
          }
          const nextRole=attr(child,'role')??role,nextBackground=background||nextRole==='x-bg';
          // AMLL represents background vocals independently of the main p's
          // interval. Keep the enclosing section/song bound, not an unbound end.
          const bounds=amll&&nextRole==='x-bg'&&!background?{...context,start:parent.start,end:parent.end}:context;
          // The profile explicitly permits zero-timed standalone whitespace.
          if(amll&&!context.preserve&&local(child.name)==='span'&&child.children.length>0&&child.children.every(item=>typeof item==='string'&&!item.trim())&&attr(child,'begin')!==undefined&&attr(child,'end')!==undefined&&time(attr(child,'begin')!)===0&&time(attr(child,'end')!)===0){
            addText(child.children.join(''),context,nextRole,nextBackground);continue;
          }
          const next=timing(child,bounds,relation,sequential?'seq':'par');
          if(local(child.name)==='br')addText('\n',{...next,preserve:true},nextRole,nextBackground);else collect(child,next,nextRole,nextBackground,container(child));
          if(sequential)cursor=next.end;
        }
      };
      collect(node,context,attr(node,'role')??'',attr(node,'role')==='x-bg',container(node));
      const append=(words:LyricWord[],background:boolean)=>{
        if(!context.preserve){while(words.length&&!words[0]!.text.trim())words.shift();while(words.length&&!words.at(-1)!.text.trim())words.pop();if(words.length){words[0]={...words[0]!,text:words[0]!.text.trimStart()};words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text.trimEnd()};}}
        if(!words.length)return;if(words.length>2000||lines.length>=10000)throw new Error('TTML 歌词过多');
        charge(words.length);
        const ordered=words.every((word,i)=>i===0||word.startMs>=words[i-1]!.startMs);
        const translated=background?bgTranslation:translation,romanized=background?bgRomanization:romanization;
        lines.push({startMs:Math.min(...words.map(word=>word.startMs)),endMs:Math.max(...words.map(word=>word.endMs)),text:words.map(word=>word.text).join(''),...(ordered?{words}:{}),...(background?{background:true}:{}),...(context.agent?{agent:context.agent}:{}),...(translated.length?{translation:translated.join('').trim()}:{}),...(romanized.length?{romanization:romanized.join('').trim()}: {})});
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
