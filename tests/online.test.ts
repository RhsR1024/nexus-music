import type {Track} from '../src/domain/track.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProviderJSON } from '../src/providers/http.ts';
import { onlineTrack, OnlineProvider } from '../src/providers/online.ts';
import { makeLXRequest } from '../src/providers/lx.ts';

test('provider JSON preserves long integer IDs and strings containing numeric-looking text', () => {
  assert.deepEqual(parseProviderJSON('{"id":90071992547409931234,"name":"id:12345678901234567","n":2,"real":1.25}'),
    { id: '90071992547409931234', name: 'id:12345678901234567', n: 2, real: 1.25 });
  assert.deepEqual(parseProviderJSON('{"fraction":0.1234567890123456789,"scientific":1.25e20}'), { fraction: 0.1234567890123456789, scientific: 1.25e20 });
});
test('TX and KG retain distinct LX identity fields and per-quality hashes', () => {
  const tx = onlineTrack('tx', { id: '90071992547409931234', mid: 'mid-fixture', title: 'Fixture', singer: [{name:'Artist'}], album: {mid:'album'}, file: {media_mid:'media-mid',size_flac:1024} });
  const request = makeLXRequest(tx, 'flac', {platform:'tx',name:'TX',actions:['musicUrl'],qualities:['flac']});
  assert.equal(request.info.musicInfo.songmid, 'mid-fixture');
  assert.equal(request.info.musicInfo.meta.songId, 'mid-fixture');
  assert.equal(request.info.musicInfo.meta.id, '90071992547409931234');
  assert.equal(request.info.musicInfo.meta.strMediaMid, 'media-mid');
  const kg = onlineTrack('kg', { Audioid:'123', FileHash:'normal-hash', SQFileHash:'lossless-hash', SQFileSize:1234, OriSongName:'Fixture' });
  const kgRequest = makeLXRequest(kg, 'flac', {platform:'kg',name:'KG',actions:['musicUrl'],qualities:['flac']});
  assert.equal(kgRequest.info.musicInfo.hash, 'normal-hash');
  assert.equal(kgRequest.info.musicInfo.meta.songId, '123');
  const wy = onlineTrack('wy', { id:'451703096', name:'Fixture' });
  const wyRequest = makeLXRequest(wy, '128k', {platform:'wy',name:'WY',actions:['musicUrl'],qualities:['128k']});
  assert.equal(wyRequest.info.musicInfo.id, 'wy_451703096');
  assert.equal(wyRequest.info.musicInfo.songmid, '451703096');
  assert.equal(kg.origin.id, '123_normal-hash');
  assert.equal((kgRequest.info.musicInfo.meta._qualitys as Record<string, {hash:string}>).flac!.hash, 'lossless-hash');
});
test('missing optional data is not fabricated, unsafe IDs are rejected', () => {
  const track = onlineTrack('wy', {id:'1', name:'Fixture'});
  assert.equal(track.durationMs, undefined); assert.equal(track.artwork, undefined); assert.deepEqual(track.qualities, []);
  assert.throws(() => onlineTrack('wy', {id:90071992547409931234, name:'Fixture'}));
});
test('search pagination uses requested page and maps returned total', async () => {
  let body = '', endpoint = '';
  const provider = new OnlineProvider({ md5: async () => '', deviceId: () => 'fixture', http: async (url, request) => {
    endpoint = url; body = request.body!; return {code:200,result:{songCount:100,songs:[{id:'1',name:'Fixture'}]}};
  } });
  const page = await provider.search('wy', 'query & +', 2, new AbortController().signal, 30);
  assert.equal(endpoint, 'https://music.163.com/api/cloudsearch/pc');
  assert.ok(body.includes('offset=30')); assert.ok(body.includes('s=query%20%26%20%2B'));
  assert.equal(page.hasMore, true); assert.equal(page.total, 100);
});
test('WY rejects encrypted string search payloads instead of returning silent empty results', async () => {
  const provider = new OnlineProvider({ md5: async () => '', deviceId: () => 'fixture', http: async () => ({code:200,result:'35b1748964af8a7c'}) });
  await assert.rejects(() => provider.search('wy', 'Shape of You', 1, new AbortController().signal, 10), /搜索服务暂时不可用/);
});

test('WY missing search cover uses exact public song identity and ignores mismatched detail rows',async()=>{
  const track:Track={origin:{kind:'online',platform:'wy',id:'9007199254740993'},title:'Public fixture',artist:'Fixture',metadata:{},qualities:[]};
  let calls=0;
  const provider=new OnlineProvider({md5:async()=>'',deviceId:()=>'',http:async(url,request,signal)=>{
    calls++;assert.equal(url,'https://music.163.com/api/v3/song/detail');assert.equal(request?.method,'POST');
    const fields=new URLSearchParams(request?.body as string);assert.deepEqual(JSON.parse(fields.get('ids')!),[track.origin.id]);
    assert.ok(signal);return{code:200,songs:[{id:'other',al:{picUrl:'https://images.invalid/wrong.jpg'}},{id:track.origin.id,al:{picUrl:'https://images.invalid/right.jpg'}}]};
  }});
  assert.equal(await provider.artwork(track,new AbortController().signal),'https://images.invalid/right.jpg');
  assert.equal(await provider.artwork({...track,origin:{kind:'online',platform:'tx',id:'private-fixture'}},new AbortController().signal),undefined);
  assert.equal(calls,1);
});
