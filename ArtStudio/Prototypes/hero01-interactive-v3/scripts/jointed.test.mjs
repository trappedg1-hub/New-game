import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { composeJoints, jointMatrices, limbWeights, LIMBS, skinPoint } from '../src/animation/jointed-rig.js';
import { ReactionController, STATES } from '../src/reactions.js';

const zero = composeJoints(0, 1, [], {});
const shift = (name, angles, [x, y]) => {
  const point = skinPoint(x, y, limbWeights(name, x, y), jointMatrices(name, angles));
  return Math.hypot(point.x - x, point.y - y);
};
const withJoint = (name, joint, amount = 0.01) => composeJoints(0, 0, [], { [name]: { [joint]: amount } });

// These are 12 distinct controls, not a single full-character displacement.
// Proximal anchors must stay put when a distal joint bends; descendants move.
test('every arm/leg joint moves only its chain and distal segments follow', () => {
  const samples = {
    raised: { shoulder: [[350, 1120], [580, 500]], elbow: [[350, 1150], [430, 710]], wrist: [[430, 710], [585, 500]] },
    lowered: { shoulder: [[880, 1050], [1090, 1870]], elbow: [[895, 1120], [1090, 1870]], wrist: [[910, 1250], [1130, 1930]] },
    frontLeg: { hip: [[425, 1880], [515, 2390]], knee: [[425, 2090], [425, 3350]], ankle: [[515, 2390], [490, 3410]] },
    backLeg: { hip: [[690, 1880], [650, 2390]], knee: [[690, 2090], [565, 3350]], ankle: [[650, 2390], [630, 3410]] },
  };
  for (const [name, joints] of Object.entries(samples)) {
    for (const [joint, [upstream, downstream]] of Object.entries(joints)) {
      const pose = withJoint(name, joint, 0.012);
      for (const other of Object.keys(LIMBS).filter(value => value !== name)) assert.deepEqual(pose[other], zero[other], `${name}/${joint} leaked to ${other}`);
      const upperShift = shift(name, pose[name], upstream), lowerShift = shift(name, pose[name], downstream);
      if (joint !== 'shoulder' && joint !== 'hip') assert.ok(upperShift < 0.12, `${name}/${joint}: upstream moved ${upperShift}`);
      assert.ok(lowerShift > 0.5, `${name}/${joint}: descendant moved only ${lowerShift}`);
    }
  }
});

test('FK retains chain hierarchy; idle moves left and right separately and strength zero is neutral', () => {
  const frames = [0, 0.8, 2, 3.5, 6].map(time => composeJoints(time, 1));
  for (const [name, def] of Object.entries(LIMBS)) {
    for (const joint of def.names) assert.ok(frames.some(frame => Math.abs(frame[name][joint]) > 0.001), `${name}/${joint} idle`);
    for (const time of [0, 1, 2, 5]) assert.deepEqual(composeJoints(time, 0)[name], zero[name]);
  }
  assert.notDeepEqual(frames[2].raised, frames[2].lowered);
  assert.notDeepEqual(frames[2].frontLeg, frames[2].backLeg);
  for (const name of Object.keys(LIMBS)) {
    const tip = name === 'raised' ? [580, 500] : name === 'lowered' ? [1100, 1900]
      : name === 'frontLeg' ? [430, 3390] : [560, 3390];
    assert.ok(shift(name, frames[2][name], tip) > 2, `${name} tip did not follow idle`);
  }
});

