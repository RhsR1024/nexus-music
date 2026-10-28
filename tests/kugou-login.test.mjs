import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {KugouLoginClient,validKugouQrImage} from '../src/providers/kugouLogin.ts';
import {KugouLoginCoordinator} from '../src/providers/kugouLoginCoordinator.ts';
import {MusicAccounts} from '../src/providers/musicAccounts.ts';
import {themeCovers} from '../scripts/fixtures/theme-covers.mjs';

const md5=async value=>createHash('md5').update(value).digest('hex');
const image='data:image/png;base64,'+themeCovers.red;
const envelope=data=>({status:1,error_code:0,data});
const qr=()=>({key:'synthetic-qr-key',mid:'a'.repeat(32),image,expiresAt:Date.now()+120_000});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const session={userId:'42',token:'synthetic-token',mid:'a'.repeat(32),nickname:'Synthetic listener'};

test('Kugou QR client signs only official requests, omits cookies and maps scan states',async()=>{
  const requests=[];let status=1;
  const client=new KugouLoginClient({md5,nonce:()=> 'ephemeral-nonce',now:()=>1_000_000,http:async(url,request)=>{
    const parsed=new URL(url);requests.push({parsed,request});
    const signature=parsed.searchParams.get('signature');parsed.searchParams.delete('signature');
    const canonical=[...parsed.searchParams].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('');
    assert.equal(signature,await md5('NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'+canonical+'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'));
    assert.equal(parsed.origin,'https://login-user.kugou.com');assert.equal(request.credentials,'omit');assert.equal(request.headers.Cookie,undefined);
    return envelope(parsed.pathname==='/v2/qrcode'?{qrcode:'synthetic-qr-key',qrcode_img:image}:{status,...(status===4?{userid:'00042',token:session.token,nickname:session.nickname}:{})});
  }});
  const signal=new AbortController().signal,challenge=await client.create(signal);
  assert.equal(challenge.expiresAt,1_120_000);assert.equal(challenge.mid,await md5('ephemeral-nonce'));
  for(const [code,expected] of [[1,'waiting'],[2,'scanned'],[0,'expired'],[4,'connected']]){status=code;const result=await client.poll(challenge,signal);assert.equal(result.status,expected);if(code===4)assert.equal(result.session.userId,'42');}
  assert.equal(requests.length,5);
});

test('QR image validation rejects external resources and unbounded decoded dimensions',()=>{
  assert.equal(validKugouQrImage(image),true);
  for(const value of ['https://invalid.example/qr.png','data:image/svg+xml;base64,AAAA',image+'=',null,'data:image/png;base64,'+'A'.repeat(2*1024*1024)])assert.equal(validKugouQrImage(value),false);
  const oversized=Buffer.from(themeCovers.red,'base64');oversized.writeUInt32BE(100_000,16);
  assert.equal(validKugouQrImage('data:image/png;base64,'+oversized.toString('base64')),false);
});

test('QR responses reject malformed envelopes, unsafe IDs and tokens; errors are redacted',async()=>{
  let response=envelope({status:4,userid:9007199254740992,token:'synthetic-token'});
  const client=new KugouLoginClient({md5,nonce:()=> 'nonce',http:async()=>response});
  const signal=new AbortController().signal;
  await assert.rejects(client.poll(qr(),signal));
  for(const data of [{status:4,userid:'42',token:'bad\nsecret'},{status:3},{status:4,userid:'0',token:'token'}]){response=envelope(data);await assert.rejects(client.poll(qr(),signal));}
  response={status:0,data:{status:1}};await assert.rejects(client.poll(qr(),signal));
  const faulty=new KugouLoginClient({md5,nonce:()=> 'nonce',http:async()=>{throw Error('https://invalid.example/?qrcode=DO-NOT-EXPOSE');}});
  await assert.rejects(faulty.poll(qr(),signal),error=>!error.message.includes('DO-NOT-EXPOSE')&&error.kind==='unavailable');
});

test('client expiry avoids the network; abort ignores a transport completing late',async()=>{
  let calls=0;const late=deferred();
  const client=new KugouLoginClient({md5,nonce:()=> 'nonce',http:async()=>{calls++;return late.promise;}});
  assert.deepEqual(await client.poll({...qr(),expiresAt:0},new AbortController().signal),{status:'expired'});assert.equal(calls,0);
  const controller=new AbortController(),pending=client.poll(qr(),controller.signal);await tick();controller.abort();
  await assert.rejects(pending,error=>error.kind==='cancelled');late.resolve(envelope({status:4,userid:'42',token:'late-token'}));
});

