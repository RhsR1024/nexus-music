import assert from 'node:assert/strict';
import { createCipheriv, createHash, generateKeyPairSync, publicEncrypt, constants } from 'node:crypto';
import { deflateSync, inflateSync, gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const cases = [];
const add = (operation, input, check) => cases.push({ operation, input, check });
const binary = Buffer.from([0, 255, 128, 1, 127]);
const unicode = '音枢🎵';
add('md5', { bytes: [...Buffer.from(unicode)] }, r => assert.equal(r.value, createHash('md5').update(unicode).digest('hex')));
for (const [encoding, input] of [['base64', binary.toString('base64')], ['utf8', unicode], ['binary', binary.toString('latin1')]]) {
  add('decode', { encoding, input }, r => assert.deepEqual(r.value, [...Buffer.from(input, encoding)]));
}
for (const encoding of ['hex', 'base64', 'binary', 'utf8']) {
  add('encode', { encoding, bytes: [...binary] }, r => assert.equal(r.value, binary.toString(encoding)));
}
const key = Buffer.from('0123456789abcdef'), iv = Buffer.from('abcdef9876543210');
for (const mode of ['aes-128-cbc', 'aes-128-ecb']) {
  const input = Buffer.from(mode.endsWith('cbc') ? unicode : '0123456789abcdef');
  const cipher = createCipheriv(mode, key, mode.endsWith('cbc') ? iv : null);
  if (mode.endsWith('ecb')) cipher.setAutoPadding(false);
  const expected = Buffer.concat([cipher.update(input), cipher.final()]);
  add('aesEncrypt', { bytes: [...input], mode, key: [...key], iv: mode.endsWith('cbc') ? [...iv] : [] }, r => assert.deepEqual(r.value, [...expected]));
}
for (const type of ['spki', 'pkcs1']) {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const padded = Buffer.alloc(256); binary.copy(padded, 256 - binary.length);
  const expected = publicEncrypt({ key: publicKey, padding: constants.RSA_NO_PADDING }, padded);
  add('rsaEncrypt', { bytes: [...binary], key: publicKey.export({ type, format: 'pem' }) }, r => assert.deepEqual(r.value, [...expected]));
  add('rsaEncrypt', { bytes: [...binary], key: publicKey.export({ type, format: 'pem' }).replaceAll('\n', '') }, r => assert.deepEqual(r.value, [...expected]));
}
for (const compressed of [deflateSync(binary), gzipSync(binary)]) {
  add('inflate', { bytes: [...compressed] }, r => assert.deepEqual(r.value, [...binary]));
}
add('deflate', { bytes: [...Buffer.from(unicode)] }, r => assert.equal(inflateSync(Buffer.from(r.value)).toString(), unicode));
add('deflate', { bytes: [] }, r => assert.equal(inflateSync(Buffer.from(r.value)).length, 0));
add('randomBytes', { count: 32 }, r => { assert.equal(r.value.length, 32); assert.ok(r.value.some(x => x !== 0)); });
for (const [operation, input] of [
  ['aesEncrypt', { bytes: [1], mode: 'aes-128-ecb', key: [...key], iv: [] }],
  ['decode', { input: 'not-base64!', encoding: 'base64' }],
  ['inflate', { bytes: [0, 1, 2] }],
  ['randomBytes', { count: -1 }],
  ['encode', { bytes: [256] }],
]) add(operation, input, r => assert.equal(typeof r.error, 'string'));
const result = spawnSync('build/tests/native-utilities', { input: JSON.stringify(cases.map(({ operation, input }) => ({ operation, input }))), encoding: 'utf8', timeout: 30000 });
assert.equal(result.status, 0, result.stderr);
const outputs = JSON.parse(result.stdout);
assert.equal(outputs.length, cases.length);
cases.forEach((item, index) => item.check(outputs[index]));
console.log(`Native utility checks passed: ${cases.length} (Node crypto/zlib independent oracle)`);
