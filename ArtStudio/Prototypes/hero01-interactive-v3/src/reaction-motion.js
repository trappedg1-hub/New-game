// Additive deformation of the same V1 plane, never a claim of separate bones.
// The approved face and the flat artwork below y=1950 are deliberately fixed.
const bell = (value, center, radius) => Math.exp(-0.5 * ((value - center) / radius) ** 2);
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function buildReactionWeights(x, y) {
  const safe = smooth((y - 610) / 90) * (1 - smooth((y - 1750) / 200));
  const spot = (cx, cy, rx, ry) => safe * bell(x, cx, rx) * bell(y, cy, ry);
  return {
    hair: safe * (bell(x, 205, 130) + bell(x, 1010, 130)) * bell(y, 1150, 350),
    shoulderLeft: spot(365, 700, 110, 120),
    shoulderRight: spot(830, 700, 110, 120),
    armLeft: spot(335, 970, 105, 200),
    armRight: spot(890, 1230, 100, 220),
    upperTorso: spot(590, 900, 235, 145),
    waist: spot(590, 1210, 225, 150),
  };
}

const DIRECTIONS = Object.freeze({
  hair: [7.0, 1.4],
  shoulderLeft: [-2.8, -4.2], shoulderRight: [2.8, -4.2],
  armLeft: [-4.5, -1.6], armRight: [4.5, -1.6],
  upperTorso: [1.8, -3.2], waist: [-4.4, 1.6],
});

export function reactionOffset(weights, contributions, strength = 1, result = { x: 0, y: 0 }) {
  let x = 0, y = 0;
  for (const part of contributions) {
    const direction = DIRECTIONS[part.zone];
    if (!direction) continue; // face, hands and legs respond with expression only
    const weight = (weights[part.zone] || 0) * Math.max(0, Math.min(1, part.amount));
    x += direction[0] * weight;
    y += direction[1] * weight;
  }
  // Even several rapid taps cannot accumulate unbounded mesh distortion.
  const scale = Math.max(0, Math.min(1.5, strength));
  result.x = Math.max(-8, Math.min(8, x)) * scale || 0;
  result.y = Math.max(-5, Math.min(5, y)) * scale || 0;
  return result;
}
