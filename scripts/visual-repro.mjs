#!/usr/bin/env node
// Compares two captures of the same state to establish the measurement noise
// floor. Unlike visual-lab this never compares against Sollin: a low score here
// means the capture itself is unstable, not that the UI is wrong.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, resolve, relative} from 'node:path';
import {parsePng} from './lib/png.mjs';
import {gray, ssimMap, regionScore, colorStats, formatPercent} from './lib/metrics.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const args = parseArgs(process.argv);
if (!args.a || !args.b) {
  console.error('用法: node scripts/visual-repro.mjs --a <截图A> --b <截图B> [--ignore-top 180] [--out <json>]');
  process.exit(2);
}

const ignoreTop = Number(args['ignore-top'] ?? 180);
const aBuffer = readFileSync(resolve(args.a));
const bBuffer = readFileSync(resolve(args.b));
const a = parsePng(aBuffer);
const b = parsePng(bBuffer);
if (a.width !== b.width || a.height !== b.height) {
  console.error(`尺寸不一致: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  process.exit(2);
}

const width = a.width, height = a.height;
const ga = gray(a), gb = gray(b);
const ssim = ssimMap(ga, gb, width, height, 3);
const madMap = new Float64Array(width * height);
let differing = 0, maxChannelDelta = 0;
for (let y = ignoreTop; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const p = i * Math.max(1, a.channels);
    const q = i * Math.max(1, b.channels);
    madMap[i] = Math.abs(ga[i] - gb[i]);
    const dr = Math.abs(a.pixels[p] - b.pixels[q]);
    const dg = Math.abs((a.pixels[p + 1] ?? a.pixels[p]) - (b.pixels[q + 1] ?? b.pixels[q]));
    const db = Math.abs((a.pixels[p + 2] ?? a.pixels[p]) - (b.pixels[q + 2] ?? b.pixels[q]));
    const delta = Math.max(dr, dg, db);
    if (delta) differing++;
    if (delta > maxChannelDelta) maxChannelDelta = delta;
  }
}
const score = regionScore(ssim, madMap, width, height, 0, 0, width, height, ignoreTop, []);
const color = colorStats(a, b, width, height, ignoreTop, [], 2);
const result = {
  generatedAt: new Date().toISOString(),
  method: 'capture reproducibility: same state, two independent runs; no reference image involved',
  ignoreTop,
  a: {path: relative(ROOT, resolve(args.a)), sha256: sha256(aBuffer)},
  b: {path: relative(ROOT, resolve(args.b)), sha256: sha256(bBuffer)},
  size: [width, height],
  comparablePixels: score.pixels,
  ssim: round(score.ssim, 8),
  mad: round(score.mad, 6),
  differingPixels: differing,
  differingFraction: differing / score.pixels,
  maxChannelDelta,
  deltaE00: color && {mean: round(color.mean, 6), p90: round(color.p90, 6), max: round(color.max, 6)},
  gate: {minSsim: 0.999, maxDeltaE00Mean: 0.5},
};
result.pass = result.ssim >= result.gate.minSsim && (result.deltaE00?.mean ?? 0) <= result.gate.maxDeltaE00Mean;

console.log(`A ${result.a.path}  ${result.a.sha256.slice(0, 12)}…`);
console.log(`B ${result.b.path}  ${result.b.sha256.slice(0, 12)}…`);
console.log(`可比区 SSIM ${formatPercent(result.ssim)}  ΔE00 ${result.deltaE00?.mean ?? '-'}  MAD ${result.mad}`);
console.log(`不同像素 ${differing} / ${score.pixels} (${formatPercent(differing / score.pixels)})  最大通道差 ${maxChannelDelta}`);
console.log(result.pass
  ? '通过 — 两次独立截图在可比区一致'
  : `未通过 — 截图不可复现（门禁 SSIM ≥ ${result.gate.minSsim}, ΔE00 ≤ ${result.gate.maxDeltaE00Mean}）`);

if (args.out) {
  mkdirSync(dirname(resolve(args.out)), {recursive: true});
  writeFileSync(resolve(args.out), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`证据: ${relative(ROOT, resolve(args.out))}`);
}
process.exit(result.pass ? 0 : 1);

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--a') out.a = argv[++i];
    else if (token === '--b') out.b = argv[++i];
    else if (token === '--ignore-top') out['ignore-top'] = argv[++i];
    else if (token === '--out') out.out = argv[++i];
  }
  return out;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
