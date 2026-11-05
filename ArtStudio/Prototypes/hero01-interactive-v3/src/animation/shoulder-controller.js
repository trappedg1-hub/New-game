import { addVector } from './controller-utils.js';
export function accumulateShoulders(pose, profile, factor, direction) {
  addVector(pose.shoulderLeft, profile.shoulderLeft, factor, direction);
  addVector(pose.shoulderRight, profile.shoulderRight, factor, direction);
}
