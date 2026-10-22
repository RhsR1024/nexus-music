#!/usr/bin/env node
// Colour-managed four-axis UI evidence. Whole-screen SSIM is a report field,
// not a pass criterion: content that cannot match (different cover/lyrics) is
// measured separately and the comparable/control regions are the gate.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, relative, resolve} from 'node:path';
import {encodePng, parsePng} from './lib/png.mjs';
import {
  colorStats,
  deltaE00,
  edgeMap,
  edgeStats,
  formatPercent,
  gray,
  gridStats,
  coverageStats,
  validCenterMask,
  maskArea,
  maskedAt,
  patchStats,
  regionScore,
  rgbToLab,
  ssimMap,
} from './lib/metrics.mjs';

import {evaluateVisualGate} from './lib/visual-gate.mjs';
import {verifyCaptureEvidence} from './lib/ui-provenance.mjs';

const SRGB_PROFILE = '/System/Library/ColorSync/Profiles/sRGB Profile.icc';
const ROOT = resolve('.');


function usage() {
  console.log(`用法: node scripts/visual-lab.mjs --spec <docs/ui-spec/xxx.json> [选项]
       node scripts/visual-lab.mjs --all [--baseline docs/ui-spec/baseline.json]

  --spec <path>       单个黄金态规格
  --all               运行 docs/ui-spec/*.json 中的全部规格
  --candidate <path>  临时覆盖规格中的候选截图
  --out <dir>         输出目录，默认 build/visual-lab/<spec-id>
  --evidence <path>   精确采集run-manifest.json
  --export-index <path> 精确截图导出index.json
  --baseline <path>   将本次结果写成新基线清单（禁止覆盖）
  --skip-hash         只用于探索；正式证据禁止跳过 SHA256`);
}

function parseArgs(argv) {
  const args = {specs: [], all: false};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--spec') args.specs.push(argv[++i]);
    else if (token === '--all') args.all = true;
    else if (token === '--candidate') args.candidate = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--evidence') args.evidence = argv[++i];
    else if (token === '--export-index') args.exportIndex = argv[++i];
    else if (token === '--baseline') args.baseline = argv[++i];
    else if (token === '--skip-hash') args.skipHash = true;
    else if (token === '--help' || token === '-h') { usage(); process.exit(0); }
    else throw new Error(`未知参数: ${token}`);
  }
  if (args.all) {
    args.specs.push(...readdirSync('docs/ui-spec')
      .filter(name => name.endsWith('.json') && name !== 'baseline.json' && !name.startsWith('baseline-'))
      .map(name => join('docs/ui-spec', name))
      .filter(path => {
        const spec = JSON.parse(readFileSync(path, 'utf8'));
        return typeof spec.id === 'string' && typeof spec.reference === 'string';
      })
      .sort());
  }
  if (!args.specs.length) { usage(); process.exit(2); }
  if (args.candidate && args.specs.length !== 1) throw new Error('--candidate 只能配合单个 --spec');
  args.specs=[...new Set(args.specs)];
  args.out ??= `build/visual-lab/run-${Date.now()}`;
  if(args.baseline && existsSync(args.baseline))throw new Error(`拒绝覆盖基线: ${args.baseline}`);
  return args;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(resolve(path))).digest('hex');
}

function sipsInfo(path) {
  const output = execFileSync('sips', ['-g', 'profile', '-g', 'bitsPerSample', '-g', 'pixelWidth', '-g', 'pixelHeight', resolve(path)], {encoding: 'utf8'});
  const value = key => output.match(new RegExp(`${key}:\\s*(.+)`))?.[1]?.trim() ?? null;
  return {profile: value('profile'), bitDepth: Number(value('bitsPerSample')), width: Number(value('pixelWidth')), height: Number(value('pixelHeight'))};
}

function normalize(path, label, outDir) {
  const NORMALIZED=join(outDir,'normalized');
  const hash = sha256(path);
  mkdirSync(NORMALIZED, {recursive: true});
  const destination = join(NORMALIZED, `${label}-${hash.slice(0, 16)}.png`);
  const sourceInfo = sipsInfo(path);
  if (!existsSync(destination)) {
    execFileSync('sips', ['-m', SRGB_PROFILE, resolve(path), '--out', destination], {stdio: 'pipe'});
  }
  const info = sipsInfo(destination);
  if (info.bitDepth !== 8 || info.profile !== 'sRGB IEC61966-2.1') throw new Error(`sips 未产出 sRGB 8 位：${destination}`);
  return {path: destination, sha256: createHash('sha256').update(readFileSync(destination)).digest('hex'), sourceInfo, info};
}

