import { HEAD_PIVOT } from './animation/head-controller.js';
import { composeReactionPose } from './animation/reaction-pose.js';

// Smooth influence fields over the V1-derived underpaint plane. Independent
// transparent limb meshes add FK/skin deformation on top in pixi-jointed.js.
const bell = (value, center, radius) => Math.exp(-0.5 * ((value - center) / radius) ** 2);
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function buildReactionWeights(x, y) {
  // A wide border taper keeps the original raster's edges anchored without
  // concentrating a hair/arm displacement into one or two mesh cells.
  const edge = smooth(x / 155) * (1 - smooth((x - 1029) / 155));
  const belowFace = smooth((y - 560) / 145);
  const bodyBand = belowFace * (1 - smooth((y - 2020) / 280));
  const head = smooth((x - 175) / 155) * (1 - smooth((x - 855) / 150)) * (1 - smooth((y - 610) / 245));
  const spot = (cx, cy, rx, ry) => edge * bodyBand * bell(x, cx, rx) * bell(y, cy, ry);
  const hairBand = edge * belowFace * (1 - smooth((y - 1460) / 235));
  const hairLeft = hairBand * bell(x, 175, 130) * bell(y, 1120, 355);
  const hairRight = hairBand * bell(x, 1015, 130) * bell(y, 1120, 355);
  const legBand = edge * smooth((y - 1830) / 300) * (1 - smooth((y - 2950) / 350));
  return {
    x, y, head,
    hairLeft, hairRight,
    hairLeftTip: hairLeft * bell(x, 105, 90) * smooth((y - 930) / 500),
    hairRightTip: hairRight * bell(x, 1090, 90) * smooth((y - 930) / 500),
    shoulderLeft: spot(365, 700, 115, 125),
    shoulderRight: spot(840, 700, 115, 125),
    armLeft: spot(335, 960, 105, 205),
    armRight: spot(905, 1330, 105, 270),
    handRight: spot(1060, 1795, 95, 150),
    torso: spot(590, 900, 235, 155),
    waist: spot(590, 1220, 225, 160),
    legLeft: legBand * bell(x, 450, 155) * bell(y, 2400, 330),
    legRight: legBand * bell(x, 685, 155) * bell(y, 2400, 330),
    cloth: edge * belowFace * bell(x, 590, 410) * bell(y, 1610, 185)
      * smooth((y - 1190) / 210) * (1 - smooth((y - 1810) / 190)),
  };
}

// Apply one pre-composed pose to an individual mesh vertex. All amplitudes
// are bounded before this call; face overlays use the same rigid head matrix.
export function applyReactionPose(weights, pose, result = { x: 0, y: 0 }) {
  const relativeX = weights.x - HEAD_PIVOT.x, relativeY = weights.y - HEAD_PIVOT.y;
  let x = weights.head * ((pose.head.cos - 1) * relativeX - pose.head.sin * relativeY + pose.head.x);
  let y = weights.head * (pose.head.sin * relativeX + (pose.head.cos - 1) * relativeY + pose.head.y);
  for (const vector of pose.activeVectors) {
    const weight = weights[vector.name];
    x += weight * vector.x;
    y += weight * vector.y;
  }
  const hair = weights.hairLeft * pose.hair.left + weights.hairRight * pose.hair.right
    + weights.hairLeftTip * pose.hair.leftTip + weights.hairRightTip * pose.hair.rightTip;
  x += hair + weights.cloth * pose.cloth;
  y += hair * 0.13 - weights.cloth * Math.abs(pose.cloth) * 0.16;
  result.x = x || 0;
  result.y = y || 0;
  return result;
}

// Compatibility helper for tests and offline tools. The live renderer composes
// the pose only once per frame rather than allocating for every vertex.
export function reactionOffset(weights, contributions, strength = 1, result = { x: 0, y: 0 }) {
  return applyReactionPose(weights, composeReactionPose(contributions, strength), result);
}
