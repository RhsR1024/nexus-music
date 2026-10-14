// Synthetic LX script: no service keys or personal music metadata.
const request = (url, options = {}) => new Promise((resolve, reject) => {
  lx.request(url, options, (error, response, body) => error ? reject(error) : resolve({ response, body }));
});
lx.on('request', async payload => {
  if (payload.mode === 'throw') throw new Error('PRIVATE_ERROR_MUST_NOT_ESCAPE');
  if (payload.mode === 'timer') { await new Promise(resolve => setTimeout(resolve, 5)); return 'timer-ok'; }
  if (payload.mode === 'httpFailure') {
    try { await request(payload.url, payload.options); return 'unexpected-success'; }
    catch (error) { return error.message; }
  }
  const url = payload.url;
  const json = await request(url + '/json');
  const form = await request(url + '/echo', { method: 'post', form: { name: '音枢 + &', id: '90071992547409931234' } });
  const post = await request(url + '/echo', { method: 'post', body: { message: '音乐🎵' } });
  const multipart = await request(url + '/echo', { method: 'post', formData: { name: '音枢' } });
  const binary = await request(url + '/binary', { binary: true });
  const binaryPost = await request(url + '/echo-binary', { method: 'post', body: lx.utils.buffer.from('00ff8001', 'hex') });
  const zipped = await lx.utils.zlib.deflate(lx.utils.buffer.from('音乐🎵'));
  const unzipped = await lx.utils.zlib.inflate(zipped);
  let abortedFired = false;
  const abort = lx.request(url + '/slow', {}, () => { abortedFired = true; });
  abort();
  await new Promise(resolve => setTimeout(resolve, 30));
  return {
    json: json.body, status: json.response.statusCode,
    form: form.body, post: post.body, multipart: multipart.body,
    binary: lx.utils.buffer.bufToString(binary.body, 'hex'),
    binaryPost: binaryPost.body,
    unzipped: lx.utils.buffer.bufToString(unzipped), abortedFired,
  };
});
lx.send('inited', { sources: { wy: { name: 'Fixture', actions: ['musicUrl'], qualitys: ['128k'] } } });
