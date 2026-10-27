import {scoreCandidate} from '../src/domain/matching.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreferenceStore,defaults} from '../src/app/preferences.ts';
import {normalizeDownloadQualities} from '../src/domain/downloadQuality.ts';
import type {Track} from '../src/domain/track.ts';
import {SourceRegistry} from '../src/providers/sourceRegistry.ts';
import {createDownloadResolver} from '../src/providers/downloadResolver.ts';
import type {LXTransport} from '../src/providers/multiSourceResolver.ts';
import {cleanBackupSettings} from '../src/storage/backupSettings.ts';
const song:Track={origin:{kind:'online',platform:'wy',id:'1'},title:'Domain input',artist:'Contract',durationMs:100000,metadata:{},qualities:[]};
async function registry(){const r=new SourceRegistry({initialize:async()=>['wy','tx'].map(platform=>({platform:platform as 'wy'|'tx',name:platform,actions:['musicUrl'],qualities:['flac','320k','128k']})),destroy(){}});r.register({id:'source',name:'contract',script:'contract'});await r.setEnabled('source',true);return r;}
test('download policies validate, migrate, persist atomically and survive old portable backups',async()=>{
 for(const value of [null,[],{unknown:'128k'},{wy:'FLAC'},{wy:'private-url'},{wy:null}])assert.throws(()=>normalizeDownloadQualities(value));
 let saved:unknown;const store=new PreferenceStore({get:async<T>()=>saved as T|undefined,put:async(_key,value)=>{saved=value;}});await store.restore();assert.deepEqual(store.getSnapshot().downloadQualities,{});
 await Promise.all([store.setDownloadQuality('wy','128k'),store.setDownloadQuality('tx','flac')]);assert.deepEqual(store.getSnapshot().downloadQualities,{wy:'128k',tx:'flac'});assert.equal(store.getSnapshot().quality,defaults.quality);
 const restart=new PreferenceStore({get:async<T>()=>saved as T,put:async()=>{}});await restart.restore();assert.deepEqual(restart.getSnapshot().downloadQualities,store.getSnapshot().downloadQualities);
 const portable=cleanBackupSettings({version:1,preferences:store.getSnapshot()});assert.deepEqual(portable.preferences.downloadQualities,{wy:'128k',tx:'flac'});
 const old={...portable.preferences};delete old.downloadQualities;await restart.update(cleanBackupSettings({version:1,preferences:old}).preferences);assert.deepEqual(restart.getSnapshot().downloadQualities,{wy:'128k',tx:'flac'});
 await store.setDownloadQuality('wy');assert.deepEqual(store.getSnapshot().downloadQualities,{tx:'flac'});
});
test('actual target platform policy keeps quality-first matching without publishing playback matches',async()=>{
 const r=await registry(),calls:unknown[]=[];let writes=0;const target:Track={...song,origin:{kind:'online',platform:'tx',id:'2'}};
 const resolver=createDownloadResolver({registry:r,transport:{async request(_source,payload){calls.push(payload);return'https://audio.example/public.mp3';}},matcher:{candidates:async()=>({items:[{track:target,...scoreCandidate(song,target)}],failedPlatforms:[]})},library:{matchFor:()=>undefined,setMatch:async()=>{writes++;}},preferences:()=>({quality:'320k',autoMatch:true,downloadQualities:{wy:'128k',tx:'flac'}}),enrich:async track=>track,other:{resolve:async()=>{throw Error('private path');}},hash:async value=>value});
 const media=await resolver.resolve(song,new AbortController().signal);assert.equal(media.quality,'flac');assert.equal(media.requestedQuality,'flac');assert.equal(writes,0);assert.equal(calls.length,1);assert.match(JSON.stringify(calls[0]),/flac/);assert.match(JSON.stringify(calls[0]),/tx/);
});
test('concurrent download requests capture independent policies while playback and private clients keep their boundaries',async()=>{
 const r=await registry();let preference={quality:'320k' as const,autoMatch:false,downloadQualities:{wy:'128k' as '128k'|'flac'}},release!:()=>void;let entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});let first=true,privateCalls=0;const requests:string[]=[];
 const transport:LXTransport={async request(_source,payload){requests.push(JSON.stringify(payload));return'https://audio.example/public.mp3';}};
 const resolver=createDownloadResolver({registry:r,transport,matcher:{candidates:async()=>{throw Error('auto match disabled');}},library:{matchFor:()=>undefined,setMatch:async()=>{throw Error('must not write');}},preferences:()=>preference,enrich:async track=>{if(first){first=false;entered();await new Promise<void>(resolve=>{release=resolve;});}return track;},other:{resolve:async()=>{privateCalls++;return{url:'https://server.example/original'};}},hash:async value=>value});
 const one=resolver.resolve(song,new AbortController().signal);await started;preference={...preference,downloadQualities:{wy:'flac'}};const two=await resolver.resolve(song,new AbortController().signal);release();const original=await one;assert.equal(two.quality,'flac');assert.equal(original.quality,'128k');assert.equal(preference.quality,'320k');assert.equal(requests.length,2);
 const privateTrack:Track={...song,origin:{kind:'navidrome',accountId:'owned-contract',id:'1'}};assert.equal((await resolver.resolve(privateTrack,new AbortController().signal)).url,'https://server.example/original');assert.equal(privateCalls,1);
});
