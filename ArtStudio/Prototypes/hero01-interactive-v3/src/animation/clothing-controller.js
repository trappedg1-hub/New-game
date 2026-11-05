export function accumulateClothing(pose, profile, follow, direction) {
  if (profile.cloth) pose.cloth += profile.cloth * follow * direction;
}
