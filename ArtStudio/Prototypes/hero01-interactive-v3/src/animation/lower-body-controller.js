import { addVector } from './controller-utils.js';
// Weight shifts are intentionally modest and fade before the shoes. They do
// not claim a separated hip, knee or ankle joint in the flattened artwork.
export function accumulateLowerBody(pose, profile, factor, direction) {
  addVector(pose.legLeft, profile.legLeft, factor, direction);
  addVector(pose.legRight, profile.legRight, factor, direction);
}
