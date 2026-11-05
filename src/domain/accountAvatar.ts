const control=/[\u0000-\u001f\u007f]/;
const loopbackHost=(hostname:string)=>hostname==='localhost'||hostname==='[::1]'||hostname==='::1'||/^127(?:\.\d{1,3}){3}$/.test(hostname);

/**
 * Account avatars are public image locations. Keep only a bounded absolute
 * http(s) URL without credentials, query or fragment; local fixture hosts may
 * stay on HTTP while public CDNs are upgraded to HTTPS.
 */
export function normalizeAccountAvatar(value:unknown):string|undefined{
  if(typeof value!=='string')return;
  const raw=value.trim();
  if(!raw||raw.length>2048||control.test(raw))return;
  try{
    const url=new URL(raw.startsWith('//')?`https:${raw}`:raw);
    if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)return;
    if(url.protocol==='http:'&&!loopbackHost(url.hostname))url.protocol='https:';
    url.search='';url.hash='';
    return url.href;
  }catch{return;}
}

export const validAccountAvatar=(value:unknown):value is string=>typeof value==='string'&&normalizeAccountAvatar(value)===value;
