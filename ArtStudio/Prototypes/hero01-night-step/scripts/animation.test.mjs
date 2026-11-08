import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { LIMBS, composeJoints, jointMatrices, limbWeights, skinPoint } from '../src/animation/jointed-rig.js';
import { automaticBlink, blinkEnvelope, motionOffset, motionPhases, motionWeights } from '../src/animation/idle-controller.js';
import { ReactionController, reactionEnvelope, REACTION_SECONDS } from '../src/reactions.js';
import { zoneAtSource } from '../src/zones.js';

const expected='bfa845260fdaecdb44d4e01fb57f608c193910d1db98f8ed7b6d3340262729f7';
const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));

test('assets are built from the unchanged, approved 1024×1024 source',async()=>{
  const source=await readFile(new URL('../../../Generated/Approved/HERO-01_outfit10_night_lingerie_step_pose.png',import.meta.url));
  const metadata=await readJson('../public/derived/jointed/jointed.json');
  assert.equal(createHash('sha256').update(source).digest('hex'),expected);
  assert.equal(metadata.source_sha256,expected);assert.deepEqual(metadata.size,[1024,1024]);
  assert.equal(metadata.neutral_max_difference,0);
  assert.deepEqual(Object.keys(metadata.layers),['leg_right','leg_left','arm_left','arm_right']);
  for(const layer of Object.values(metadata.layers)){
    assert.ok(layer.mesh.active_cells.length>0);assert.ok((await readFile(new URL(`../public/derived/jointed/${layer.file}`,import.meta.url))).length>0);
  }
});

test('the neutral rig reconstructs the source, including shoulder, knee and toes',()=>{
  const pose=composeJoints(0,0,[]);
  for(const name of Object.keys(LIMBS)){
    const matrices=jointMatrices(name,pose[name]);
    for(const [x,y] of [[315,425],[465,482],[420,800],[585,590],[580,1000]]){
      const p=skinPoint(x,y,limbWeights(name,x,y),matrices);
      assert.ok(Math.hypot(p.x-x,p.y-y)<1e-8);
    }
  }
});

test('a quick attack is followed by a sustained, smooth two-second return',()=>{
  assert.equal(reactionEnvelope(0),0);
  assert.ok(reactionEnvelope(.07)>=.49,'half amplitude by 70ms');
  assert.equal(reactionEnvelope(.14),1);assert.equal(reactionEnvelope(.40),1);
  assert.ok(reactionEnvelope(1.35)>.25);assert.equal(reactionEnvelope(REACTION_SECONDS),0);
  for(let t=0;t<2;t+=.01){assert.ok(reactionEnvelope(t)>=0);assert.ok(reactionEnvelope(t)<=1.08);}
});

test('limbs have independent joints and respond visibly to their own zones',()=>{
  const sample=(zone,name,x,y)=>{
    const pose=composeJoints(0,1,[{zone,variant:0,amount:1,followAmount:1,lateAmount:1}]);
    const p=skinPoint(x,y,limbWeights(name,x,y),jointMatrices(name,pose[name]));
    return {pose,distance:Math.hypot(p.x-x,p.y-y)};
  };
  const left=sample('handLeft','armLeft',315,425),right=sample('handRight','armRight',715,425);
  const near=sample('footNear','legLeft',420,800),far=sample('legRight','legRight',585,590);
  assert.ok(left.distance>25);assert.ok(right.distance>25);assert.ok(near.distance>35);assert.ok(far.distance>9);
  assert.equal(left.pose.legLeft.hip,0);assert.notEqual(left.pose.armLeft.elbow,0);assert.notEqual(near.pose.legLeft.ankle,0);
  const quiet=composeJoints(NaN,NaN,[{zone:'unknown',amount:NaN}]);
  assert.ok(Object.values(quiet).every(limb=>Object.values(limb).every(Number.isFinite)));
});

test('new gestures interrupt smoothly without queued or duplicate taps',()=>{
  const r=new ReactionController();
  assert.ok(r.trigger('handLeft',10));assert.equal(r.trigger('handLeft',10.01),null);
  const before=r.sample(10.4).contributions[0];assert.ok(r.trigger('footNear',10.4));
  const next=r.sample(10.4).contributions;
  assert.equal(next[0].zone,'handLeft');assert.ok(Math.abs(next[0].amount-before.amount)<1e-9);
  assert.equal(next[1].zone,'footNear');assert.equal(next[1].amount,0);
  assert.equal(r.sample(12.7).active,false);assert.equal(r.count,2);
  assert.equal(r.trigger('not-a-zone',13),null);
});

test('idle loops cleanly, blinking is bounded, and interaction zones cover intended areas',()=>{
  const w=motionWeights(510,230),a=motionOffset(w,motionPhases(0),1),b=motionOffset(w,motionPhases(8),1);
  assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8);
  assert.equal(blinkEnvelope(-1),0);assert.equal(blinkEnvelope(.12),1);assert.equal(blinkEnvelope(.4),0);
  assert.ok(automaticBlink(3.32)>.9);
  for(const [x,y,zone] of [[410,780,'footNear'],[590,710,'legRight'],[315,420,'handLeft'],[710,420,'handRight'],[510,100,'face']])assert.equal(zoneAtSource(x,y),zone);
});
