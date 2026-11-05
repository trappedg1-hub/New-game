import { addVector } from './controller-utils.js';
// Bounded fields coordinate the body/sleeve underpaint. The independent
// shoulder/elbow/wrist chains are composed separately in jointed-rig.js.
export function accumulateArms(pose, profile, factor, direction) {
  addVector(pose.armLeft, profile.armLeft, factor, direction);
  addVector(pose.armRight, profile.armRight, factor, direction);
  addVector(pose.handRight, profile.handRight, factor, direction);
}
