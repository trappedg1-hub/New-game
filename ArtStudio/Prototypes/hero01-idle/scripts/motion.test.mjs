import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_WIDTH, SOURCE_HEIGHT, smoothstep, blinkEnvelope, automaticBlink,
  motionWeights, motionPhases, motionOffset,
} from '../src/rig.js';

test('blink is bounded, continuous, and has a short closed hold', () => {
  assert.equal(blinkEnvelope(-1), 0);
  assert.equal(blinkEnvelope(0), 0);
  assert.equal(blinkEnvelope(0.16), 1);
  assert.equal(blinkEnvelope(0.20), 1);
  assert.equal(blinkEnvelope(0.42), 0);
  let previous = blinkEnvelope(0);
  for (let ms = 1; ms <= 420; ms++) {
    const current = blinkEnvelope(ms / 1000);
    assert.ok(current >= 0 && current <= 1, `out of range at ${ms} ms`);
    assert.ok(Math.abs(current - previous) < 0.01, `discontinuous at ${ms} ms`);
    if (ms <= 160) assert.ok(current >= previous - 1e-12);
    if (ms >= 216) assert.ok(current <= previous + 1e-12);
    previous = current;
  }
  assert.equal(automaticBlink(0), 0);
  assert.equal(automaticBlink(2.35 + 0.18), 1);
  assert.equal(automaticBlink(2.35 + 0.42), 0);
  assert.equal(automaticBlink(2.35 + 18.4 + 0.18), 1);
  assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(smoothstep(0, 1, 2), 1);
});

test('head and lower body remain fixed; zero intensity is exactly neutral', () => {
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
  assert.ok(Math.hypot(...motionOffset(motionWeights(600, 1650), motionPhases(1.2), 1)) > 1);
});

test('maximum-intensity mesh remains bounded without flipped triangles over time', () => {
  const cols = 51;
  const rows = 149;
  const weights = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      weights.push(motionWeights(SOURCE_WIDTH * col / (cols - 1), SOURCE_HEIGHT * row / (rows - 1)));
    }
  }
  const positions = new Float64Array(cols * rows * 2);
  let maxDisplacement = 0;
  let minCross = Infinity;
  for (let frame = 0; frame <= 184; frame++) {
    const phases = motionPhases(frame / 10);
    for (let i = 0; i < weights.length; i++) {
      const [dx, dy] = motionOffset(weights[i], phases, 1.5);
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(dx, dy));
      positions[i * 2] = weights[i].x + dx;
      positions[i * 2 + 1] = weights[i].y + dy;
    }
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const i = (row * cols + col) * 2;
        const r = i + 2;
        const d = i + cols * 2;
        const q = d + 2;
        const cross1 = (positions[r] - positions[i]) * (positions[d + 1] - positions[i + 1])
          - (positions[r + 1] - positions[i + 1]) * (positions[d] - positions[i]);
        const cross2 = (positions[q] - positions[r]) * (positions[d + 1] - positions[r + 1])
          - (positions[q + 1] - positions[r + 1]) * (positions[d] - positions[r]);
        minCross = Math.min(minCross, cross1, cross2);
      }
    }
  }
  assert.ok(maxDisplacement > 10 && maxDisplacement < 25, `max displacement ${maxDisplacement}`);
  assert.ok(minCross > 300, `folded or overly compressed triangle: ${minCross}`);
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
  assert.ok(worstStep < 0.5, `step too large: ${worstStep} source px/frame`);
});

test('approved source stays locked and the six experimental eye layers have the expected size', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const source = readFileSync(new URL('../../../Generated/Approved/HERO-01_outfit02_playful_maid.png', import.meta.url));
  const metadata = JSON.parse(readFileSync(new URL('../public/derived/rig.json', import.meta.url), 'utf8'));
  const expected = '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd';
  assert.equal(createHash('sha256').update(source).digest('hex'), expected);
  assert.equal(metadata.source_sha256, expected);
  for (const eye of metadata.eyes) {
    for (const layer of ['open', 'underpaint', 'closed']) {
      const image = readFileSync(new URL(`../public/derived/eye_${eye.name}_${layer}.png`, import.meta.url));
      assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(image.readUInt32BE(16), eye.box[2] - eye.box[0]);
      assert.equal(image.readUInt32BE(20), eye.box[3] - eye.box[1]);
      assert.equal(image[25], 6, 'eye layer is RGBA');
    }
  }
});
