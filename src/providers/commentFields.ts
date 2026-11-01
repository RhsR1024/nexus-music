const controls=/[\u0000-\u001f\u007f]/;

export function commentMediaURL(value:unknown){
 if(typeof value!=='string')return;
 const raw=value.trim();
 if(!raw||raw.length>2048||controls.test(raw))return;
 try{
  const url=new URL(raw.startsWith('//')?`https:${raw}`:raw);
  if(url.protocol==='http:')url.protocol='https:';
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password)return;
  // Avatar URLs are public descriptors. Drop query strings and fragments so
  // transient transport signatures do not become durable image identities.
  url.search='';
  url.hash='';
  return url.href;
 }catch{return;}
}

export function commentRegion(value:unknown){
 if(typeof value!=='string')return;
 const clean=value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
 return clean||undefined;
}
