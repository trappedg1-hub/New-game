// V3-style continuous deformation fields, authored for the approved yoga pose.
// The joints are separate skinned meshes; this underlay moves only gently.
import { LOOP_SECONDS } from './jointed-rig.js';
export const SOURCE_WIDTH = 1534;
export const SOURCE_HEIGHT = 2733;
const clamp01 = value => Math.max(0, Math.min(1, value));
export function smoothstep(a, b, value) {
  const x = clamp01((value - a) / (b - a));
  return x * x * (3 - 2 * x);
}
const bell = (value, center, width) => Math.exp(-0.5 * ((value - center) / width) ** 2);
export function motionWeights(x, y) {
  const edge = smoothstep(0, 150, x) * (1 - smoothstep(SOURCE_WIDTH - 150, SOURCE_WIDTH, x));
  const torso = edge * bell(x, 800, 290) * bell(y, 790, 200)
    * smoothstep(480, 650, y) * (1 - smoothstep(1050, 1200, y));
  // Root of the ponytail remains anchored to the tie; its lower lengths lag.
  const hair = edge * bell(x, 445, 150) * smoothstep(170, 520, y)
    * (1 - smoothstep(970, 1090, y)) * (1 - smoothstep(630, 720, x));
  const waist = edge * bell(x, 765, 360) * bell(y, 1240, 270)
    * smoothstep(900, 1050, y) * (1 - smoothstep(1620, 1760, y));
  const cloth = edge * bell(x, 767, 360) * bell(y, 1370, 220)
    * smoothstep(1100, 1200, y) * (1 - smoothstep(1640, 1725, y));
  return { x, y, torso, hair, waist, cloth };
}
export function motionPhases(time) {
  const p = 2 * Math.PI * time / LOOP_SECONDS;
  return { breath: Math.sin(2 * p), shift: Math.sin(p),
    hair: Math.sin(2 * p - 0.52) + Math.sin(0.52),
    cloth: Math.sin(2 * p - 0.18) + Math.sin(0.18) };
}
export function motionOffset(w, p, strength, result = [0, 0]) {
  result[0] = ((w.x - 800) * 0.006 * w.torso * p.breath + 8 * w.hair * p.hair
    + 4.3 * w.waist * p.shift + (w.x - 767) * 0.0025 * w.cloth * p.cloth) * strength;
  result[1] = (-4 * w.torso * p.breath + 1.0 * w.hair * p.hair
    - 1.4 * w.waist * p.shift - 1.5 * w.cloth * p.cloth) * strength;
  return result;
}
export function blinkEnvelope(elapsed) {
  const close = 0.16, hold = 0.055, open = 0.205;
  if (elapsed < 0 || elapsed >= close + hold + open) return 0;
  if (elapsed < close) return smoothstep(0, close, elapsed);
  if (elapsed < close + hold) return 1;
  return 1 - smoothstep(0, open, elapsed - close - hold);
}
export function automaticBlink(time) {
  const cycle = time % 24;
  return Math.max(...[3.1, 9.5, 17.2, 17.7].map(start => blinkEnvelope(cycle - start)));
}
