// Original test-only TrueType: triangular A and S; all other text uses fallback.
// No third-party glyphs, tables or font binaries are copied.
export function fixtureFont(){
 const tables=new Map(),b=n=>Buffer.alloc(n),u16=(v,o,n)=>v.writeUInt16BE(n&65535,o),s16=(v,o,n)=>v.writeInt16BE(n,o),u32=(v,o,n)=>v.writeUInt32BE(n>>>0,o);
 const head=b(54);u32(head,0,0x10000);u32(head,4,0x10000);u32(head,12,0x5f0f3cf5);u16(head,16,11);u16(head,18,1000);s16(head,36,0);s16(head,38,0);s16(head,40,950);s16(head,42,900);u16(head,46,8);s16(head,48,2);tables.set('head',head);
 const hhea=b(36);u32(hhea,0,0x10000);s16(hhea,4,900);s16(hhea,6,-100);u16(hhea,10,1000);s16(hhea,14,50);s16(hhea,16,950);s16(hhea,18,1);u16(hhea,34,2);tables.set('hhea',hhea);
 const maxp=b(32);u32(maxp,0,0x10000);u16(maxp,4,2);u16(maxp,6,3);u16(maxp,8,1);u16(maxp,14,2);tables.set('maxp',maxp);
 const hmtx=b(8);u16(hmtx,0,1000);u16(hmtx,4,1000);s16(hmtx,6,50);tables.set('hmtx',hmtx);
 const glyph=b(32);s16(glyph,0,1);s16(glyph,2,50);s16(glyph,6,950);s16(glyph,8,900);u16(glyph,10,2);glyph.fill(1,14,17);[50,450,450,0,900,-900].forEach((v,i)=>s16(glyph,17+i*2,v));
 tables.set('glyf',Buffer.concat([b(12),glyph]));const loca=b(6);u16(loca,2,6);u16(loca,4,22);tables.set('loca',loca);
 const fmt=b(40);u16(fmt,0,4);u16(fmt,2,40);u16(fmt,6,6);u16(fmt,8,4);u16(fmt,10,1);u16(fmt,12,2);[65,83,65535].forEach((n,i)=>{u16(fmt,14+i*2,n);u16(fmt,22+i*2,n);});[-64,-82,1].forEach((n,i)=>s16(fmt,28+i*2,n));
 const cmap=b(12);u16(cmap,2,1);u16(cmap,4,3);u16(cmap,6,1);u32(cmap,8,12);tables.set('cmap',Buffer.concat([cmap,fmt]));
 const strings=[[0,'Original synthetic NexusMusic test font'],[1,'Nexus Fixture'],[2,'Regular'],[3,'NexusFixture-1'],[4,'Nexus Fixture Regular'],[5,'Version 1.0'],[6,'NexusFixture-Regular'],[13,'Original test fixture; no third-party font assets.']];
 const name=b(6+strings.length*12);u16(name,2,strings.length);u16(name,4,name.length);let offset=0;const bodies=[];
 strings.forEach(([id,text],i)=>{const bytes=Buffer.from(text,'utf16le').swap16(),p=6+i*12;[3,1,0x409,id,bytes.length,offset].forEach((v,j)=>u16(name,p+j*2,v));bodies.push(bytes);offset+=bytes.length;});tables.set('name',Buffer.concat([name,...bodies]));
 const post=b(32);u32(post,0,0x30000);s16(post,8,-100);s16(post,10,50);tables.set('post',post);
 const os=b(78);s16(os,2,1000);u16(os,4,400);u16(os,6,5);s16(os,26,50);s16(os,28,300);u32(os,42,1);os.write('NEXU',58);u16(os,62,0x40);u16(os,64,65);u16(os,66,65);s16(os,68,900);s16(os,70,-100);u16(os,74,900);u16(os,76,100);tables.set('OS/2',os);
 const checksum=data=>{const padded=Buffer.concat([data,b((4-data.length%4)%4)]);let sum=0;for(let i=0;i<padded.length;i+=4)sum=(sum+padded.readUInt32BE(i))>>>0;return sum;};
 const tags=[...tables.keys()].sort(),directory=b(12+tags.length*16);u32(directory,0,0x10000);u16(directory,4,tags.length);u16(directory,6,128);u16(directory,8,3);u16(directory,10,tags.length*16-128);offset=directory.length;let headAt=0;const parts=[];
 tags.forEach((tag,i)=>{const bytes=tables.get(tag),p=12+i*16;directory.write(tag,p);u32(directory,p+4,checksum(bytes));u32(directory,p+8,offset);u32(directory,p+12,bytes.length);if(tag==='head')headAt=offset;parts.push(bytes,b((4-bytes.length%4)%4));offset+=bytes.length+(4-bytes.length%4)%4;});
 const font=Buffer.concat([directory,...parts]);u32(font,headAt+8,(0xb1b0afba-checksum(font))>>>0);return font;
}
