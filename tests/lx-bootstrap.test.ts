import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { URL } from 'node:url';

function host() {
  const messages: Array<{ event: string; data: Record<string, unknown> }> = [];
  const requests: number[] = [];
  const aborted: number[] = [];
  const timers: number[] = [];
  const context = createContext({
    __nexusScriptInfo: { name: 'Contract fixture' },
    __nexusNative: {
      emit(event: string, json: string) { messages.push({ event, data: JSON.parse(json) }); },
      http(id: number) { requests.push(id); },
      abortHttp(id: number) { aborted.push(id); },
      timer(id: number) { timers.push(id); }, clearTimer() {},
      utility(operation: string, json: string) {
        const value = JSON.parse(json);
        if (operation === 'decode') return JSON.stringify({ value: [...Buffer.from(value.input, value.encoding)] });
        if (operation === 'encode') return JSON.stringify({ value: Buffer.from(value.bytes).toString(value.encoding) });
        return JSON.stringify({ error: 'Unsupported operation' });
      },
    },
  });
  runInContext(readFileSync(new URL('../native/script-host/bootstrap.js', import.meta.url), 'utf8'), context);
  return { context, messages, requests, aborted, timers };
}

test('host keeps version/env and independent state; init may only occur once', async () => {
  const a = host(); const b = host();
  assert.equal(runInContext('lx.env', a.context), 'mobile');
  await runInContext('lx.send(lx.EVENT_NAMES.inited, {sources:{wy:{actions:["musicUrl"],qualitys:["128k"]}}})', a.context);
  assert.equal(a.messages[0]?.event, 'inited');
  assert.equal(b.messages.length, 0);
  await assert.rejects(runInContext('lx.send("inited", {sources:{}})', a.context));
});

test('HTTP callback receives body and abort ignores late response', () => {
  const h = host();
  runInContext('globalThis.body = null; globalThis.cancel = lx.request("https://example.test", {}, (e,r,b) => { body=b; })', h.context);
  const id = h.requests[0]!;
  runInContext('cancel()', h.context);
  runInContext(`__nexusHttp(${id}, null, {body:"late"})`, h.context);
  assert.equal(runInContext('body', h.context), null);
  assert.deepEqual(h.aborted, [id]);
  runInContext('lx.request("https://example.test", {}, (e,r,b) => { body=b; })', h.context);
  runInContext(`__nexusHttp(${h.requests[1]}, null, {body:{code:200}})`, h.context);
  assert.equal(runInContext('body.code', h.context), 200);
});

test('timer cancellation suppresses invocation; each timer runs once', () => {
  const h = host();
  runInContext('globalThis.count=0; const id=setTimeout(()=>count++,0); clearTimeout(id)', h.context);
  runInContext(`__nexusTimer(${h.timers[0]})`, h.context);
  assert.equal(runInContext('count', h.context), 0);
  runInContext('setTimeout(()=>count++,0)', h.context);
  runInContext(`__nexusTimer(${h.timers[1]}); __nexusTimer(${h.timers[1]})`, h.context);
  assert.equal(runInContext('count', h.context), 1);
});

test('binary/base64 preserve non-UTF8 bytes; Unicode roundtrip keeps surrogate pairs', () => {
  const h = host();
  assert.equal(runInContext('lx.utils.buffer.bufToString(lx.utils.buffer.from("00ff80", "hex"), "base64")', h.context), 'AP+A');
  assert.equal(runInContext('lx.utils.buffer.bufToString(lx.utils.buffer.from("音乐🎵"))', h.context), '音乐🎵');
  assert.equal(runInContext('btoa(atob("AP+A"))', h.context), 'AP+A');
});

test('async request result is correlated and error hides raw script output', async () => {
  const h = host();
  await runInContext('lx.send("inited", {sources:{}}); lx.on("request", async data=>data.info.id)', h.context);
  runInContext('__nexusInvoke("one", {info:{id:"90071992547409931"}})', h.context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.messages.at(-1), { event: 'requestSucceeded', data: { id: 'one', result: '90071992547409931' } });
  await runInContext('lx.on("request", ()=>{throw new Error("PRIVATE_TOKEN")})', h.context);
  runInContext('__nexusInvoke("two", {})', h.context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.messages.at(-1), { event: 'requestFailed', data: { id: 'two', code: 'SCRIPT_REQUEST_FAILED' } });
});
