import {parseBoundedXML,type XMLElement} from '../formats/xml.ts';
export class WebDAVError extends Error {
  readonly kind:'configuration'|'authorization'|'network'|'protocol'|'missing'|'scope';
  constructor(kind:WebDAVError['kind']) {
    super({configuration:'WebDAV地址或路径无效',authorization:'WebDAV凭据无效或无权访问',network:'无法连接WebDAV，请检查网络后重试',protocol:'WebDAV响应不完整或格式不受支持',missing:'WebDAV文件已移除或更改，请刷新',scope:'WebDAV返回了账号目录之外的地址，已停止请求'}[kind]);
    this.kind=kind;
  }
}
const fail=(kind:WebDAVError['kind']):never=>{throw new WebDAVError(kind);};
function safeRaw(raw:string) {
  if(!raw||raw.length>8192||/[\u0000-\u0020\u007f\\?#]/.test(raw))fail('configuration');
  const path=raw.replace(/^https?:\/\/[^/]+/i,'');
  for(const segment of path.split('/')){
    let value:string;try{value=decodeURIComponent(segment);}catch{return fail('configuration');}
    if(value==='.'||value==='..'||/[\u0000-\u001f\u007f\\/%]/.test(value))fail('configuration');
  }
}
const encodePath=(path:string)=>path.split('/').map(part=>encodeURIComponent(decodeURIComponent(part))).join('/');
export function normalizeDAVRoot(raw:string):string {
  const text=raw.trim();safeRaw(text);let url:URL;try{url=new URL(text);}catch{return fail('configuration');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)fail('configuration');
  url.pathname=encodePath(url.pathname).replace(/\/+$/,'')+'/';return url.href;
}
export function davURL(root:string,path=''):string {
  const base=normalizeDAVRoot(root);if(!path)return base;
  safeRaw(path);if(path.startsWith('/')||/^[a-z][a-z\d+.-]*:/i.test(path))return fail('scope');
  return base+encodePath(path);
}
export function scopedDAVPath(root:string,href:string,requestPath=''):string {
  const base=new URL(normalizeDAVRoot(root));safeRaw(href);let url:URL;
  try{url=new URL(href,davURL(root,requestPath));}catch{return fail('scope');}
  if(url.origin!==base.origin||url.username||url.password||url.search||url.hash)return fail('scope');
  const path=encodePath(url.pathname);if(path===base.pathname.slice(0,-1))return '';
  if(!path.startsWith(base.pathname))return fail('scope');
  return path.slice(base.pathname.length);
}
interface Node {name:string;namespace:string;text:string;children:Node[]}
function namespaced(node:XMLElement,inherited:Readonly<Record<string,string>>={}):Node {
  const scope:Record<string,string>=Object.assign(Object.create(null),inherited);for(const [key,value] of Object.entries(node.attrs))if(key==='xmlns')scope['']=value;else if(key.startsWith('xmlns:'))scope[key.slice(6)]=value;
  const parts=node.name.split(':');if(parts.length>2)return fail('protocol');
  const prefix=parts.length===2?parts[0]!:'',name=parts.at(-1)!;
  if(prefix&&!scope[prefix])return fail('protocol');
  const children=node.children.filter((value):value is XMLElement=>typeof value!=='string').map(value=>namespaced(value,scope));
  return{name,namespace:scope[prefix]??'',text:node.children.map(value=>typeof value==='string'?value:'').join(''),children};
}
const children=(node:Node,name:string)=>node.children.filter(value=>value.namespace==='DAV:'&&value.name===name);
const one=(node:Node,name:string)=>{const values=children(node,name);if(values.length>1)return fail('protocol');return values[0];};
const text=(node:Node|undefined)=>node?.text.trim()??'';
const successful=(status:string)=>/^HTTP\/\d(?:\.\d)?\s+2\d\d(?:\s|$)/i.test(status);
export interface DAVEntry {path:string;name:string;directory:boolean;bytes?:number;etag?:string;modified?:string;contentType?:string}
export function parseDAVListing(xml:string,root:string,requestPath=''):DAVEntry[] {
  let node:Node;try{node=namespaced(parseBoundedXML(xml));}catch{return fail('protocol');}
  if(node.name!=='multistatus'||node.namespace!=='DAV:')return fail('protocol');
  const responses=children(node,'response');if(responses.length>10000)return fail('protocol');
  const entries:DAVEntry[]=[],seen=new Set<string>();
  for(const response of responses){
    const status=one(response,'status');if(status&&!successful(text(status)))continue;
    const properties=new Map<string,Node>();
    for(const propstat of children(response,'propstat')){
      if(!successful(text(one(propstat,'status'))))continue;
      const prop=one(propstat,'prop');if(!prop)continue;
      for(const item of prop.children)if(item.namespace==='DAV:'){if(properties.has(item.name))return fail('protocol');properties.set(item.name,item);}
    }
    if(!properties.size)continue;
    const href=text(one(response,'href'));if(!href)return fail('protocol');
    let path=scopedDAVPath(root,href,requestPath);
    const size=text(properties.get('getcontentlength')),bytes=size?Number(size):undefined;
    if(bytes!==undefined&&(!/^\d+$/.test(size)||!Number.isSafeInteger(bytes)||bytes<0))return fail('protocol');
    const resource=properties.get('resourcetype'),directory=!!resource&&children(resource,'collection').length>0;
    if(directory&&path&&!path.endsWith('/'))path+='/';
    if(seen.has(path))return fail('protocol');seen.add(path);
    const name=text(properties.get('displayname'))||decodeURIComponent(path.replace(/\/$/,'').split('/').at(-1)??'');
    entries.push({path,name,directory,...(bytes!==undefined?{bytes}:{}),...(text(properties.get('getetag'))?{etag:text(properties.get('getetag'))}:{}),...(text(properties.get('getlastmodified'))?{modified:text(properties.get('getlastmodified'))}:{}),...(text(properties.get('getcontenttype'))?{contentType:text(properties.get('getcontenttype'))}:{})});
  }
  return entries;
}
export interface WebDAVCredentials {username:string;password:string}
export interface WebDAVAccount {id:string;url:string;username:string;label:string}
export interface DAVTransport {request(root:string,path:string,credentials:WebDAVCredentials,depth:0|1,signal:AbortSignal):Promise<{status:number;body:string}>}
export class WebDAVClient {
  readonly account:WebDAVAccount;private credentials:WebDAVCredentials;private transport:DAVTransport;
  constructor(account:WebDAVAccount,credentials:WebDAVCredentials,transport:DAVTransport){this.account=account;this.credentials=credentials;this.transport=transport;}
  private async query(path:string,depth:0|1,signal:AbortSignal){
    davURL(this.account.url,path);let result:{status:number;body:string};
    try{result=await this.transport.request(this.account.url,path,this.credentials,depth,signal);}catch(error){if(signal.aborted)throw signal.reason;if(error instanceof WebDAVError)throw error;return fail('network');}
    if(signal.aborted)throw signal.reason;
    if(result.status===401||result.status===403)return fail('authorization');if(result.status===404)return fail('missing');if(result.status!==207)return fail('protocol');
    return parseDAVListing(result.body,this.account.url,path);
  }
  async list(path='',signal=new AbortController().signal){
    if(path&&!path.endsWith('/'))return fail('configuration');const entries=await this.query(path,1,signal);
    const self=entries.find(item=>item.path===path);if(!self?.directory)return fail('protocol');
    return entries.filter(item=>{if(item===self)return false;const child=item.path.slice(path.length).replace(/\/$/,'');if(!item.path.startsWith(path)||!child||child.includes('/'))return fail('scope');return true;});
  }
  async stat(path:string,signal=new AbortController().signal){const entries=await this.query(path,0,signal);const entry=entries.find(item=>item.path===path);if(!entry)return fail('missing');return entry;}
}
