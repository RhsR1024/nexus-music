const controls=/[\u0000-\u001f\u007f]/;

export function commentMediaURL(value:unknown){
 if(typeof value!=='string')return;
 const raw=value.trim();
 if(!raw||raw.length>2048||controls.test(raw))return;
 try{
  const url=new URL(raw.startsWith('//')?`https:${raw}`:raw);
  if(url.protocol==='http:')url.protocol='https:';
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password)return;
  // This fixed public QQ avatar endpoint needs its descriptor in the query.
  // Never retain transient transport signatures or arbitrary query fields.
  let descriptor:URLSearchParams|undefined;
  if(url.hostname==='thirdqq.qlogo.cn'&&!url.port&&url.pathname==='/g'){
   const fields=url.searchParams,b=fields.get('b'),k=fields.get('k'),s=fields.get('s');
   if(['b','k','s'].every(key=>fields.getAll(key).length===1)&&b==='sdk'&&
      k!==null&&/^[A-Za-z0-9_-]{1,128}$/.test(k)&&s!==null&&/^(?:40|100|140|640)$/.test(s)){
    descriptor=new URLSearchParams({b,k,s});
   }else return;
  }
  url.search='';
  if(descriptor)url.search=descriptor.toString();
  url.hash='';
  return url.href;
 }catch{return;}
}

export function commentRegion(value:unknown){
 if(typeof value!=='string')return;
 const clean=value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
 return clean||undefined;
}
