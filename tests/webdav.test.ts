import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDAVRoot,davURL,scopedDAVPath,parseDAVListing,WebDAVClient,WebDAVError} from '../src/providers/webdav.ts';
const root='https://music.example/dav/';
const response=(path:string,properties:string,status='200 OK')=>`<d:response><d:href>${path}</d:href><d:propstat><d:prop>${properties}</d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`;
const collection='<d:resourcetype><d:collection/></d:resourcetype>';
const file='<d:resourcetype/><d:displayname>Fixture &amp; tone</d:displayname><d:getcontentlength>9007199254740991</d:getcontentlength><d:getetag>&quot;version1&quot;</d:getetag>';
const xml=(rows:string)=>`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${rows}</d:multistatus>`;
test('WebDAV canonical paths retain Unicode and encoding, containing all resources within account root',()=>{
  assert.equal(normalizeDAVRoot(' https://music.example:443/dav '),root);
  assert.equal(davURL(root,'子目录/声 音.mp3'.split('/').map(encodeURIComponent).join('/')),root+'%E5%AD%90%E7%9B%AE%E5%BD%95/%E5%A3%B0%20%E9%9F%B3.mp3');
  assert.equal(scopedDAVPath(root,'tone%20a.mp3','album/'),'album/tone%20a.mp3');
  assert.equal(scopedDAVPath(root,'/dav/fixture.mp3'),'fixture.mp3');
  assert.equal(scopedDAVPath(root,'/dav'),'');
  assert.equal(davURL(root,'100%25.mp3'),root+'100%25.mp3');
  assert.equal(scopedDAVPath(root,'/dav/literal%2520name.mp3'),'literal%2520name.mp3');
  for(const path of ['../private.mp3','%2e%2e/private.mp3','%2E/private.mp3','safe%2foutside.mp3','%252e%252e/private.mp3','safe%5Cprivate.mp3','bad%00.mp3','bad%xy.mp3'])assert.throws(()=>davURL(root,path),WebDAVError);
  for(const href of ['https://outside.example/dav/tone.mp3','https://music.example:444/dav/tone.mp3','/dav-other/tone.mp3','/private/tone.mp3','//outside.example/dav/tone.mp3','https://a:b@music.example/dav/tone.mp3'])assert.throws(()=>scopedDAVPath(root,href),WebDAVError);
  for(const url of ['file:///dav','https://a:b@music.example/dav','https://music.example/dav?token=private','https://music.example/dav#hash','https://music.example/dav/%2e%2e/private'])assert.throws(()=>normalizeDAVRoot(url),WebDAVError);
});
test('WebDAV parses DAV namespace properties only from successful propstat, preserving safe integer file sizes',()=>{
  const rows=response('/dav/',collection)+response('/dav/tone.mp3',file)+response('/dav/private.mp3',file,'403 Forbidden');
  const entries=parseDAVListing(xml(rows),root);assert.equal(entries.length,2);assert.equal(entries[1]!.bytes,Number.MAX_SAFE_INTEGER);assert.equal(entries[1]!.etag,'"version1"');assert.equal(entries[1]!.name,'Fixture & tone');
  const mixed=xml(`<d:response><d:href>/dav/tone.mp3</d:href><d:propstat><d:prop>${file}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat><d:propstat><d:prop><d:getcontentlength>wrong</d:getcontentlength></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>`);
  assert.equal(parseDAVListing(mixed,root)[0]!.bytes,Number.MAX_SAFE_INTEGER);
  assert.throws(()=>parseDAVListing(xml(response('/dav/tone.mp3',file.replace('9007199254740991','9007199254740992'))),root));
  assert.throws(()=>parseDAVListing('<multistatus xmlns="unrelated"/>',root));
  assert.deepEqual(parseDAVListing('<multistatus xmlns="DAV:" xmlns:x="other"><x:response/></multistatus>',root),[]);
  assert.throws(()=>parseDAVListing(xml(response('/dav/tone.mp3',file)+response('/dav/tone.mp3',file)),root));
  assert.throws(()=>parseDAVListing(xml(response('/dav/tone.mp3',`<d:displayname>${'x'.repeat(1025)}</d:displayname>`)),root));
  assert.equal(parseDAVListing(xml(response('/dav/album',collection)),root)[0]!.path,'album/');
});
test('WebDAV XML rejects entity expansion, malformed structures and external hrefs without leaking server data',()=>{
  for(const value of ['<!DOCTYPE x [<!ENTITY e SYSTEM "file:///private">]><d:multistatus xmlns:d="DAV:"/>','<d:multistatus xmlns:d="DAV:">&unknown;</d:multistatus>','<d:multistatus xmlns:d="DAV:">','<d:multistatus xmlns:d="DAV:"><x:response/></d:multistatus>'])assert.throws(()=>parseDAVListing(value,root),WebDAVError);
  assert.throws(()=>parseDAVListing(xml(response('https://outside.example/tone.mp3',file)),root),error=>error instanceof WebDAVError&&error.kind==='scope'&&!error.message.includes('outside.example'));
  assert.throws(()=>parseDAVListing(' '.repeat(2097153),root));
});
test('WebDAV listing enforces Depth1 boundary and stat completeness, separating authorization and missing errors',async()=>{
  let body=xml(response('/dav/',collection)+response('/dav/tone.mp3',file)),status=207;const calls:{path:string;depth:number}[]=[];
  const client=new WebDAVClient({id:'account',url:root,username:'fixture',label:'Fixture'},{username:'fixture',password:'private-fixture'},{request:async(_,path,__,depth)=>{calls.push({path,depth});return{status,body};}});
  assert.equal((await client.list()).length,1);assert.deepEqual(calls,[{path:'',depth:1}]);
  body=xml(response('/dav/tone.mp3',file));assert.equal((await client.stat('tone.mp3')).path,'tone.mp3');assert.equal(calls.at(-1)!.depth,0);
  await assert.rejects(client.stat('missing.mp3'),error=>error instanceof WebDAVError&&error.kind==='missing');
  body=xml(response('/dav/',collection)+response('/dav/hidden/nested.mp3',file));await assert.rejects(client.list(),error=>error instanceof WebDAVError&&error.kind==='scope');
  status=401;await assert.rejects(client.list(),error=>error instanceof WebDAVError&&error.kind==='authorization');
  status=404;await assert.rejects(client.list(),error=>error instanceof WebDAVError&&error.kind==='missing');
  status=200;await assert.rejects(client.list(),error=>error instanceof WebDAVError&&error.kind==='protocol');
});
test('WebDAV cancellation cannot publish a late server result; transport error details remain private',async()=>{
  const abort=new AbortController();let finish!:(value:{status:number;body:string})=>void;
  const client=new WebDAVClient({id:'account',url:root,username:'fixture',label:'Fixture'},{username:'fixture',password:'private-fixture'},{request:()=>new Promise(resolve=>{finish=resolve;})});
  const pending=client.list('',abort.signal);abort.abort();finish({status:207,body:xml(response('/dav/',collection))});await assert.rejects(pending);
  const bad=new WebDAVClient(client.account,{username:'fixture',password:'private-fixture'},{request:async()=>{throw new Error('https://private:password@server.example');}});
  await assert.rejects(bad.list(),error=>error instanceof WebDAVError&&error.kind==='network'&&!error.message.includes('password'));
});
