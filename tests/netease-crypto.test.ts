import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,constants,publicEncrypt} from 'node:crypto';
import {weapiPayload,weapiSecretKey} from '../src/providers/neteaseCrypto.ts';

const IV='0102030405060708',PRESET='0CoJUm6Qyw8W8jud';
const PUBLIC_KEY=`-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;
const aes=(text:string,key:string)=>{const cipher=createCipheriv('aes-128-cbc',Buffer.from(key),Buffer.from(IV));return Buffer.concat([cipher.update(text,'utf8'),cipher.final()]).toString('base64');};

test('weapi payload matches an independent AES/RSA implementation',()=>{
  const data={offset:0,total:true,limit:30,csrf_token:'fixture',note:'网易云'},secret='AbCdEfGh12345678';
  const payload=weapiPayload(data,secret);
  assert.equal(payload.params,aes(aes(JSON.stringify(data),PRESET),secret));
  const reversed=Buffer.from([...secret].reverse().join(''),'utf8'),padded=Buffer.alloc(128);
  reversed.copy(padded,128-reversed.length);
  const expected=publicEncrypt({key:PUBLIC_KEY,padding:constants.RSA_NO_PADDING},padded).toString('hex');
  assert.equal(payload.encSecKey,expected);
  assert.match(payload.params,/^[A-Za-z0-9+/]+={0,2}$/);
  assert.match(payload.encSecKey,/^[a-f0-9]{256}$/);
});

test('weapi generates a fresh 16-character key and rejects malformed keys',()=>{
  const first=weapiSecretKey(),second=weapiSecretKey();
  assert.match(first,/^[A-Za-z0-9]{16}$/);assert.match(second,/^[A-Za-z0-9]{16}$/);
  assert.notEqual(new Set([weapiPayload({offset:0},first).params,weapiPayload({offset:0},second).params]).size,1);
  for(const key of ['', 'short', '12345678901234567', 'not-base62-!!!!!'])assert.throws(()=>weapiPayload({},key),/16 base62/);
});
