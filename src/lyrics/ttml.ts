import type {LyricDocument,LyricLine,LyricWord} from './parser.ts';
// Original bounded TTML lyric subset. No DOM, entity expansion, DTD or networking.
interface Element {name:string;attrs:Record<string,string>;children:(Element|string)[]}
const local=(name:string)=>name.split(':').at(-1)!;
const maxTime=86400000;
function entities(text:string):string {
  return text.replace(/&([^;\s]*);/g,(_,name:string)=>{
    const known:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.prototype.hasOwnProperty.call(known,name))return known[name]!;
    const point=/^#x[\da-f]+$/i.test(name)?parseInt(name.slice(2),16):/^#\d+$/.test(name)?Number(name.slice(1)):NaN;
    if(!Number.isInteger(point)||point<1||point>0x10ffff||(point>=0xd800&&point<=0xdfff))throw new Error('TTML 实体无效');return String.fromCodePoint(point);
  });
}
function xml(input:string):Element {
  if(input.length>2097152||/<!\s*(DOCTYPE|ENTITY)/i.test(input))throw new Error('TTML 数据过大或包含不支持的声明');
  let index=0,count=0,root:Element|undefined;const stack:Element[]=[];
  const name=/^[A-Za-z_][\w.:-]*/;
  while(index<input.length){
    if(++count>100000)throw new Error('TTML 节点过多');
    if(input.startsWith('<!--',index)){const end=input.indexOf('-->',index+4);if(end<0)throw new Error('TTML 注释未结束');index=end+3;continue;}
    if(input.startsWith('<?',index)){const end=input.indexOf('?>',index+2);if(end<0)throw new Error('TTML 声明未结束');index=end+2;continue;}
    if(input.startsWith('<![CDATA[',index)){const end=input.indexOf(']]>',index+9);if(end<0||!stack.length)throw new Error('TTML CDATA 无效');stack.at(-1)!.children.push(input.slice(index+9,end));index=end+3;continue;}
    if(input[index]!=='<'){
      let end=input.indexOf('<',index);if(end<0)end=input.length;const text=input.slice(index,end);if(/&(?!#x[\da-f]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/i.test(text))throw new Error('TTML 实体无效');
      if(stack.length)stack.at(-1)!.children.push(entities(text));else if(text.trim().replace(/^\uFEFF/,''))throw new Error('TTML 根节点无效');index=end;continue;
    }
    if(input.startsWith('</',index)){
      const end=input.indexOf('>',index+2);if(end<0)throw new Error('TTML 未闭合');const closing=input.slice(index+2,end).trim();if(stack.pop()?.name!==closing)throw new Error('TTML 标签不匹配');index=end+1;continue;
    }
    index++;const tag=input.slice(index).match(name)?.[0];if(!tag)throw new Error('TTML 标签无效');index+=tag.length;
    const element:Element={name:tag,attrs:{},children:[]};let closed=false;
    while(index<input.length){
      while(/\s/.test(input[index]??'')&&index<input.length)index++;
      if(input.startsWith('/>',index)){index+=2;closed=true;break;}if(input[index]==='>'){index++;break;}
      const key=input.slice(index).match(name)?.[0];if(!key||Object.keys(element.attrs).length>=32)throw new Error('TTML 属性无效');index+=key.length;
      while(/\s/.test(input[index]??'')&&index<input.length)index++;if(input[index++]!=='=')throw new Error('TTML 属性无效');while(/\s/.test(input[index]??'')&&index<input.length)index++;
      const quote=input[index++];if(quote!=='"'&&quote!=="'")throw new Error('TTML 属性引号无效');const end=input.indexOf(quote,index);if(end<0)throw new Error('TTML 属性未结束');
      if(key in element.attrs)throw new Error('TTML 属性重复');const raw=input.slice(index,end);if(raw.includes('<')||/&(?!#x[\da-f]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/i.test(raw))throw new Error('TTML 属性无效');element.attrs[key]=entities(raw);index=end+1;
    }
    if(stack.length)stack.at(-1)!.children.push(element);else {if(root)throw new Error('TTML 多个根节点');root=element;}
    if(!closed){stack.push(element);if(stack.length>32)throw new Error('TTML 嵌套过深');}
  }
  if(stack.length||!root||local(root.name)!=='tt')throw new Error('TTML 根节点或闭合无效');return root;
}
function attr(node:Element,name:string):string|undefined {return Object.entries(node.attrs).find(([key])=>local(key)===name)?.[1];}
export function parseTTML(input:string):LyricDocument {
  const root=xml(input),frameRate=Number(attr(root,'frameRate')??30);
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
  const lines:LyricLine[]=[];
  interface Timing {start:number;end:number;agent?:string;preserve:boolean}
  const timing=(node:Element,parent:Timing):Timing=>{
    if(attr(node,'timeContainer')==='seq')throw new Error('TTML 顺序时间容器暂不支持');
    const start=parent.start+(attr(node,'begin')?time(attr(node,'begin')!):0),end=Math.min(parent.end,attr(node,'end')?parent.start+time(attr(node,'end')!):maxTime,attr(node,'dur')?start+time(attr(node,'dur')!):maxTime);
    if(start>end||start>maxTime)throw new Error('TTML 时间范围无效');return{start,end,agent:attr(node,'agent')??parent.agent,preserve:attr(node,'space')?attr(node,'space')==='preserve':parent.preserve};
  };
  const visit=(node:Element,parent:Timing)=>{
    const context=timing(node,parent);
    if(local(node.name)==='p'){
      const main:LyricWord[]=[],bg:LyricWord[]=[],translation:string[]=[],romanization:string[]=[];
      const collect=(child:Element|string,context:Timing,role='')=>{
        if(typeof child==='string'){const text=context.preserve?child:child.replace(/\s+/g,' ');if(!text)return;
          if(!context.preserve&&!text.trim()&&role!=='x-translation'&&role!=='x-roman'){const words=role==='x-bg'?bg:main;if(words.length&&!words.at(-1)!.text.endsWith(' '))words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text+' '};return;}
          if(role==='x-translation'){translation.push(text);return;}if(role==='x-roman'){romanization.push(text);return;}
          (role==='x-bg'?bg:main).push({text,startMs:context.start,endMs:context.end});return;}
        const next=timing(child,context),nextRole=attr(child,'role')??role;
        if(local(child.name)==='br')collect('\n',{...next,preserve:true},nextRole);else for(const leaf of child.children)collect(leaf,next,nextRole);
      };
      for(const child of node.children)collect(child,context,attr(node,'role')??'');
      const append=(words:LyricWord[],background:boolean)=>{
        if(!context.preserve){while(words.length&&!words[0]!.text.trim())words.shift();while(words.length&&!words.at(-1)!.text.trim())words.pop();if(words.length){words[0]={...words[0]!,text:words[0]!.text.trimStart()};words[words.length-1]={...words.at(-1)!,text:words.at(-1)!.text.trimEnd()};}}
        if(!words.length)return;if(words.length>2000||lines.length>=10000)throw new Error('TTML 歌词过多');
        const ordered=words.every((word,i)=>i===0||word.startMs>=words[i-1]!.startMs);
        lines.push({startMs:Math.min(...words.map(word=>word.startMs)),endMs:Math.max(...words.map(word=>word.endMs)),text:words.map(word=>word.text).join(''),...(ordered?{words}:{}),...(background?{background:true}:{}),...(context.agent?{agent:context.agent}:{}),...(!background&&translation.length?{translation:translation.join('').trim()}:{}),...(!background&&romanization.length?{romanization:romanization.join('').trim()}: {})});
      };
      append(main,false);append(bg,true);return;
    }
    if(local(node.name)==='head'||local(node.name)==='metadata')return;
    for(const child of node.children)if(typeof child!=='string')visit(child,context);
  };
  visit(root,{start:0,end:maxTime,preserve:false});lines.sort((a,b)=>a.startMs-b.startMs||Number(!!a.background)-Number(!!b.background));
  return{lines,plain:[],synced:lines.length>0};
}
