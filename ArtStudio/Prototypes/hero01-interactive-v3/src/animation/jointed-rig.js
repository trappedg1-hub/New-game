// Experimental source-derived 2D skinning. Each limb has its own continuous
// transparent texture and a real three-joint FK chain. Linear blend weights
// around the middle and distal joints avoid rigidly hinged paper cutouts.
// Coordinates and directions are in the approved 1184 × 3488 source space.
import { variantFor } from './profiles.js';
import { clamp, finiteUnit } from './controller-utils.js';

const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const pt = (x, y) => Object.freeze({ x, y });
export const LIMBS = Object.freeze({
  raised: Object.freeze({
    root: pt(292, 940), middle: pt(355, 1110), end: pt(405, 650),
    names: ['shoulder', 'elbow', 'wrist'], limits: [0.025, 0.030, 0.030],
  }),
  lowered: Object.freeze({
    root: pt(880, 1050), middle: pt(910, 1250), end: pt(1010, 1700),
    names: ['shoulder', 'elbow', 'wrist'], limits: [0.022, 0.026, 0.035],
  }),
  frontLeg: Object.freeze({
    root: pt(425, 1870), middle: pt(515, 2390), end: pt(425, 3230),
    names: ['hip', 'knee', 'ankle'], limits: [0.012, 0.015, 0.018],
  }),
  backLeg: Object.freeze({
    root: pt(690, 1870), middle: pt(650, 2390), end: pt(565, 3230),
    names: ['hip', 'knee', 'ankle'], limits: [0.012, 0.015, 0.018],
  }),
});

// Weights follow the painted limb, not an arbitrary rectangular cell. Near
// the cuff and the cut under the skirt they taper to the unmoved body, hiding
// root seams. The occluded part of the lowered arm is necessarily inferred.
export function limbWeights(name, x, y) {
  let root, middle, end;
  if (name === 'raised') {
    root = smooth(20, 165, Math.hypot(x - 292, y - 940));
    middle = 1 - smooth(970, 1130, y);
    end = 1 - smooth(590, 690, y);
  } else if (name === 'lowered') {
    root = smooth(1048, 1160, y);
    // The forearm is hidden by the skirt before the hand reappears. Fade
    // continuously to the skirt and back out at the cuff (never a step).
    root *= 1 - smooth(1490, 1600, y) + smooth(1660, 1740, y);
    middle = smooth(1150, 1350, y);
    end = smooth(1665, 1750, y);
  } else if (name === 'frontLeg' || name === 'backLeg') {
    root = smooth(1880, 2040, y);
    middle = smooth(2280, 2500, y);
    end = smooth(3130, 3290, y);
  } else throw new Error(`Unknown limb ${name}`);
  return { root, middle, end: Math.min(middle, end) };
}

// Matrices use x'=a*x+c*y+tx, y'=b*x+d*y+ty.
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

// Profile values are radians: shoulder/hip first, elbow/knee second,
// wrist/ankle third. The latter channels use the existing delayed envelopes.
const REACTIONS = {
  shoulderLeft:  { raised: [-0.013, 0.007, -0.004] },
  shoulderRight: { lowered: [0.013, -0.007, 0.004] },
  armLeft:       { raised: [0.013, 0.014, -0.010] },
  armRight:      { lowered: [-0.012, -0.014, 0.013] },
  handLeft:      { raised: [0.003, 0.008, 0.022] },
  handRight:     { lowered: [-0.004, -0.008, -0.028] },
  upperTorso:    { raised: [0.005, 0.004, -0.003], lowered: [-0.005, -0.004, 0.003] },
  waist:         { frontLeg: [0.004, 0.005, -0.003], backLeg: [-0.004, -0.005, 0.003] },
  legLeft:       { frontLeg: [0.007, 0.010, -0.009] },
  legRight:      { backLeg: [-0.007, -0.010, 0.009] },
};
function idle(time) {
  // Every channel starts at zero so the rest-frame comparison remains useful.
  // Different frequencies give independently readable, non-mechanical motion.
  return {
    raised: [0.009 * Math.sin(time * 0.58), 0.012 * Math.sin(time * 0.71), -0.009 * Math.sin(time * 0.83)],
    lowered: [-0.011 * Math.sin(time * 0.49), -0.010 * Math.sin(time * 0.64), 0.012 * Math.sin(time * 0.79)],
    frontLeg: [0.004 * Math.sin(time * 0.41), 0.009 * Math.sin(time * 0.54), -0.006 * Math.sin(time * 0.68)],
    backLeg: [-0.004 * Math.sin(time * 0.38), -0.008 * Math.sin(time * 0.51), 0.006 * Math.sin(time * 0.65)],
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
      // QA-only overrides isolate one joint at a time; normal UI never sends
      // this parameter. Missing channels are zero rather than idle values.
      const candidate = override === null ? values[name][i] : override[name]?.[key] ?? 0;
      result[name][key] = clamp(Number.isFinite(candidate) ? candidate : 0, def.limits[i]) || 0;
    }
  }
  return result;
}
