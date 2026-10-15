// Original bounded XML tree; no DTD, external entities or networking.
export interface XMLElement {name:string;attrs:Record<string,string>;children:(XMLElement|string)[]}
function entities(text:string):string {
  return text.replace(/&([^;\s]*);/g,(_,name:string)=>{
    const known:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.prototype.hasOwnProperty.call(known,name))return known[name]!;
    const point=/^#x[\da-f]+$/i.test(name)?parseInt(name.slice(2),16):/^#\d+$/.test(name)?Number(name.slice(1)):NaN;
    if(!Number.isInteger(point)||point<1||point>0x10ffff||(point>=0xd800&&point<=0xdfff))throw new Error('XML 实体无效');return String.fromCodePoint(point);
  });
}
export function parseBoundedXML(input:string):XMLElement {
  if(input.length>2097152||/<!\s*(DOCTYPE|ENTITY)/i.test(input))throw new Error('XML 数据过大或包含不支持的声明');
  let index=0,count=0,root:XMLElement|undefined;const stack:XMLElement[]=[];
  const name=/^[A-Za-z_][\w.:-]*/;
  while(index<input.length){
    if(++count>100000)throw new Error('XML 节点过多');
    if(input.startsWith('<!--',index)){const end=input.indexOf('-->',index+4);if(end<0)throw new Error('XML 注释未结束');index=end+3;continue;}
    if(input.startsWith('<?',index)){const end=input.indexOf('?>',index+2);if(end<0)throw new Error('XML 声明未结束');index=end+2;continue;}
    if(input.startsWith('<![CDATA[',index)){const end=input.indexOf(']]>',index+9);if(end<0||!stack.length)throw new Error('XML CDATA 无效');stack.at(-1)!.children.push(input.slice(index+9,end));index=end+3;continue;}
    if(input[index]!=='<'){
      let end=input.indexOf('<',index);if(end<0)end=input.length;const text=input.slice(index,end);if(/&(?!#x[\da-f]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/i.test(text))throw new Error('XML 实体无效');
      if(stack.length)stack.at(-1)!.children.push(entities(text));else if(text.trim().replace(/^\uFEFF/,''))throw new Error('XML 根节点无效');index=end;continue;
    }
    if(input.startsWith('</',index)){
      const end=input.indexOf('>',index+2);if(end<0)throw new Error('XML 未闭合');const closing=input.slice(index+2,end).trim();if(stack.pop()?.name!==closing)throw new Error('XML 标签不匹配');index=end+1;continue;
    }
    index++;const tag=input.slice(index).match(name)?.[0];if(!tag)throw new Error('XML 标签无效');index+=tag.length;
    const element:XMLElement={name:tag,attrs:{},children:[]};let closed=false;
    while(index<input.length){
      while(/\s/.test(input[index]??'')&&index<input.length)index++;
      if(input.startsWith('/>',index)){index+=2;closed=true;break;}if(input[index]==='>'){index++;break;}
      const key=input.slice(index).match(name)?.[0];if(!key||Object.keys(element.attrs).length>=32)throw new Error('XML 属性无效');index+=key.length;
      while(/\s/.test(input[index]??'')&&index<input.length)index++;if(input[index++]!=='=')throw new Error('XML 属性无效');while(/\s/.test(input[index]??'')&&index<input.length)index++;
      const quote=input[index++];if(quote!=='"'&&quote!=="'")throw new Error('XML 属性引号无效');const end=input.indexOf(quote,index);if(end<0)throw new Error('XML 属性未结束');
      if(key in element.attrs)throw new Error('XML 属性重复');const raw=input.slice(index,end);if(raw.includes('<')||/&(?!#x[\da-f]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/i.test(raw))throw new Error('XML 属性无效');element.attrs[key]=entities(raw);index=end+1;
    }
    if(stack.length)stack.at(-1)!.children.push(element);else {if(root)throw new Error('XML 多个根节点');root=element;}
    if(!closed){stack.push(element);if(stack.length>32)throw new Error('XML 嵌套过深');}
  }
  if(stack.length||!root)throw new Error('XML 根节点或闭合无效');return root;
}