function rectScore(map, madMap, width, height, ignoreTop, rects, include = null, centers = null) {
  return regionScore(map, madMap, width, height, 0, Math.max(0, ignoreTop), width, height, ignoreTop, rects, include, centers);
}

function insideRectStats(map, madMap, width, height, ignoreTop, rects) {
  let n = 0, sum = 0, mad = 0;
  for (let y = ignoreTop; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let inside = false;
      for (const rect of rects) {
        if (x >= rect[0] && x < rect[0] + rect[2] && y >= rect[1] && y < rect[1] + rect[3]) { inside = true; break; }
      }
      if (!inside) continue;
      const i = y * width + x;
      sum += map[i]; mad += madMap[i]; n++;
    }
  }
  return n ? {ssim: sum / n, mad: mad / n, pixels: n} : null;
}

function scoreSet({map, madMap, edgeA, edgeB, imageA, imageB, width, height, ignoreTop, masks, colorMasks, patches, include = null, colorInclude = null, step = 2, radius = 3}) {
  const centers=validCenterMask(width,height,ignoreTop,masks,include,radius);
  const edgeCenters=validCenterMask(width,height,ignoreTop,masks,include,1);
  const scored = rectScore(map, madMap, width, height, ignoreTop, masks, include, centers);
  const coverage=coverageStats(width,height,ignoreTop,masks,include);
  const colorCoverage=coverageStats(width,height,ignoreTop,colorMasks??masks,colorInclude??include);
  const score = scored == null ? null : {
    ssim: scored.ssim,
    mad: scored.mad,
    pixels: scored.pixels,
    coverage,
    colorCoverage,
    boundaryExcludedPixels:coverage.scoredPixels-scored.pixels,
    color: colorStats(imageA, imageB, width, height, ignoreTop, colorMasks ?? masks, step, colorInclude ?? include),
    ink: edgeStats(edgeA, edgeB, width, height, ignoreTop, masks, 1, include, edgeCenters),
  };
  if (score && patches?.length) {
    score.patches = patches.map(patch => {
      const ref = patchStats(imageA, patch.rect);
      const cur = patchStats(imageB, patch.rect);
      if (!ref || !cur) return {...patch, missing: true};
      return {
        label: patch.label,
        rect: patch.rect,
        reference: ref.mean.map(value => Math.round(value)),
        candidate: cur.mean.map(value => Math.round(value)),
        referenceStd: ref.std,
        candidateStd: cur.std,
        deltaE00: deltaE00(rgbToLab(...ref.mean), rgbToLab(...cur.mean)),
      };
    });
  }
  return score;
}

