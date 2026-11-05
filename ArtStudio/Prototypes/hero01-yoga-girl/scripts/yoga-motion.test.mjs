import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LOOP_SECONDS, LIMBS as JOINTS, composeJoints as limbPose, limbWeights, jointMatrices, skinPoint } from '../src/animation/jointed-rig.js';
import { automaticBlink, blinkEnvelope, motionWeights, motionPhases, motionOffset } from '../src/animation/idle-controller.js';
import { composeYogaReaction, applyYogaReaction } from '../src/reaction-motion.js';
import { ReactionController, ReactionClock, STATES } from '../src/reactions.js';
import { PHYSICAL_VARIANTS, variantFor } from '../src/animation/profiles.js';
import { ZONES, zoneAtSource } from '../src/zones.js';

const approx = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a-b) <= tolerance, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const limit = (name, joint) => JOINTS[name].limits[JOINTS[name].names.indexOf(joint)];
const zeroPose = () => Object.fromEntries(Object.entries(JOINTS).map(([name, joint]) =>
  [name, Object.fromEntries(joint.names.map(part => [part,0]))]));
const sample = { armLeft:[240,1560], armRight:[1290,1550], legLeft:[430,2550], legRight:[1090,2550] };
const skinned = (name, pose) => {
  const [x,y] = sample[name];
  const point=skinPoint(x,y,limbWeights(name,x,y),jointMatrices(name,pose[name]));
  return [point.x,point.y];
};

test('approved art and generated metadata refer to the same unscaled source', async () => {
  const source = fileURLToPath(new URL('../../../Generated/Approved/HERO-01_outfit05_yoga_girl.png', import.meta.url));
  const bytes = await readFile(source);
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,'5cd0f5faca1f86fa3f0dfca6429615a877cc98b60c5af542ccbb99a1ff16a317');
  assert.equal(bytes.readUInt32BE(16),1534); assert.equal(bytes.readUInt32BE(20),2733);
  const metadata = JSON.parse(await readFile(new URL('../public/derived/rig.json', import.meta.url)));
  const layers = JSON.parse(await readFile(new URL('../public/derived/jointed/jointed.json', import.meta.url)));
  assert.equal(metadata.source_sha256,hash); assert.equal(layers.source_sha256,hash);
  assert.deepEqual(Object.keys(layers.layers).sort(), ['arm_left','arm_right','leg_left','leg_right','shorts']);
  for (const part of Object.values(layers.layers)) {
    const png = await readFile(new URL(`../public/derived/jointed/${part.file}`, import.meta.url));
    assert.equal(png.readUInt32BE(16),part.box[2]); assert.equal(png.readUInt32BE(20),part.box[3]);
    assert.deepEqual(part.mesh.grid,[65,117]); assert.ok(part.mesh.halo>=32);
    const [cols,rows]=part.mesh.size, maxCells=(cols-1)*(rows-1);
    assert.ok(part.mesh.active_cells.length>0 && part.mesh.active_cells.length<maxCells);
    assert.equal(new Set(part.mesh.active_cells).size,part.mesh.active_cells.length);
    assert.ok(part.mesh.active_cells.every(index=>Number.isInteger(index)&&index>=0&&index<maxCells));
  }
});

test('each of the four three-joint chains is neutral and independently movable', () => {
  const neutral=zeroPose();
  for (const name of Object.keys(JOINTS)) {
    const rest=skinned(name,neutral);
    approx(rest[0],sample[name][0]); approx(rest[1],sample[name][1]);
    for (const joint of JOINTS[name].names) {
      const pose=zeroPose(); pose[name][joint]=limit(name,joint)*0.7;
      assert.ok(distance(skinned(name,pose),rest)>0.1,`${name}.${joint} must move its own distal point`);
      for (const other of Object.keys(JOINTS).filter(id=>id!==name)) {
        assert.ok(distance(skinned(other,pose),skinned(other,neutral))<1e-8,`${name}.${joint} moved ${other}`);
      }
    }
  }
});

test('joint overrides clamp extremes and ignore non-finite values', () => {
  const override={};
  for (const [name,joint] of Object.entries(JOINTS)) override[name]=Object.fromEntries(joint.names.map((key,i)=>[key, i===0?999:i===1?-999:NaN]));
  const pose=limbPose(0,0,[],override);
  for (const [name,joint] of Object.entries(JOINTS)) {
    approx(pose[name][joint.names[0]],limit(name,joint.names[0]));
    approx(pose[name][joint.names[1]],-limit(name,joint.names[1]));
    approx(pose[name][joint.names[2]],0);
  }
});

