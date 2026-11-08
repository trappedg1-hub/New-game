export function addVector(target, values, factor, direction = 1) {
  if (!values) return;
  target.x += values[0] * factor * direction;
  target.y += values[1] * factor;
}
export const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
export const finiteUnit = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