function runSpec(specPath, overrides) {
  const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
  const referencePath = spec.reference;
  const candidatePath = overrides.candidate ?? spec.candidate;
  if (!existsSync(referencePath)) throw new Error(`${spec.id}: 参考图不存在 ${referencePath}`);
  if (!candidatePath || !existsSync(candidatePath)) throw new Error(`${spec.id}: 候选图不存在 ${candidatePath}`);

  const referenceSha = sha256(referencePath);
  const candidateSha = sha256(candidatePath);
  if (!overrides.skipHash) {
    if (spec.referenceSha256 && spec.referenceSha256 !== referenceSha) throw new Error(`${spec.id}: 参考图 SHA256 不匹配\n  spec ${spec.referenceSha256}\n  file ${referenceSha}`);
    if (!overrides.candidate && spec.candidateSha256 && spec.candidateSha256 !== candidateSha) throw new Error(`${spec.id}: 候选图 SHA256 不匹配\n  spec ${spec.candidateSha256}\n  file ${candidateSha}`);
  }

  const outDir=resolve(overrides.out);
  if(existsSync(outDir))throw new Error(`拒绝覆盖输出目录: ${outDir}`);
  mkdirSync(outDir,{recursive:true});
  const reference = normalize(referencePath, `${spec.id}-reference`,outDir);
  const candidate = normalize(candidatePath, `${spec.id}-candidate`,outDir);
  const a = parsePng(readFileSync(reference.path));
  const b = parsePng(readFileSync(candidate.path));
  const [expectedWidth, expectedHeight] = spec.size ?? [1290, 2796];
  if (a.width !== b.width || a.height !== b.height) throw new Error(`${spec.id}: 尺寸不一致 ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  if (a.width !== expectedWidth || a.height !== expectedHeight) throw new Error(`${spec.id}: 期望 ${expectedWidth}x${expectedHeight}，实际 ${a.width}x${a.height}`);

  const {width, height} = a;
  const ignoreTop = spec.ignoreTop ?? 180;
  const contentMasks = spec.contentMasks ?? [];
  const controlMasks = spec.controlMasks ?? contentMasks;
  const controlColorMasks = spec.controlColorMasks ?? controlMasks;
  const controlRegions = spec.controlRegions ?? null;
  const controlColorRegions = spec.controlColorRegions ?? null;
  const gridMasks = spec.gridMasks ?? controlMasks;
  const patches = spec.colorPatches ?? [];
  const grayA = gray(a);
  const grayB = gray(b);
  if(!Number.isInteger(spec.window??7)||(spec.window??7)<1||(spec.window??7)%2!==1)throw new Error('window must be a positive odd integer');
  const radius=Math.floor((spec.window??7)/2);
  const map = ssimMap(grayA, grayB, width, height, radius);
  const madMap = new Float64Array(width * height);
  for (let i = 0; i < madMap.length; i++) madMap[i] = Math.abs(grayA[i] - grayB[i]);
  const edgeA = edgeMap(grayA, width, height);
  const edgeB = edgeMap(grayB, width, height);

  const whole = scoreSet({map, madMap, edgeA, edgeB, imageA: a, imageB: b, width, height, ignoreTop, masks: [], colorMasks: [], patches,radius});
  const comparable = scoreSet({map, madMap, edgeA, edgeB, imageA: a, imageB: b, width, height, ignoreTop, masks: contentMasks, colorMasks: contentMasks, patches,radius});
  const control = scoreSet({map, madMap, edgeA, edgeB, imageA: a, imageB: b, width, height, ignoreTop, masks: controlMasks, colorMasks: controlColorMasks, patches, include: controlRegions, colorInclude: controlColorRegions,radius});
  const content = insideRectStats(map, madMap, width, height, ignoreTop, contentMasks);
  const totalArea = width * Math.max(0, height - ignoreTop);
  const contentArea = maskArea(width, height, ignoreTop, contentMasks);
  const contentFraction = totalArea ? contentArea.inside / totalArea : null;
  const ceiling = comparable && contentFraction != null ? contentFraction + (1 - contentFraction) * comparable.ssim : null;

  const grid = gridStats({
    ssim: map, mad: madMap, edgeA, edgeB, a, b, width, height, ignoreTop,
    masks: gridMasks, colorMasks: gridMasks, cols: spec.grid?.[0] ?? 6, rows: spec.grid?.[1] ?? 8,
  });

  writeDiff(outDir, a, b, width, height, ignoreTop, controlMasks);
  writeSideBySide(outDir, a, b, width, height);
  const overlay=Buffer.alloc(width*height*3);
  for(let i=0;i<width*height;i++)for(let channel=0;channel<3;channel++)overlay[i*3+channel]=Math.round((a.pixels[i*a.channels+channel]+b.pixels[i*b.channels+channel])/2);
  writeFileSync(join(outDir,'overlay.png'),encodePng(width,height,overlay));

  const targets = {controlSsim: 0.9, controlDeltaE: 4, controlEdge: 0.35, ...(spec.targets ?? {})};
  const critical=(spec.criticalRegions??[]).map(region=>{
    const metrics=scoreSet({map,madMap,edgeA,edgeB,imageA:a,imageB:b,width,height,ignoreTop,masks:controlMasks,colorMasks:controlColorMasks,include:[region.rect],colorInclude:[region.rect],radius:Math.floor((spec.window??7)/2)});
    return {...region,...evaluateVisualGate(metrics,targets),metrics:summarize(metrics)};
  });
  const failures=evaluateVisualGate(control,targets).failures;
  for(const region of critical)for(const failure of region.failures)failures.push(region.label+': '+failure);
  const evidence=verifyCaptureEvidence(overrides.evidence??spec.captureEvidence?.manifest,overrides.exportIndex??spec.captureEvidence?.exportIndex,candidatePath);
  const provenanceReady=evidence.ready&&!overrides.skipHash&&Boolean(spec.referenceSha256)&&(Boolean(spec.candidateSha256)||Boolean(overrides.evidence));

  const report = {
    id: spec.id,
    title: spec.title,
    spec: relative(ROOT, resolve(specPath)),
    specSha256:sha256(specPath),
    toolHashes:Object.fromEntries(['scripts/visual-lab.mjs','scripts/lib/metrics.mjs','scripts/lib/visual-gate.mjs','scripts/lib/png.mjs','scripts/lib/ui-provenance.mjs',SRGB_PROFILE].map(path=>[path,sha256(path)])),
    evidence,provenanceReady,
    pageAccepted:false,
    acceptanceNote:'Metric gates and provenance do not establish state, geometry, manual, normal-navigation or motion acceptance.',
    criticalRegions:critical,
    generatedAt: new Date().toISOString(),
    state: spec.state,
    reference: {path: referencePath, sha256: referenceSha, source: reference.sourceInfo, normalizedSha256: reference.sha256},
    candidate: {path: candidatePath, sha256: candidateSha, source: candidate.sourceInfo, normalizedSha256: candidate.sha256},
    size: [width, height],
    ignoreTop,
    contentMasks,
    controlMasks,
    controlColorMasks,
    controlRegions,
    controlColorRegions,
    contentAreaFraction: contentFraction,
    method: {
      color: 'sips ICC → sRGB 8-bit; CIEDE2000 in CIE Lab D65',
      structure: 'local uniform-window SSIM, population covariance, 255 data range; only complete valid neighborhoods',
      ink: 'Sobel gradient correlation (glyph/icon alignment proxy)',
      passGate: 'declared control and each critical region; missing/non-finite metrics fail; page acceptance remains separate',
    },
    whole: summarize(whole),
    comparable: summarize(comparable),
    control: summarize(control),
    contentRegion: content,
    ceilingIfContentMatched: ceiling,
    targets,
    pass: failures.length === 0,
    failures,
    patches: control?.patches ?? [],
    grid: grid.map(cell => ({
      ...cell,
      ssim: cell.ssim == null ? null : Number(cell.ssim.toFixed(5)),
      mad: cell.mad == null ? null : Number(cell.mad.toFixed(3)),
      deltaE: cell.deltaE == null ? null : Number(cell.deltaE.toFixed(3)),
      edgeCorrelation: cell.edgeCorrelation == null ? null : Number(cell.edgeCorrelation.toFixed(4)),
    })),
  };
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\n[${spec.id}] ${spec.title}`);
  console.log(`  参考 ${referencePath}  ${reference.sourceInfo.profile}/${reference.sourceInfo.bitDepth}bit  ${referenceSha.slice(0, 12)}…`);
  console.log(`  候选 ${candidatePath}  ${candidate.sourceInfo.profile}/${candidate.sourceInfo.bitDepth}bit  ${candidateSha.slice(0, 12)}…`);
  console.log(`  整屏     ${metricLine(whole)}  （报告用，不设门禁）`);
  console.log(`  可比区   ${metricLine(comparable)}  ${contentFraction == null ? '' : `内容占 ${(contentFraction * 100).toFixed(1)}%`}`);
  console.log(`  控件区   ${metricLine(control)}`);
  console.log(`  应用区覆盖 控件${formatPercent(control?.coverage.applicationCoverageFraction)} / 颜色${formatPercent(control?.colorCoverage.applicationCoverageFraction)}；来源${provenanceReady?'已绑定':'未就绪'}；整页验收仍待人工/几何/正常操作`);
  if (content) console.log(`  内容本身 ${formatPercent(content.ssim)} / MAD ${content.mad.toFixed(1)}；内容一致条件估算 ${formatPercent(ceiling)}`);
  if (control?.patches?.length) {
    console.log('  色块:');
    for (const patch of control.patches) console.log(`    ${patch.label ?? patch.rect.join(',')}  ΔE00 ${patch.deltaE00?.toFixed(2) ?? 'n/a'}  ref ${patch.reference?.join(',') ?? 'n/a'}  cur ${patch.candidate?.join(',') ?? 'n/a'}  std ${patch.referenceStd?.toFixed(1) ?? 'n/a'}/${patch.candidateStd?.toFixed(1) ?? 'n/a'}`);
  }
  const weak = grid.filter(cell => cell.ssim != null).sort((left, right) => left.ssim - right.ssim).slice(0, 5);
  console.log(`  最弱区域: ${weak.map(cell => `r${cell.row}c${cell.col} ${formatPercent(cell.ssim)}`).join('  ')}`);
  console.log(`  结果: ${failures.length ? `未通过 — ${failures.join('; ')}` : '通过'}`);
  console.log(`  报告: ${relative(ROOT, outDir)}/report.json`);
  return report;
}

