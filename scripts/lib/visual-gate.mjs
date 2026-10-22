export const DEFAULT_VISUAL_TARGETS = Object.freeze({controlSsim: 0.9, controlDeltaE: 4, controlEdge: 0.35});

// This is a metric gate for a declared region, never a page-completion verdict.
// Consume raw metrics before JSON serialization can turn NaN/Infinity into null.
export function evaluateVisualGate(control, overrides = {}) {
  const targets = {...DEFAULT_VISUAL_TARGETS, ...overrides};
  const failures = [];
  for (const [key, minimum, maximum] of [['controlSsim', 0, 1], ['controlDeltaE', 0, Infinity], ['controlEdge', -1, 1]]) {
    if (!Number.isFinite(targets[key]) || targets[key] < minimum || targets[key] > maximum) failures.push(`invalid target ${key}`);
  }
  if (!control) failures.push('control region is empty');
  else {
    const checks = [
      ['control SSIM', control.ssim, control.pixels, value => value >= targets.controlSsim],
      ['control ΔE00', control.color?.mean, control.color?.sampledPixels, value => value <= targets.controlDeltaE],
      ['control ink correlation', control.ink?.correlation, control.ink?.pixels, value => value >= targets.controlEdge],
    ];
    for (const [name, value, count, meetsTarget] of checks) {
      if (!Number.isFinite(value)) failures.push(`${name} is missing or non-finite`);
      else if (!meetsTarget(value)) failures.push(`${name} ${value} does not meet target`);
      if (!Number.isSafeInteger(count) || count <= 0) failures.push(`${name} has no valid samples`);
    }
  }
  return {pass: failures.length === 0, failures};
}
