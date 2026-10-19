#!/usr/bin/env node
// Dependency-free PNG comparison for Sollin UI alignment.
// Decodes 8-bit RGB/RGBA PNGs, reports global and grid SSIM/MAD, writes a
// diff image. Reference screenshots and simulator captures are both 1290x2796.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {inflateSync, deflateSync} from 'node:zlib';
import {basename, dirname, resolve} from 'node:path';

const PNG_SIGNATURE = 0x89504e47;
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function parsePng(buffer) {
  if (buffer.readUInt32BE(0) !== PNG_SIGNATURE) throw new Error('不是 PNG 文件');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 && bitDepth !== 16) throw new Error(`仅支持 8/16 位 PNG，当前 ${bitDepth}`);
  if (interlace !== 0) throw new Error('不支持隔行 PNG');
  const channels = {0: 1, 2: 3, 4: 2, 6: 4}[colorType];
  if (!channels) throw new Error(`不支持的颜色类型 ${colorType}`);
  const sampleBytes = bitDepth / 8;
  const bytesPerPixel = channels * sampleBytes;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error('PNG 数据不完整');
  const decoded = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const source = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const target = decoded.subarray(y * stride, (y + 1) * stride);
    const previous = y ? decoded.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const left = x >= bytesPerPixel ? target[x - bytesPerPixel] : 0;
      const up = previous ? previous[x] : 0;
      const upLeft = previous && x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value = source[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      target[x] = value & 0xff;
    }
  }
  if (bitDepth === 16) {
    // iPhone screenshots are 16-bit P3; keep the high byte (round to nearest).
    const pixels = Buffer.alloc(width * height * channels);
    for (let i = 0; i < width * height * channels; i++) pixels[i] = decoded[i * 2];
    return {width, height, channels, pixels};
  }
  return {width, height, channels, pixels: decoded};
}

function gray(image) {
  const {width, height, channels, pixels} = image;
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    out[i] = channels >= 3 ? 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2] : pixels[p];
  }
  return out;
}

function stats(a, b, width, height, x0, y0, x1, y1) {
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  let mad = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      const va = a[i];
      const vb = b[i];
      sa += va;
      sb += vb;
      saa += va * va;
      sbb += vb * vb;
      sab += va * vb;
      mad += Math.abs(va - vb);
      n++;
    }
  }
  if (!n) return null;
  const ma = sa / n;
  const mb = sb / n;
  const va = saa / n - ma * ma;
  const vb = sbb / n - mb * mb;
  const cov = sab / n - ma * mb;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const ssim = ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2));
  return {ssim, mad: mad / n, meanReference: ma, meanCandidate: mb};
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function parseArgs(argv) {
  const args = {grid: [6, 8], ignoreTop: 0, masks: [], gain: 3};
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--out') args.out = argv[++i];
    else if (token === '--grid') args.grid = argv[++i].split('x').map(Number);
    else if (token === '--ignore-top') args.ignoreTop = Number(argv[++i]);
    else if (token === '--mask') args.masks.push(argv[++i].split(',').map(Number));
    else if (token === '--gain') args.gain = Number(argv[++i]);
    else positional.push(token);
  }
  if (positional.length !== 2) {
    console.error('用法: node scripts/visual-diff.mjs <reference.png> <candidate.png> [--out dir] [--grid 6x8] [--ignore-top 60] [--mask x,y,w,h]');
    process.exit(2);
  }
  args.reference = positional[0];
  args.candidate = positional[1];
  return args;
}

const args = parseArgs(process.argv);
const reference = parsePng(readFileSync(resolve(args.reference)));
const candidate = parsePng(readFileSync(resolve(args.candidate)));
if (reference.width !== candidate.width || reference.height !== candidate.height) {
  console.error(`尺寸不一致: ${reference.width}x${reference.height} vs ${candidate.width}x${candidate.height}。请使用同逻辑尺寸截图。`);
  process.exit(3);
}
const {width, height} = reference;
const a = gray(reference);
const b = gray(candidate);
const masked = (x, y) =>
  y < args.ignoreTop || args.masks.some(([mx, my, mw, mh]) => x >= mx && x < mx + mw && y >= my && y < my + mh);

const global = stats(a, b, width, height, 0, Math.min(args.ignoreTop, height), width, height);
const [cols, rows] = args.grid;
const grid = [];
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const x0 = Math.floor((col * width) / cols);
    const x1 = Math.floor(((col + 1) * width) / cols);
    const y0 = Math.max(args.ignoreTop, Math.floor((row * height) / rows));
    const y1 = Math.floor(((row + 1) * height) / rows);
    if (y1 <= y0 || x1 <= x0) continue;
    const s = stats(a, b, width, height, x0, y0, x1, y1);
    grid.push({row, col, x0, y0, x1, y1, ...s});
  }
}
// Honest masked score: recompute over unmasked pixels only.
let n = 0;
let sa = 0;
let sb = 0;
let saa = 0;
let sbb = 0;
let sab = 0;
let mad = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (masked(x, y)) continue;
    const i = y * width + x;
    sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i]; mad += Math.abs(a[i] - b[i]); n++;
  }
}
const ma = sa / n;
const mb = sb / n;
const va = saa / n - ma * ma;
const vb = sbb / n - mb * mb;
const cov = sab / n - ma * mb;
const c1 = (0.01 * 255) ** 2;
const c2 = (0.03 * 255) ** 2;
const maskedScore = ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2));

const outDir = resolve(args.out ?? `build/visual-diff/${basename(args.candidate, '.png')}`);
mkdirSync(outDir, {recursive: true});
const diff = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const delta = masked(x, y) ? 0 : Math.min(255, Math.round(Math.abs(a[i] - b[i]) * args.gain));
    const p = i * 3;
    diff[p] = delta;
    diff[p + 1] = delta > 40 ? Math.round(delta * 0.35) : 0;
    diff[p + 2] = 0;
  }
}
writeFileSync(resolve(outDir, 'diff.png'), encodePng(width, height, diff));
const report = {
  reference: args.reference,
  candidate: args.candidate,
  size: [width, height],
  ignoreTop: args.ignoreTop,
  masks: args.masks,
  global: {ssim: global.ssim, mad: global.mad},
  masked: {ssim: maskedScore, mad: mad / n, pixels: n},
  grid,
};
writeFileSync(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`参考: ${args.reference}`);
console.log(`候选: ${args.candidate}`);
console.log(`尺寸: ${width}x${height}  忽略顶部: ${args.ignoreTop}px  遮罩: ${args.masks.length} 块`);
console.log(`全局 SSIM: ${(global.ssim * 100).toFixed(2)}%  MAD: ${global.mad.toFixed(2)}`);
console.log(`遮罩后 SSIM: ${(maskedScore * 100).toFixed(2)}%  MAD: ${(mad / n).toFixed(2)}`);
console.log('区域（SSIM% / MAD）:');
for (const cell of grid) {
  const flag = cell.ssim < 0.8 ? '  <<<' : '';
  console.log(`  r${cell.row}c${cell.col} [${cell.x0},${cell.y0}-${cell.x1},${cell.y1}] ${(cell.ssim * 100).toFixed(1)}% / ${cell.mad.toFixed(1)}${flag}`);
}
console.log(`报告与 diff: ${outDir}`);
if (maskedScore < 0.9) process.exitCode = 1;