function summarize(score) {
  if (!score) return null;
  return {
    ssim: Number(score.ssim.toFixed(5)),
    mad: Number(score.mad.toFixed(3)),
    pixels: score.pixels,
    coverage:score.coverage,
    colorCoverage:score.colorCoverage,
    boundaryExcludedPixels:score.boundaryExcludedPixels,
    color: score.color == null ? null : {
      deltaE00Mean: Number(score.color.mean.toFixed(3)),
      deltaE00P50: Number(score.color.p50.toFixed(3)),
      deltaE00P90: Number(score.color.p90.toFixed(3)),
      deltaE00P99: Number(score.color.p99.toFixed(3)),
      sampledPixels: score.color.sampledPixels,
    },
    ink: score.ink == null ? null : {
      pixels:score.ink.pixels,
      correlation: score.ink.correlation == null ? null : Number(score.ink.correlation.toFixed(4)),
      densityReference: Number(score.ink.densityReference.toFixed(3)),
      densityCandidate: Number(score.ink.densityCandidate.toFixed(3)),
      ratio: score.ink.ratio == null ? null : Number(score.ink.ratio.toFixed(4)),
    },
    patches: score.patches?.map(patch => ({
      label: patch.label,
      rect: patch.rect,
      reference: patch.reference,
      candidate: patch.candidate,
      referenceStd: patch.referenceStd == null ? null : Number(patch.referenceStd.toFixed(2)),
      candidateStd: patch.candidateStd == null ? null : Number(patch.candidateStd.toFixed(2)),
      deltaE00: patch.deltaE00 == null ? null : Number(patch.deltaE00.toFixed(3)),
    })),
  };
}

