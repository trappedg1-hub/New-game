import { PHYSICAL_PROFILES, variantFor } from './profiles.js';
import { clamp, finiteUnit } from './controller-utils.js';
import { accumulateHead } from './head-controller.js';
import { accumulateHair } from './hair-controller.js';
import { accumulateShoulders } from './shoulder-controller.js';
import { accumulateArms } from './arm-controller.js';
import { accumulateTorso } from './torso-controller.js';
import { accumulateLowerBody } from './lower-body-controller.js';
import { accumulateClothing } from './clothing-controller.js';

const vector = () => ({ x: 0, y: 0 });
export function emptyPose() {
  return {
    head: { x: 0, y: 0, rotation: 0, scaleDelta: 0, scale: 1, cos: 1, sin: 0 },
    hair: { left: 0, right: 0, leftTip: 0, rightTip: 0 },
    shoulderLeft: vector(), shoulderRight: vector(), armLeft: vector(), armRight: vector(),
    handRight: vector(), torso: vector(), waist: vector(), legLeft: vector(), legRight: vector(), cloth: 0, activeVectors: [],
  };
}

// This is evaluated once per frame, not once per vertex. Compatible channels
// overlap; final limits protect artwork during rapid interrupted reactions.
export function composeReactionPose(contributions = [], strength = 1) {
  const pose = emptyPose();
  const intensity = Number.isFinite(strength) ? Math.max(0, Math.min(1.5, strength)) : 0;
  for (const part of contributions) {
    const profile = PHYSICAL_PROFILES[part.zone];
    if (!profile) continue;
    const variation = variantFor(part.variant);
    const factor = finiteUnit(part.amount) * variation.scale * intensity;
    const follow = finiteUnit(part.followAmount ?? part.amount) * variation.scale * intensity;
    const late = finiteUnit(part.lateAmount ?? part.followAmount ?? part.amount) * variation.scale * intensity;
    accumulateHead(pose, profile, factor, variation.direction);
    accumulateHair(pose, profile, follow, late, variation.direction);
    accumulateShoulders(pose, profile, factor, variation.direction);
    accumulateArms(pose, profile, factor, variation.direction);
    accumulateTorso(pose, profile, factor, variation.direction);
    accumulateLowerBody(pose, profile, factor, variation.direction);
    accumulateClothing(pose, profile, follow, variation.direction);
  }
  pose.head.x = clamp(pose.head.x, 15);
  pose.head.y = clamp(pose.head.y, 6);
  pose.head.rotation = clamp(pose.head.rotation, 0.035);
  pose.head.scaleDelta = clamp(pose.head.scaleDelta, 0.010);
  pose.head.scale = 1 + pose.head.scaleDelta;
  pose.head.cos = Math.cos(pose.head.rotation) * pose.head.scale;
  pose.head.sin = Math.sin(pose.head.rotation) * pose.head.scale;
  for (const name of ['shoulderLeft', 'shoulderRight', 'armLeft', 'armRight', 'handRight', 'torso', 'waist', 'legLeft', 'legRight']) {
    pose[name].x = clamp(pose[name].x, 16);
    pose[name].y = clamp(pose[name].y, 11);
  }
  for (const name of ['left', 'right']) pose.hair[name] = clamp(pose.hair[name], 14);
  for (const name of ['leftTip', 'rightTip']) pose.hair[name] = clamp(pose.hair[name], 6);
  pose.cloth = clamp(pose.cloth, 7);
  pose.activeVectors = ['shoulderLeft', 'shoulderRight', 'armLeft', 'armRight', 'handRight', 'torso', 'waist', 'legLeft', 'legRight']
    .filter(name => pose[name].x || pose[name].y).map(name => ({ name, x: pose[name].x, y: pose[name].y }));
  return pose;
}
