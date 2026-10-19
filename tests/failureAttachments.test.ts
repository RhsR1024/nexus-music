import test from 'node:test';
import assert from 'node:assert/strict';
import {failureAttachmentExtension} from '../scripts/lib/failure-attachments.ts';
test('failure exports recognize extensionless actual PNG and JPEG signatures',()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  assert.equal(failureAttachmentExtension('uuid',png),'.png');assert.equal(failureAttachmentExtension('other',Buffer.from([255,216,255,224,0,16])),'.jpg');
  assert.equal(failureAttachmentExtension('short',png.subarray(0,4)),undefined);
});
test('failure exports retain UTF8 hierarchy text and advertised evidence filenames',()=>{
  assert.equal(failureAttachmentExtension('uuid',Buffer.from('Application, label: 音枢\n  Button, identifier: mini-reset')),'.txt');
  assert.equal(failureAttachmentExtension('manifest.JSON',Buffer.from('{}')),'.json');
  assert.equal(failureAttachmentExtension('named.PNG',Buffer.from('partial screenshot bytes')),'.png');
});
test('failure exports do not label binary event archives, malformed UTF8 or empty payloads as text',()=>{
  for(const value of [Buffer.from('bplist00'),Buffer.from([255,254,128]),Buffer.from('binary\u0000event'),Buffer.alloc(0),Buffer.from('   ')])assert.equal(failureAttachmentExtension('uuid',value),undefined);
});
