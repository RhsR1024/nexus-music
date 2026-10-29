import test from 'node:test';
import assert from 'node:assert/strict';
import {SearchAssistanceProvider,AssistanceUnavailableError,cleanSearchKeywords} from '../src/providers/searchAssistance.ts';
import {SearchAssistanceCoordinator} from '../src/providers/searchAssistanceCoordinator.ts';
import type {OnlinePlatform} from '../src/domain/track.ts';
const signal=()=>new AbortController().signal;
const provider=(value:unknown)=>new SearchAssistanceProvider({http:async()=>value,md5:async()=> 'a'.repeat(32),deviceId:()=> 'ephemeral-test'});
test('keyword sanitization deduplicates without inventing rows, bounds text and count',()=>{
 assert.deepEqual(cleanSearchKeywords([' <em>Love</em> &amp; Music ','love & music','', 'a'.repeat(501),'X\nY']),['Love & Music','X Y']);
 assert.equal(cleanSearchKeywords(Array.from({length:30},(_,i)=>`word${i}`)).length,20);
 assert.throws(()=>cleanSearchKeywords([{}]));assert.throws(()=>cleanSearchKeywords(Array(1001).fill('x')));
});
test('NetEase hot and typed words validate different envelopes and preserve public query semantics',async()=>{
 assert.deepEqual(await provider({code:200,result:{hots:[{first:'Public Word'}]}}).read('wy','hot','',signal()),['Public Word']);
 assert.deepEqual(await provider({code:200,result:{songs:[{name:'Public Song',artists:[{name:'Public Artist'}]}]}}).read('wy','suggest','Public',signal()),['Public Song - Public Artist']);
 assert.deepEqual(await provider({code:200,result:{artists:[]}}).read('wy','suggest','absent',signal()),[]);
 await assert.rejects(provider({code:200}).read('wy','suggest','x',signal()));
 await assert.rejects(provider({code:200,result:{songs:[{artists:[]}]}}).read('wy','suggest','x',signal()));
});
test('QQ, Kuwo and Kugou parse keyword data rather than result links',async()=>{
 assert.deepEqual(await provider({code:0,hotkey:{code:0,data:{vec_hotkey:[{query:'Public Word'}]}}}).read('tx','hot','',signal()),['Public Word']);
 assert.deepEqual(await provider({code:0,data:{song:{itemlist:[{name:'Song',singer:'Artist'}]}}}).read('tx','suggest','s',signal()),['Song - Artist']);
 assert.deepEqual(await provider({STATUS:'OK',WORDITEMS:[{RELWORD:'Public Word'}]}).read('kw','suggest','p',signal()),['Public Word']);
 assert.deepEqual(await provider({status:'ok',tagvalue:[{key:'Public Word'}]}).read('kw','hot','',signal()),['Public Word']);
 assert.deepEqual(await provider({status:1,data:[{RecordDatas:[{HintInfo:'Public Word'}]}]}).read('kg','suggest','p',signal()),['Public Word']);
 assert.deepEqual(await provider({status:1,errcode:0,data:{list:[{keywords:[{keyword:'Public Word'},{keyword:'Advertisement',jumpurl:'https://example.com'}]}]}}).read('kg','hot','',signal()),['Public Word']);
 await assert.rejects(provider({status:1,errcode:1001,data:[]}).read('kg','suggest','x',signal()));
});
test('Migu hot words exclude promotional deep links and retired suggestions never fetch a homepage',async()=>{
 assert.deepEqual(await provider({code:'000000',data:{hotwords:[{hotwordList:[{word:'Song',resourceType:'song',id:'123'},{word:'Ad',resourceType:'song',id:'124',url:'mgmusic://advertisement'},{word:'No identity',resourceType:'song'}]}]}}).read('mg','hot','',signal()),['Song']);
 const p=new SearchAssistanceProvider({http:async()=>{assert.fail('Retired route must not be requested');},md5:async()=>'',deviceId:()=>''});
 await assert.rejects(p.read('mg','suggest','x',signal()),AssistanceUnavailableError);
});
test('all public requests omit account credentials; Kugou identity is per-request and cancellation wins',async()=>{
 const requests:{url:string;headers:Readonly<Record<string,string>>|undefined}[]=[];
 const p=new SearchAssistanceProvider({http:async(url,r)=>{assert.equal(r.credentials,'omit');assert.equal(r.headers?.Cookie,undefined);requests.push({url,headers:r.headers});return {status:1,data:{list:[]}};},md5:async(v)=>v==='nonce'?'a'.repeat(32):'b'.repeat(32),deviceId:()=> 'nonce',now:()=>1000});
 await p.read('kg','hot','',signal());assert.equal(requests[0]!.headers?.mid,'a'.repeat(32));assert.equal(requests[0]!.headers?.clienttime,'1');
 const aborted=new AbortController();aborted.abort();await assert.rejects(p.read('kg','hot','',aborted.signal));assert.equal(requests.length,1);
});
test('late assistance cannot replace a new query, mode or cleared screen',async()=>{
 const waiting:((s:readonly string[])=>void)[]=[];
 const c=new SearchAssistanceCoordinator({read:async()=>new Promise(resolve=>waiting.push(resolve))});
 const a=c.load('suggest','old','wy'),b=c.load('hot','','tx');waiting[1]!(['Current']);await b;waiting[0]!(['Stale']);await a;
 assert.equal(c.getSnapshot().mode,'hot');assert.deepEqual(c.getSnapshot().groups[0]!.items,['Current']);
 const d=c.load('suggest','gone','kw');c.clear();waiting[2]!(['Gone']);await d;assert.deepEqual(c.getSnapshot().groups,[]);
});
test('one provider failure is independent and retry does not refetch successful groups',async()=>{
 const calls:OnlinePlatform[]=[];let fail=true;
 const c=new SearchAssistanceCoordinator({read:async p=>{calls.push(p);if(p==='kw'&&fail)throw Error('private upstream body');return [p];}});
 await c.load('hot','','all');assert.equal(c.getSnapshot().groups.length,5);assert.equal(c.getSnapshot().groups[2]!.error?.includes('private'),false);
 assert.deepEqual(c.getSnapshot().groups[0]!.items,['wy']);fail=false;await c.retry('kw');assert.deepEqual(c.getSnapshot().groups[2]!.items,['kw']);assert.equal(calls.filter(p=>p==='wy').length,1);
});
test('unsupported advice has no retry action and late errors after clear stay invisible',async()=>{
 let fail:(e:unknown)=>void=()=>{};
 const c=new SearchAssistanceCoordinator({read:async p=>{if(p==='mg')throw new AssistanceUnavailableError();return new Promise((_,reject)=>{fail=reject;});}});
 await c.load('suggest','x','mg');assert.equal(c.getSnapshot().groups[0]!.retryable,false);await c.retry('mg');
 const pending=c.load('suggest','x','wy');c.clear();fail(Error('secret'));await pending;assert.deepEqual(c.getSnapshot().groups,[]);
});
