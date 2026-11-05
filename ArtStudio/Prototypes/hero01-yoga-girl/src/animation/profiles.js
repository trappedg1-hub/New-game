// Yoga-specific reaction variation. V3's envelope/state machine is reused;
// these timings and directions are tailored to the planted hands/knees pose.
export const PHYSICAL_VARIANTS = Object.freeze([
  Object.freeze({ direction: 1, scale: 0.78, timing: 1.12 }),
  Object.freeze({ direction: -1, scale: 0.90, timing: 1.20 }),
  Object.freeze({ direction: 1, scale: 1.00, timing: 1.28 }),
]);
export function variantFor(index = 0) {
  return PHYSICAL_VARIANTS[((Number.isInteger(index) ? index : 0) % PHYSICAL_VARIANTS.length + PHYSICAL_VARIANTS.length) % PHYSICAL_VARIANTS.length];
}
