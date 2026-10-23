import {musicCookieHeader,parseNeteaseCookiePayload} from './musicWebLogin.ts';
import type {HTTPRequest} from './http.ts';
import {weapiPayload} from './neteaseCrypto.ts';

export interface NeteaseSessionAuth {readonly cookie:string;readonly csrf:string}
const DESKTOP_UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Reads the same cookie subset the official web API accepts; anything else is no session. */
export function neteaseSessionAuth(session:unknown):NeteaseSessionAuth|undefined {
  const value=session&&typeof session==='object'&&!Array.isArray(session)?session as Record<string,unknown>:{};
  try{
    const cookies=parseNeteaseCookiePayload(JSON.stringify(value.cookies));
    return {cookie:musicCookieHeader(cookies),csrf:cookies.__csrf??''};
  }catch{return undefined;}
}

export function neteaseWeapiRequest(data:Record<string,unknown>,auth:NeteaseSessionAuth):HTTPRequest {
  const encrypted=weapiPayload({...data,csrf_token:auth.csrf});
  return{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Cookie:auth.cookie,Referer:'https://music.163.com/',Origin:'https://music.163.com','User-Agent':DESKTOP_UA},
    body:`params=${encodeURIComponent(encrypted.params)}&encSecKey=${encodeURIComponent(encrypted.encSecKey)}`,
  };
}

