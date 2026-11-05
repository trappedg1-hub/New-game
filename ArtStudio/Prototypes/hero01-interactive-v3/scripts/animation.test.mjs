import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES } from '../src/zones.js';
import { ReactionController, STATES } from '../src/reactions.js';
import { PHYSICAL_PROFILES } from '../src/animation/profiles.js';
import { composeReactionPose } from '../src/animation/reaction-pose.js';
import { HEAD_PIVOT } from '../src/animation/head-controller.js';
import { buildReactionWeights, applyReactionPose, reactionOffset } from '../src/reaction-motion.js';
import { deformedPoint } from '../src/pixi-hitboxes.js';
import { motionWeights, motionOffset, motionPhases } from '../src/animation/idle-controller.js';

const W = 1184, H = 3488, COLS = 51, ROWS = 149;
const physicalPoints = {
  head: [550, 120], hair: [200, 1120], face: [560, 410],
  shoulderLeft: [370, 700], shoulderRight: [835, 700],
  armLeft: [330, 1000], armRight: [905, 1320],
  handLeft: [500, 565], handRight: [1060, 1795],
  upperTorso: [600, 900], waist: [600, 1200],
  legLeft: [460, 2400], legRight: [685, 2400],
};

const displacement = (x, y, parts, strength = 1) => reactionOffset(buildReactionWeights(x, y), parts, strength);

test('all 13 physical profiles move their intended area and have three controlled variants', () => {
  const ids = ZONES.map(z => z.id);
  assert.deepEqual(new Set(Object.keys(PHYSICAL_PROFILES)), new Set(ids));
  assert.deepEqual(new Set(Object.keys(physicalPoints)), new Set(ids));
  for (const id of ids) {
    const [x, y] = physicalPoints[id];
    const poses = [0, 1, 2].map(variant => displacement(x, y, [{ zone: id, amount: 1, variant }]));
    for (const d of poses) assert.ok(Math.hypot(d.x, d.y) > 1, `${id}: ${JSON.stringify(d)}`);
    assert.notDeepEqual(poses[0], poses[1], id);
    assert.notDeepEqual(poses[0], poses[2], id);
    assert.deepEqual(displacement(x, y, [{ zone: id, amount: 1 }], 0), { x: 0, y: 0 });
  }
  const approach = composeReactionPose([{ zone: 'head', amount: 1, variant: 0 }]);
  const retreat = composeReactionPose([{ zone: 'head', amount: 1, variant: 1 }]);
  assert.ok(approach.head.scale > 1 && retreat.head.scale < 1, 'head variants should suggest approach and retreat');
  const r = new ReactionController();
  assert.deepEqual([0, 3, 6, 9].map(time => r.trigger('head', time).variant), [0, 1, 2, 0]);
});

test('secondary hair lags the main reaction, interruptions remain continuous and states recover', () => {
  const r = new ReactionController();
  r.trigger('head', 0);
  const early = r.sample(0.08).contributions[0];
  assert.ok(early.amount > 0 && early.followAmount === 0 && early.lateAmount === 0);
  const following = r.sample(0.16).contributions[0];
  assert.ok(following.amount > following.followAmount && following.followAmount > 0 && following.lateAmount === 0);
  const later = r.sample(0.3).contributions[0];
  assert.ok(later.followAmount > later.lateAmount && later.lateAmount > 0);
  const before = r.sample(0.4);
  r.trigger('legLeft', 0.4);
  const after = r.sample(0.4);
  assert.equal(after.state, STATES.REACTION_TRANSITION);
  for (const [x, y] of [[550, 120], [200, 1120], [460, 2400], [600, 900]]) {
    const a = displacement(x, y, before.contributions, 1.5), b = displacement(x, y, after.contributions, 1.5);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-9, `interruption jumped at ${x},${y}`);
  }
  assert.equal(r.sample(0.6).state, STATES.TOUCH_REACTION);
  assert.equal(r.sample(2).state, STATES.RETURN_TO_IDLE);
  assert.equal(r.sample(3).state, STATES.IDLE);
  assert.deepEqual(r.sample(3).contributions, []);
});

test('rapid overlapping inputs stay smooth, bounded and never queue stale targets', () => {
  const r = new ReactionController();
  const order = ['head', 'hair', 'legLeft', 'handRight', 'face', 'waist', 'armRight'];
  let previous = null, worstJump = 0;
  for (let frame = 0; frame <= 240; frame++) {
    const time = frame / 60;
    if (frame % 7 === 0 && frame < 210) assert.ok(r.trigger(order[(frame / 7) % order.length], time));
    const result = r.sample(time);
    assert.ok(result.contributions.length <= 3);
    for (const part of result.contributions) for (const n of ['amount', 'followAmount', 'lateAmount']) assert.ok(part[n] >= 0 && part[n] <= 1);
    const current = [[550, 120], [200, 1120], [460, 2400], [600, 900]].map(([x, y]) => displacement(x, y, result.contributions, 1.5));
    if (previous) for (let i = 0; i < current.length; i++) worstJump = Math.max(worstJump, Math.hypot(current[i].x - previous[i].x, current[i].y - previous[i].y));
    previous = current;
  }
  assert.ok(worstJump < 6, `successive 60 fps samples moved ${worstJump} source pixels`);
  assert.equal(r.sample(8).state, STATES.IDLE);
  assert.deepEqual(r.sample(8).contributions, []);
});

