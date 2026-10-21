#!/usr/bin/env node
// Greyscale local-SSIM comparison. For colour-managed, four-axis evidence use
// scripts/visual-lab.mjs; this CLI is kept for historical score continuity.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {encodePng, parsePng} from './lib/png.mjs';
import {gray, maskedAt, regionScore, ssimMap} from './lib/metrics.mjs';

function parseArgs(argv) {
  const args = {grid: [6, 8], ignoreTop: 0, masks: [], gain: 3, window: 7};
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--out') args.out = argv[++i];
    else if (token === '--grid') args.grid = argv[++i].split('x').map(Number);
    else if (token === '--ignore-top') args.ignoreTop = Number(argv[++i]);
    else if (token === '--mask') args.masks.push(argv[++i].split(',').map(Number));
    else if (token === '--gain') args.gain = Number(argv[++i]);
    else if (token === '--window') args.window = Number(argv[++i]);
    else positional.push(token);
  }
  if (positional.length !== 2) {
    console.error('用法: node scripts/visual-diff.mjs <reference.png> <candidate.png> [--out dir] [--grid 6x8] [--ignore-top 60] [--mask x,y,w,h] [--window 7]');
    process.exit(2);
  }
  args.reference = positional[0];
  args.candidate = positional[1];
  return args;
}

const args = parseArgs(process.argv);
const reference = parsePng(readFileSync(resolve(args.reference)), {allow16Bit: true});
const candidate = parsePng(readFileSync(resolve(args.candidate)), {allow16Bit: true});
if (reference.width !== candidate.width || reference.height !== candidate.height) {
  console.error(`尺寸不一致: ${reference.width}x${reference.height} vs ${candidate.width}x${candidate.height}。请使用同逻辑尺寸截图。`);
  process.exit(3);
}
const {width, height} = reference;
const a = gray(reference);
const b = gray(candidate);
const masked = (x, y) => maskedAt(x, y, args.ignoreTop, args.masks);

const map = ssimMap(a, b, width, height, Math.floor(args.window / 2));
const madMap = new Float64Array(width * height);
for (let i = 0; i < madMap.length; i++) madMap[i] = Math.abs(a[i] - b[i]);

const global = regionScore(map, madMap, width, height, 0, Math.min(args.ignoreTop, height), width, height, args.ignoreTop, args.masks);
const [cols, rows] = args.grid;
const grid = [];
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const x0 = Math.floor((col * width) / cols);
    const x1 = Math.floor(((col + 1) * width) / cols);
    const y0 = Math.max(args.ignoreTop, Math.floor((row * height) / rows));
    const y1 = Math.floor(((row + 1) * height) / rows);
    if (y1 <= y0 || x1 <= x0) continue;
    const s = regionScore(map, madMap, width, height, x0, y0, x1, y1, args.ignoreTop, args.masks);
    grid.push({row, col, x0, y0, x1, y1, ...(s ?? {})});
  }
}

let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (masked(x, y)) continue;
    const i = y * width + x;
    sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i]; n++;
  }
}
const ma = n ? sa / n : null;
const mb = n ? sb / n : null;
const va = n ? saa / n - ma * ma : null;
const vb = n ? sbb / n - mb * mb : null;
const cov = n ? sab / n - ma * mb : null;
const c1 = (0.01 * 255) ** 2;
const c2 = (0.03 * 255) ** 2;
const legacyScore = n ? ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2)) : null;

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
  window: args.window,
  masks: args.masks,
  method: 'local-ssim',
  global: global == null ? null : {ssim: global.ssim, mad: global.mad},
  masked: {ssim: global?.ssim ?? null, mad: global?.mad ?? null},
  legacyGlobalSsim: legacyScore,
  grid,
};
writeFileSync(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`参考: ${args.reference}`);
console.log(`候选: ${args.candidate}`);
console.log(`尺寸: ${width}x${height}  忽略顶部: ${args.ignoreTop}px  遮罩: ${args.masks.length} 块  窗口: ${args.window}x${args.window}`);
console.log(`局部 SSIM: ${global == null ? 'n/a' : `${(global.ssim * 100).toFixed(2)}%`}  MAD: ${global == null ? 'n/a' : global.mad.toFixed(2)}  （旧全局统计值 ${legacyScore == null ? 'n/a' : `${(legacyScore * 100).toFixed(2)}%`}，仅作历史对照）`);
console.log(`遮罩后局部 SSIM: ${global == null ? 'n/a' : `${(global.ssim * 100).toFixed(2)}%`}  MAD: ${global == null ? 'n/a' : global.mad.toFixed(2)}`);
console.log('区域（SSIM% / MAD）:');
for (const cell of grid) {
  if (cell.ssim == null) {
    console.log(`  r${cell.row}c${cell.col} [${cell.x0},${cell.y0}-${cell.x1},${cell.y1}] masked`);
    continue;
  }
  const flag = cell.ssim < 0.8 ? '  <<<' : '';
  console.log(`  r${cell.row}c${cell.col} [${cell.x0},${cell.y0}-${cell.x1},${cell.y1}] ${(cell.ssim * 100).toFixed(1)}% / ${cell.mad.toFixed(1)}${flag}`);
}
console.log(`报告与 diff: ${outDir}`);
if ((global?.ssim ?? 0) < 0.9) process.exitCode = 1;
