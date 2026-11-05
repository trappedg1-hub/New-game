import { addVector } from './controller-utils.js';
// The raised hand is baked over the face, so its cue is shared with the
// upper arm/head. Only the lowered hand has a local, bounded mesh cue.
export function accumulateArms(pose, profile, factor, direction) {
  addVector(pose.armLeft, profile.armLeft, factor, direction);
  addVector(pose.armRight, profile.armRight, factor, direction);
  addVector(pose.handRight, profile.handRight, factor, direction);
}
