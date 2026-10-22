export function gray(image) {
  const {width, height, channels, pixels} = image;
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    out[i] = channels >= 3 ? 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2] : pixels[p];
  }
  return out;
}

function integral(src, width, height) {
  const stride = width + 1;
  const out = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += src[y * width + x];
      out[(y + 1) * stride + x + 1] = out[y * stride + x + 1] + row;
    }
  }
  return out;
}

function boxMean(src, width, height, radius) {
  const I = integral(src, width, height);
  const stride = width + 1;
  const out = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum = I[y1 * stride + x1] - I[y0 * stride + x1] - I[y1 * stride + x0] + I[y0 * stride + x0];
      out[y * width + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

export function ssimMap(a, b, width, height, radius) {
  validateFrame(width, height, 0);
  if (!Number.isInteger(radius) || radius < 0) throw new Error('SSIM radius must be a non-negative integer');
  if (a.length !== width * height || b.length !== width * height) throw new Error('SSIM input length does not match frame');
  const aa = new Float64Array(width * height);
  const bb = new Float64Array(width * height);
  const ab = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    aa[i] = a[i] * a[i];
    bb[i] = b[i] * b[i];
    ab[i] = a[i] * b[i];
  }
  const ma = boxMean(a, width, height, radius);
  const mb = boxMean(b, width, height, radius);
  const maa = boxMean(aa, width, height, radius);
  const mbb = boxMean(bb, width, height, radius);
  const mab = boxMean(ab, width, height, radius);
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const map = new Float64Array(width * height);
  for (let i = 0; i < map.length; i++) {
    const va = Math.max(0, maa[i] - ma[i] * ma[i]);
    const vb = Math.max(0, mbb[i] - mb[i] * mb[i]);
    const cov = mab[i] - ma[i] * mb[i];
    map[i] = ((2 * ma[i] * mb[i] + c1) * (2 * cov + c2)) / ((ma[i] * ma[i] + mb[i] * mb[i] + c1) * (va + vb + c2));
  }
  return map;
}

export function rectContains(rect, x, y) {
  return x >= rect[0] && x < rect[0] + rect[2] && y >= rect[1] && y < rect[1] + rect[3];
}

export function maskedAt(x, y, ignoreTop, rects, include = null) {
  if (y < ignoreTop) return true;
  if (include?.length && !include.some(rect => rectContains(rect, x, y))) return true;
  for (const rect of rects) if (rectContains(rect, x, y)) return true;
  return false;
}

function validateFrame(width, height, ignoreTop) {
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0)
      || !Number.isSafeInteger(ignoreTop) || ignoreTop < 0) throw new Error('Frame dimensions and ignoreTop must be non-negative integer pixels');
}

function rectUnionMask(width, height, ignoreTop, rects) {
  validateFrame(width, height, ignoreTop);
  const mask = new Uint8Array(width * height);
  for (const rect of rects) {
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isSafeInteger) || rect[2] < 0 || rect[3] < 0) {
      throw new Error('Rectangles must contain integer [x, y, width, height] with non-negative dimensions');
    }
    const [x, y, w, h] = rect;
    const x0 = Math.max(0, x), x1 = Math.min(width, x + w);
    const y0 = Math.max(ignoreTop, y), y1 = Math.min(height, y + h);
    if (x1 <= x0) continue;
    for (let row = y0; row < y1; row++) mask.fill(1, row * width + x0, row * width + x1);
  }
  return mask;
}

export function maskArea(width, height, ignoreTop, rects) {
  const mask = rectUnionMask(width, height, ignoreTop, rects);
  return {inside: mask.reduce((sum, value) => sum + value, 0), total: width * Math.max(0, height - ignoreTop)};
}

// Coverage uses the same integer pixel membership as scoring. Overlap is a union,
// exclusions only count inside the ROI, and both full-frame and app denominators
// remain explicit. An absent/empty include list retains the legacy full-app ROI.
export function coverageStats(width, height, ignoreTop, rects = [], include = null) {
  const roi = include?.length ? include : [[0, ignoreTop, width, Math.max(0, height - ignoreTop)]];
  const included = rectUnionMask(width, height, ignoreTop, roi);
  const excluded = rectUnionMask(width, height, ignoreTop, rects);
  let includedPixels = 0, excludedPixels = 0;
  for (let i = 0; i < included.length; i++) {
    includedPixels += included[i];
    excludedPixels += included[i] && excluded[i] ? 1 : 0;
  }
  const fullFramePixels = width * height;
  const applicationPixels = width * Math.max(0, height - ignoreTop);
  const scoredPixels = includedPixels - excludedPixels;
  return {
    fullFramePixels, applicationPixels, includedPixels, excludedPixels, scoredPixels,
    frameCoverageFraction: scoredPixels / fullFramePixels,
    applicationCoverageFraction: applicationPixels ? scoredPixels / applicationPixels : null,
    roiExcludedFraction: includedPixels ? excludedPixels / includedPixels : null,
  };
}

