// Source-pixel amplitudes for one original, flat illustration. These are
// bounded, reversible 2D pose approximations, not independently drawn bones.
// Each profile coordinates compatible parts; y components do not flip sign.
export const PHYSICAL_PROFILES = Object.freeze({
  head:          { head: [9, -2.5, 0.021, 0.007], hair: [-8, 10], torso: [1.4, -0.7], cloth: 1.0 },
  hair:          { head: [-5, 0.5, -0.012, -0.002], hair: [-14, 14], shoulderLeft: [-1, -2], shoulderRight: [1, -2], cloth: 1.0 },
  face:          { head: [-7, 2.0, -0.016, -0.005], hair: [-4, 5], torso: [1, 0.8] },
  shoulderLeft:  { head: [2.5, -0.6, 0.006], hair: [-7, 2], shoulderLeft: [-6, -10], shoulderRight: [1, -1.5], armLeft: [-3, -3], torso: [2, -2], cloth: 1.4 },
  shoulderRight: { head: [-2.5, -0.6, -0.006], hair: [-2, 7], shoulderLeft: [-1, -1.5], shoulderRight: [6, -10], armRight: [3, -3], torso: [-2, -2], cloth: -1.4 },
  armLeft:       { head: [2, -0.5, 0.005], hair: [-4, 2], shoulderLeft: [-3, -5], armLeft: [-12, -3], torso: [2, -0.8], cloth: 1.3 },
  armRight:      { head: [-2, -0.5, -0.005], hair: [-2, 4], shoulderRight: [3, -5], armRight: [12, -2], handRight: [6, 0.5], torso: [-2, -0.8], cloth: -1.3 },
  handLeft:      { head: [4, 0.8, 0.009, 0.003], hair: [-3, 2], shoulderLeft: [3, -5], armLeft: [8, -2], torso: [1, -0.5] },
  handRight:     { head: [-1.5, 0, -0.004], hair: [-1, 3], shoulderRight: [2, -2], armRight: [6, -1.5], handRight: [13, -2], torso: [-1, 0], cloth: -1 },
  upperTorso:    { head: [-2, 1, -0.006], hair: [-3, 3], shoulderLeft: [2, -3], shoulderRight: [-2, -3], torso: [-5, -6], waist: [2, 1], cloth: 2 },
  waist:         { head: [2, 0.5, 0.006], hair: [-3, 4], torso: [-5, 1], waist: [-11, 1.5], cloth: 4 },
  legLeft:       { head: [-2, 0, -0.004], hair: [-2, 2], torso: [-2, 0], waist: [4, 1], legLeft: [-12, -1], cloth: 2.3 },
  legRight:      { head: [2, 0, 0.004], hair: [-2, 2], torso: [2, 0], waist: [-4, 1], legRight: [12, -1], cloth: -2.3 },
});

// Deterministic cycle: no random jumps, while amplitude, direction and timing
// vary independently of the unchanged V3 expression selection.
export const PHYSICAL_VARIANTS = Object.freeze([
  Object.freeze({ direction: 1, scale: 0.86, timing: 0.92 }),
  Object.freeze({ direction: -1, scale: 1.0, timing: 1.05 }),
  Object.freeze({ direction: 1, scale: 1.13, timing: 1.16 }),
]);

export function variantFor(index = 0) {
  return PHYSICAL_VARIANTS[((Number.isInteger(index) ? index : 0) % PHYSICAL_VARIANTS.length + PHYSICAL_VARIANTS.length) % PHYSICAL_VARIANTS.length];
}
