import {parseProviderJSON} from './http.ts';
/** Kuwo's public playlist endpoint emits single-quoted object strings. Convert
 * only string tokens; JSON still validates the entire grammar. Never eval JS. */
export function parseKuwoJSON(source:string):unknown{
  if(source.length>4*1024*1024)throw Error('响应过大');
  let result='',i=0;
  while(i<source.length){
    const quote=source[i];
    if(quote!=="'"&&quote!=='"'){result+=quote;i++;continue;}
    i++;let value='',closed=false;
    while(i<source.length){
      const char=source[i++]!;
      if(char===quote){closed=true;break;}
      if(char==='\\'){
        const escape=source[i++];
        if(escape==="'"||escape==='"'||escape==='\\'||escape==='/'){value+=escape;continue;}
        const escaped:Record<string,string>={b:'\b',f:'\f',n:'\n',r:'\r',t:'\t'};
        if(escape&&escaped[escape]!==undefined){value+=escaped[escape];continue;}
        if(escape==='u'&&/^[0-9a-fA-F]{4}$/.test(source.slice(i,i+4))){value+=String.fromCharCode(parseInt(source.slice(i,i+4),16));i+=4;continue;}
        throw Error('响应转义无效');
      }
      if(char.charCodeAt(0)<32)throw Error('响应字符串无效');value+=char;
    }
    if(!closed)throw Error('响应字符串未结束');result+=JSON.stringify(value);
  }
  return parseProviderJSON(result);
}
