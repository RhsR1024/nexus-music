// Read-only account contracts: Q-music Android 5db858f kugouApi.ts
// (Apache-2.0), MakcRe/KuGouMusicApi (MIT; licenses/kugou-api-mit.txt).
import {AccountPlaylistError,type AccountPlaylist} from './accountPlaylists.ts';
import {validKugouDailySession} from './kugouDaily.ts';
import {resolveKugouTracks,KugouTrackDetailError} from './kugouTrackDetails.ts';
import {queryURL,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicSession} from './musicAccounts.ts';
import {cleanTrack,safePublicURL} from '../storage/cleanTrack.ts';
import type {Track} from '../domain/track.ts';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
function fail():never{throw new AccountPlaylistError('incomplete');}
const id=(v:unknown)=>{const result=text(v);return /^[1-9]\d{0,19}$/.test(result)?result:fail();};
const count=(v:unknown)=>{if(typeof v!=='number'&&!(typeof v==='string'&&/^\d+$/.test(v)))return fail();const n=Number(v);return Number.isSafeInteger(n)&&n>=0&&n<=10000?n:fail();};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v);
const cover=(v:unknown)=>{try{const u=new URL(text(v).replace('{size}','240').replace(/^http:/i,'https:'));return u.protocol==='https:'&&safePublicURL(u.href)?u.href:'';}catch{return '';}};
export class KugouPlaylists{
  private readonly deps:{http:HTTPClient;md5:(value:string)=>Promise<string>;now?:()=>number};
  constructor(deps:KugouPlaylists['deps']){this.deps=deps;}
  private open(account:MusicAccount,session:MusicSession,signal:AbortSignal,check:()=>void){
    check();if(!validKugouDailySession(account,session)||session.accountId!==undefined&&session.accountId!==account.id)throw new AccountPlaylistError('login_required');
    return async(path:'/v7/get_all_list'|'/v4/get_list_all_file_v3',body:Row)=>{
      check();const query:Row={dfid:'-',mid:session.mid,uuid:'-',appid:1005,clientver:20489,clienttime:Math.floor((this.deps.now??Date.now)()/1000),...(path==='/v7/get_all_list'?{plat:1}:{}),userid:session.userId,token:session.token};
      const payload=JSON.stringify(body),salt='OIlwieks28dk2k092lksi2UIkp',signature=await this.deps.md5(salt+Object.keys(query).sort().map(k=>`${k}=${query[k]}`).join('')+payload+salt);
      check();if(!hash(signature))throw new AccountPlaylistError('unavailable');
      const raw=row(await this.deps.http(queryURL(`https://gateway.kugou.com${path}`,{...query,signature}),{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',dfid:'-',mid:String(session.mid),clienttime:String(query.clienttime),'x-router':'cloudlist.service.kugou.com'},body:payload},signal));check();
      if(![1,'1'].includes(raw.status as string|number)||raw.error_code!==undefined&&![0,'0'].includes(raw.error_code as string|number)||!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))throw new AccountPlaylistError('unavailable');
      return row(raw.data);
    };
  }
  async list(account:MusicAccount,session:MusicSession,signal:AbortSignal,check:()=>void):Promise<AccountPlaylist[]>{
    const call=this.open(account,session,signal,check),items:AccountPlaylist[]=[],seen=new Set<string>();let expected:number|undefined;
    for(let page=1;page<=100;page++){
      const data=await call('/v7/get_all_list',{userid:session.userId,token:session.token,total_ver:979,type:2,page,pagesize:100}),rows=data.info??data.list;
      if(!Array.isArray(rows)||rows.length>100)fail();
      const rawTotal=data.total??data.count;if(rawTotal!=null){const n=count(rawTotal);if(expected!==undefined&&n!==expected)fail();expected=n;}else if(expected!==undefined)fail();
      for(const value of rows){const item=row(value),identifier=id(item.listid??item.list_id),title=text(item.name??item.listname).trim()||'未命名歌单';
        if(seen.has(identifier)||title.length>200||/[\u0000-\u001f\u007f]/.test(title))fail();seen.add(identifier);
        const creator=item.list_create_userid,foreign=creator!==undefined&&creator!==null&&text(creator)!==''&&text(creator)!=='0'?id(creator)!==session.userId:false;
        items.push(Object.freeze({id:identifier,title,count:count(item.count??item.songcount??item.filecount),coverUrl:cover(item.pic??item.img??item.picurl),kind:Number(item.is_collect)===1||foreign?'favorite':'created'}));
      }
      if(items.length>10000)fail();
      if(expected!==undefined){if(items.length>expected)fail();if(items.length===expected)return items;if(!rows.length)fail();}
      else if(rows.length<100)return items;
    }
    return fail();
  }
  async tracks(account:MusicAccount,session:MusicSession,playlist:AccountPlaylist,signal:AbortSignal,check:()=>void):Promise<Track[]>{
    const call=this.open(account,session,signal,check),identifier=id(playlist.id),hashes:string[]=[],pages=new Set<string>();let expected:number|undefined;
    for(let page=1;page<=100;page++){
      const data=await call('/v4/get_list_all_file_v3',{listid:identifier,userid:session.userId,token:session.token,type:0,page,pagesize:300,area_code:1,allplatform:1,show_cover:1}),rows=data.info??data.list;
      if(!Array.isArray(rows)||rows.length>300)fail();
      const rawTotal=data.count??data.total;if(rawTotal!=null){const n=count(rawTotal);if(expected!==undefined&&n!==expected)fail();expected=n;}else if(expected!==undefined)fail();
      const group=rows.map(value=>{const item=row(value),valueHash=item.hash??item.filehash??item.file_hash;if(!hash(valueHash))return fail();return valueHash.toUpperCase();});
      const fingerprint=JSON.stringify(group);if(group.length&&pages.has(fingerprint))fail();pages.add(fingerprint);hashes.push(...group);if(hashes.length>10000)fail();
      if(expected!==undefined&&hashes.length>expected)fail();
      if(expected!==undefined&&hashes.length===expected||expected===undefined&&rows.length<300){
        try{return(await resolveKugouTracks(this.deps,hashes,signal,check)).map(cleanTrack);}catch(error){check();if(error instanceof KugouTrackDetailError)throw new AccountPlaylistError('incomplete');throw error;}
      }
      if(!rows.length)fail();
    }
    return fail();
  }
}
