import * as PIXI from 'pixi.js';
import { createHitboxes, deformedPoint } from './pixi-hitboxes.js';
import { createJointed, loadJointed } from './pixi-jointed.js';
import { motionWeights, motionPhases, motionOffset, SOURCE_WIDTH, SOURCE_HEIGHT } from './animation/idle-controller.js';
import { composeBodyReaction } from './reactions.js';

const COLS=65,ROWS=65;
function appFor(host){
  const app=new PIXI.Application({width:1,height:1,backgroundAlpha:0,antialias:true,autoDensity:true,autoStart:false,
    // Keep the browser's native device-pixel ratio; do not trade detail for speed.
    resolution:window.devicePixelRatio||1,powerPreference:'high-performance'});
  app.stop();app.renderer.events.autoPreventDefault=false;app.view.style.touchAction='pan-y';
  app.view.setAttribute('aria-hidden','true');host.appendChild(app.view);return app;
}
function bodyMesh(texture){
  const mesh=new PIXI.SimplePlane(texture,COLS,ROWS),buffer=mesh.geometry.getBuffer('aVertexPosition');
  const base=Float32Array.from(buffer.data),weights=[];
  for(let i=0;i<base.length;i+=2)weights.push(motionWeights(base[i],base[i+1]));
  return {mesh,buffer,base,weights};
}
function updateBody(body,time,strength,reaction){
  const phases=motionPhases(time),out=body.buffer.data,offset=[0,0];
  for(let i=0;i<body.weights.length;i++){
    const w=body.weights[i];motionOffset(w,phases,strength,reaction,offset);
    out[2*i]=w.x+offset[0];out[2*i+1]=w.y+offset[1];
  }
  body.buffer.update();
}
function fit(root,width,height,view){
  let scale,cx,cy;
  if(view==='face') { scale=Math.min(width*.87/350,height*.84/350);cx=510;cy=113; }
  else { scale=Math.min((width-20)/SOURCE_WIDTH,(height-20)/SOURCE_HEIGHT);cx=512;cy=512; }
  root.scale.set(scale);root.position.set(width/2-cx*scale,height/2-cy*scale);
}
export async function createStage(host,sourceUrl,assetsBase,{debug=false,onTap=()=>{}}={}){
  const response=await fetch(`${assetsBase}derived/rig.json`);
  if(!response.ok)throw new Error('Не удалось загрузить метаданные рига');
  const metadata=await response.json();
  const [source,jointedAssets,eyeTextures]=await Promise.all([
    PIXI.Assets.load(sourceUrl),loadJointed(assetsBase),
    Promise.all(metadata.eyes.map(e=>PIXI.Assets.load(`${assetsBase}derived/${e.file}`))),
  ]);
  for(const t of [source,...eyeTextures])t.baseTexture.mipmap=PIXI.MIPMAP_MODES.ON;
  if(source.width!==SOURCE_WIDTH||source.height!==SOURCE_HEIGHT||jointedAssets.metadata.source_sha256!==metadata.source_sha256)
    throw new Error('Слои не совпадают с утверждённым исходником');
  const app=appFor(host),root=new PIXI.Container();app.stage.addChild(root);
  const original=new PIXI.Sprite(source);original.visible=false;root.addChild(original);
  const body=bodyMesh(jointedAssets.body);root.addChild(body.mesh);
  const jointed=createJointed(jointedAssets,body,{cols:COLS,rows:ROWS,width:SOURCE_WIDTH,height:SOURCE_HEIGHT});
  for(const name of ['leg_right','leg_left','arm_left','arm_right'])root.addChild(jointed.skins[name].mesh);
  const eyes=metadata.eyes.map((eye,i)=>{const sprite=new PIXI.Sprite(eyeTextures[i]);sprite.alpha=0;root.addChild(sprite);return {eye,sprite};});
  const bodyPoint=(x,y)=>deformedPoint(x,y,body.buffer.data,COLS,ROWS,SOURCE_WIDTH,SOURCE_HEIGHT);
  jointed.update(0,0,[]);
  const hitboxes=createHitboxes(root,body,{cols:COLS,rows:ROWS,width:SOURCE_WIDTH,height:SOURCE_HEIGHT,debug,onTap,deformZonePoint:jointed.zonePoint});
  let view='body';
  function resize(){
    const width=Math.max(1,Math.round(host.clientWidth)),height=Math.max(1,Math.round(host.clientHeight));
    app.renderer.resolution=window.devicePixelRatio||1;
    app.renderer.resize(width,height);fit(root,width,height,view);app.renderer.render(app.stage);
  }
  const observer=new ResizeObserver(resize);observer.observe(host);window.addEventListener('resize',resize);resize();
  let lastBodyPose={head:0,hair:0,waist:0};
  function render(time,strength,blink,{contributions=[],jointPose=null,dryRun=false}={}){
    lastBodyPose=composeBodyReaction(contributions,strength);
    updateBody(body,time,strength,lastBodyPose);jointed.update(time,strength,contributions,jointPose);
    for(const {eye,sprite} of eyes){const [x0,y0]=eye.box;const p=bodyPoint(x0,y0);sprite.position.set(p.x,p.y);sprite.alpha=Math.max(0,Math.min(1,blink));}
    if(!dryRun){hitboxes.update();app.renderer.render(app.stage);}
  }
  function sourceToClient(x,y){
    const point=hitboxes.toLocal(x,y),global=root.toGlobal(new PIXI.Point(point.x,point.y));
    const rect=app.view.getBoundingClientRect();return {x:rect.left+global.x*rect.width/app.screen.width,y:rect.top+global.y*rect.height/app.screen.height};
  }
  function zoneAtClient(x,y){
    const rect=app.view.getBoundingClientRect(),sx=(x-rect.left)*app.screen.width/rect.width,sy=(y-rect.top)*app.screen.height/rect.height;
    const boundary=app.renderer.events.rootBoundary;boundary.rootTarget ||= app.stage;
    return boundary.hitTest(sx,sy)?.name||null;
  }
  function geometryStats(){
    const p=body.buffer.data;let maxDisplacement=0,minCross=Infinity;
    for(let i=0;i<body.weights.length;i++){
      maxDisplacement=Math.max(maxDisplacement,Math.hypot(p[2*i]-body.base[2*i],p[2*i+1]-body.base[2*i+1]));
      if(i%COLS<COLS-1&&i<COLS*(ROWS-1)){
        const r=i+1,d=i+COLS,z=d+1;
        minCross=Math.min(minCross,(p[2*r]-p[2*i])*(p[2*d+1]-p[2*i+1])-(p[2*r+1]-p[2*i+1])*(p[2*d]-p[2*i]),
          (p[2*z]-p[2*r])*(p[2*d+1]-p[2*r+1])-(p[2*z+1]-p[2*r+1])*(p[2*d]-p[2*r]));
      }
    }
    return {maximumDisplacement:maxDisplacement,minimumCellCross:minCross,limbs:jointed.geometryStats()};
  }
  function readPixels(){app.renderer.render(app.stage);const gl=app.renderer.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {pixels,w,h};}
  function difference(a,b){
    let sum=0,max=0,changed=0;for(let i=0;i<a.pixels.length;i+=4){let different=false;
      for(let j=0;j<4;j++){const d=Math.abs(a.pixels[i+j]-b.pixels[i+j]);sum+=d;max=Math.max(max,d);different ||= d>0;}if(different)changed++;}
    return {meanAbsoluteDifference:sum/a.pixels.length,maxDifference:max,changedFraction:changed/(a.w*a.h),width:a.w,height:a.h};
  }
  function comparePixels(){
    render(0,0,0,{});const animated=readPixels();
    original.visible=true;body.mesh.visible=false;
    for(const skin of Object.values(jointed.skins))skin.mesh.visible=false;
    const reference=readPixels();
    original.visible=false;body.mesh.visible=true;for(const skin of Object.values(jointed.skins))skin.mesh.visible=true;
    app.renderer.render(app.stage);return difference(reference,animated);
  }
  function compareSparsePixels(){
    const sparse=readPixels();jointed.setSparseMeshes(false);const full=readPixels();
    jointed.setSparseMeshes(true);app.renderer.render(app.stage);return difference(sparse,full);
  }
  function setView(next){view=next;resize();}
  function destroy(){observer.disconnect();window.removeEventListener('resize',resize);hitboxes.destroy();app.destroy(true);}
  return {render,setView,geometryStats,comparePixels,compareSparsePixels,sourceToClient,zoneAtClient,
    jointAngles:()=>jointed.angles(),limbPoint:jointed.point,bodyPose:()=>lastBodyPose,hitboxes,metadata,app,destroy};
}