test('12-second body cycle and joints close smoothly, with bounded 60 Hz steps', () => {
  const coords=[[445,550],[800,800],[760,1250],[430,2550],[1090,2550]];
  for (const strength of [0,1,1.5]) {
    const start=limbPose(0,strength), end=limbPose(LOOP_SECONDS,strength);
    for (const [name,joint] of Object.entries(JOINTS)) for(const key of joint.names) approx(start[name][key],end[name][key]);
    for (const [x,y] of coords) {
      const w=motionWeights(x,y), first=motionOffset(w,motionPhases(0),strength), last=motionOffset(w,motionPhases(LOOP_SECONDS),strength);
      assert.ok(distance(first,last)<1e-8);
    }
    let previous=limbPose(0,strength), maxStep=0;
    for(let frame=1;frame<=LOOP_SECONDS*60;frame++) {
      const current=limbPose(frame/60,strength);
      for (const [name,joint] of Object.entries(JOINTS)) for (const key of joint.names) {
        assert.ok(Number.isFinite(current[name][key]));
        assert.ok(Math.abs(current[name][key])<=limit(name,key));
        maxStep=Math.max(maxStep,Math.abs(current[name][key]-previous[name][key]));
      }
      previous=current;
    }
    assert.ok(maxStep < 0.001, `largest 60 Hz joint step ${maxStep}`);
  }
});

test('blink envelope is bounded, continuous and returns to open', () => {
  assert.equal(blinkEnvelope(-1),0); assert.equal(blinkEnvelope(0),0);
  assert.equal(blinkEnvelope(0.18),1); assert.equal(blinkEnvelope(0.42),0);
  let previous=blinkEnvelope(0), largest=0;
  for(let i=1;i<=420;i++) {
    const value=blinkEnvelope(i/1000); assert.ok(value>=0 && value<=1);
    largest=Math.max(largest,Math.abs(value-previous)); previous=value;
  }
  assert.ok(largest<0.015,`blink jump ${largest}`);
  for(let t=0;t<24;t+=0.017) approx(automaticBlink(t),automaticBlink(t+24),1e-9);
});

test('reaction fields and limb angles remain finite and bounded under overlapping taps', () => {
  const contributions=ZONES.flatMap(zone=>PHYSICAL_VARIANTS.map((_,variant)=>({zone:zone.id,variant,amount:1,followAmount:1,lateAmount:1})));
  const field=composeYogaReaction(contributions,99), pose=limbPose(3,1.5,contributions);
  for (const [key,value] of Object.entries(field)) assert.ok(Number.isFinite(value) && Math.abs(value)<=(key==='hair'?12:7));
  for (const [name,joint] of Object.entries(JOINTS)) for(const key of joint.names) assert.ok(Math.abs(pose[name][key])<=limit(name,key));
  const offset=applyYogaReaction(motionWeights(445,550),field); assert.ok(offset.every(Number.isFinite));
  assert.deepEqual(composeYogaReaction([{zone:'bogus',amount:NaN}],1),{hair:0,torso:0,waist:0,cloth:0});
  assert.equal(variantFor(-1),PHYSICAL_VARIANTS.at(-1));
});

test('reaction timing handles cooldown, replacement and return to idle', () => {
  const r=new ReactionController();
  assert.equal(r.trigger('bogus',0),null); assert.equal(r.trigger('face',NaN),null);
  assert.equal(r.trigger('hair',0).zone,'hair'); assert.equal(r.trigger('face',0.05),null);
  assert.ok(r.sample(0.15).contributions[0].amount>0);
  assert.equal(r.trigger('face',0.2).zone,'face');
  const transitioning=r.sample(0.21); assert.equal(transitioning.state,STATES.REACTION_TRANSITION);
  assert.ok(transitioning.contributions.length<=3);
  assert.equal(r.sample(5).state,STATES.IDLE);
  const clock=new ReactionClock(1000); approx(clock.advance(1300),0.3); approx(clock.advance(1200),0.3);
  clock.reset(2000); approx(clock.advance(2100),0.4);
});

test('all 13 yoga hit zones have reachable source coordinates', () => {
  const points={head:[800,100],hair:[400,500],face:[900,350],shoulderLeft:[560,820],shoulderRight:[950,700],
    armLeft:[460,1200],armRight:[1100,1300],handLeft:[280,1530],handRight:[1240,1520],
    upperTorso:[700,850],waist:[750,1070],legLeft:[520,2000],legRight:[1050,2000]};
  assert.equal(ZONES.length,13);
  for(const [id,[x,y]] of Object.entries(points)) assert.equal(zoneAtSource(x,y),id,`${id} is not reachable`);
});
