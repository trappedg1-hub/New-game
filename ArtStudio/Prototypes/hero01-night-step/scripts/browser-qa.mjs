// Real Chromium mouse/touch input against the local isolated preview.
// This is emulation, not a claim of physical-phone performance or visual perfection.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium as playwright } from 'playwright-core';
import chromium, { inflate } from '@sparticuz/chromium';

const root=fileURLToPath(new URL('..',import.meta.url));
const executable=process.env.CHROMIUM_PATH||await chromium.executablePath();
let env={...process.env};
if(process.platform==='linux'&&!process.env.CHROMIUM_PATH){
  // Serverless Chromium bundles NSS libraries separately. Extract them rather
  // than depending on a pre-existing /tmp or a globally installed browser.
  const entry=fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  const directory=await inflate(join(dirname(entry),'../bin/al2023.tar.br'));
  env.LD_LIBRARY_PATH=[join(directory,'lib'),env.LD_LIBRARY_PATH].filter(Boolean).join(':');
}
const args=[...chromium.args];
const vite=await createServer({root,configFile:join(root,'vite.config.js'),logLevel:'error',
  server:{host:'0.0.0.0',port:53501,strictPort:false}});
await vite.listen();
const base=`http://127.0.0.1:${vite.httpServer.address().port}/?qa=1`;
const zones={footNear:[410,780],legLeft:[455,500],legRight:[590,710],footFar:[565,980],
  handLeft:[315,420],handRight:[710,420],armLeft:[379,320],armRight:[655,320],
  face:[510,100],hair:[390,260],head:[510,30],torso:[535,210],waist:[535,280]};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getState=page=>page.evaluate(()=>window.__NIGHT_STEP_QA__.getState());
