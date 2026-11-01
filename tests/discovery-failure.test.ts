import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DeadlineError} from '../src/providers/async.ts';
import {HTTPResponseError} from '../src/providers/http.ts';
import {classifyDiscoveryFailure,playlistLinkFailure} from '../src/providers/discoveryFailure.ts';

test('discovery failures classify timeout, connection and transient platform responses',()=>{
  assert.deepEqual(classifyDiscoveryFailure(new DeadlineError()),{kind:'timeout',message:'读取超时，请检查网络后重试。',retryable:true});
  assert.equal(classifyDiscoveryFailure(new TypeError('Network request failed')).kind,'connection');
  assert.equal(classifyDiscoveryFailure(new HTTPResponseError(429)).kind,'rate-limit');
  assert.equal(classifyDiscoveryFailure(new HTTPResponseError(503)).kind,'server');
  assert.equal(classifyDiscoveryFailure(new HTTPResponseError(403)).kind,'rejected');
});

test('provider completeness failures stay sanitized and distinguish retry from invalid result',()=>{
  assert.deepEqual(classifyDiscoveryFailure(new Error('歌曲数量与平台声明不符，未导入不完整歌单')),{kind:'incomplete',message:'歌曲数量与平台声明不符，未导入不完整歌单',retryable:true});
  assert.deepEqual(classifyDiscoveryFailure(new Error('酷狗完整歌单格式无效')),{kind:'invalid',message:'酷狗完整歌单格式无效',retryable:true});
  assert.deepEqual(classifyDiscoveryFailure(new Error('raw provider secret https://private.invalid/token')),{kind:'unknown',message:'此平台暂时无法读取，请重试或选择其他平台。',retryable:true});
});

test('short-link failures never expose a provider URL, raw exception or credentials',()=>{
  const privateValue='https://user:secret@private.invalid/?token=secret';
  for(const error of [new DeadlineError(),new TypeError('Network request failed '+privateValue),new HTTPResponseError(500),new Error(privateValue)]){
    const message=playlistLinkFailure(error);
    assert.equal(message.includes('private.invalid'),false);assert.equal(message.includes('secret'),false);
  }
});
