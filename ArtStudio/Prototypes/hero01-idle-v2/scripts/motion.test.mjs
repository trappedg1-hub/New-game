import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  SOURCE_WIDTH, SOURCE_HEIGHT, MESH_STEP, MESH_X, MESH_Y, COLS, ROWS, BLINK_DURATION,
  smoothstep, breathAt, blinkEnvelope, blinkSchedule, automaticBlink,
  motionWeights, motionPhases, motionOffset, strandBend,
} from '../src/rig.js';

test('blink is continuous, closes briskly and reopens a little more slowly', () => {
  assert.equal(blinkEnvelope(-1), 0);
  assert.equal(blinkEnvelope(0), 0);
  assert.equal(blinkEnvelope(0.15), 1);
  assert.equal(blinkEnvelope(0.16), 1);
  assert.equal(blinkEnvelope(BLINK_DURATION), 0);
  let previous = blinkEnvelope(0);
  for (let ms = 1; ms <= 400; ms++) {
    const current = blinkEnvelope(ms / 1000);
    assert.ok(current >= 0 && current <= 1, `out of range at ${ms} ms`);
    assert.ok(Math.abs(current - previous) < 0.012, `discontinuous at ${ms} ms`);
    if (ms <= 135) assert.ok(current >= previous - 1e-12);
    if (ms >= 170) assert.ok(current <= previous + 1e-12);
    previous = current;
  }
  assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(smoothstep(0, 1, 2), 1);
});

test('blink schedule is irregular, repeatable and includes a non-overlapping pair', () => {
  assert.equal(automaticBlink(0), 0);
  const first = blinkSchedule(0);
  assert.deepEqual(first, blinkSchedule(0));
  assert.notDeepEqual(first, blinkSchedule(1));
  for (let block = 0; block < 10; block++) {
    const starts = blinkSchedule(block);
    for (let i = 1; i < starts.length; i++) {
      assert.ok(starts[i] - starts[i - 1] > BLINK_DURATION, `overlapping blink in block ${block}`);
    }
    assert.ok(Math.abs(starts[4] - starts[3] - 0.52) < 1e-9);
    for (const start of starts) {
      assert.equal(automaticBlink(block * 48 + start + 0.15), 1);
      assert.equal(automaticBlink(block * 48 + start + BLINK_DURATION + 0.01), 0);
    }
  }
});

test('breath is bounded, smooth at the loop, and includes a resting beat', () => {
  assert.equal(breathAt(0), 0);
  assert.equal(breathAt(5.6), 0);
  assert.equal(breathAt(2.1), 1);
  assert.equal(breathAt(5.4), 0);
  let previous = breathAt(0);
  for (let step = 1; step <= 1120; step++) {
    const current = breathAt(step / 200);
    assert.ok(current >= 0 && current <= 1);
    assert.ok(Math.abs(current - previous) < 0.01);
    previous = current;
  }
});

test('head and lower body stay fixed and zero intensity is exactly neutral', () => {
  for (const time of [0, 0.7, 1.2, 2.8, 4.5, 12.3]) {
    const phases = motionPhases(time);
    for (let x = 0; x <= SOURCE_WIDTH; x += SOURCE_WIDTH / 20) {
      for (const y of [0, 300, 610, 1950, 2500, 3200, SOURCE_HEIGHT]) {
        assert.equal(Math.hypot(...motionOffset(motionWeights(x, y), phases, 1.5)), 0);
      }
      assert.equal(Math.hypot(...motionOffset(motionWeights(x, 900), phases, 0)), 0);
    }
  }
  assert.ok(Math.hypot(...motionOffset(motionWeights(200, 1050), motionPhases(1.2), 1)) > 1);
  assert.ok(Math.hypot(...motionOffset(motionWeights(600, 1650), motionPhases(1.2), 1)) > 0.4);
});

test('two real strand overlays have independent, end-anchored motion', () => {
  const leftAnchors = [1300, 1465], rightAnchors = [1360, 1415];
  for (const y of [0, 1300, 1465, 1700]) assert.ok(Math.abs(strandBend(y, leftAnchors, 3.4, 1, 1)) < 1e-12);
  for (const y of [0, 1360, 1415, 1700]) assert.ok(Math.abs(strandBend(y, rightAnchors, 1.2, 1, 1)) < 1e-12);
  assert.ok(strandBend(1382, leftAnchors, 3.4, 1, 1) > 3);
  assert.equal(strandBend(1382, leftAnchors, 3.4, 1, 0), 0);
  let diverged = false;
  for (let time = 0; time < 20; time += 0.2) {
    const phases = motionPhases(time);
    if (Math.abs(phases.leftStrand - phases.rightStrand) > 0.5) diverged = true;
  }
  assert.ok(diverged, 'strands should not share one synchronized phase');
});

