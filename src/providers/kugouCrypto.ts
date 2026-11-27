// Pure-TypeScript AES-256-CBC (encrypt/decrypt) + 1024-bit raw RSA encryption
// for Kugou mobile verification-code login (/v7/login_by_verifycode).
// Protocol adapted from MakcRe/KuGouMusicApi (MIT; licenses/kugou-api-mit.txt).

const SBOX = Uint8Array.of(
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
);

const INV_SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]!] = i;

const RCON = Uint8Array.of(0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36);

// Standard Kugou Android login RSA-1024 public key modulus (exponent 65537).
const KUGOU_RSA_MODULUS = 0xc8006ed03842d2628209bd314984ca5ed6cfe06e30c95f9d4704d9c49791d7a935ba950ecb0bc8ebf5f5994f0bac927a7eb151b3c1de343303fa539c83136eccfd7d7e511e2dbce18eaa9f784c9b50d443e75865979e0a5e216e46c684066a8d6b998580bbaa22d73f5790286bb14742e83244e44db6d707ffe162c5c7002d45n;
const KUGOU_RSA_EXPONENT = 65537n;

function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b1 = bytes[i++]!;
    if (b1 < 0x80) out += String.fromCharCode(b1);
    else if (b1 < 0xe0) out += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i++]! & 0x3f));
    else if (b1 < 0xf0) out += String.fromCharCode(((b1 & 0x0f) << 12) | ((bytes[i++]! & 0x3f) << 6) | (bytes[i++]! & 0x3f));
    else {
      const cp = (((b1 & 0x07) << 18) | ((bytes[i++]! & 0x3f) << 12) | ((bytes[i++]! & 0x3f) << 6) | (bytes[i++]! & 0x3f)) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean)) throw new Error('Invalid hex input');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function xtime(a: number): number {
  return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff;
}

function gmul(a: number, b: number): number {
  let p = 0, hi = a, lo = b;
  for (let i = 0; i < 8; i++) {
    if (lo & 1) p ^= hi;
    hi = xtime(hi);
    lo >>= 1;
  }
  return p;
}

// AES-256 key expansion (Nk = 8 words = 32 bytes, Nr = 14 rounds, 240 expanded bytes).
function expandKey256(key: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('AES-256 key must be 32 bytes');
  const w = new Uint8Array(240);
  w.set(key);
  for (let i = 32; i < 240; i += 4) {
    let a = w[i - 4]!, b = w[i - 3]!, c = w[i - 2]!, d = w[i - 1]!;
    if (i % 32 === 0) {
      const t = a;
      a = SBOX[b]! ^ RCON[i / 32]!;
      b = SBOX[c]!;
      c = SBOX[d]!;
      d = SBOX[t]!;
    } else if (i % 32 === 16) {
      a = SBOX[a]!; b = SBOX[b]!; c = SBOX[c]!; d = SBOX[d]!;
    }
    w[i] = w[i - 32]! ^ a;
    w[i + 1] = w[i - 31]! ^ b;
    w[i + 2] = w[i - 30]! ^ c;
    w[i + 3] = w[i - 29]! ^ d;
  }
  return w;
}

function addRoundKey(state: Uint8Array, w: Uint8Array, offset: number): void {
  for (let i = 0; i < 16; i++) state[i] = state[i]! ^ w[offset + i]!;
}

function encryptBlock256(state: Uint8Array, w: Uint8Array): void {
  addRoundKey(state, w, 0);
  for (let round = 1; round <= 14; round++) {
    for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]!]!;
    const s = Uint8Array.from(state);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[c * 4 + r] = s[((c + r) & 3) * 4 + r]!;
    if (round < 14) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4, a = state[i]!, b = state[i + 1]!, cc = state[i + 2]!, d = state[i + 3]!;
        state[i] = xtime(a) ^ (xtime(b) ^ b) ^ cc ^ d;
        state[i + 1] = a ^ xtime(b) ^ (xtime(cc) ^ cc) ^ d;
        state[i + 2] = a ^ b ^ xtime(cc) ^ (xtime(d) ^ d);
        state[i + 3] = (xtime(a) ^ a) ^ b ^ cc ^ xtime(d);
      }
    }
    addRoundKey(state, w, round * 16);
  }
}

