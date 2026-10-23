/**
 * NetEase weapi payload: AES-128-CBC twice with a per-request key, then the
 * reversed key is RSA-encrypted with NetEase's published web public key.
 * Ported from Sollin-Music-Desktop neteaseCrypto.ts so account endpoints keep
 * the reference protocol without shipping a browser crypto dependency.
 */
const SBOX=Uint8Array.of(
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
);
const RCON=Uint8Array.of(0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36);
const PRESET_KEY='0CoJUm6Qyw8W8jud';
const IV='0102030405060708';
const BASE62='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MODULUS=0xe0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7n;
const EXPONENT=65537n;
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export interface WeapiPayload {readonly params:string;readonly encSecKey:string}

function utf8(text:string):Uint8Array {
  const bytes:number[]=[];
  for(const character of text){
    const point=character.codePointAt(0)!;
    if(point<0x80)bytes.push(point);
    else if(point<0x800)bytes.push(0xc0|point>>6,0x80|point&63);
    else if(point<0x10000)bytes.push(0xe0|point>>12,0x80|point>>6&63,0x80|point&63);
    else bytes.push(0xf0|point>>18,0x80|point>>12&63,0x80|point>>6&63,0x80|point&63);
  }
  return Uint8Array.from(bytes);
}

function base64(bytes:Uint8Array):string {
  let text='';
  for(let index=0;index<bytes.length;index+=3){
    const first=bytes[index]!,second=bytes[index+1],third=bytes[index+2];
    text+=B64[first>>2]!+B64[(first&3)<<4|(second??0)>>4]!;
    text+=second===undefined?'=':B64[(second&15)<<2|(third??0)>>6]!;
    text+=third===undefined?'=':B64[third&63]!;
  }
  return text;
}

function expandKey(key:Uint8Array):Uint8Array {
  if(key.length!==16)throw new Error('AES-128 key must be 16 bytes');
  const words=new Uint8Array(176);
  words.set(key);
  for(let index=16;index<176;index+=4){
    let a=words[index-4]!,b=words[index-3]!,c=words[index-2]!,d=words[index-1]!;
    if(index%16===0){const first=a;a=SBOX[b]!^RCON[index/16]!;b=SBOX[c]!;c=SBOX[d]!;d=SBOX[first]!;}
    words[index]=words[index-16]!^a;words[index+1]=words[index-15]!^b;
    words[index+2]=words[index-14]!^c;words[index+3]=words[index-13]!^d;
  }
  return words;
}

function mixColumns(state:Uint8Array):void {
  for(let column=0;column<4;column++){
    const index=column*4,a=state[index]!,b=state[index+1]!,c=state[index+2]!,d=state[index+3]!;
    const twice=(value:number)=>((value<<1)^((value>>7&1)?0x1b:0))&0xff;
    state[index]=twice(a)^(twice(b)^b)^c^d;
    state[index+1]=a^twice(b)^(twice(c)^c)^d;
    state[index+2]=a^b^twice(c)^(twice(d)^d);
    state[index+3]=(twice(a)^a)^b^c^twice(d);
  }
}

function encryptBlock(state:Uint8Array,words:Uint8Array):void {
  const addKey=(offset:number)=>{for(let index=0;index<16;index++)state[index]=(state[index]!)^(words[offset+index]!);};
  addKey(0);
  for(let round=1;round<=10;round++){
    for(let index=0;index<16;index++)state[index]=SBOX[state[index]!]!;
    const shifted=Uint8Array.from(state);
    for(let row=0;row<4;row++)for(let column=0;column<4;column++)state[column*4+row]=shifted[((column+row)&3)*4+row]!;
    if(round<10)mixColumns(state);
    addKey(round*16);
  }
}

function encryptCbc(data:Uint8Array,key:string):Uint8Array {
  const words=expandKey(utf8(key)),initial=utf8(IV);
  const length=Math.ceil((data.length+1)/16)*16,padded=new Uint8Array(length);
  padded.set(data);padded.fill(length-data.length,data.length);
  const output=new Uint8Array(length);
  let previous=initial;
  for(let offset=0;offset<length;offset+=16){
    const block=new Uint8Array(16);
    for(let index=0;index<16;index++)block[index]=padded[offset+index]!^previous[index]!;
    encryptBlock(block,words);
    output.set(block,offset);previous=block;
  }
  return output;
}

function modPow(base:bigint,exponent:bigint,modulus:bigint):bigint {
  let result=1n,value=base%modulus,power=exponent;
  while(power>0n){
    if(power&1n)result=result*value%modulus;
    value=value*value%modulus;power>>=1n;
  }
  return result;
}

function rsaEncryptHex(message:Uint8Array):string {
  let value=0n;
  for(const byte of message)value=(value<<8n)|BigInt(byte);
  const encrypted=modPow(value,EXPONENT,MODULUS).toString(16);
  return encrypted.padStart(256,'0');
}

export function weapiSecretKey(random:()=>number=Math.random):string {
  let key='';
  for(let index=0;index<16;index++)key+=BASE62[Math.floor(random()*BASE62.length)]!;
  return key;
}

export function weapiPayload(data:Record<string,unknown>,secretKey:string=weapiSecretKey()):WeapiPayload {
  if(!/^[A-Za-z0-9]{16}$/.test(secretKey))throw new Error('weapi key must be 16 base62 characters');
  const first=base64(encryptCbc(utf8(JSON.stringify(data)),PRESET_KEY));
  const second=base64(encryptCbc(utf8(first),secretKey));
  return {params:second,encSecKey:rsaEncryptHex(utf8([...secretKey].reverse().join('')))};
}