test('coordinator publishes scanned state, keeps secrets out of snapshots and saves no capabilities',async()=>{
  const snapshots=[],saved=[];let polls=0;
  const coordinator=new KugouLoginCoordinator({pollMs:0,client:{create:async()=>qr(),poll:async()=>++polls===1?{status:'scanned'}:{status:'connected',session}},accounts:{save:async(...args)=>saved.push(args)}});
  coordinator.subscribe(()=>snapshots.push(coordinator.getSnapshot()));await coordinator.login();
  assert.equal(coordinator.getSnapshot().status,'succeeded');assert.equal(snapshots.some(s=>s.status==='scanned'),true);
  assert.doesNotMatch(JSON.stringify(snapshots),/synthetic-qr-key|synthetic-token|"mid"/);
  assert.deepEqual(saved[0][0].capabilities,[]);assert.equal(saved[0][1].platform,'kg');assert.equal(saved[0][1].token,'synthetic-token');
  assert.equal(snapshots.filter(s=>['saving','succeeded'].includes(s.status)).every(s=>!s.image),true);
});

test('cancel and replacement invalidate late QR results and stale image callbacks',async()=>{
  const old=deferred();let creates=0,saves=0;
  const coordinator=new KugouLoginCoordinator({client:{create:async()=>++creates===1?old.promise:qr(),poll:async()=>({status:'expired'})},accounts:{save:async()=>saves++}});
  const first=coordinator.login();coordinator.cancel();assert.equal(coordinator.getSnapshot().status,'cancelled');
  await coordinator.login();const current=coordinator.getSnapshot();
  coordinator.imageFailed(current.generation-1);old.resolve(qr());await first;
  assert.equal(coordinator.getSnapshot(),current);assert.equal(current.status,'expired');assert.equal(saves,0);
});

test('a late connected poll cannot save credentials after cancellation',async()=>{
  const late=deferred();let saves=0;
  const coordinator=new KugouLoginCoordinator({client:{create:async()=>qr(),poll:async()=>late.promise},accounts:{save:async()=>saves++}});
  const pending=coordinator.login();await tick();assert.equal(coordinator.getSnapshot().status,'waiting');
  coordinator.cancel();late.resolve({status:'connected',session});await pending;
  assert.equal(coordinator.getSnapshot().status,'cancelled');assert.equal(saves,0);assert.equal(coordinator.getSnapshot().image,undefined);
});

test('image decoding failure cancels the current attempt and ignores its late result',async()=>{
  const late=deferred();let saves=0;
  const coordinator=new KugouLoginCoordinator({client:{create:async()=>qr(),poll:async()=>late.promise},accounts:{save:async()=>saves++}});
  const pending=coordinator.login();await tick();coordinator.imageFailed(coordinator.getSnapshot().generation);
  late.resolve({status:'connected',session});await pending;
  assert.equal(coordinator.getSnapshot().status,'failed');assert.equal(coordinator.getSnapshot().image,undefined);assert.equal(saves,0);
});

test('expiry aborts a pending poll and clears the presentation image',async()=>{
  const coordinator=new KugouLoginCoordinator({client:{create:async()=>({...qr(),expiresAt:Date.now()+30}),poll:async(_qr,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('stopped')),{once:true}))},accounts:{save:async()=>assert.fail('Expired QR cannot save')}});
  await coordinator.login();assert.deepEqual({...coordinator.getSnapshot()},{status:'expired',generation:1});
});

for(const phase of ['hash','secret','metadata'])test(`cancel during ${phase} restores the previous account and credential`,async()=>{
  const records=new Map(),secrets=new Map(),entered=deferred(),release=deferred();let armed=false;
  const hold=async location=>{if(armed&&phase===location){armed=false;entered.resolve();await release.promise;}};
  const accounts=new MusicAccounts({get:async key=>records.get(key),put:async(key,value)=>{records.set(key,value);await hold('metadata');}},
    {get:async key=>secrets.get(key)??null,set:async(key,value)=>{secrets.set(key,value);await hold('secret');},remove:async key=>{secrets.delete(key);}},async()=>{await hold('hash');return 'a'.repeat(64);});
  const account={platform:'kg',label:'Old label',username:'42',capabilities:[]};
  await accounts.save(account,{token:'old-token'});const previous=accounts.getSnapshot();armed=true;
  const controller=new AbortController(),pending=accounts.save({...account,label:'Changed'},{token:'new-token'},controller.signal);
  await entered.promise;controller.abort();release.resolve();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(accounts.getSnapshot(),previous);assert.deepEqual(records.get('music.accounts.v1'),previous);assert.equal((await accounts.session(previous[0].id)).token,'old-token');
});
