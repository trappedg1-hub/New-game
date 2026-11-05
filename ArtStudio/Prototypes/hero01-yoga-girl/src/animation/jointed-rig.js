// Adapted from the approved V3 FK + weighted-skin pipeline, with new pivots,
// limits, limb weights and original yoga-specific movement. Source: 1534×2733.
import { variantFor } from './profiles.js';
import { clamp, finiteUnit } from './controller-utils.js';

const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const pt = (x, y) => Object.freeze({ x, y });
export const LIMBS = Object.freeze({
  armLeft: Object.freeze({ root: pt(515, 990), middle: pt(462, 1230), end: pt(392, 1490),
    names: ['shoulder', 'elbow', 'wrist'], limits: [0.017, 0.020, 0.024] }),
  armRight: Object.freeze({ root: pt(970, 670), middle: pt(1053, 1080), end: pt(1120, 1490),
    names: ['shoulder', 'elbow', 'wrist'], limits: [0.014, 0.018, 0.024] }),
  legLeft: Object.freeze({ root: pt(565, 1625), middle: pt(553, 1975), end: pt(430, 2240),
    names: ['hip', 'knee', 'ankle'], limits: [0.012, 0.016, 0.024] }),
  legRight: Object.freeze({ root: pt(968, 1625), middle: pt(980, 1975), end: pt(1102, 2240),
    names: ['hip', 'knee', 'ankle'], limits: [0.012, 0.016, 0.024] }),
});

// Each is a continuous three-joint skin with smoothly blended joint weights.
// The left forearm is hidden by the shorts in the source; its hand and upper
// arm still share this same chain rather than being separately animated cards.
const shortsEdges = [
  [1080,570,940],[1100,560,955],[1200,470,1045],[1300,420,1090],
  [1400,397,1115],[1500,393,1120],[1600,402,1110],[1650,410,1105],
];
function shortsEdge(y, right) {
  for (let i=1;i<shortsEdges.length;i++) {
    const a=shortsEdges[i-1],b=shortsEdges[i];
    if (y<=b[0]) { const t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0]))); return a[right?2:1]*(1-t)+b[right?2:1]*t; }
  }
  return shortsEdges[shortsEdges.length-1][right?2:1];
}
export function limbWeights(name, x, y) {
  let root, middle, end;
  if (name === 'armLeft') {
    root = smooth(1000, 1135, y); middle = smooth(1150, 1325, y); end = smooth(1450, 1530, y);
  } else if (name === 'armRight') {
    root = smooth(625, 825, y); middle = smooth(1010, 1180, y); end = smooth(1430, 1515, y);
  } else if (name === 'legLeft' || name === 'legRight') {
    root = smooth(1660, 1800, y); middle = smooth(1920, 2065, y); end = smooth(2195, 2320, y);
  } else throw new Error(`Unknown limb ${name}`);
  if (name === 'armLeft' || name === 'armRight') {
    // At the occlusion against the shorts, the inner arm contour is planted
    // and must not expose a bright strip of the mat. Fade this restraint out
    // past the hip; the palm and distal wrist remain independently movable.
    const right=name==='armRight';
    const distance=right ? x-shortsEdge(y,true) : shortsEdge(y,false)-x;
    const nearHip=smooth(1110,1260,y)*(1-smooth(1700,1800,y));
    root *= 1-nearHip*(1-smooth(80,160,distance));
  } else {
    // The shared mat/shadow between the knees is not a separate limb. Anchor
    // that background near the centreline so the two skins cannot pull its
    // clipped edge apart; the visible thighs and feet retain joint motion.
    const distance=name==='legLeft' ? 767-x : x-767;
    root *= smooth(0,110,distance);
  }
  return { root, middle, end: Math.min(middle, end) };
}