async function clickZone(page,kind,id,xy){
  const point=await page.evaluate(([x,y])=>window.__NIGHT_STEP_QA__.sourceToClient(x,y),xy);
  const hit=await page.evaluate(({x,y})=>window.__NIGHT_STEP_QA__.zoneAtClient(x,y),point);
  assert.equal(hit,id,`${kind}: hitbox at ${id}`);
  const count=(await getState(page)).reaction.count;
  if(kind==='touch')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  await page.waitForFunction(expected=>window.__NIGHT_STEP_QA__.getState().reaction.count===expected,count+1,{timeout:5000});
  const state=await getState(page);assert.equal(state.lastReaction.zone,id);assert.equal(state.input,kind);
  await sleep(140); // Real cooldown and animation frames, not synthetic DOM events.
}
async function launch(){return playwright.launch({executablePath:executable,headless:true,args,env});}
async function testDesktop(){
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__NIGHT_STEP_QA__);
    const original=await page.evaluate(()=>window.__NIGHT_STEP_QA__.comparePixels());
    assert.ok(original.meanAbsoluteDifference<.2,`neutral raster difference ${original.meanAbsoluteDifference}`);
    for(const zone of ['footNear','legRight','handLeft','handRight']){
      const sparse=await page.evaluate(zone=>{const q=window.__NIGHT_STEP_QA__;
        q.frame({time:0,strength:1.35,contributions:[{zone,variant:2,amount:1,followAmount:1,lateAmount:1}]});
        return q.compareSparsePixels();},zone);
      assert.equal(sparse.maxDifference,0,`sparse mesh changed visible pixels for ${zone}`);
    }
    await page.evaluate(()=>window.__NIGHT_STEP_QA__.resume());
    await page.locator('#animated-view').scrollIntoViewIfNeeded();
    for(const [id,xy] of Object.entries(zones))await clickZone(page,'mouse',id,xy);
    const point=await page.evaluate(()=>window.__NIGHT_STEP_QA__.sourceToClient(410,780));
    let count=(await getState(page)).reaction.count;
    await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+35,point.y+35,{steps:4});await page.mouse.up();
    await sleep(100);assert.equal((await getState(page)).reaction.count,count,'drag must not trigger tap');
    assert.equal(await page.evaluate(()=>window.__NIGHT_STEP_QA__.pendingPointers()),0);
    await page.locator('#animated-view').focus();await page.keyboard.press('3');await sleep(100);
    assert.equal((await getState(page)).lastReaction.zone,'handLeft');
    await page.locator('#play-toggle').click();assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'),'true');
    const paused=(await getState(page)).idleTime;await sleep(180);
    assert.ok(Math.abs((await getState(page)).idleTime-paused)<.025,'pause freezes idle');
    await page.locator('#blink-button').click();await sleep(100);assert.ok((await getState(page)).blink>.1,'manual blink works paused');
    await page.locator('#compare-toggle').click();assert.equal(await page.locator('#reference-section').isVisible(),true);
    assert.equal(await page.locator('#source-image').evaluate(img=>img.naturalWidth),1024);
    await page.locator('#compare-toggle').click();assert.equal(await page.locator('#reference-section').isHidden(),true);
    await page.locator('#view-face').click();await clickZone(page,'mouse','face',zones.face);
    await page.locator('#view-body').click();
    // Sample every zone and reaction variation at maximum strength. A positive
    // oriented cross product excludes flipped mesh triangles at tested frames.
    const geometry=await page.evaluate(async()=>{
      const q=window.__NIGHT_STEP_QA__,{reactionEnvelope:e}=await import('/src/reactions.js'),{ZONES}=await import('/src/zones.js');
      const worst={body:Infinity};for(const limb of ['leg_right','leg_left','arm_left','arm_right'])worst[limb]=Infinity;
      for(const {id} of ZONES)for(let variant=0;variant<3;variant++)for(let n=0;n<=42;n++){
        const t=n*.05,contributions=[{zone:id,variant,amount:e(t),followAmount:e(t-.065),lateAmount:e(t-.13)}];
        const g=q.geometryAt({time:0,strength:1.35,contributions});worst.body=Math.min(worst.body,g.minimumCellCross);
        for(const [limb,s] of Object.entries(g.limbs))worst[limb]=Math.min(worst[limb],s.minimumCellCross);
      }
      return worst;
    });
    for(const [name,cross] of Object.entries(geometry))assert.ok(cross>0,`${name} folded: ${cross}`);
    assert.deepEqual(errors,[]);console.log('Desktop: 13 actual mouse zones, drag, keyboard, pause, blink, comparison, zoom — PASS');
    console.log('Neutral WebGL mean difference:',original.meanAbsoluteDifference.toFixed(4),'; minimum sampled triangle cross:',JSON.stringify(geometry));
  }finally{await browser.close();}
}
async function testMobile(){
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errors=[];
    page.on('pageerror',error=>errors.push(error.message));await page.goto(base,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__NIGHT_STEP_QA__);await page.locator('#animated-view').scrollIntoViewIfNeeded();
    for(const [id,xy] of Object.entries(zones))await clickZone(page,'touch',id,xy);
    const client=await page.context().newCDPSession(page);
    const point=await page.evaluate(()=>window.__NIGHT_STEP_QA__.sourceToClient(410,780));let count=(await getState(page)).reaction.count;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:0}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-90,id:0}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(120);
    assert.equal((await getState(page)).reaction.count,count,'scroll must not trigger tap');
    assert.equal(await page.evaluate(()=>window.__NIGHT_STEP_QA__.pendingPointers()),0);
    await page.locator('#animated-view').scrollIntoViewIfNeeded();
    const second=await page.evaluate(()=>window.__NIGHT_STEP_QA__.sourceToClient(410,780));
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:second.x,y:second.y,id:0}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:second.x,y:second.y,id:0},{x:second.x+18,y:second.y,id:1}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:second.x+18,y:second.y,id:1}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(120);
    assert.equal((await getState(page)).reaction.count,count,'multi-touch must not trigger tap');
    assert.equal(await page.evaluate(()=>window.__NIGHT_STEP_QA__.pendingPointers()),0);
    await page.locator('[data-zone="handRight"]').click();assert.equal((await getState(page)).lastReaction.zone,'handRight');
    for(const width of [320,375,390,650]){
      await page.setViewportSize({width,height:844});
      const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(layout.scroll<=layout.viewport,`horizontal overflow at ${width}: ${JSON.stringify(layout)}`);
    }
    assert.deepEqual(errors,[]);console.log('Mobile emulation: 13 actual touch zones, scroll/multitouch rejection, quick controls, 320–650px layouts — PASS');
  }finally{await browser.close();}
}
async function testReducedMotion(){
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__NIGHT_STEP_QA__);
    assert.equal((await getState(page)).playing,false);await page.locator('[data-zone="footNear"]').click();
    assert.equal((await getState(page)).lastReaction.zone,'footNear');console.log('Reduced motion: idle paused, explicit reactions available — PASS');
  }finally{await browser.close();}
}
try{await testDesktop();await testMobile();await testReducedMotion();}
finally{await vite.close();}