test('moving head mesh and existing blink/expression overlay use the same rigid transform', () => {
  for (const zone of ['head', 'face', 'hair', 'handLeft']) for (const variant of [0, 1, 2]) {
    const pose = composeReactionPose([{ zone, amount: 1, variant }], 1.5);
    const points = new Float32Array(COLS * ROWS * 2);
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const x = col * W / (COLS - 1), y = row * H / (ROWS - 1), i = (row * COLS + col) * 2;
      const base = motionOffset(motionWeights(x, y), motionPhases(2.7), 1.5);
      const extra = applyReactionPose(buildReactionWeights(x, y), pose);
      points[i] = x + base[0] + extra.x; points[i + 1] = y + base[1] + extra.y;
    }
    // Rectangle contains both eye sprites, all V3 mouths, cheek and sleepy layers.
    for (let y = 280; y <= 495; y += 13) for (let x = 395; x <= 715; x += 13) {
      const mesh = deformedPoint(x, y, points, COLS, ROWS, W, H);
      const dx = x - HEAD_PIVOT.x, dy = y - HEAD_PIVOT.y, h = pose.head;
      const overlayX = HEAD_PIVOT.x + dx * h.cos - dy * h.sin + h.x;
      const overlayY = HEAD_PIVOT.y + dx * h.sin + dy * h.cos + h.y;
      assert.ok(Math.hypot(mesh.x - overlayX, mesh.y - overlayY) < 0.001, `${zone}/${variant} at ${x},${y}`);
    }
  }
});

test('idle breathing continues independently during a reaction', () => {
  const x = 600, y = 900, pose = composeReactionPose([{ zone: 'upperTorso', amount: 1 }], 1);
  const extra = applyReactionPose(buildReactionWeights(x, y), pose);
  const a = motionOffset(motionWeights(x, y), motionPhases(0), 1);
  const b = motionOffset(motionWeights(x, y), motionPhases(1.2), 1);
  assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) > 2);
  assert.ok(Math.abs(((b[1] + extra.y) - (a[1] + extra.y)) - (b[1] - a[1])) < 1e-12);
});

test('all three-way maximum-intensity zone combinations preserve body-plane orientation and floor anchors', () => {
  const ids = ZONES.map(zone => zone.id), weights = [], base = [], phases = motionPhases(1.2);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const x = col * W / (COLS - 1), y = row * H / (ROWS - 1);
    const idle = motionOffset(motionWeights(x, y), phases, 1.5);
    weights.push(buildReactionWeights(x, y)); base.push(x + idle[0], y + idle[1]);
  }
  const points = new Float64Array(COLS * ROWS * 2);
  let minCross = Infinity, maxDisplacement = 0, combinations = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i; j < ids.length; j++) for (let k = j; k < ids.length; k++) for (const variant of [0, 1, 2]) {
    const pose = composeReactionPose([ids[i], ids[j], ids[k]].map(zone => ({ zone, amount: 1, variant })), 1.5);
    for (let n = 0; n < weights.length; n++) {
      const d = applyReactionPose(weights[n], pose), x = (n % COLS) * W / (COLS - 1), y = Math.floor(n / COLS) * H / (ROWS - 1);
      points[n * 2] = base[n * 2] + d.x; points[n * 2 + 1] = base[n * 2 + 1] + d.y;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(points[n * 2] - x, points[n * 2 + 1] - y));
      if (y >= 3300) assert.equal(Math.hypot(d.x, d.y), 0);
    }
    const cross = (a, b, c) => (points[b] - points[a]) * (points[c + 1] - points[a + 1]) - (points[b + 1] - points[a + 1]) * (points[c] - points[a]);
    for (let row = 0; row < ROWS - 1; row++) for (let col = 0; col < COLS - 1; col++) {
      const a = (row * COLS + col) * 2, b = a + 2, c = a + COLS * 2, d = c + 2;
      minCross = Math.min(minCross, cross(a, b, c), cross(b, d, c));
    }
    combinations++;
  }
  assert.equal(combinations, 1365);
  assert.ok(minCross > 300, `minimum oriented triangle cross-product: ${minCross}`);
  assert.ok(maxDisplacement < 48, `maximum combined displacement: ${maxDisplacement}`);
  console.log(`  1365 stress poses: min triangle cross ${minCross.toFixed(2)}, max source displacement ${maxDisplacement.toFixed(2)} px`);
});
