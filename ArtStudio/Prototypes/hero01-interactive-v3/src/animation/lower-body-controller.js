import { addVector } from './controller-utils.js';
// Body-plane weight-shift fields fade above the floor. The separate leg skins
// follow their own hip/knee/ankle chains in jointed-rig.js.
export function accumulateLowerBody(pose, profile, factor, direction) {
  addVector(pose.legLeft, profile.legLeft, factor, direction);
  addVector(pose.legRight, profile.legRight, factor, direction);
}
