// Pure-TypeScript ISO/IEC 18004 QR Code (Versions 1–6, EC Level L, Byte mode)
// + valid uncompressed PNG data URI encoder. Keeps login QR generation 100% local
// so login tokens never touch third-party QR image services.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

interface VersionSpec {
  readonly version: number;
  readonly size: number;
  readonly dataCodewords: number;
  readonly blocks: number;
  readonly ecPerBlock: number;
  readonly align: readonly number[];
}

// ISO/IEC 18004 EC Level L tables for Versions 1–6 (byte capacity up to 134 bytes).
const VERSIONS: readonly VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, blocks: 1, ecPerBlock: 7, align: [] },
  { version: 2, size: 25, dataCodewords: 34, blocks: 1, ecPerBlock: 10, align: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, blocks: 1, ecPerBlock: 15, align: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, blocks: 1, ecPerBlock: 20, align: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, blocks: 1, ecPerBlock: 26, align: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, blocks: 2, ecPerBlock: 18, align: [6, 34] },
];

// Precomputed 15-bit BCH + masked format strings for EC Level L (01) and masks 0..7.
const FORMAT_BITS_L = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976] as const;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i]!;
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ poly[j]!;
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, root);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenerator(ecCount);
  const rem = new Uint8Array(ecCount);
  for (const byte of data) {
    const factor = byte ^ rem[0]!;
    for (let i = 0; i < ecCount - 1; i++) rem[i] = rem[i + 1]!;
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i++) rem[i] = rem[i]! ^ gfMul(gen[i + 1]!, factor);
    }
  }
  return rem;
}

function utf8Bytes(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(out);
}

function buildCodewords(payload: Uint8Array, spec: VersionSpec): Uint8Array {
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  // Mode 0100 (Byte), 8-bit character count (valid for Versions 1–9).
  push(0b0100, 4);
  push(payload.length, 8);
  for (const b of payload) push(b, 8);

  const capacityBits = spec.dataCodewords * 8;
  const terminator = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminator; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(spec.dataCodewords);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]!;
    data[byteIdx++] = b;
  }
  let padToggle = false;
  while (byteIdx < spec.dataCodewords) {
    data[byteIdx++] = padToggle ? 0x11 : 0xec;
    padToggle = !padToggle;
  }

  const blockLen = spec.dataCodewords / spec.blocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.blocks; b++) {
    const slice = data.subarray(b * blockLen, (b + 1) * blockLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
  }

  const out = new Uint8Array(spec.dataCodewords + spec.blocks * spec.ecPerBlock);
  let pos = 0;
  for (let i = 0; i < blockLen; i++) {
    for (let b = 0; b < spec.blocks; b++) out[pos++] = dataBlocks[b]![i]!;
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) out[pos++] = ecBlocks[b]![i]!;
  }
  return out;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return ((r + c) & 1) === 0;
    case 1: return (r & 1) === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (((r >> 1) + Math.floor(c / 3)) & 1) === 0;
    case 5: return ((r * c) & 1) + ((r * c) % 3) === 0;
    case 6: return ((((r * c) & 1) + ((r * c) % 3)) & 1) === 0;
    default: return ((((r + c) & 1) + ((r * c) % 3)) & 1) === 0;
  }
}

function penaltyScore(grid: Uint8Array, size: number): number {
  let score = 0;
  const at = (r: number, c: number) => grid[r * size + c]!;
  // Rule 1: adjacent runs >= 5
  for (let r = 0; r < size; r++) {
    let runH = 1, runV = 1;
    for (let c = 1; c < size; c++) {
      if (at(r, c) === at(r, c - 1)) runH++; else { if (runH >= 5) score += runH - 2; runH = 1; }
      if (at(c, r) === at(c - 1, r)) runV++; else { if (runV >= 5) score += runV - 2; runV = 1; }
    }
    if (runH >= 5) score += runH - 2;
    if (runV >= 5) score += runV - 2;
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  }
  // Rule 4: dark ratio balance
  let dark = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i]) dark++;
  const pct = (dark * 100) / grid.length;
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

