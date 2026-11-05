import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ZONES, ZONES_BY_ID, zoneAtSource, pointInPolygon } from '../src/zones.js';
import { COOLDOWN_SECONDS, EXPRESSIONS, STATES, ExpressionMixer, ReactionController } from '../src/reactions.js';
import { buildReactionWeights, reactionOffset } from '../src/reaction-motion.js';
import { SOURCE_HEIGHT as SOURCE_H, SOURCE_WIDTH as SOURCE_W, motionOffset, motionWeights, motionPhases } from '../src/rig.js';
const COLS = 51, ROWS = 149;

const samples = {
  head: [550, 120], hair: [320, 360], face: [560, 410],
  shoulderLeft: [370, 630], shoulderRight: [835, 680],
  armLeft: [330, 1000], armRight: [890, 1220],
  handLeft: [500, 565], handRight: [1070, 1810],
  upperTorso: [600, 900], waist: [600, 1200],
  legLeft: [460, 2250], legRight: [700, 2200],
};

test('source polygons represent each distinct body area; background stays inert', () => {
  assert.deepEqual(new Set(Object.keys(samples)), new Set(ZONES.map(z => z.id)));
  for (const [zone, [x, y]] of Object.entries(samples)) {
    assert.equal(zoneAtSource(x, y), zone, `${zone} at ${x},${y}`);
    const definition = ZONES_BY_ID[zone];
    assert.ok(definition.polygons.some(poly => pointInPolygon(x, y, poly)));
    for (const poly of definition.polygons) {
      assert.ok(poly.length >= 6 && poly.length % 2 === 0);
      for (let i = 0; i < poly.length; i += 2) assert.ok(poly[i] >= 0 && poly[i] <= SOURCE_W && poly[i + 1] >= 0 && poly[i + 1] <= SOURCE_H);
    }
  }
  for (const point of [[10, 10], [1180, 500], [1000, 2700], [30, 1900]]) assert.equal(zoneAtSource(...point), null);
  // The fingertip visually overlaps the face and must never be a face tap.
  assert.equal(zoneAtSource(565, 480), 'handLeft');
  assert.equal(zoneAtSource(550, 120), 'head');
  assert.equal(zoneAtSource(320, 360), 'hair');
});

test('every zone has an immediate valid response, bounded attack and coherent return', () => {
  for (const zone of Object.keys(samples)) {
    const r = new ReactionController();
    const event = r.trigger(zone, 1);
    assert.ok(event && EXPRESSIONS[event.expression]);
    assert.equal(r.sample(1).state, STATES.TOUCH_REACTION);
    assert.equal(r.sample(1).expression, event.expression);
    assert.equal(r.sample(1.3).contributions.at(-1).zone, zone);
    assert.equal(r.sample(2.2).state, STATES.RETURN_TO_IDLE);
    assert.equal(r.sample(2.8).expression, 'neutral');
    assert.equal(r.sample(3).state, STATES.IDLE);
  }
});

test('cooldown suppresses duplicate input; repeated taps and fast combinations create special states', () => {
  const r = new ReactionController();
  assert.ok(r.trigger('face', 10));
  assert.equal(r.trigger('face', 10 + COOLDOWN_SECONDS / 2), null);
  assert.equal(r.count, 1);
  assert.ok(r.trigger('face', 10.2));
  const repeated = r.trigger('face', 10.4);
  assert.equal(repeated.special, true);
  assert.equal(repeated.expression, 'blushing');
  assert.equal(r.sample(10.45).state, STATES.SPECIAL_REACTION);
  assert.equal(r.trigger('missing', 10.6), null);
  assert.equal(r.trigger('hair', 9), null);
  for (let i = 0; i < 100; i++) {
    r.trigger(i % 2 ? 'waist' : 'upperTorso', 11 + i * 0.11);
    const frame = r.sample(11 + i * 0.11 + 0.05);
    assert.ok(frame.contributions.length <= 3);
    for (const part of frame.contributions) assert.ok(part.amount >= 0 && part.amount <= 1);
  }
  assert.equal(r.sample(30).state, STATES.IDLE);
  assert.ok(r.history.length <= 8);
  const combo = new ReactionController();
  combo.trigger('head', 1); combo.trigger('face', 1.2); combo.trigger('hair', 1.4);
  assert.equal(combo.trigger('waist', 1.6).expression, 'playful');
});

