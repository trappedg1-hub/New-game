import * as PIXI from 'pixi.js';
import { ZONES } from './zones.js';

// Interpolate the actual two triangles Pixi's PlaneGeometry uses per cell.
// Source polygons therefore follow V1 and reaction deformations, and inherit
// the same responsive, zoom and root transforms as the painted character.
export function deformedPoint(x, y, positions, cols, rows, width, height) {
  const gridX = Math.max(0, Math.min(cols - 1, x / width * (cols - 1)));
  const gridY = Math.max(0, Math.min(rows - 1, y / height * (rows - 1)));
  const col = Math.min(cols - 2, Math.floor(gridX));
  const row = Math.min(rows - 2, Math.floor(gridY));
  const u = gridX - col, v = gridY - row;
  const a = (row * cols + col) * 2, b = a + 2, c = a + cols * 2, d = c + 2;
  let resultX, resultY;
  if (u + v <= 1) {
    resultX = positions[a] * (1 - u - v) + positions[b] * u + positions[c] * v;
    resultY = positions[a + 1] * (1 - u - v) + positions[b + 1] * u + positions[c + 1] * v;
  } else {
    resultX = positions[b] * (1 - v) + positions[c] * (1 - u) + positions[d] * (u + v - 1);
    resultY = positions[b + 1] * (1 - v) + positions[c + 1] * (1 - u) + positions[d + 1] * (u + v - 1);
  }
  return { x: resultX, y: resultY };
}

export function createHitboxes(parent, mesh, { cols, rows, width, height, debug, onTap }) {
  const container = new PIXI.Container();
  container.eventMode = 'passive';
  parent.addChild(container);
  const pending = new Map();
  let ignoreMouseUntil = 0;
  let multiTouch = false;
  const hitAreas = [];
  const ordered = [...ZONES].sort((a, b) => a.priority - b.priority);
  for (const zone of ordered) {
    for (const source of zone.polygons) {
      const graphic = new PIXI.Graphics();
      graphic.name = zone.id;
      const polygon = new PIXI.Polygon([...source]);
      graphic.hitArea = polygon;
      graphic.eventMode = 'static';
      graphic.cursor = 'pointer';
      graphic.on('pointerdown', event => {
        // Only one active finger/pen/mouse contact at a time. All reaction
        // events originate on Pixi's actual zone, not a universal DOM box.
        const now = performance.now();
        if (event.pointerType === 'mouse' && now < ignoreMouseUntil) return;
        if (event.pointerType === 'touch') ignoreMouseUntil = now + 800;
        // A multi-finger gesture is never a tap, even if the first finger
        // stays still and is released over a valid zone.
        if (event.pointerType === 'touch' && (multiTouch || pending.size > 0)) {
          pending.clear();
          return;
        }
        if (pending.size > 0 || pending.has(event.pointerId)) return;
        pending.set(event.pointerId, { zone: zone.id, x: event.global.x, y: event.global.y, time: now });
        event.stopPropagation();
      });
      graphic.on('pointerup', event => {
        const start = pending.get(event.pointerId);
        pending.delete(event.pointerId);
        if (!start || start.zone !== zone.id) return;
        const distance = Math.hypot(event.global.x - start.x, event.global.y - start.y);
        if (distance <= 12 && performance.now() - start.time <= 900) onTap(zone.id, event.pointerType || 'unknown');
        event.stopPropagation();
      });
      graphic.on('pointerupoutside', event => pending.delete(event.pointerId));
      graphic.on('pointercancel', event => pending.delete(event.pointerId));
      container.addChild(graphic);
      hitAreas.push({ zone, source, polygon });
    }
  }
  // These native listeners only release pointer bookkeeping when the browser
  // cancels or releases outside the canvas; they never generate reactions.
  const release = event => pending.delete(event.pointerId);
  const startTouches = event => {
    if (event.touches.length > 1) { multiTouch = true; pending.clear(); }
  };
  const releaseTouches = event => {
    for (const touch of event.changedTouches || []) pending.delete(touch.identifier);
    if (event.touches.length === 0) multiTouch = false;
  };
  const clear = () => { pending.clear(); multiTouch = false; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('touchstart', startTouches, { passive: true });
  window.addEventListener('touchend', releaseTouches);
  window.addEventListener('touchcancel', releaseTouches);
  window.addEventListener('blur', clear);
  const outlines = debug ? new PIXI.Graphics() : null;
  if (outlines) {
    outlines.eventMode = 'none';
    parent.addChild(outlines);
  }
  function update() {
    const positions = mesh.buffer.data;
    if (outlines) outlines.clear();
    for (const area of hitAreas) {
      const points = area.polygon.points;
      for (let i = 0; i < area.source.length; i += 2) {
        const transformed = deformedPoint(area.source[i], area.source[i + 1], positions, cols, rows, width, height);
        points[i] = transformed.x; points[i + 1] = transformed.y;
      }
      if (outlines) {
        outlines.lineStyle(12, area.zone.color, 0.95).beginFill(area.zone.color, 0.12).drawPolygon(points).endFill();
      }
    }
  }
  function toLocal(x, y) {
    return deformedPoint(x, y, mesh.buffer.data, cols, rows, width, height);
  }
  function destroy() {
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
    window.removeEventListener('touchstart', startTouches);
    window.removeEventListener('touchend', releaseTouches);
    window.removeEventListener('touchcancel', releaseTouches);
    window.removeEventListener('blur', clear);
    pending.clear();
  }
  update();
  return { update, toLocal, destroy, pendingCount: () => pending.size };
}