function metricLine(score) {
  if (!score) return 'n/a';
  return `SSIM ${formatPercent(score.ssim)}  ΔE00 ${score.color?.mean?.toFixed(2) ?? 'n/a'} (p90 ${score.color?.p90?.toFixed(2) ?? 'n/a'})  ink r ${score.ink?.correlation?.toFixed(2) ?? 'n/a'}  MAD ${score.mad.toFixed(1)}`;
}

function writeDiff(outDir, a, b, width, height, ignoreTop, masks) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = i * Math.max(1, a.channels);
      const q = i * Math.max(1, b.channels);
      const d = maskedAt(x, y, ignoreTop, masks) ? 0 : deltaE00(
        rgbToLab(a.pixels[p], a.pixels[p + 1] ?? a.pixels[p], a.pixels[p + 2] ?? a.pixels[p]),
        rgbToLab(b.pixels[q], b.pixels[q + 1] ?? b.pixels[q], b.pixels[q + 2] ?? b.pixels[q]),
      );
      const value = Math.min(255, Math.round((d / 20) * 255));
      rgb[i*3] = value;
      rgb[i*3 + 1] = value > 120 ? Math.round(value * 0.35) : 0;
      rgb[i*3 + 2] = 0;
    }
  }
  writeFileSync(join(outDir, 'diff-deltae.png'), encodePng(width, height, rgb));
}

function writeSideBySide(outDir, a, b, width, height) {
  const rgb = Buffer.alloc(width * 2 * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = i * Math.max(1, a.channels);
      const q = i * Math.max(1, b.channels);
      const left = (y * width * 2 + x) * 3;
      const right = (y * width * 2 + width + x) * 3;
      rgb[left] = a.pixels[p]; rgb[left + 1] = a.pixels[p + 1] ?? a.pixels[p]; rgb[left + 2] = a.pixels[p + 2] ?? a.pixels[p];
      rgb[right] = b.pixels[q]; rgb[right + 1] = b.pixels[q + 1] ?? b.pixels[q]; rgb[right + 2] = b.pixels[q + 2] ?? b.pixels[q];
    }
  }
  writeFileSync(join(outDir, 'side-by-side.png'), encodePng(width * 2, height, rgb));
}

const args = parseArgs(process.argv);
const reports = [];
for (const spec of args.specs) reports.push(runSpec(spec, {...args, out:args.specs.length===1?args.out:join(args.out,basename(spec,'.json'))}));

if (args.baseline) {
  const baseline = {
    generatedAt: new Date().toISOString(),
    gate: 'Control region only. Whole-screen SSIM is recorded as a report value and is not a pass criterion.',
    states: reports,
  };
  mkdirSync(dirname(resolve(args.baseline)), {recursive: true});
  writeFileSync(resolve(args.baseline), `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`\n基线清单: ${args.baseline}`);
}

const failed = reports.filter(report => !report.pass);
if (failed.length) {
  console.log(`\n${failed.length}/${reports.length} 个黄金态未通过控件区门禁（这是当前差距，不是脚本错误）。`);
  process.exitCode = 1;
}