test('maximum intensity mesh stays bounded without flipped triangles', () => {
  const weights = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) weights.push(motionWeights(MESH_X[col], MESH_Y[row]));
  }
  const positions = new Float64Array(COLS * ROWS * 2);
  let maxDisplacement = 0, minCross = Infinity;
  for (let frame = 0; frame <= 225; frame++) {
    const phases = motionPhases(frame / 5);
    for (let i = 0; i < weights.length; i++) {
      const [dx, dy] = motionOffset(weights[i], phases, 1.5);
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(dx, dy));
      positions[i * 2] = weights[i].x + dx;
      positions[i * 2 + 1] = weights[i].y + dy;
    }
    for (let row = 0; row < ROWS - 1; row++) {
      for (let col = 0; col < COLS - 1; col++) {
        const i = (row * COLS + col) * 2, r = i + 2, d = i + COLS * 2, q = d + 2;
        const cross1 = (positions[r] - positions[i]) * (positions[d + 1] - positions[i + 1])
          - (positions[r + 1] - positions[i + 1]) * (positions[d] - positions[i]);
        const cross2 = (positions[q] - positions[r]) * (positions[d + 1] - positions[r + 1])
          - (positions[q + 1] - positions[r + 1]) * (positions[d] - positions[r]);
        minCross = Math.min(minCross, cross1, cross2);
      }
    }
  }
  assert.ok(maxDisplacement > 5 && maxDisplacement < 12, `max displacement ${maxDisplacement}`);
  assert.ok(minCross > 190, `folded or overly compressed triangle: ${minCross}`);
});

test('movement changes smoothly between 60 fps samples', () => {
  let worstStep = 0;
  for (const [x, y] of [[200, 1000], [950, 1250], [400, 880], [600, 1650]]) {
    const weights = motionWeights(x, y);
    let previous = motionOffset(weights, motionPhases(0), 1.5);
    for (let frame = 1; frame <= 600; frame++) {
      const current = motionOffset(weights, motionPhases(frame / 60), 1.5);
      worstStep = Math.max(worstStep, Math.hypot(current[0] - previous[0], current[1] - previous[1]));
      previous = current;
    }
  }
  assert.ok(worstStep < 0.2, `step too large: ${worstStep} source px/frame`);
});

test('approved source is locked and V2 atlases and hair patches have the expected dimensions', () => {
  const source = readFileSync(new URL('../../../Generated/Approved/HERO-01_outfit02_playful_maid.png', import.meta.url));
  const metadata = JSON.parse(readFileSync(new URL('../public/derived/rig-v2.json', import.meta.url), 'utf8'));
  const expected = '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd';
  assert.equal(createHash('sha256').update(source).digest('hex'), expected);
  assert.equal(metadata.source_sha256, expected);
  const checkPng = (name, width, height) => {
    const image = readFileSync(new URL(`../public/derived/${name}.png`, import.meta.url));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), width);
    assert.equal(image.readUInt32BE(20), height);
    assert.equal(image[25], 6, `${name} must be RGBA`);
  };
  assert.equal(metadata.eyes.length, 2);
  for (const eye of metadata.eyes) {
    assert.equal(eye.frames, 33);
    checkPng(`blink_${eye.name}_atlas`, eye.columns * eye.cell[0], Math.ceil(eye.frames / eye.columns) * eye.cell[1]);
  }
  assert.equal(metadata.strands.length, 2);
  for (const strand of metadata.strands) {
    const width = strand.box[2] - strand.box[0], height = strand.box[3] - strand.box[1];
    assert.equal(width % MESH_STEP, 0);
    assert.equal(height % MESH_STEP, 0);
    for (let x = strand.box[0]; x <= strand.box[2]; x += MESH_STEP) assert.ok(MESH_X.includes(x));
    for (let y = strand.box[1]; y <= strand.box[3]; y += MESH_STEP) assert.ok(MESH_Y.includes(y));
    assert.ok(COLS * ROWS < 4000, 'mobile mesh should stay lightweight');
    assert.ok(strand.neutral_mean_error < 0.01 && strand.neutral_max_error < 1);
    for (const layer of ['restore', 'strand']) checkPng(`hair_${strand.name}_${layer}`, width, height);
  }
});
