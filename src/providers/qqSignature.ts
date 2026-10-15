// QQ request signature wire compatibility, adapted from the Apache-2.0 LX
// reference at 6624ab58 (musicSdk/tx/utils/crypto.js). See THIRD_PARTY_NOTICES.md.
export async function qqSignature(payload: string, sha1: (text: string) => Promise<string>) {
  const digest = await sha1(payload);
  const select = (indices: readonly number[]) => indices.map(index => digest[index] ?? '').join('');
  const mask = [89,39,179,150,218,82,58,252,177,52,186,123,120,64,242,133,143,161,121,179];
  const bytes = mask.map((value, index) => value ^ parseInt(digest.slice(index*2,index*2+2),16));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  for (let i=0;i<bytes.length;i+=3) {
    const bits = (bytes[i]!<<16) | ((bytes[i+1]??0)<<8) | (bytes[i+2]??0);
    base64 += alphabet[(bits>>>18)&63]! + alphabet[(bits>>>12)&63]!;
    if (i+1<bytes.length) base64 += alphabet[(bits>>>6)&63]!;
    if (i+2<bytes.length) base64 += alphabet[bits&63]!;
  }
  return `zzc${select([23,14,6,36,16,40,7,19])}${base64.replace(/[+/=]/g,'')}${select([16,1,32,12,19,27,8,5])}`.toLowerCase();
}
