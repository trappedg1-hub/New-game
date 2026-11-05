// V1 idle breathing, chest, hair, cloth and blinking equations, unchanged.
export const SOURCE_WIDTH = 1184;
export const SOURCE_HEIGHT = 3488;
const clamp01 = value => Math.max(0, Math.min(1, value));
export function smoothstep(a, b, value) {
  const x = clamp01((value - a) / (b - a));
  return x * x * (3 - 2 * x);
}
const bell = (value, center, width) => Math.exp(-0.5 * ((value - center) / width) ** 2);

export function motionWeights(x, y) {
  const edge = smoothstep(0, 90, x) * (1 - smoothstep(SOURCE_WIDTH - 90, SOURCE_WIDTH, x));
  const torso = bell(y, 910, 230) * bell(x, 590, 390) * smoothstep(610, 760, y)
    * (1 - smoothstep(1350, 1600, y)) * edge;
  const side = smoothstep(245, 415, Math.abs(x - 592));
  const hair = side * smoothstep(675, 900, y) * (1 - smoothstep(1430, 1600, y)) * edge;
  const cloth = bell(y, 1650, 170) * bell(x, 590, 440)
    * smoothstep(1260, 1420, y) * (1 - smoothstep(1810, 1950, y)) * edge;
  return { x, y, torso, hair, cloth };
}

export function motionPhases(time) {
  return {
    breath: Math.sin(time * Math.PI * 2 / 4.8),
    hair: Math.sin(time * Math.PI * 2 / 6.2),
    cloth: Math.sin(time * Math.PI * 2 / 7.4),
  };
}

export function motionOffset(weights, phases, strength, result = [0, 0]) {
  const { x, torso, hair, cloth } = weights;
  result[0] = ((x - 590) * 0.014 * torso * phases.breath + 10 * hair * phases.hair + 5 * cloth * phases.cloth) * strength;
  result[1] = (-8 * torso * phases.breath + 2.8 * hair * phases.hair - 3.0 * cloth * phases.cloth) * strength;
  return result;
}

// One blink is a continuous short close, hold and release. No full-frame swaps.
export function blinkEnvelope(elapsed) {
  const close = 0.16;
  const hold = 0.055;
  const open = 0.205;
  if (elapsed < 0 || elapsed >= close + hold + open) return 0;
  if (elapsed < close) return smoothstep(0, close, elapsed);
  if (elapsed < close + hold) return 1;
  return 1 - smoothstep(0, open, elapsed - close - hold);
}

export function automaticBlink(time) {
  const cycle = time % 18.4;
  // A long, gently irregular sequence, including one occasional double blink.
  return Math.max(...[2.35, 6.95, 7.45, 13.2].map(start => blinkEnvelope(cycle - start)));
}
