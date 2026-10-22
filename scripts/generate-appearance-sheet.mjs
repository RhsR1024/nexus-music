import {writeFileSync} from 'node:fs';
import {encodePng} from './lib/png.mjs';

// IMG_4855 and IMG_4856 show the same fixed sheet wash at the same screen
// coordinates. Sample only low-gradient regions from both references, then
// interpolate a tiny bitmap so the native image scaler carries the broad
// two-dimensional blue-grey drift without embedding either screenshot.
const sheetTop = 258;
const sheetBottom = 2796;
const controls = [
  [258, [244, 246, 244], [233, 240, 244], [221, 235, 243]],
  [400, [239, 242, 242], [228, 237, 242], [216, 232, 242]],
  [500, [236, 241, 242], [224, 235, 242], [212, 230, 241]],
  [575, [235, 242, 245], [224, 236, 244], [211, 230, 243]],
  [700, [230, 239, 243], [218, 235, 243], [205, 227, 242]],
  [900, [222, 235, 243], [210, 230, 242], [198, 224, 241]],
  [1100, [222, 235, 242], [215, 232, 242], [191, 221, 241]],
  [1300, [217, 233, 242], [210, 229, 242], [191, 220, 240]],
  [1500, [212, 230, 242], [205, 227, 241], [199, 222, 241]],
  [1700, [208, 228, 241], [211, 229, 241], [207, 224, 241]],
  [1900, [206, 227, 241], [215, 229, 241], [216, 227, 241]],
  [2100, [209, 228, 241], [219, 231, 241], [224, 229, 241]],
  [2300, [218, 230, 241], [227, 233, 241], [233, 232, 241]],
  [2500, [224, 232, 241], [234, 235, 241], [242, 234, 241]],
  [2700, [224, 229, 241], [237, 233, 242], [250, 236, 241]],
  [2796, [224, 229, 241], [237, 233, 242], [250, 236, 241]],
];

const width = 17;
const height = 33;
const pixels = Buffer.alloc(width * height * 3);

function mix(left, right, amount) {
  return left.map((value, index) => value + (right[index] - value) * amount);
}

function rowAt(y) {
  const exact = controls.find(row => row[0] === y);
  if (exact) return exact;
  const nextIndex = controls.findIndex(row => row[0] > y);
  const before = controls[nextIndex - 1];
  const after = controls[nextIndex];
  const amount = (y - before[0]) / (after[0] - before[0]);
  return [
    y,
    mix(before[1], after[1], amount),
    mix(before[2], after[2], amount),
    mix(before[3], after[3], amount),
  ];
}

function sample(normalizedX, normalizedY) {
  const row = rowAt(sheetTop + (sheetBottom - sheetTop) * normalizedY);
  return normalizedX <= 0.5
    ? mix(row[1], row[2], normalizedX * 2)
    : mix(row[2], row[3], (normalizedX - 0.5) * 2);
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const color = sample(x / (width - 1), y / (height - 1));
    const offset = (y * width + x) * 3;
    color.forEach((channel, index) => {
      pixels[offset + index] = Math.max(0, Math.min(255, Math.round(channel)));
    });
  }
}

writeFileSync('assets/appearance-sheet-light.png', encodePng(width, height, pixels));
console.log(`wrote assets/appearance-sheet-light.png (${width}x${height})`);