// A center is eligible only when its entire square neighborhood is in the image
// and in the selected, unmasked region. Use radius=3 for a 7x7 SSIM and radius=1
// for Sobel. The map itself may still be computed once for the complete frame.
export function validCenterMask(width, height, ignoreTop, rects = [], include = null, radius = 0) {
  if (!Number.isInteger(radius) || radius < 0) throw new Error('Neighborhood radius must be a non-negative integer');
  const roi = include?.length ? include : [[0, ignoreTop, width, Math.max(0, height - ignoreTop)]];
  const included = rectUnionMask(width, height, ignoreTop, roi);
  const excluded = rectUnionMask(width, height, ignoreTop, rects);
  for (let i = 0; i < included.length; i++) if (excluded[i]) included[i] = 0;
  if (!radius) return included;
  const I = integral(included, width, height), stride = width + 1;
  const centers = new Uint8Array(width * height);
  const side = 2 * radius + 1, expected = side * side;
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const x0 = x - radius, x1 = x + radius + 1, y0 = y - radius, y1 = y + radius + 1;
      const count = I[y1 * stride + x1] - I[y0 * stride + x1] - I[y1 * stride + x0] + I[y0 * stride + x0];
      if (count === expected) centers[y * width + x] = 1;
    }
  }
  return centers;
}

export function regionScore(map, madMap, width, height, x0, y0, x1, y1, ignoreTop, rects, include = null, validCenters = null) {
  if (validCenters && validCenters.length !== width * height) throw new Error('Valid-center mask length does not match frame');
  let n = 0, sum = 0, mad = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (maskedAt(x, y, ignoreTop, rects, include)) continue;
      const i = y * width + x;
      if (validCenters && !validCenters[i]) continue;
      sum += map[i];
      mad += madMap[i];
      n++;
    }
  }
  if (!n) return null;
  return {ssim: sum / n, mad: mad / n, pixels: n};
}

function srgbToLinear(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const D65 = {x: 0.95047, y: 1, z: 1.08883};
const EPSILON = (6 / 29) ** 3;
const KAPPA = 3 * (6 / 29) ** 2;

function labF(value) {
  return value > EPSILON ? Math.cbrt(value) : value / KAPPA + 4 / 29;
}

export function rgbToLab(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / D65.x;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / D65.y;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / D65.z;
  const fx = labF(x), fy = labF(y), fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const RAD = Math.PI / 180;
const POW25_7 = 25 ** 7;

export function deltaE00(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) / RAD + 360) % 360;
  const h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) / RAD + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hbarp - 30) * RAD) + 0.24 * Math.cos(2 * hbarp * RAD) + 0.32 * Math.cos((3 * hbarp + 6) * RAD) - 0.2 * Math.cos((4 * hbarp - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + POW25_7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

// Sobel magnitude on the greyscale image. This is the "ink" axis: it responds
// to glyph/icon edges and their alignment, not to which words the fixture used.
export function edgeMap(source, width, height) {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = source[i - width - 1], tc = source[i - width], tr = source[i - width + 1];
      const ml = source[i - 1], mr = source[i + 1];
      const bl = source[i + width - 1], bc = source[i + width], br = source[i + width + 1];
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

export function edgeStats(edgeA, edgeB, width, height, ignoreTop, rects, step = 1, include = null, validCenters = null) {
  if (!Number.isInteger(step) || step < 1) throw new Error('Sampling step must be a positive integer');
  if (validCenters && validCenters.length !== width * height) throw new Error('Valid-center mask length does not match frame');
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = ignoreTop; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (maskedAt(x, y, ignoreTop, rects, include)) continue;
      const i = y * width + x;
      if (validCenters && !validCenters[i]) continue;
      const a = edgeA[i], b = edgeB[i];
      sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++;
    }
  }
  if (!n) return null;
  const ma = sa / n, mb = sb / n;
  const va = saa / n - ma * ma, vb = sbb / n - mb * mb;
  const cov = sab / n - ma * mb;
  return {
    correlation: va > 1e-6 && vb > 1e-6 ? cov / Math.sqrt(va * vb) : null,
    densityReference: ma,
    densityCandidate: mb,
    ratio: ma > 1e-6 ? mb / ma : null,
    pixels: n,
  };
}

export function colorStats(a, b, width, height, ignoreTop, rects, step = 2, include = null) {
  if (!Number.isInteger(step) || step < 1) throw new Error('Sampling step must be a positive integer');
  const values = [];
  let sum = 0;
  for (let y = ignoreTop; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (maskedAt(x, y, ignoreTop, rects, include)) continue;
      const i = (y * width + x) * Math.max(1, a.channels);
      const j = (y * width + x) * Math.max(1, b.channels);
      const d = deltaE00(
        rgbToLab(a.pixels[i], a.pixels[i + 1] ?? a.pixels[i], a.pixels[i + 2] ?? a.pixels[i]),
        rgbToLab(b.pixels[j], b.pixels[j + 1] ?? b.pixels[j], b.pixels[j + 2] ?? b.pixels[j]),
      );
      values.push(d);
      sum += d;
    }
  }
  if (!values.length) return null;
  values.sort((left, right) => left - right);
  const pick = q => values[Math.min(values.length - 1, Math.floor(q * values.length))];
  return {
    mean: sum / values.length,
    p50: pick(0.5),
    p90: pick(0.9),
    p99: pick(0.99),
    max: values[values.length - 1],
    sampledPixels: values.length,
    step,
  };
}