export function encodeQrMatrix(text: string): { readonly size: number; readonly modules: Uint8Array } {
  const payload = utf8Bytes(text);
  const spec = VERSIONS.find(v => payload.length + 2 <= v.dataCodewords);
  if (!spec) throw new Error('QR payload exceeds supported length');

  const size = spec.size;
  const base = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);
  const setFn = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    base[r * size + c] = dark ? 1 : 0;
    reserved[r * size + c] = 1;
  };

  // Finder patterns + 1-module white separators
  for (const [top, left] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFn(top + r, left + c, inside && (ring || center));
      }
    }
  }
  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFn(6, i, (i & 1) === 0);
    setFn(i, 6, (i & 1) === 0);
  }
  // Alignment patterns
  for (const r of spec.align) {
    for (const c of spec.align) {
      if (reserved[r * size + c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFn(r + dr, c + dc, dist === 2 || dist === 0);
        }
      }
    }
  }
  // Reserve format info cells & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      reserved[8 * size + i] = 1;
      reserved[i * size + 8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) reserved[8 * size + (size - 1 - i)] = 1;
  for (let i = 0; i < 7; i++) reserved[(size - 1 - i) * size + 8] = 1;
  setFn(4 * spec.version + 9, 8, true);

  // Place data + EC bits in standard zig-zag order
  const codewords = buildCodewords(payload, spec);
  const dataBits = new Uint8Array(size * size);
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [col, col - 1]) {
        const idx = r * size + c;
        if (reserved[idx]) continue;
        if (bitIndex < totalBits) {
          const cw = codewords[bitIndex >> 3]!;
          dataBits[idx] = (cw >>> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
      }
    }
    upward = !upward;
  }

  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestGrid = new Uint8Array(size * size);

  for (let mask = 0; mask < 8; mask++) {
    const grid = new Uint8Array(base);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const idx = r * size + c;
        if (reserved[idx]) continue;
        grid[idx] = dataBits[idx]! ^ (maskBit(mask, r, c) ? 1 : 0);
      }
    }
    const fmt = FORMAT_BITS_L[mask]!;
    const fBit = (i: number) => (fmt >>> i) & 1;
    // Top-left format strip
    for (let i = 0; i <= 5; i++) grid[8 * size + i] = fBit(14 - i);
    grid[8 * size + 7] = fBit(8);
    grid[8 * size + 8] = fBit(7);
    grid[7 * size + 8] = fBit(6);
    for (let i = 0; i <= 5; i++) grid[(5 - i) * size + 8] = fBit(5 - i);
    // Split format strips (bottom-left & top-right)
    for (let i = 0; i < 7; i++) grid[(size - 1 - i) * size + 8] = fBit(14 - i);
    for (let i = 0; i < 8; i++) grid[8 * size + (size - 8 + i)] = fBit(7 - i);

    const score = penaltyScore(grid, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestGrid = grid;
    }
  }
  void bestMask;
  return { size, modules: bestGrid };
}

// CRC32 + Adler32 for minimal valid uncompressed PNG
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32be(v: number): Uint8Array {
  return Uint8Array.of((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(u32be(data.length), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  out.set(u32be(crc32(out.subarray(4, 8 + data.length))), 8 + data.length);
  return out;
}

function zlibStore(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const blockCount = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + raw.length + blockCount * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let pos = 2;
  for (let offset = 0; offset < raw.length; offset += maxBlock) {
    const len = Math.min(maxBlock, raw.length - offset);
    const isFinal = offset + len >= raw.length ? 1 : 0;
    const nlen = (~len) & 0xffff;
    out[pos++] = isFinal;
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    out[pos++] = nlen & 0xff;
    out[pos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(offset, offset + len), pos);
    pos += len;
  }
  out.set(u32be(adler32(raw)), pos);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    out += c === undefined ? '=' : B64[c & 63]!;
  }
  return out;
}

/** Encodes text into a crisp monochrome PNG data URI (`data:image/png;base64,...`). */
export function encodeQrPngDataUri(text: string, targetPx = 246): string {
  const { size, modules } = encodeQrMatrix(text);
  const quiet = 4;
  const totalModules = size + quiet * 2;
  const scale = Math.max(4, Math.min(10, Math.round(targetPx / totalModules)));
  const px = totalModules * scale;

  // Grayscale 8-bit PNG (color type 0): 1 filter byte + px bytes per row.
  const rowStride = 1 + px;
  const raw = new Uint8Array(px * rowStride);
  raw.fill(255);
  for (let y = 0; y < px; y++) {
    raw[y * rowStride] = 0; // Filter type 0 (None)
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r * size + c]) continue;
      const y0 = (r + quiet) * scale;
      const x0 = (c + quiet) * scale;
      for (let dy = 0; dy < scale; dy++) {
        const rowStart = (y0 + dy) * rowStride + 1 + x0;
        raw.fill(0, rowStart, rowStart + scale);
      }
    }
  }

  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(px), 0);
  ihdr.set(u32be(px), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const ihdrChunk = pngChunk('IHDR', ihdr);
  const idatChunk = pngChunk('IDAT', zlibStore(raw));
  const iendChunk = pngChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let off = 0;
  png.set(sig, off); off += sig.length;
  png.set(ihdrChunk, off); off += ihdrChunk.length;
  png.set(idatChunk, off); off += idatChunk.length;
  png.set(iendChunk, off);
  return `data:image/png;base64,${toBase64(png)}`;
}
