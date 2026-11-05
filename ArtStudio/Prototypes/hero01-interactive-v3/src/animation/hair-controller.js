// Two broad, anchored regions of the original illustration follow later than
// the leading motion. They are not separately drawn, free-flying hair strands.
export function accumulateHair(pose, profile, follow, late, direction) {
  if (!profile.hair) return;
  pose.hair.left += profile.hair[0] * follow * direction;
  pose.hair.right += profile.hair[1] * follow * direction;
  pose.hair.leftTip += profile.hair[0] * late * direction * 0.34;
  pose.hair.rightTip += profile.hair[1] * late * direction * 0.34;
}
