import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const server = createServer(async (req, res) => {
  if (req.url === '/oversize') { res.end(Buffer.alloc(8 * 1024 * 1024 + 1)); return; }
  if (req.url === '/hang') return;
  if (req.url === '/slow') { setTimeout(() => { res.end('late'); }, 100).unref(); return; }
  if (req.url === '/binary') { res.end(Buffer.from([0, 255, 128, 1])); return; }
  if (req.url === '/json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: 200 })); return; }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  const contentType = req.headers['content-type'];
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ body: req.url === '/echo-binary' ? Buffer.concat(chunks).toString('hex') : body, contentType }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
function run(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn('build/tests/native-runtime', ['modules/nexus-native/ios/bootstrap.js', 'tests/native/runtime-fixture.js', JSON.stringify(payload)]);
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Native runtime test exceeded deadline')); }, 30000);
    child.on('error', reject);
    child.on('exit', code => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`Runtime exit ${code}: ${stderr}`));
      else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } }
    });
  });
}
try {
  const [result, timer, failure] = await Promise.all([run({ url }), run({ mode: 'timer' }), run({ mode: 'throw' })]);
  assert.deepEqual(result.json, { code: 200 });
  assert.equal(result.status, 200);
  const form = new URLSearchParams(result.form.body);
  assert.equal(form.get('name'), '音枢 + &');
  assert.equal(form.get('id'), '90071992547409931234');
  assert.deepEqual(JSON.parse(result.post.body), { message: '音乐🎵' });
  assert.match(result.post.contentType, /application\/json/);
  assert.match(result.multipart.contentType, /multipart\/form-data; boundary=/);
  assert.match(result.multipart.body, /name="name"\r\n\r\n音枢/);
  assert.equal(result.binary, '00ff8001');
  assert.equal(result.binaryPost.body, '00ff8001');
  assert.equal(result.unzipped, '音乐🎵');
  assert.equal(result.abortedFired, false);
  assert.equal(timer, 'timer-ok');
  assert.deepEqual(failure, { error: 'SCRIPT_REQUEST_FAILED' });
  assert.equal(await run({ mode: 'httpFailure', url: 'file:///private/forbidden' }), 'HTTP_REQUEST_INVALID');
  assert.equal(await run({ mode: 'httpFailure', url: url + '/oversize' }), 'HTTP_RESPONSE_TOO_LARGE');
  assert.equal(await run({ mode: 'httpFailure', url: url + '/hang', options: { timeout: 1 } }), 'HTTP_REQUEST_FAILED');
  console.log('Native JSC runtime checks passed: HTTP/JSON/form/multipart/binary/timer/abort/crypto/error isolation');
} finally { server.closeAllConnections(); server.close(); }