function decryptBlock256(state: Uint8Array, w: Uint8Array): void {
  addRoundKey(state, w, 14 * 16);
  for (let round = 13; round >= 0; round--) {
    const s = Uint8Array.from(state);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[c * 4 + r] = s[((c - r + 4) & 3) * 4 + r]!;
    for (let i = 0; i < 16; i++) state[i] = INV_SBOX[state[i]!]!;
    addRoundKey(state, w, round * 16);
    if (round > 0) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4, a = state[i]!, b = state[i + 1]!, cc = state[i + 2]!, d = state[i + 3]!;
        state[i] = gmul(a, 14) ^ gmul(b, 11) ^ gmul(cc, 13) ^ gmul(d, 9);
        state[i + 1] = gmul(a, 9) ^ gmul(b, 14) ^ gmul(cc, 11) ^ gmul(d, 13);
        state[i + 2] = gmul(a, 13) ^ gmul(b, 9) ^ gmul(cc, 14) ^ gmul(d, 11);
        state[i + 3] = gmul(a, 11) ^ gmul(b, 13) ^ gmul(cc, 9) ^ gmul(d, 14);
      }
    }
  }
}

export async function kugouAesEncrypt(
  payload: Record<string, unknown>,
  md5: (value: string) => Promise<string>,
  tempKey?: string,
): Promise<{ readonly str: string; readonly key: string }> {
  const key = tempKey ?? Array.from({ length: 16 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]!).join('');
  const derived = (await md5(key)).slice(0, 32);
  const keyBytes = utf8Encode(derived);
  const ivBytes = utf8Encode(derived.slice(16));
  const plain = utf8Encode(JSON.stringify(payload));
  const paddedLen = Math.ceil((plain.length + 1) / 16) * 16;
  const padded = new Uint8Array(paddedLen);
  padded.set(plain);
  padded.fill(paddedLen - plain.length, plain.length);
  const words = expandKey256(keyBytes);
  const out = new Uint8Array(paddedLen);
  let prev = ivBytes;
  for (let off = 0; off < paddedLen; off += 16) {
    const block = new Uint8Array(16);
    for (let i = 0; i < 16; i++) block[i] = padded[off + i]! ^ prev[i]!;
    encryptBlock256(block, words);
    out.set(block, off);
    prev = block;
  }
  return { str: toHex(out), key };
}

export async function kugouAesDecrypt(
  hexCipher: string,
  tempKey: string,
  md5: (value: string) => Promise<string>,
): Promise<unknown> {
  const derived = (await md5(tempKey)).slice(0, 32);
  const keyBytes = utf8Encode(derived);
  const ivBytes = utf8Encode(derived.slice(16));
  const cipher = fromHex(hexCipher);
  if (cipher.length === 0 || cipher.length % 16 !== 0) throw new Error('Invalid AES block length');
  const words = expandKey256(keyBytes);
  const out = new Uint8Array(cipher.length);
  let prev = ivBytes;
  for (let off = 0; off < cipher.length; off += 16) {
    const block = cipher.slice(off, off + 16);
    const nextPrev = cipher.subarray(off, off + 16);
    decryptBlock256(block, words);
    for (let i = 0; i < 16; i++) out[off + i] = block[i]! ^ prev[i]!;
    prev = nextPrev;
  }
  const pad = out[out.length - 1]!;
  if (pad < 1 || pad > 16 || pad > out.length) throw new Error('Invalid PKCS7 padding');
  for (let i = out.length - pad; i < out.length; i++) if (out[i] !== pad) throw new Error('Invalid PKCS7 padding');
  const text = utf8Decode(out.subarray(0, out.length - pad));
  try { return JSON.parse(text); } catch { return text; }
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n, v = base % mod, e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * v) % mod;
    v = (v * v) % mod;
    e >>= 1n;
  }
  return result;
}

/** Raw RSA-1024 zero-right-padded encryption matching KuGouMusicApi cryptoRSAEncrypt. */
export function kugouRsaEncrypt(payload: Record<string, unknown>): string {
  const bytes = utf8Encode(JSON.stringify(payload));
  if (bytes.length > 128) throw new Error('RSA payload exceeds 128 bytes');
  const padded = new Uint8Array(128);
  padded.set(bytes);
  let value = 0n;
  for (const byte of padded) value = (value << 8n) | BigInt(byte);
  return modPow(value, KUGOU_RSA_EXPONENT, KUGOU_RSA_MODULUS).toString(16).padStart(256, '0').toUpperCase();
}
