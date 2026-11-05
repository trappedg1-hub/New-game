// Adapted from the approved V3 Pixi/SimplePlane stage. No existing costume or
// runtime is changed; yoga-specific masks, pivots and profiles are separate.
import * as PIXI from 'pixi.js';
import { createHitboxes } from './pixi-hitboxes.js';
import { createJointed, loadJointed } from './pixi-jointed.js';
import { composeYogaReaction, applyYogaReaction } from './reaction-motion.js';
import { SOURCE_WIDTH, SOURCE_HEIGHT, smoothstep, motionWeights, motionPhases, motionOffset } from './animation/idle-controller.js';

const COLS = 65, ROWS = 117;
function makeApplication(host) {
  const touch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const compact = touch && Math.min(window.innerWidth, window.innerHeight) <= 600;
  const app = new PIXI.Application({ width: 1, height: 1, backgroundAlpha: 0, antialias: true,
    autoDensity: true, autoStart: false, resolution: Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2),
    powerPreference: 'high-performance' });
  app.stop();
  app.renderer.events.autoPreventDefault = false;
  app.view.style.touchAction = 'pan-y';
  app.view.setAttribute('aria-hidden', 'true');
  host.appendChild(app.view);
  return app;
}
function createMesh(texture) {
  const mesh = new PIXI.SimplePlane(texture, COLS, ROWS);
  const buffer = mesh.geometry.getBuffer('aVertexPosition');
  const base = Float32Array.from(buffer.data);
  const weights = [];
  for (let i=0; i<base.length; i+=2) weights.push(motionWeights(base[i],base[i+1]));
  return { mesh, buffer, base, weights };
}
function updateMesh(rig, time, strength, pose) {
  const phases = motionPhases(time), out = rig.buffer.data, idle = [0,0], extra = [0,0];
  for (let i=0; i<rig.weights.length; i++) {
    const w=rig.weights[i];
    motionOffset(w,phases,strength,idle);
    applyYogaReaction(w,pose,extra);
    out[i*2]=w.x+idle[0]+extra[0]; out[i*2+1]=w.y+idle[1]+extra[1];
  }
  rig.buffer.update();
}
function createEye(parent, eye, textures) {
  const [x0,y0] = eye.box, [cx,cy] = eye.pivot;
  const group=new PIXI.Container(); group.visible=false; parent.addChild(group);
  const underpaint=new PIXI.Sprite(textures[`${eye.name}_underpaint`]);
  underpaint.position.set(x0,y0); group.addChild(underpaint);
  const closed=new PIXI.Sprite(textures[`${eye.name}_closed`]);
  closed.position.set(x0,y0); group.addChild(closed);
  const rotate=new PIXI.Container(); rotate.position.set(cx,cy); rotate.rotation=eye.angle;
  const squash=new PIXI.Container(), unrotate=new PIXI.Container(); unrotate.rotation=-eye.angle;
  const open=new PIXI.Sprite(textures[`${eye.name}_open`]); open.position.set(x0-cx,y0-cy);
  group.addChild(rotate); rotate.addChild(squash); squash.addChild(unrotate); unrotate.addChild(open);
  return { group, closed, open, squash };
}
function updateEye(eye, amount) {
  eye.group.visible=amount>0;
  if (!eye.group.visible) return;
  eye.group.alpha=smoothstep(0,0.06,amount);
  eye.squash.scale.y=Math.max(0.02,1-amount*0.98);
  eye.closed.alpha=smoothstep(0.65,0.84,amount);
  eye.open.alpha=1-smoothstep(0.65,0.84,amount);
}
function fit(root,width,height,view) {
  let scale,cx,cy,sy=height/2;
  if (view==='face') {
    scale=Math.min(width*0.92/650,height*0.86/700); cx=790; cy=335;
    if (width<300) sy=height*0.45;
  } else {
    scale=Math.min((width-24)/SOURCE_WIDTH,(height-24)/SOURCE_HEIGHT);
    cx=SOURCE_WIDTH/2; cy=SOURCE_HEIGHT/2;
  }
  root.scale.set(scale); root.position.set(width/2-cx*scale,sy-cy*scale);
}
export async function createStage(originalHost, animatedHost, sourceUrl, assetsBase, { debug=false,onTap=()=>{} }={}) {
  const response=await fetch(`${assetsBase}derived/rig.json`);
  if (!response.ok) throw new Error('Не удалось загрузить параметры рига.');
  const metadata=await response.json();
  const texture=await PIXI.Assets.load(sourceUrl);
  texture.baseTexture.mipmap=PIXI.MIPMAP_MODES.ON;
  if (texture.width!==SOURCE_WIDTH || texture.height!==SOURCE_HEIGHT) throw new Error('Неверный размер утверждённого арта.');
  const eyeTextures={};
  const [,jointedAssets]=await Promise.all([
    Promise.all(metadata.eyes.flatMap(eye=>['open','underpaint','closed'].map(async layer=>{
      const key=`${eye.name}_${layer}`;
      eyeTextures[key]=await PIXI.Assets.load(`${assetsBase}derived/eye_${eye.name}_${layer}.png`);
    }))),
    loadJointed(assetsBase),
  ]);
  if (jointedAssets.metadata.source_sha256!==metadata.source_sha256 ||
      jointedAssets.body.width!==SOURCE_WIDTH || jointedAssets.body.height!==SOURCE_HEIGHT) {
    throw new Error('Слои не соответствуют утверждённому исходнику.');
  }
  const originalApp=makeApplication(originalHost);
  let animatedApp;
  try { animatedApp=makeApplication(animatedHost); } catch(error) { originalApp.destroy(true); throw error; }
  const originalRoot=new PIXI.Container(); originalApp.stage.addChild(originalRoot);
  originalRoot.addChild(new PIXI.Sprite(texture));
  const animatedRoot=new PIXI.Container(); animatedApp.stage.addChild(animatedRoot);
  const mesh=createMesh(jointedAssets.body); animatedRoot.addChild(mesh.mesh);
  const jointed=createJointed(jointedAssets,mesh,{cols:COLS,rows:ROWS,width:SOURCE_WIDTH,height:SOURCE_HEIGHT});
  // Garment is redrawn last from the same body-aligned triangles: the planted
  // hands and thighs cannot pull a background strip through the shorts.
  for (const layer of ['leg_left','leg_right','arm_left','arm_right','shorts']) animatedRoot.addChild(jointed.skins[layer].mesh);
  const faceRoot=new PIXI.Container(); animatedRoot.addChild(faceRoot);
  const eyes=metadata.eyes.map(eye=>createEye(faceRoot,eye,eyeTextures));
  jointed.update(0,0);
  const hitboxes=createHitboxes(animatedRoot,mesh,{cols:COLS,rows:ROWS,width:SOURCE_WIDTH,height:SOURCE_HEIGHT,
    debug,onTap,deformZonePoint:jointed.zonePoint});
  let view='body';
  function resize() {
    for (const [host,app,root] of [[originalHost,originalApp,originalRoot],[animatedHost,animatedApp,animatedRoot]]) {
      const width=Math.max(1,Math.round(host.clientWidth)),height=Math.max(1,Math.round(host.clientHeight));
      // In full-body view the portrait is narrower than a desktop panel. Avoid
      // rasterizing the empty transparent side margins, without scaling or
      // clipping the art. Face view keeps the full panel for its zoomed crop.
      let left=0;
      if(view==='body' && width>24 && height>24){
        const scale=Math.min((width-24)/SOURCE_WIDTH,(height-24)/SOURCE_HEIGHT);
        left=Math.max(0,Math.floor((width-SOURCE_WIDTH*scale)/2-16));
      }
      app.renderer.resize(width-2*left,height);app.view.style.marginLeft=`${left}px`;
      fit(root,width,height,view);root.position.x-=left;
    }
    originalApp.renderer.render(originalApp.stage); animatedApp.renderer.render(animatedApp.stage);
  }
  const observer=new ResizeObserver(resize); observer.observe(originalHost); observer.observe(animatedHost); resize();
  let currentPose=null;
  function render(time,strength,blink,{contributions=[],jointPose=null,dryRun=false}={}) {
    currentPose=composeYogaReaction(contributions,strength);
    updateMesh(mesh,time,strength,currentPose);
    jointed.update(time,strength,contributions,jointPose);
    eyes.forEach(eye=>updateEye(eye,blink));
    if (!dryRun) { hitboxes.update(); animatedApp.renderer.render(animatedApp.stage); }
  }
  function zoneAtClient(x,y) {
    const rect=animatedApp.view.getBoundingClientRect();
    const sx=(x-rect.left)*animatedApp.screen.width/rect.width,sy=(y-rect.top)*animatedApp.screen.height/rect.height;
    const boundary=animatedApp.renderer.events.rootBoundary; boundary.rootTarget ||= animatedApp.stage;
    return boundary.hitTest(sx,sy)?.name || null;
  }
  function sourceToClient(x,y) {
    const point=hitboxes.toLocal(x,y), global=animatedRoot.toGlobal(new PIXI.Point(point.x,point.y));
    const rect=animatedApp.view.getBoundingClientRect();
    return {x:rect.left+global.x*rect.width/animatedApp.screen.width,y:rect.top+global.y*rect.height/animatedApp.screen.height};
  }
  function setView(next) { view=next; resize(); }
  function geometryStats() {
    const p=mesh.buffer.data;
    let maxDisplacement=0,minCross=Infinity;
    for(let i=0;i<mesh.weights.length;i++) {
      maxDisplacement=Math.max(maxDisplacement,Math.hypot(p[2*i]-mesh.base[2*i],p[2*i+1]-mesh.base[2*i+1]));
      if(i%COLS<COLS-1 && i<COLS*(ROWS-1)) {
        const r=i+1,d=i+COLS,z=d+1;
        const c1=(p[2*r]-p[2*i])*(p[2*d+1]-p[2*i+1])-(p[2*r+1]-p[2*i+1])*(p[2*d]-p[2*i]);
        const c2=(p[2*z]-p[2*r])*(p[2*d+1]-p[2*r+1])-(p[2*z+1]-p[2*r+1])*(p[2*d]-p[2*r]);
        minCross=Math.min(minCross,c1,c2);
      }
    }
    return {maximumDisplacement:maxDisplacement,minimumCellCross:minCross,limbs:jointed.geometryStats()};
  }
  // Read synchronously after render; using gl.readPixels after a completed
  // browser frame can otherwise return an already-cleared WebGL buffer.
  function readPixels(app) {
    app.renderer.render(app.stage);
    const gl=app.renderer.gl,width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
    const pixels=new Uint8Array(width*height*4);
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return {pixels,width,height};
  }
  function compareBuffers(a,b) {
    if(a.width!==b.width||a.height!==b.height)return {comparable:false,sizes:[a.width,a.height,b.width,b.height]};
    let sum=0,max=0,changed=0,nonTransparentA=0,nonTransparentB=0;
    for(let i=0;i<a.pixels.length;i+=4) {
      if(a.pixels[i+3])nonTransparentA++; if(b.pixels[i+3])nonTransparentB++;
      let different=false;
      for(let j=0;j<4;j++){const d=Math.abs(a.pixels[i+j]-b.pixels[i+j]);sum+=d;max=Math.max(max,d);different ||= d>0;}
      if(different)changed++;
    }
    return {comparable:true,meanAbsoluteDifference:sum/a.pixels.length,maxDifference:max,
      changedFraction:changed/(a.width*a.height),nonTransparentA,nonTransparentB,width:a.width,height:a.height};
  }
  function comparePixels(){return compareBuffers(readPixels(originalApp),readPixels(animatedApp));}
  function compareFrames(a,b){render(a.time,a.strength,a.blink,a);const one=readPixels(animatedApp);
    render(b.time,b.strength,b.blink,b);return compareBuffers(one,readPixels(animatedApp));}
  function compareCulling(frame){
    render(frame.time,frame.strength,frame.blink,frame);
    jointed.setSparseMeshes(true);const sparse=readPixels(animatedApp);
    jointed.setSparseMeshes(false);const full=readPixels(animatedApp);
    jointed.setSparseMeshes(true);animatedApp.renderer.render(animatedApp.stage);
    return compareBuffers(sparse,full);
  }
  function destroy(){observer.disconnect();hitboxes.destroy();originalApp.destroy(true);animatedApp.destroy(true);}
  return {render,setView,geometryStats,comparePixels,compareFrames,compareCulling,sourceToClient,zoneAtClient,
    deformedSourcePoint:(x,y)=>hitboxes.toLocal(x,y),jointAngles:()=>jointed.angles(),limbPoint:jointed.point,
    pose:()=>currentPose,hitboxes,metadata,originalApp,animatedApp,destroy};
}
