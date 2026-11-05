// The face, blink layers and underlying head pixels share one transform.
// A 2D tilt/sideways translation approximates a turn; tiny uniform scaling
// suggests approach or retreat. Neither is a real 3D head movement.
export const HEAD_PIVOT = Object.freeze({ x: 590, y: 600 });
export function accumulateHead(pose, profile, factor, direction) {
  if (!profile.head) return;
  pose.head.x += profile.head[0] * factor * direction;
  pose.head.y += profile.head[1] * factor;
  pose.head.rotation += profile.head[2] * factor * direction;
  pose.head.scaleDelta += (profile.head[3] || 0) * factor * direction;
}
