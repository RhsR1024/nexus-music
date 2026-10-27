import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreferenceStore} from '../src/app/preferences.ts';
import {downloadCoverSize,normalizeDownloadCoverSizes} from '../src/domain/downloadCover.ts';
import {cleanBackupSettings} from '../src/storage/backupSettings.ts';
import type {Track} from '../src/domain/track.ts';
import {CoverService} from '../src/providers/covers.ts';
import {SourceRegistry} from '../src/providers/sourceRegistry.ts';
const track:Track={origin:{kind:'online',platform:'wy',id:'1'},title:'Domain input',artist:'Contract',metadata:{},qualities:[]};
test('cover size policy defaults, validates and persists independent device file choices atomically',async()=>{
 for(const value of [null,[],{wy:'1000'},{wy:1201},{wy:Infinity},{unknown:512}])assert.throws(()=>normalizeDownloadCoverSizes(value));
 let saved:unknown;const repository={get:async<T>()=>saved as T|undefined,put:async(_key:string,value:unknown)=>{saved=structuredClone(value);}};const store=new PreferenceStore(repository);await store.restore();assert.equal(downloadCoverSize(track,store.getSnapshot().downloadCoverSizes),512);
 await Promise.all([store.setDownloadCoverSize('wy',1000),store.setDownloadCoverSize('tx',1200),store.setDownloadCoverSize('kw',500)]);const restarted=new PreferenceStore(repository);await restarted.restore();assert.deepEqual(restarted.getSnapshot().downloadCoverSizes,{wy:1000,tx:1200,kw:500});assert.equal(downloadCoverSize(track,restarted.getSnapshot().downloadCoverSizes),1000);assert.equal(downloadCoverSize({...track,origin:{kind:'navidrome',accountId:'contract',id:'1'}},restarted.getSnapshot().downloadCoverSizes),512);
 const backup=cleanBackupSettings({version:1,preferences:store.getSnapshot()});assert(!Object.hasOwn(backup.preferences,'downloadCoverSizes'));await restarted.update(backup.preferences);assert.equal(restarted.getSnapshot().downloadCoverSizes.tx,1200);await restarted.setDownloadCoverSize('tx');assert.equal(restarted.getSnapshot().downloadCoverSizes.tx,undefined);
});
test('online export covers use separate namespace and native size path while display and private requests retain their original sizes',async()=>{
 const calls:{purpose:string;key:string;size:number}[]=[];const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});const privateSizes:number[]=[];
 const service=new CoverService({fetchCover:async(key,_url,size)=>{calls.push({purpose:'display',key,size});return'file:///display.jpg';},fetchExportCover:async(key,_url,size)=>{calls.push({purpose:'export',key,size});return'file:///export.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({files:0,bytes:0})},async value=>value,registry,{request:async()=>''},async(_account,_id,_signal,size)=>{privateSizes.push(size);return'https://server.invalid/private';},undefined,async()=> 'https://p1.music.126.net/public.jpg');
 const signal=new AbortController().signal;await service.loadTrack(track,signal,1024);await service.loadForExport(track,signal,1200);assert.equal(calls[0]!.size,1024);assert.match(calls[0]!.key,/cover-v2/);assert.equal(calls[1]!.size,1200);assert.match(calls[1]!.key,/cover-export-v1/);assert.notEqual(calls[0]!.key,calls[1]!.key);
 await service.loadForExport({...track,origin:{kind:'navidrome',accountId:'contract',id:'1'},metadata:{coverArtId:'art'}},signal,1200);assert.deepEqual(privateSizes,[512]);assert.equal(calls.at(-1)!.purpose,'display');
});
