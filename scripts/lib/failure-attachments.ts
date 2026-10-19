import {extname} from 'node:path';
// Xcode may export attachments as bare UUIDs. Preserve readable evidence using
// its actual signature instead of depending on an optional filename extension.
export function failureAttachmentExtension(name:string,bytes:Uint8Array):string|undefined {
  const extension=extname(name).toLowerCase();
  if(['.png','.jpg','.jpeg','.txt','.json'].includes(extension))return extension;
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))return '.png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return '.jpg';
  if(bytes.length===0||new TextDecoder().decode(bytes.slice(0,8))==='bplist00')return;
  try {
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)&&text.trim())return '.txt';
  } catch { /* Binary event/archive attachments remain in the xcresult. */ }
}
