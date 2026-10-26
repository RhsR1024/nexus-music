import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {WebDAVBackups,normalizeBackupDirectory,strongBackupETag,backupDirectory,type BackupTransport} from '../src/storage/webdavBackups.ts';
import {encodeBackup,decodeBackup,type LibraryBackup} from '../src/storage/backup.ts';
import {emptyLibrary} from '../src/storage/library.ts';
import {WebDAVError,type DAVEntry,type WebDAVAccount} from '../src/providers/webdav.ts';
import type {Track} from '../src/domain/track.ts';
import {DAVNativeTransport,type DAVNativeModule} from '../src/providers/davNativeTransport.ts';
const hash=async(text:string)=>createHash('sha256').update(text).digest('hex');
const date=new Date('2026-10-16T10:30:00.123Z'),account:WebDAVAccount={id:'a'.repeat(64),url:'https://fixture.invalid/dav/',username:'fixture-user',label:'Synthetic DAV'};
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};};
function fixture(){
  const records=new Map<string,unknown>(),directories=new Set<string>(),files=new Map<string,string>(),listeners=new Set<()=>void>();
  let accounts=[account],restoreCalls:LibraryBackup[]=[],uuid=0,writeFails=false,corruptRead=false,putStatus=201,restoreAction=async()=>{},beforeRead=async()=>{},beforePut=async()=>{},beforeStat=async()=>{};
  const calls:{operation:string;root:string;path:string;etag:string}[]=[];
  const repository={get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{await beforePut();if(writeFails)throw new Error('fixture disk full');records.set(key,structuredClone(value));}};
  const client={list:async(path:string)=>{if(!directories.has(path))throw new WebDAVError('missing');return[...files].filter(([key])=>key.startsWith(path)&&!key.slice(path.length).includes('/')).map(([path,body])=>({path,name:'server display name ignored',directory:false,bytes:Buffer.byteLength(body),etag:'"fixture"'}));},stat:async(path:string):Promise<DAVEntry>=>{await beforeStat();if(directories.has(path))return{path,name:'directory',directory:true};if(files.has(path))return{path,name:'file',directory:false};throw new WebDAVError('missing');}};
  const transport:BackupTransport={backup:async(root,path,credentials,operation,body,etag,signal)=>{
    assert.deepEqual(credentials,{username:'fixture-user',password:'synthetic-secret'});assert.equal(signal.aborted,false);calls.push({operation,root,path,etag});
    const key=root.slice(account.url.length)+path;
    if(operation==='MKCOL'){directories.add(key);return{status:201,body:'',etag:'',bytes:0};}
    if(operation==='PUT'){if(putStatus!==201)return{status:putStatus,body:'',etag:'',bytes:0};if(files.has(key))return{status:412,body:'',etag:'',bytes:0};files.set(key,body);return{status:201,body:'',etag:'"fixture"',bytes:0};}
    await beforeRead();const saved=files.get(key);if(saved===undefined)return{status:404,body:'',etag:'',bytes:0};const read=corruptRead?saved+' ':saved;return{status:200,body:read,etag:'"fixture"',bytes:Buffer.byteLength(read)};
  }};
  const options={repository,accounts:{getSnapshot:()=>accounts,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},credentials:async()=>({username:'fixture-user',password:'synthetic-secret'}),client:async()=>client},transport,hash,uuid:()=>String(++uuid).padStart(32,'0'),snapshot:()=>encodeBackup(emptyLibrary,date),now:()=>date,restore:async(backup:LibraryBackup)=>{await restoreAction();restoreCalls.push(backup);}};
  const backups=new WebDAVBackups(options);
  return{backups,options,records,directories,files,calls,restoreCalls,client,transport,configure:()=>backups.configure(account.id,''),setWriteFails:(value:boolean)=>{writeFails=value;},setCorruptRead:(value:boolean)=>{corruptRead=value;},setPutStatus:(value:number)=>{putStatus=value;},setBeforeRead:(action:()=>Promise<void>)=>{beforeRead=action;},setBeforePut:(action:()=>Promise<void>)=>{beforePut=action;},setBeforeStat:(action:()=>Promise<void>)=>{beforeStat=action;},setRestoreAction:(action:()=>Promise<void>)=>{restoreAction=action;},updateAccount:(remove=false)=>{accounts=remove?[]:[{...account}];for(const listener of listeners)listener();}};
}
test('cloud backup directories preserve Unicode and literal names while rejecting escape and malformed paths',()=>{
  assert.equal(normalizeBackupDirectory(''),backupDirectory);assert.equal(normalizeBackupDirectory(' 音枢/备份/ '),'%E9%9F%B3%E6%9E%A2/%E5%A4%87%E4%BB%BD/');assert.equal(normalizeBackupDirectory('100%'),'100%25/');
  for(const path of ['/outside','https://fixture.invalid/','../private','x//y','x/./y','x\\y','%252e%252e/private','x%2fy','x\ny','a/'.repeat(33)])assert.throws(()=>normalizeBackupDirectory(path));
  assert.equal(strongBackupETag('W/"weak"'),'');assert.equal(strongBackupETag('"a"\r\nX: private'),'');assert.equal(strongBackupETag('"strong"'),'"strong"');assert.equal(strongBackupETag('"'+'é'.repeat(4096)+'"'),'');
});
test('cloud backup configuration survives restart without credentials and rejects corrupt records',async()=>{
  const f=fixture();await f.backups.configure(account.id,'音枢/备份');const next=new WebDAVBackups(f.options);await next.restore();assert.equal(next.getSnapshot().config?.directory,normalizeBackupDirectory('音枢/备份'));assert.doesNotMatch(JSON.stringify([...f.records]),/secret|password|fixture-user/);
  f.records.set('webdav.backup.v1',{version:2,accountId:account.id,directory:backupDirectory});await assert.rejects(new WebDAVBackups(f.options).restore());
});
test('cloud backup failed configuration writes retain prior settings and cannot race a restore or upload',async()=>{
  const f=fixture();await f.configure();f.setWriteFails(true);await assert.rejects(f.backups.configure(account.id,'other'));assert.equal(f.backups.getSnapshot().config?.directory,backupDirectory);f.setWriteFails(false);
  const wait=deferred<void>();f.setBeforePut(()=>wait.promise);const pending=f.backups.configure(account.id,'other');assert.equal(f.backups.cancel(),false);await assert.rejects(f.backups.upload());await assert.rejects(f.configure());wait.resolve();await pending;assert.equal(f.backups.getSnapshot().config?.directory,'other/');
});
test('cloud uploads create and verify directories, unique versions and full readback digest without altering local data',async()=>{
  const f=fixture();await f.backups.configure(account.id,'nested/backup');await f.backups.upload();await f.backups.upload();assert.deepEqual([...f.directories],['nested/','nested/backup/']);assert.equal(f.files.size,2);assert.equal(f.restoreCalls.length,0);
  const [first]=f.backups.getSnapshot().files;assert.match(first!.name,/^nexus-20261016T103000123Z-\d{32}-[a-f\d]{64}\.json$/);assert.equal(first!.digest,await hash(f.options.snapshot()));assert.equal(f.calls.filter(call=>call.operation==='MKCOL').length,2);assert.ok(f.calls.filter(call=>call.operation==='GET').every(call=>call.etag==='"fixture"'&&call.root===account.url+'nested/backup/'));
});
test('cloud upload rejects a same-name file masquerading as the backup directory and verifies MKCOL 405',async()=>{
  const f=fixture();await f.configure();f.files.set(backupDirectory,'existing file');await assert.rejects(f.backups.upload());assert.equal(f.calls.length,0);f.files.clear();
  f.transport.backup=async()=>({status:405,body:'',etag:'',bytes:0});await assert.rejects(f.backups.upload());assert.equal(f.restoreCalls.length,0);assert.equal(f.backups.getSnapshot().files.length,0);
});
test('cloud upload collision, authorization and corrupt readback never announce success or restore local data',async()=>{
  for(const status of [412,401,403,507]){const f=fixture();await f.configure();f.setPutStatus(status);await assert.rejects(f.backups.upload());assert.equal(f.backups.getSnapshot().files.length,0);assert.ok(f.backups.getSnapshot().error);assert.equal(f.restoreCalls.length,0);}
  const f=fixture();await f.configure();f.setCorruptRead(true);await assert.rejects(f.backups.upload());assert.equal(f.files.size,1);assert.equal(f.backups.getSnapshot().files.length,0);assert.match(f.backups.getSnapshot().error,/摘要/);
});
test('cloud list and preview distinguish legacy format-only backup from digest-verified versions and require explicit restore',async()=>{
  const f=fixture();await f.configure();await f.backups.list();assert.match(f.backups.getSnapshot().message,/尚不存在/);await f.backups.upload();f.files.set(backupDirectory+'legacy.json',f.options.snapshot());f.files.set(backupDirectory+'ignore.mp3','fixture');await f.backups.list();assert.equal(f.backups.getSnapshot().files.length,2);
  const legacy=f.backups.getSnapshot().files.find(file=>file.name==='legacy.json')!;await f.backups.preview(legacy);assert.equal(f.backups.getSnapshot().preview?.digestVerified,false);assert.equal(f.restoreCalls.length,0);await f.backups.restorePreview();assert.equal(f.restoreCalls.length,1);assert.equal(f.backups.getSnapshot().preview,undefined);await assert.rejects(f.backups.restorePreview());
  const generated=f.backups.getSnapshot().files.find(file=>file.digest)!;await f.backups.preview(generated);assert.equal(f.backups.getSnapshot().preview?.digestVerified,true);assert.equal(f.restoreCalls.length,1);
});
test('cloud preview rejects changed digest, unknown versions, invalid JSON and oversized entries without invoking restore',async()=>{
  const f=fixture();await f.configure();await f.backups.upload();const generated=f.backups.getSnapshot().files[0]!;f.files.set(generated.path,f.options.snapshot()+' ');await assert.rejects(f.backups.preview(generated));
  for(const body of ['{invalid',JSON.stringify({...decodeBackup(f.options.snapshot()),version:2})]){f.files.set(backupDirectory+'legacy.json',body);await f.backups.list();await assert.rejects(f.backups.preview(f.backups.getSnapshot().files.find(file=>file.name==='legacy.json')!));}
  f.files.set(backupDirectory+'huge.json','x'.repeat(32*1024*1024+1));await f.backups.list();const hits=f.calls.length;await assert.rejects(f.backups.preview(f.backups.getSnapshot().files.find(file=>file.name==='huge.json')!));assert.equal(f.calls.length,hits);assert.equal(f.restoreCalls.length,0);
});
test('cloud canceled read and changed credentials discard late results and do not pretend to undo accepted uploads',async()=>{
  for(const change of ['cancel','update','remove']){const f=fixture();await f.configure();const entered=deferred<void>(),wait=deferred<void>();f.setBeforeRead(async()=>{entered.resolve();await wait.promise;});const pending=f.backups.upload();await entered.promise;assert.equal(f.files.size,1);
    if(change==='cancel'){f.backups.cancel();assert.match(f.backups.getSnapshot().message,/刷新列表/);}else f.updateAccount(change==='remove');wait.resolve();await assert.rejects(pending);assert.equal(f.backups.getSnapshot().busy,null);assert.equal(f.backups.getSnapshot().files.length,0);assert.equal(f.restoreCalls.length,0);
  }
});
test('cloud local restore cannot be falsely canceled and reports commit-refresh uncertainty honestly',async()=>{
  const f=fixture();await f.configure();await f.backups.upload();await f.backups.preview(f.backups.getSnapshot().files[0]!);const wait=deferred<void>();f.setRestoreAction(()=>wait.promise);const pending=f.backups.restorePreview();assert.equal(f.backups.cancel(),false);await assert.rejects(f.configure());await assert.rejects(f.backups.list());f.updateAccount(true);wait.resolve();await pending;assert.equal(f.restoreCalls.length,1);assert.equal(f.backups.getSnapshot().files.length,0);
  const other=fixture();await other.configure();await other.backups.upload();await other.backups.preview(other.backups.getSnapshot().files[0]!);other.setRestoreAction(async()=>{throw new Error('fixture post-commit refresh error');});await assert.rejects(other.backups.restorePreview());assert.match(other.backups.getSnapshot().error,/未确认完成/);assert.doesNotMatch(other.backups.getSnapshot().error,/旧库|撤销|post-commit/);
});
test('cloud directory checks stop before any remote write when canceled, and stale ETag errors ask for refresh',async()=>{
  const f=fixture();await f.configure();const entered=deferred<void>(),wait=deferred<void>();f.setBeforeStat(async()=>{entered.resolve();await wait.promise;});const pending=f.backups.upload();await entered.promise;f.backups.cancel();wait.resolve();await assert.rejects(pending);assert.equal(f.calls.length,0);
  f.setBeforeStat(async()=>{});await f.backups.upload();f.transport.backup=async()=>({status:412,body:'',etag:'',bytes:0});await assert.rejects(f.backups.preview(f.backups.getSnapshot().files[0]!));assert.match(f.backups.getSnapshot().error,/版本已变化/);assert.equal(f.restoreCalls.length,0);
});
test('cloud backup native bridge keeps cancellation and sanitized errors and rejects unsupported binaries',async()=>{
  const wait=deferred<{status:number;body:string;etag:string;bytes:number}>(),calls:string[]=[];
  const native={backup:async(token,root,path,user,password,operation,body,etag)=>{assert.deepEqual([token,root,path,user,password,operation,body,etag],['fixture-token',account.url,'backup.json','fixture-user','synthetic-secret','GET','','"fixture"']);return wait.promise;},cancel:async token=>{calls.push(token);}} as DAVNativeModule;
  const transport=new DAVNativeTransport(native,()=> 'fixture-token'),abort=new AbortController();const pending=transport.backup(account.url,'backup.json',{username:'fixture-user',password:'synthetic-secret'},'GET','','"fixture"',abort.signal);abort.abort();wait.resolve({status:200,body:'fixture',etag:'',bytes:7});await assert.rejects(pending);assert.deepEqual(calls,['fixture-token']);
  const unsupported=new DAVNativeTransport({cancel:async()=>{}} as unknown as DAVNativeModule,()=> 'fixture-token');await assert.rejects(unsupported.backup(account.url,'x',{username:'fixture-user',password:'synthetic-secret'},'GET','','',new AbortController().signal),error=>error instanceof WebDAVError&&error.kind==='protocol');
});
test('backup decoder drops unknown root fields and secret metadata before cloud restore',()=>{
  const track:Track={origin:{kind:'online',platform:'wy',id:'original'},title:'Synthetic',artist:'Fixture',metadata:{songId:'original',password:'fixture-private'},qualities:[{id:'128k',sizeBytes:123,password:'fixture-private'} as Track['qualities'][number]]};
  const library={...emptyLibrary,favorites:[track],matches:[{original:track,target:{...track,origin:{kind:'online',platform:'tx',id:'target'} as const},method:'manual' as const,updatedAt:123,password:'fixture-private'}]};
  const encoded=encodeBackup(library,date);assert.doesNotMatch(encoded,/fixture-private/);
  const safe=decodeBackup(JSON.stringify({...decodeBackup(encoded),credentials:'fixture-private-root',scripts:['fixture-script']}));assert.equal('credentials' in safe,false);assert.equal('scripts' in safe,false);assert.equal(safe.library.favorites[0]!.metadata.songId,'original');assert.equal(safe.library.favorites[0]!.qualities[0]!.sizeBytes,123);
});

test('asynchronous backup snapshots cannot write after cancellation while waiting for queued local commits',async()=>{
  const f=fixture();await f.configure();const entered=deferred<void>(),wait=deferred<void>();(f.options as unknown as {snapshot:()=>Promise<string>}).snapshot=async()=>{entered.resolve();await wait.promise;return encodeBackup(emptyLibrary,date);};const pending=f.backups.upload();await entered.promise;f.backups.cancel();wait.resolve();await assert.rejects(pending);assert.equal(f.files.size,0);assert.equal(f.calls.length,0);
});
