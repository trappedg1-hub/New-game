// Run against the isolated Vite server: CHROME_PATH=/path/to/chromium node scripts/browser-qa.mjs
// Mobile uses Chromium touch emulation, not a physical phone or Safari.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const url=process.env.PREVIEW_URL || 'http://127.0.0.1:5188';
const executablePath=process.env.CHROME_PATH || undefined;
const launchOptions={ headless:true, executablePath, args:['--no-sandbox','--disable-dev-shm-usage',
  '--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--no-zygote','--single-process','--in-process-gpu'] };
const points={head:[800,100],hair:[400,500],face:[900,350],shoulderLeft:[560,820],shoulderRight:[950,700],
  armLeft:[460,1200],armRight:[1100,1300],handLeft:[280,1530],handRight:[1240,1520],
  upperTorso:[700,850],waist:[750,1070],legLeft:[520,2000],legRight:[1050,2000]};
const errors=[];
function listen(page,kind) {
  page.on('pageerror',error=>errors.push(`${kind}: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`${kind}: ${message.text()}`);});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${kind}: HTTP ${response.status()} ${response.url()}`);});
}
async function init(page) {
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle',timeout:90000});
  await page.waitForFunction(()=>window.__YOGA_QA__,null,{timeout:45000});
  assert.equal(await page.locator('#error-message').isHidden(),true);
  assert.equal(await page.locator('#play-toggle').isEnabled(),true);
  const sourceHash=await page.evaluate(()=>window.__YOGA_QA__.getState().sourceHash);
  assert.equal(sourceHash,'5cd0f5faca1f86fa3f0dfca6429615a877cc98b60c5af542ccbb99a1ff16a317');
}
async function clientPoint(page, x, y) {
  await page.locator('#animated-view').scrollIntoViewIfNeeded();
  let p=await page.evaluate(([x,y])=>window.__YOGA_QA__.sourceToClient(x,y),[x,y]);
  const size=page.viewportSize();
  if(p.y<30||p.y>size.height-30){
    await page.evaluate((py)=>window.scrollBy(0,py-innerHeight/2),p.y);
    await page.waitForTimeout(40);
    p=await page.evaluate(([x,y])=>window.__YOGA_QA__.sourceToClient(x,y),[x,y]);
  }
  assert.ok(p.x>=0&&p.x<size.width&&p.y>=0&&p.y<size.height,`point outside viewport: ${JSON.stringify(p)}`);
  return p;
}
async function testTaps(page, type) {
  await page.evaluate(()=>window.__YOGA_QA__.resume());
  await page.waitForTimeout(200);
  for(const [zone,[x,y]] of Object.entries(points)) {
    const p=await clientPoint(page,x,y);
    const target=await page.evaluate(({x,y})=>window.__YOGA_QA__.zoneAtClient(x,y),p);
    assert.equal(target,zone,`${type}: ${zone} maps to ${target}`);
    const before=await page.evaluate(()=>window.__YOGA_QA__.getState().reaction.count);
    if(type==='touch') await page.touchscreen.tap(p.x,p.y);
    else await page.mouse.click(p.x,p.y);
    await page.waitForTimeout(140);
    const state=await page.evaluate(()=>window.__YOGA_QA__.getState());
    assert.equal(state.reaction.count,before+1,`${type}: ${zone} did not produce a reaction`);
    assert.equal(state.lastReaction.zone,zone,`${type}: wrong reaction zone`);
    assert.equal(state.input,type);
  }
  return Object.keys(points).length;
}
async function getFps(page,durationMs=5000) {
  return page.evaluate(ms=>new Promise(resolve=>{
    let start,previous,frames=0;const deltas=[];
    function tick(now){
      if(start===undefined)start=now;
      if(previous!==undefined)deltas.push(now-previous);previous=now;frames++;
      if(now-start>=ms){deltas.sort((a,b)=>a-b);resolve({frames,seconds:(now-start)/1000,
        fps:(frames-1)/((now-start)/1000),medianMs:deltas[Math.floor(deltas.length/2)],p95Ms:deltas[Math.floor(deltas.length*.95)]});}
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }),durationMs);
}

async function desktop() {
  const browser=await chromium.launch(launchOptions);
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1050},deviceScaleFactor:1});
    const page=await context.newPage();listen(page,'desktop');await init(page);
    await page.locator('#layout-compare').click();
    const neutral=await page.evaluate(()=>{const q=window.__YOGA_QA__;q.frame({time:0,strength:0,blink:0});return q.comparePixels();});
    assert.equal(neutral.comparable,true);assert.ok(neutral.meanAbsoluteDifference<0.7,JSON.stringify(neutral));
    const differences=await page.evaluate(()=>{const q=window.__YOGA_QA__;
      return {motion:q.compareFrames({time:0,strength:0,blink:0},{time:3,strength:1.5,blink:0}),
        blink:q.compareFrames({time:0,strength:0,blink:0},{time:0,strength:0,blink:1})};});
    assert.ok(differences.motion.changedFraction>0.001);assert.ok(differences.blink.changedFraction>0.00001);
    const closure=await page.evaluate(()=>window.__YOGA_QA__.compareFrames(
      {time:0,strength:1.5,blink:0},{time:12,strength:1.5,blink:0}));
    assert.equal(closure.maxDifference,0,'12-second cycle should match at its seam');
    const culling=await page.evaluate(()=>{
      const q=window.__YOGA_QA__,frames=[
        {time:0,strength:0,blink:0},{time:3,strength:1.5,blink:0},{time:0,strength:0,blink:1},
        {time:0,strength:0,blink:0,jointPose:{armLeft:{shoulder:.017,elbow:.020,wrist:.024},legLeft:{hip:.012,knee:.016,ankle:.024}}},
        {time:0,strength:0,blink:0,jointPose:{armRight:{shoulder:-.014,elbow:-.018,wrist:-.024},legRight:{hip:-.012,knee:-.016,ankle:-.024}}},
        {time:6,strength:1.5,blink:0,contributions:[{zone:'waist',variant:2,amount:1,followAmount:1,lateAmount:1}]},
      ];
      return frames.map(frame=>q.compareCulling(frame));
    });
    for(const result of culling)assert.equal(result.maxDifference,0,`culled pixels differ: ${JSON.stringify(result)}`);
    await page.locator('#layout-solo').click();
    await page.locator('#view-face').click();assert.equal(await page.locator('#view-face').getAttribute('aria-pressed'),'true');
    await page.locator('#view-body').click();assert.equal(await page.locator('#view-body').getAttribute('aria-pressed'),'true');
    await page.locator('#intensity').focus();await page.keyboard.press('End');
    assert.equal(await page.locator('#intensity-value').textContent(),'150%');

    // Every 60 Hz sample of both full body cycles; then isolated joint extremes,
    // simultaneous extremes and each reaction variant. These are geometric
    // checks, not a claim of perceptual review of infinitely many frames.
    const geometry=await page.evaluate((zones)=>{
      const q=window.__YOGA_QA__, names={armLeft:['shoulder','elbow','wrist'],armRight:['shoulder','elbow','wrist'],
        legLeft:['hip','knee','ankle'],legRight:['hip','knee','ankle']};
      const probes={armLeft:[240,1560],armRight:[1290,1550],legLeft:[430,2550],legRight:[1090,2550]};
      let min=Infinity,max=0,maxStep=0,count=0,previous=null;const layerMin={};
      function check(options,track=false){
        const stats=q.geometryAt(options); count++;
        if(!Number.isFinite(stats.minimumCellCross)||stats.minimumCellCross<=0)throw Error('folded body '+JSON.stringify(options));
        min=Math.min(min,stats.minimumCellCross);max=Math.max(max,stats.maximumDisplacement);
        for(const [layer,s] of Object.entries(stats.limbs)){
          if(!Number.isFinite(s.minimumCellCross)||s.minimumCellCross<=0)throw Error('folded '+layer+' '+JSON.stringify(options));
          layerMin[layer]=Math.min(layerMin[layer]??Infinity,s.minimumCellCross);
        }
        if(track){
          const now=Object.fromEntries(Object.entries(probes).map(([name,[x,y]])=>[name,q.limbPoint(name,x,y)]));
          if(previous)for(const name of Object.keys(now))maxStep=Math.max(maxStep,Math.hypot(now[name].x-previous[name].x,now[name].y-previous[name].y));
          previous=now;
        }
      }
      for(const strength of [1,1.5]){previous=null;for(let frame=0;frame<=720;frame++)check({time:frame/60,strength,blink:0},true);}
      for(const [limb,parts] of Object.entries(names))for(const part of parts)for(const sign of [-1,1])
        check({time:0,strength:0,jointPose:{[limb]:{[part]:sign*999}}});
      for(const sign of [-1,1]){
        const pose=Object.fromEntries(Object.entries(names).map(([limb,parts])=>[limb,Object.fromEntries(parts.map(part=>[part,sign*999]))]));
        check({time:0,strength:0,jointPose:pose});
      }
      for(const zone of zones)for(const variant of [0,1,2])for(const time of [0,3,6,9])
        check({time,strength:1.5,contributions:[{zone,variant,amount:1,followAmount:1,lateAmount:1}]});
      return {framesChecked:count,minBodyCross:min,minLayerCross:layerMin,maxBodyDisplacement:max,maxProbeStep:maxStep};
    },Object.keys(points));
    assert.ok(geometry.maxProbeStep<1,`probe step: ${geometry.maxProbeStep}`);
    const clicks=await testTaps(page,'mouse');
    // Dragging does not produce a tap and must release pointer bookkeeping.
    const p=await clientPoint(page,...points.hair);
    const before=await page.evaluate(()=>window.__YOGA_QA__.getState().reaction.count);
    await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+35,p.y+30,{steps:5});await page.mouse.up();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.__YOGA_QA__.getState().reaction.count),before);
    assert.equal(await page.evaluate(()=>window.__YOGA_QA__.pendingPointers()),0);
    await page.locator('#play-toggle').click();assert.equal(await page.locator('#play-status').textContent(),'Анимация на паузе');
    await page.locator('#blink-button').click();await page.waitForTimeout(180);
    assert.ok((await page.evaluate(()=>window.__YOGA_QA__.getState())).currentBlink>0);
    await page.locator('#play-toggle').click();
    const renderer=await page.evaluate(()=>{const c=document.querySelector('#animated-view canvas');const gl=c.getContext('webgl2')||c.getContext('webgl');const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
    const fps=await getFps(page);
    await page.screenshot({path:'/tmp/yoga-desktop-final.png',fullPage:true});
    return {neutral,differences,closureMaxDifference:closure.maxDifference,cullingFramesMatched:culling.length,geometry,clicks,renderer,fps};
  }finally{await browser.close();}
}
async function mobile() {
  const browser=await chromium.launch(launchOptions);
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page=await context.newPage();listen(page,'mobile');await init(page);
    assert.equal(await page.locator('#play-status').textContent(),'Анимация на паузе');
    await page.locator('#play-toggle').click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    const touches=await testTaps(page,'touch');
    await page.locator('#view-face').click();assert.equal(await page.locator('#view-face').getAttribute('aria-pressed'),'true');
    await page.locator('#view-body').click();
    const fps=await getFps(page);
    await page.screenshot({path:'/tmp/yoga-mobile-final.png',fullPage:true});
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    const p=await clientPoint(page,...points.handRight);
    assert.equal(await page.evaluate(({x,y})=>window.__YOGA_QA__.zoneAtClient(x,y),p),'handRight');
    const before=await page.evaluate(()=>window.__YOGA_QA__.getState().reaction.count);
    await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(140);
    assert.equal(await page.evaluate(()=>window.__YOGA_QA__.getState().reaction.count),before+1);
    return {touches,viewport:{width:390,height:844,dpr:3},landscapeTouch:true,reducedMotionPaused:true,fps};
  }finally{await browser.close();}
}
const result={desktop:await desktop(),mobile:await mobile(),errors};
assert.deepEqual(errors,[]);
await writeFile('/tmp/yoga-browser-qa.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