export function patchStats(image, rect) {
  const {width, height, channels, pixels} = image;
  const [x0, y0, w, h] = rect;
  const x1 = Math.min(width, x0 + w), y1 = Math.min(height, y0 + h);
  let n = 0, r = 0, g = 0, b = 0;
  for (let y = Math.max(0, y0); y < y1; y++) {
    for (let x = Math.max(0, x0); x < x1; x++) {
      const p = (y * width + x) * Math.max(1, channels);
      r += pixels[p]; g += pixels[p + 1] ?? pixels[p]; b += pixels[p + 2] ?? pixels[p]; n++;
    }
  }
  if (!n) return null;
  const mean = [r / n, g / n, b / n];
  let variance = 0;
  for (let y = Math.max(0, y0); y < y1; y++) {
    for (let x = Math.max(0, x0); x < x1; x++) {
      const p = (y * width + x) * Math.max(1, channels);
      variance += ((pixels[p] ?? 0) - mean[0]) ** 2 + ((pixels[p + 1] ?? pixels[p]) - mean[1]) ** 2 + ((pixels[p + 2] ?? pixels[p]) - mean[2]) ** 2;
    }
  }
  return {mean, std: Math.sqrt(variance / (n * 3)), pixels: n};
}

export function gridStats({ssim, mad, edgeA, edgeB, a, b, width, height, ignoreTop, masks, colorMasks = [], cols = 6, rows = 8, step = 2}) {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((col * width) / cols);
      const x1 = Math.floor(((col + 1) * width) / cols);
      const y0 = Math.max(ignoreTop, Math.floor((row * height) / rows));
      const y1 = Math.floor(((row + 1) * height) / rows);
      if (y1 <= y0 || x1 <= x0) continue;
      let n = 0, s = 0, m = 0, ea = 0, eb = 0, eaa = 0, ebb = 0, eab = 0, de = 0;
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          if (maskedAt(x, y, ignoreTop, masks)) continue;
          const i = y * width + x;
          s += ssim[i]; m += mad[i];
          const va = edgeA[i], vb = edgeB[i];
          ea += va; eb += vb; eaa += va * va; ebb += vb * vb; eab += va * vb;
          if (!maskedAt(x, y, ignoreTop, colorMasks)) {
            const p = i * Math.max(1, a.channels), q = i * Math.max(1, b.channels);
            de += deltaE00(
              rgbToLab(a.pixels[p], a.pixels[p + 1] ?? a.pixels[p], a.pixels[p + 2] ?? a.pixels[p]),
              rgbToLab(b.pixels[q], b.pixels[q + 1] ?? b.pixels[q], b.pixels[q + 2] ?? b.pixels[q]),
            );
          }
          n++;
        }
      }
      if (!n) {
        cells.push({row, col, x0, y0, x1, y1, masked: true});
        continue;
      }
      const ma = ea / n, mb = eb / n;
      const vva = eaa / n - ma * ma, vvb = ebb / n - mb * mb, cov = eab / n - ma * mb;
      cells.push({
        row, col, x0, y0, x1, y1,
        ssim: s / n, mad: m / n,
        deltaE: de / n,
        edgeCorrelation: vva > 1e-6 && vvb > 1e-6 ? cov / Math.sqrt(vva * vvb) : null,
        pixels: n,
      });
    }
  }
  return cells;
}

export function formatPercent(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(2)}%`;
}
