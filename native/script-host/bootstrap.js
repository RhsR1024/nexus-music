// Original NexusMusic protocol implementation. No third-party preload is copied.
// The native adapter owns network, timers, and utility operations. No app global
// or credentials are exposed to this independent JavaScriptCore context.
(function install() {
  const native = globalThis.__nexusNative;
  delete globalThis.__nexusNative;
  const info = globalThis.__nexusScriptInfo;
  delete globalThis.__nexusScriptInfo;
  let initialized = false;
  let handler;
  let sequence = 0;
  const httpCallbacks = new Map();
  const timers = new Map();
  const eventNames = Object.freeze({ request: 'request', inited: 'inited', updateAlert: 'updateAlert' });
  const utility = (name, input) => {
    const result = JSON.parse(native.utility(name, JSON.stringify(input)));
    if (result.error) throw new Error(result.error);
    return result.value;
  };
  const bytes = (input, encoding = 'utf8') => {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    if (Array.isArray(input)) return new Uint8Array(input);
    if (typeof input !== 'string') throw new Error('Unsupported buffer input');
    if (encoding === 'hex') {
      if (!/^(?:[0-9a-f]{2})*$/i.test(input)) throw new Error('Invalid hex');
      return new Uint8Array(input.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) ?? []);
    }
    return new Uint8Array(utility('decode', { input, encoding }));
  };
  const buffer = Object.freeze({
    from: bytes,
    bufToString(input, encoding = 'utf8') {
      return utility('encode', { bytes: Array.from(bytes(input)), encoding });
    },
  });
  const unsupported = name => () => { throw new Error(`Host capability unavailable: ${name}`); };
  const utils = Object.freeze({
    buffer,
    crypto: Object.freeze({
      md5: input => utility('md5', { bytes: Array.from(bytes(input)) }),
      randomBytes: count => new Uint8Array(utility('randomBytes', { count })),
      aesEncrypt: unsupported('AES'), rsaEncrypt: unsupported('RSA'),
    }),
    zlib: Object.freeze({ inflate: unsupported('zlib.inflate'), deflate: unsupported('zlib.deflate') }),
  });
  globalThis.setTimeout = (callback, delay = 0, ...args) => {
    if (typeof callback !== 'function') throw new Error('Timer callback required');
    const id = ++sequence;
    timers.set(id, () => callback(...args));
    native.timer(id, Math.min(Math.max(Number(delay) || 0, 0), 60000));
    return id;
  };
  globalThis.clearTimeout = id => { timers.delete(id); native.clearTimer(id); };
  globalThis.atob = input => buffer.bufToString(bytes(input, 'base64'), 'binary');
  globalThis.btoa = input => buffer.bufToString(bytes(input, 'binary'), 'base64');
  globalThis.console = Object.freeze({ log() {}, info() {}, warn() {}, error() {}, debug() {} });
  globalThis.lx = Object.freeze({
    EVENT_NAMES: eventNames, env: 'mobile', version: '2.0.0',
    currentScriptInfo: Object.freeze(info), utils,
    on(event, callback) {
      if (event !== eventNames.request || typeof callback !== 'function') return Promise.reject(new Error('Unsupported event'));
      handler = callback;
      return Promise.resolve();
    },
    send(event, data) {
      if (event === eventNames.inited) {
        if (initialized) return Promise.reject(new Error('Already initialized'));
        if (!data || typeof data.sources !== 'object' || data.sources === null) return Promise.reject(new Error('Invalid sources'));
        initialized = true;
        native.emit('inited', JSON.stringify(data));
        return Promise.resolve();
      }
      if (event === eventNames.updateAlert) {
        native.emit('updateAlert', JSON.stringify(data));
        return Promise.resolve();
      }
      return Promise.reject(new Error('Unsupported event'));
    },
    request(url, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      if (typeof callback !== 'function') throw new Error('Request callback required');
      const id = ++sequence;
      httpCallbacks.set(id, callback);
      native.http(id, String(url), JSON.stringify(options || {}));
      return () => { httpCallbacks.delete(id); native.abortHttp(id); };
    },
  });
  // This is a byte buffer subset, not a promise of full Node Buffer compatibility.
  globalThis.Buffer = Object.freeze({ from: bytes, isBuffer: value => value instanceof Uint8Array });
  globalThis.__nexusTimer = id => {
    const callback = timers.get(id); timers.delete(id); if (callback) callback();
  };
  globalThis.__nexusHttp = (id, error, response) => {
    const callback = httpCallbacks.get(id); httpCallbacks.delete(id);
    if (callback) callback(error ? new Error(error) : null, response, response?.body);
  };
  globalThis.__nexusInvoke = (id, payload) => {
    if (!initialized || !handler) {
      native.emit('requestFailed', JSON.stringify({ id, code: 'NOT_INITIALIZED' }));
      return;
    }
    Promise.resolve().then(() => handler(payload)).then(
      result => native.emit('requestSucceeded', JSON.stringify({ id, result })),
      () => native.emit('requestFailed', JSON.stringify({ id, code: 'SCRIPT_REQUEST_FAILED' })),
    );
  };
})();
