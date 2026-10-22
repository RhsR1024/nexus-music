import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateVisualGate} from '../scripts/lib/visual-gate.mjs';
import {gray, ssimMap, regionScore, edgeMap, edgeStats, colorStats, validCenterMask} from '../scripts/lib/metrics.mjs';

const good = () => ({ssim: 1, pixels: 100, color: {mean: 0, sampledPixels: 25}, ink: {correlation: 1, pixels: 64}});

test('metric gate fails closed for absent, non-finite and unsampled required axes', () => {
  assert.equal(evaluateVisualGate(good()).pass, true);
  assert.equal(evaluateVisualGate(null).pass, false);
  for (const invalid of [undefined, null, NaN, Infinity, -Infinity]) {
    for (const axis of ['ssim', 'color', 'ink']) {
      const score = good();
      if (axis === 'ssim') score.ssim = invalid;
      else if (axis === 'color') score.color.mean = invalid;
      else score.ink.correlation = invalid;
      assert.equal(evaluateVisualGate(score).pass, false, `${axis}: ${invalid}`);
    }
  }
  for (const axis of ['color', 'ink']) {
    const score = good(); score[axis] = null;
    assert.equal(evaluateVisualGate(score).pass, false);
  }
  for (const count of [0, -1, NaN, undefined, 0.5]) {
    for (const axis of ['ssim', 'color', 'ink']) {
      const score = good();
      if (axis === 'ssim') score.pixels = count;
      else if (axis === 'color') score.color.sampledPixels = count;
      else score.ink.pixels = count;
      assert.equal(evaluateVisualGate(score).pass, false);
    }
  }
});

test('gate rejects invalid thresholds and preserves boundary comparisons', () => {
  assert.equal(evaluateVisualGate({...good(), ssim: 0.9, color: {mean: 4, sampledPixels: 25}, ink: {correlation: 0.35, pixels: 64}}).pass, true);
  for (const invalid of [{controlSsim: null}, {controlDeltaE: NaN}, {controlEdge: Infinity}, {controlSsim: 1.1}, {controlDeltaE: -1}, {controlEdge: -2}]) {
    assert.equal(evaluateVisualGate(good(), invalid).pass, false);
  }
});

function iconImage(kind = 'pause', shift = 0, background = 230) {
  const width = 32, height = 32, pixels = new Uint8Array(width * height * 3).fill(background);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const xx = x - shift;
    const mark = kind === 'cross'
      ? ((xx >= 6 && xx < 26 && y >= 14 && y < 18) || (xx >= 14 && xx < 18 && y >= 6 && y < 26))
      : ((xx >= 8 && xx < 12 && y >= 6 && y < 26) || (kind !== 'missing' && xx >= 20 && xx < 24 && y >= 6 && y < 26));
    if (mark) for (let channel = 0; channel < 3; channel++) pixels[(y * width + x) * 3 + channel] = 30;
  }
  return {width, height, channels: 3, pixels};
}

function measure(a, b) {
  const {width, height} = a, include = [[2, 2, 28, 28]];
  const ga = gray(a), gb = gray(b), mad = Float64Array.from(ga, (value, i) => Math.abs(value - gb[i]));
  const control = regionScore(ssimMap(ga, gb, width, height, 3), mad, width, height, 0, 0, width, height, 0, [], include, validCenterMask(width, height, 0, [], include, 3));
  control.color = colorStats(a, b, width, height, 0, [], 1, include);
  control.ink = edgeStats(edgeMap(ga, width, height), edgeMap(gb, width, height), width, height, 0, [], 1, include, validCenterMask(width, height, 0, [], include, 1));
  return control;
}

test('synthetic same-state repeat passes while a shifted control fails', () => {
  const reference = iconImage();
  assert.equal(evaluateVisualGate(measure(reference, iconImage())).pass, true);
  const shifted = measure(reference, iconImage('pause', 6));
  assert.ok(shifted.ssim < 0.9);
  assert.ok(shifted.ink.correlation < 0.35);
  assert.equal(evaluateVisualGate(shifted).pass, false);
});

test('wrong background, missing control and substituted icon fail their declared region gate', () => {
  const reference = iconImage();
  const wrongColor = measure(reference, iconImage('pause', 0, 170));
  assert.ok(wrongColor.color.mean > 4);
  assert.equal(evaluateVisualGate(wrongColor).pass, false);
  for (const kind of ['missing', 'cross']) {
    const changed = measure(reference, iconImage(kind));
    assert.ok(changed.ssim < 0.9, `${kind} SSIM ${changed.ssim}`);
    assert.equal(evaluateVisualGate(changed).pass, false, kind);
  }
});

test('identical flat images cannot pass when edge correlation is undefined', () => {
  const image = {width: 32, height: 32, channels: 3, pixels: new Uint8Array(32 * 32 * 3).fill(230)};
  const control = measure(image, image);
  assert.equal(control.ssim, 1);
  assert.equal(control.color.mean, 0);
  assert.equal(control.ink.correlation, null);
  assert.equal(evaluateVisualGate(control).pass, false);
});