// Same affine FK / linear blend skinning method as the approved V3.
function rotationAt(point, angle) {
  const a = Math.cos(angle), b = Math.sin(angle), c = -b, d = a;
  return { a, b, c, d, tx: point.x - a * point.x - c * point.y, ty: point.y - b * point.x - d * point.y };
}
function multiply(p, q) {
  return { a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    tx: p.a * q.tx + p.c * q.ty + p.tx, ty: p.b * q.tx + p.d * q.ty + p.ty };
}
export function jointMatrices(name, angles) {
  const def = LIMBS[name];
  if (!def) throw new Error(`Unknown limb ${name}`);
  const root = rotationAt(def.root, angles[def.names[0]] || 0);
  const middle = multiply(root, rotationAt(def.middle, angles[def.names[1]] || 0));
  const end = multiply(middle, rotationAt(def.end, angles[def.names[2]] || 0));
  return [root, middle, end];
}
export function skinPoint(x, y, weights, matrices, result = { x: 0, y: 0 }) {
  const [a, b, c] = matrices;
  const ax = a.a * x + a.c * y + a.tx, ay = a.b * x + a.d * y + a.ty;
  const bx = b.a * x + b.c * y + b.tx, by = b.b * x + b.d * y + b.ty;
  const cx = c.a * x + c.c * y + c.tx, cy = c.b * x + c.d * y + c.ty;
  result.x = x + weights.root * (ax + weights.middle * (bx - ax) + weights.end * (cx - bx) - x);
  result.y = y + weights.root * (ay + weights.middle * (by - ay) + weights.end * (cy - by) - y);
  return result;
}

const REACTIONS = Object.freeze({
  shoulderLeft: { armLeft: [0.008, -0.006, 0.002] },
  shoulderRight: { armRight: [-0.008, 0.006, -0.002] },
  armLeft: { armLeft: [0.009, -0.012, 0.007] },
  armRight: { armRight: [-0.009, 0.012, -0.007] },
  handLeft: { armLeft: [0.002, -0.005, 0.016] },
  handRight: { armRight: [-0.002, 0.005, -0.016] },
  upperTorso: { armLeft: [0.004, -0.003, 0], armRight: [-0.004, 0.003, 0] },
  waist: { legLeft: [0.004, -0.003, 0.003], legRight: [-0.004, 0.003, -0.003] },
  legLeft: { legLeft: [0.004, -0.009, 0.015] },
  legRight: { legRight: [-0.004, 0.009, -0.015] },
});

export const LOOP_SECONDS = 12;
function idle(time) {
  // Yoga weight transfer and breath are periodic, with delayed return in the
  // ankles and ponytail rather than the maid costume's motion profiles.
  const phase = 2 * Math.PI * time / LOOP_SECONDS;
  const sway = Math.sin(phase), breath = Math.sin(phase * 2);
  const ankleFollow = Math.sin(phase - 0.36) + Math.sin(0.36);
  return {
    armLeft: [0.0045 * sway, 0.005 * breath, -0.006 * breath],
    armRight: [-0.004 * sway, -0.005 * breath, 0.006 * breath],
    legLeft: [0.0035 * sway, -0.006 * sway, 0.010 * ankleFollow],
    legRight: [-0.0035 * sway, 0.006 * sway, -0.010 * ankleFollow],
  };
}
export function composeJoints(time = 0, strength = 1, contributions = [], override = null) {
  const intensity = Number.isFinite(strength) ? Math.max(0, Math.min(1.5, strength)) : 0;
  const values = idle(Number.isFinite(time) ? time : 0);
  for (const name of Object.keys(values)) values[name] = values[name].map(value => value * intensity);
  for (const part of contributions) {
    const profile = REACTIONS[part.zone];
    if (!profile) continue;
    const variant = variantFor(part.variant);
    const amounts = [part.amount, part.followAmount ?? part.amount, part.lateAmount ?? part.followAmount ?? part.amount]
      .map(amount => finiteUnit(amount) * variant.scale * variant.direction * intensity);
    for (const [name, channel] of Object.entries(profile)) {
      for (let i = 0; i < 3; i++) values[name][i] += channel[i] * amounts[i];
    }
  }
  const result = {};
  for (const [name, def] of Object.entries(LIMBS)) {
    result[name] = {};
    for (let i = 0; i < 3; i++) {
      const key = def.names[i];
      const value = override === null ? values[name][i] : override[name]?.[key] ?? 0;
      result[name][key] = clamp(Number.isFinite(value) ? value : 0, def.limits[i]) || 0;
    }
  }
  return result;
}
