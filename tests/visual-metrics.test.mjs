import test from 'node:test';
import assert from 'node:assert/strict';
import {deltaE00, rgbToLab, maskedAt, maskArea, regionScore} from '../scripts/lib/metrics.mjs';
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
