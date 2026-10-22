import test from 'node:test';
import assert from 'node:assert/strict';
import {deltaE00, rgbToLab, maskedAt, maskArea, regionScore, coverageStats, validCenterMask, ssimMap, edgeMap, edgeStats, colorStats} from '../scripts/lib/metrics.mjs';
import {parsePng, encodePng} from '../scripts/lib/png.mjs';

// Sharma, Wu & Dalal (2005) CIEDE2000 verification data.
const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
  [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0],
  [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.5, 0], [61, -5, 29], 22.8977],
];

test('CIEDE2000 matches the published verification pairs', () => {
  for (const [left, right, expected] of SHARMA) {
    const actual = deltaE00(left, right);
    assert.ok(Math.abs(actual - expected) < 1e-4, `${left} vs ${right}: ${actual} != ${expected}`);
    assert.ok(Math.abs(deltaE00(right, left) - expected) < 1e-4, 'deltaE00 must be symmetric');
  }
});

test('rgbToLab maps sRGB endpoints onto the Lab axis', () => {
  const white = rgbToLab(255, 255, 255);
  assert.ok(Math.abs(white[0] - 100) < 1e-3);
  assert.ok(Math.abs(white[1]) < 1e-4 && Math.abs(white[2]) < 1e-4);
  for (const value of rgbToLab(0, 0, 0)) assert.ok(Math.abs(value) < 1e-6);
});

test('mask predicates honour ignoreTop and rectangles', () => {
  assert.equal(maskedAt(5, 5, 0, [[0, 0, 10, 10]]), true);
  assert.equal(maskedAt(15, 5, 0, [[0, 0, 10, 10]]), false);
  assert.equal(maskedAt(5, 5, 10, []), true);
  assert.deepEqual(maskArea(10, 10, 2, [[0, 0, 10, 10]]), {inside: 80, total: 80});
  assert.deepEqual(maskArea(10, 10, 0, [[0, 0, 10, 10]]), {inside: 100, total: 100});
});

test('regionScore skips masked pixels and reports null for an empty region', () => {
  const width = 10, height = 10;
  const map = new Float64Array(width * height).fill(0.5);
  const mad = new Float64Array(width * height).fill(0.25);
  const half = regionScore(map, mad, width, height, 0, 0, width, height, 0, [[0, 0, 5, 10]]);
  assert.equal(half.pixels, 50);
  assert.equal(half.ssim, 0.5);
  assert.equal(half.mad, 0.25);
  assert.equal(regionScore(map, mad, width, height, 0, 0, width, height, 0, [[0, 0, 10, 10]]), null);
});

test('PNG roundtrip preserves RGB pixels', () => {
  const width = 2, height = 2;
  const rgb = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  const decoded = parsePng(encodePng(width, height, rgb));
  assert.equal(decoded.width, width);
  assert.equal(decoded.height, height);
  assert.equal(decoded.channels, 3);
  assert.deepEqual([...decoded.pixels], [...rgb]);
});

test('rectangle area is a clipped union including overlaps and empty/offscreen rectangles', () => {
  assert.deepEqual(maskArea(10, 10, 0, [[0, 0, 10, 10], [0, 0, 10, 10]]), {inside: 100, total: 100});
  assert.deepEqual(maskArea(10, 10, 2, [[-5, -5, 10, 10], [20, 20, 5, 5], [0, 0, 0, 10]]), {inside: 15, total: 80});
  assert.deepEqual(maskArea(10, 10, 20, [[0, 0, 10, 10]]), {inside: 0, total: 0});
  assert.throws(() => maskArea(10, 10, 0, [[0.5, 0, 2, 2]]), /integer/);
  assert.throws(() => maskArea(10, 10, 0, [[0, 0, -2, 2]]), /non-negative/);
});

test('coverage distinguishes full frame, application, ROI exclusion, and overlapping union', () => {
  const result = coverageStats(10, 10, 2, [[0, 0, 3, 10], [2, 0, 3, 10]], [[0, 0, 6, 10], [4, 0, 6, 10]]);
  assert.deepEqual(result, {
    fullFramePixels: 100, applicationPixels: 80, includedPixels: 80, excludedPixels: 40, scoredPixels: 40,
    frameCoverageFraction: 0.4, applicationCoverageFraction: 0.5, roiExcludedFraction: 0.5,
  });
  const tiny = coverageStats(10, 10, 0, [], [[2, 2, 1, 1]]);
  assert.equal(tiny.roiExcludedFraction, 0);
  assert.equal(tiny.applicationCoverageFraction, 0.01);
  assert.equal(coverageStats(10, 10, 0, [], [[20, 20, 2, 2]]).roiExcludedFraction, null);
  assert.equal(coverageStats(10, 10, 0, [[0, 0, 10, 10]]).scoredPixels, 0);
});

