import { addVector } from './controller-utils.js';
export function accumulateTorso(pose, profile, factor, direction) {
  addVector(pose.torso, profile.torso, factor, direction);
  addVector(pose.waist, profile.waist, factor, direction);
}