test('per-zone variation cycles and stale expressions are replaced, not queued', () => {
  const r = new ReactionController();
  const first = r.trigger('head', 0).expression;
  const second = r.trigger('head', 3).expression;
  assert.notEqual(first, second);
  const mixer = new ExpressionMixer();
  for (const expression of Object.keys(EXPRESSIONS).filter(name => name !== 'neutral')) {
    mixer.setTarget(expression);
    for (let i = 0; i < 60; i++) mixer.update(1 / 60);
    assert.equal(mixer.current, expression);
    assert.ok(Math.abs(mixer.amount - 1) < 1e-9);
  }
  mixer.setTarget('surprised'); mixer.update(1 / 60);
  mixer.setTarget('sad');
  for (let i = 0; i < 60; i++) mixer.update(1 / 60);
  assert.equal(mixer.current, 'sad');
  mixer.setTarget('not-real');
  for (let i = 0; i < 60; i++) mixer.update(1 / 60);
  assert.equal(mixer.current, 'neutral'); assert.equal(mixer.amount, 0);
});

test('additive reactions remain small, smooth and keep V1 face and lower body fixed', () => {
  const parts = Object.keys(samples).map(zone => ({ zone, amount: 1 }));
  for (let y = 0; y <= SOURCE_H; y += 35) for (let x = 0; x <= SOURCE_W; x += 35) {
    const weights = buildReactionWeights(x, y);
    const zero = reactionOffset(weights, parts, 0);
    assert.equal(zero.x, 0); assert.equal(zero.y, 0);
    const offset = reactionOffset(weights, parts, 1.5);
    assert.ok(Math.abs(offset.x) <= 12 && Math.abs(offset.y) <= 7.5);
    if (y <= 610 || y >= 1950) assert.deepEqual(offset, { x: 0, y: 0 });
  }
  for (const zone of ['hair', 'shoulderLeft', 'shoulderRight', 'armLeft', 'armRight', 'upperTorso', 'waist']) {
    let max = 0;
    for (let y = 650; y < 1750; y += 50) for (let x = 100; x < 1100; x += 50) {
      const d = reactionOffset(buildReactionWeights(x, y), [{ zone, amount: 1 }], 1.5);
      max = Math.max(max, Math.hypot(d.x, d.y));
    }
    assert.ok(max > 0.5, zone);
  }
  for (const zone of ['head', 'face', 'handLeft', 'handRight', 'legLeft', 'legRight']) {
    assert.deepEqual(reactionOffset(buildReactionWeights(590, 900), [{ zone, amount: 1 }]), { x: 0, y: 0 });
  }
});

test('combined V1 and worst-case additive zones do not invert sampled mesh triangles', () => {
  const stress = Object.keys(samples).map(zone => ({ zone, amount: 1 }));
  for (const t of [0, 0.5, 1.25, 2.5, 4.75, 8.5]) {
    const grid = [];
    for (let row = 0; row < ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < COLS; col++) {
        const x = col * SOURCE_W / (COLS - 1), y = row * SOURCE_H / (ROWS - 1);
        const base = motionOffset(motionWeights(x, y), motionPhases(t), 1.5);
        const extra = reactionOffset(buildReactionWeights(x, y), stress, 1.5);
        grid[row][col] = { x: x + base[0] + extra.x, y: y + base[1] + extra.y };
      }
    }
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    for (let row = 0; row < ROWS - 1; row++) for (let col = 0; col < COLS - 1; col++) {
      const a = grid[row][col], b = grid[row][col + 1], c = grid[row + 1][col], d = grid[row + 1][col + 1];
      assert.ok(cross(a, b, c) > 0 && cross(b, d, c) > 0, `${row},${col} at ${t}`);
    }
  }
});

test('expression atlas metadata stays local and approved image retains its hash', async () => {
  const meta = JSON.parse(await readFile(new URL('../public/derived/expressions/expressions.json', import.meta.url)));
  assert.deepEqual(meta.mouthRect, [525, 420, 130, 75]);
  assert.equal(meta.frames, 25); assert.equal(meta.columns, 5);
  assert.deepEqual(new Set(Object.keys(meta.studies)), new Set(['happy', 'surprised', 'shy', 'playful', 'sad']));
  for (const study of Object.values(meta.studies)) assert.ok(study.inliers >= 25);
  for (const name of Object.keys(meta.studies)) {
    const png = await readFile(new URL(`../public/derived/expressions/mouth_${name}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 650); assert.equal(png.readUInt32BE(20), 375);
  }
  const approved = await readFile(new URL('../../../Generated/Approved/HERO-01_outfit02_playful_maid.png', import.meta.url));
  assert.equal(createHash('sha256').update(approved).digest('hex'), '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd');
});

test('hitbox vertices use the same triangle interpolation as the Pixi mesh', async () => {
  const { deformedPoint } = await import('../src/pixi-hitboxes.js');
  const vertices = new Float32Array([0, 0, 10, 1, -1, 10, 12, 12]);
  for (const [x, y, expectedX, expectedY] of [[2, 3, 1.7, 3.2], [7, 8, 7.7, 9.2]]) {
    const actual = deformedPoint(x, y, vertices, 2, 2, 10, 10);
    assert.ok(Math.abs(actual.x - expectedX) < 1e-7);
    assert.ok(Math.abs(actual.y - expectedY) < 1e-7);
  }
});