// Deliberately direct O(pixels * window area) oracle: two-pass, population
// moments, uniform weights, 8-bit data range and clipped image-boundary windows.
// It shares no integral-image or box-filter implementation with production.
function directSsim(a, b, width, height, radius, x, y) {
  const pairs = [];
  for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) pairs.push([a[yy * width + xx], b[yy * width + xx]]);
  }
  const ma = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const mb = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  let va = 0, vb = 0, cov = 0;
  for (const [left, right] of pairs) { va += (left - ma) ** 2; vb += (right - mb) ** 2; cov += (left - ma) * (right - mb); }
  va /= pairs.length; vb /= pairs.length; cov /= pairs.length;
  const c1 = 2.55 ** 2, c2 = 7.65 ** 2;
  return ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma ** 2 + mb ** 2 + c1) * (va + vb + c2));
}

test('local SSIM agrees with an independent direct-window oracle including image boundaries', () => {
  const width = 11, height = 9;
  const a = Float64Array.from({length: width * height}, (_, i) => (i * 47 + (i % width) * 13) % 256);
  const b = Float64Array.from(a, (value, i) => i % 5 ? value : 255 - value);
  for (const radius of [0, 1, 3]) {
    const actual = ssimMap(a, b, width, height, radius);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      assert.ok(Math.abs(actual[y * width + x] - directSsim(a, b, width, height, radius, x, y)) < 1e-10, `radius ${radius}, pixel ${x},${y}`);
    }
  }
  assert.throws(() => ssimMap(a, b, width, height, NaN), /radius/);
});

test('valid centers remove SSIM contamination from excluded content and ROI boundaries', () => {
  const width = 15, height = 9;
  const a = new Float64Array(width * height).fill(128), b = a.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < 7; x++) b[y * width + x] = 0;
  const include = [[7, 0, 8, 9]], mad = new Float64Array(a.length), map = ssimMap(a, b, width, height, 3);
  const legacy = regionScore(map, mad, width, height, 0, 0, width, height, 0, [], include);
  assert.ok(legacy.ssim < 0.9, 'unrestricted windows demonstrate outside-ROI contamination');
  for (const [masks, regions] of [[[], include], [[[0, 0, 7, 9]], null]]) {
    const centers = validCenterMask(width, height, 0, masks, regions, 3);
    const clean = regionScore(map, mad, width, height, 0, 0, width, height, 0, masks, regions, centers);
    assert.equal(clean.ssim, 1);
    assert.equal(clean.pixels, 6);
  }
  assert.equal(validCenterMask(width, height, 0, [], [[7, 0, 5, 9]], 3).some(Boolean), false);
});

test('center mask respects union seams, top exclusion, image borders and interior holes', () => {
  const mask = validCenterMask(9, 9, 2, [[4, 5, 1, 1]], [[0, 0, 5, 9], [4, 0, 5, 9]], 1);
  assert.equal(mask[3 * 9 + 4], 1, 'overlapping ROI union must not introduce a seam');
  assert.equal(mask[2 * 9 + 4], 0, 'window must not enter ignored system strip');
  assert.equal(mask[8 * 9 + 4], 0, 'full window must remain inside image');
  assert.equal(mask[4 * 9 + 4], 0, 'window must not touch excluded content');
});

test('Sobel scoring excludes gradients crossing ROI boundaries', () => {
  const width = 13, height = 11, include = [[5, 0, 8, 11]];
  const a = Float64Array.from({length: width * height}, (_, i) => (i * 17) % 230), b = a.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < 5; x++) b[y * width + x] = 255 - a[y * width + x];
  const ea = edgeMap(a, width, height), eb = edgeMap(b, width, height);
  const legacy = edgeStats(ea, eb, width, height, 0, [], 1, include);
  const clean = edgeStats(ea, eb, width, height, 0, [], 1, include, validCenterMask(width, height, 0, [], include, 1));
  assert.ok(legacy.correlation < 0.999);
  assert.ok(Math.abs(clean.correlation - 1) < 1e-12);
  assert.equal(clean.pixels, 54);
});

test('color sampling reports missing tiny off-grid ROI and rejects invalid strides', () => {
  const image = {channels: 3, pixels: new Uint8Array(10 * 10 * 3).fill(128)};
  assert.equal(colorStats(image, image, 10, 10, 0, [], 2, [[1, 1, 1, 1]]), null);
  assert.equal(colorStats(image, image, 10, 10, 0, [], 1, [[1, 1, 1, 1]]).sampledPixels, 1);
  assert.throws(() => colorStats(image, image, 10, 10, 0, [], 0), /positive integer/);
});