test('bounded FK remains finite and does not flip triangles at extreme joint settings', () => {
  const boxes = { raised: [270, 475, 625, 1210], lowered: [806, 1046, 1175, 1967],
    frontLeg: [202, 1858, 627, 3488], backLeg: [457, 1858, 898, 3488] };
  let minCross = Infinity, maxMove = 0, samples = 0;
  for (const [name, def] of Object.entries(LIMBS)) {
    const [x0, y0, x1, y1] = boxes[name], dx = 20, dy = 20;
    for (let bits = 0; bits < 8; bits++) {
      const override = Object.fromEntries(def.names.map((key, i) => [key, def.limits[i] * (bits & (1 << i) ? 1 : -1)]));
      const pose = composeJoints(0, 0, [], { [name]: override });
      const matrices = jointMatrices(name, pose[name]);
      const map = (x, y) => skinPoint(x, y, limbWeights(name, x, y), matrices);
      const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      for (let y = y0; y + dy <= y1; y += dy) for (let x = x0; x + dx <= x1; x += dx) {
        const a = map(x, y), b = map(x + dx, y), c = map(x, y + dy), d = map(x + dx, y + dy);
        minCross = Math.min(minCross, cross(a, b, c), cross(b, d, c));
        maxMove = Math.max(maxMove, Math.hypot(a.x - x, a.y - y));
        samples++;
      }
    }
  }
  assert.ok(minCross > 250, `folded limb cell: ${minCross}`);
  assert.ok(maxMove < 60, `joint displacement too large: ${maxMove}`);
  console.log(`  ${samples} extreme skin cells: min cross ${minCross.toFixed(2)}, max displacement ${maxMove.toFixed(2)} px`);
});

test('joint reactions use delayed channels, remain continuous through interruptions and return to idle', () => {
  const controller = new ReactionController();
  const zones = ['armLeft', 'legRight', 'handRight', 'armRight', 'legLeft', 'handLeft'];
  let previous = null, worst = 0;
  for (let frame = 0; frame <= 240; frame++) {
    const time = frame / 60;
    if (frame % 9 === 0 && frame < 170) controller.trigger(zones[(frame / 9) % zones.length], time);
    const result = controller.sample(time);
    const pose = composeJoints(time, 1.5, result.contributions);
    if (previous) for (const [name, def] of Object.entries(LIMBS)) for (const joint of def.names) {
      worst = Math.max(worst, Math.abs(pose[name][joint] - previous[name][joint]));
      assert.ok(Math.abs(pose[name][joint]) <= def.limits[def.names.indexOf(joint)] + 1e-12);
    }
    previous = pose;
  }
  assert.ok(worst < 0.012, `successive joint frame jumped ${worst} radians`);
  assert.equal(controller.sample(9).state, STATES.IDLE);
  assert.deepEqual(composeJoints(9, 1, controller.sample(9).contributions), composeJoints(9, 1));
  console.log(`  worst successive interrupted joint step ${worst.toFixed(5)} rad`);
});

test('derivative metadata matches source, independent transparent crops and safe dimensions', async () => {
  const base = new URL('../public/derived/jointed/', import.meta.url);
  const meta = JSON.parse(await readFile(new URL('jointed.json', base)));
  assert.deepEqual(meta.size, [1184, 3488]);
  assert.equal(meta.source_sha256, '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd');
  assert.deepEqual(Object.keys(meta.layers), ['leg_back', 'leg_front', 'leg_back_foot', 'arm_down', 'arm_raised']);
  const body = await readFile(new URL(meta.body, base));
  assert.equal(body.readUInt32BE(16), 1184); assert.equal(body.readUInt32BE(20), 3488);
  for (const layer of Object.values(meta.layers)) {
    assert.match(layer.file, /^[a-z_]+\.png$/);
    const data = await readFile(new URL(layer.file, base));
    const [x, y, width, height] = layer.box;
    assert.equal(data.readUInt32BE(16), width); assert.equal(data.readUInt32BE(20), height);
    assert.equal(data[25], 6, 'source-derived layer must be RGBA');
    assert.ok(x >= 0 && y >= 0 && x + width <= 1184 && y + height <= 3488);
  }
  const approved = await readFile(new URL('../../../Generated/Approved/HERO-01_outfit02_playful_maid.png', import.meta.url));
  assert.equal(createHash('sha256').update(approved).digest('hex'), meta.source_sha256);
});
