// Bounded V3-style smooth influence fields. Values are unique to the yoga
// balance pose; independently skinned limbs receive their own joint channels.
import { motionWeights } from './animation/idle-controller.js';
import { finiteUnit, clamp } from './animation/controller-utils.js';
import { variantFor } from './animation/profiles.js';

const REACTIONS = Object.freeze({
  head: { hair: 4, torso: -0.6 }, hair: { hair: 9, torso: -0.5 },
  face: { hair: 2, torso: -1 }, shoulderLeft: { hair: 3, torso: -2 },
  shoulderRight: { hair: -2, torso: -2 }, armLeft: { torso: -1, waist: 1 },
  armRight: { torso: 1, waist: -1 }, handLeft: { hair: 2 }, handRight: { hair: -2 },
  upperTorso: { torso: -4, cloth: 1.5 }, waist: { waist: 5, cloth: 2.4 },
  legLeft: { waist: -2, cloth: 1.5 }, legRight: { waist: 2, cloth: -1.5 },
});
export function composeYogaReaction(contributions = [], strength = 1) {
  const result = { hair: 0, torso: 0, waist: 0, cloth: 0 };
  const intensity = Number.isFinite(strength) ? Math.max(0, Math.min(1.5, strength)) : 0;
  for (const part of contributions) {
    const profile = REACTIONS[part.zone];
    if (!profile) continue;
    const variant = variantFor(part.variant);
    for (const [key, value] of Object.entries(profile)) {
      const delayed = key === 'hair' || key === 'cloth';
      result[key] += value * finiteUnit(delayed ? part.followAmount ?? part.amount : part.amount)
        * variant.scale * variant.direction * intensity;
    }
  }
  for (const key of Object.keys(result)) result[key] = clamp(result[key], key === 'hair' ? 12 : 7);
  return result;
}
export function applyYogaReaction(w, pose, result = [0, 0]) {
  result[0] = w.hair * pose.hair + w.waist * pose.waist + w.cloth * pose.cloth;
  result[1] = w.torso * pose.torso + w.hair * pose.hair * 0.12 - w.cloth * Math.abs(pose.cloth) * 0.12;
  return result;
}
export function reactionWeights(x, y) { return motionWeights(x, y); }
