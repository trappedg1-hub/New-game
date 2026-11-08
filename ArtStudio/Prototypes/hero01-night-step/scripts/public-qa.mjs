// Public Vercel smoke test. Touch is emulated; this is not a physical-phone benchmark.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from 'playwright-core';
import chromium, { inflate } from '@sparticuz/chromium';

const root=new URL(process.env.NIGHT_STEP_PUBLIC_URL||'https://hero01-idle-prototype.vercel.app/');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const get=async path=>{
  const url=new URL(path,root),response=await fetch(url,{cache:'no-store'});
  assert.equal(response.status,200,`${url}: HTTP ${response.status}; expected public access`);
  return Buffer.from(await response.arrayBuffer());
};
const localHtml=(await readFile('dist/index.html')).toString('utf8');
const publicHtml=(await get('')).toString('utf8');
assert.match(publicHtml,/Night Step — Motion Study/);
const bundle=(html,ext)=>html.match(new RegExp(`(?:\\./)?(assets/index-[^" ]+\\.${ext})`))?.[1];
for(const ext of ['js','css'])assert.equal(bundle(publicHtml,ext),bundle(localHtml,ext),`public ${ext} bundle differs from build`);
const assets=await readdir('dist/assets');
const image=assets.find(name=>name.startsWith('HERO-01_outfit10_night_lingerie_step_pose-')&&name.endsWith('.png'));
assert.ok(image,'approved source image missing from build');
const paths=[bundle(localHtml,'js'),bundle(localHtml,'css'),`assets/${image}`,'derived/rig.json','derived/jointed/jointed.json',
  ...['body','arm_left','arm_right','leg_left','leg_right'].map(part=>`derived/jointed/${part}.png`),
  'derived/eye_left_closed.png','derived/eye_right_closed.png'];
for(const path of paths){const [remote,local]=await Promise.all([get(path),readFile(`dist/${path}`)]);assert.equal(sha(remote),sha(local),`${path} differs`);}
console.log(`Public HTML and ${paths.length} assets match the local production build.`);

const executable=await chromium.executablePath();let env={...process.env};
if(process.platform==='linux'){
  const entry=fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  const libs=await inflate(join(dirname(entry),'../bin/al2023.tar.br'));
  env.LD_LIBRARY_PATH=[join(libs,'lib'),env.LD_LIBRARY_PATH].filter(Boolean).join(':');
}
const browser=await playwright.launch({executablePath:executable,headless:true,args:chromium.args,env});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(`page: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`HTTP ${r.status()}: ${r.url()}`);});
  try{
    await page.goto(new URL('?qa=1',root).href,{waitUntil:'networkidle',timeout:90000});
    await page.waitForFunction(()=>window.__NIGHT_STEP_QA__||!document.querySelector('#error-message').hidden,null,{timeout:90000});
    const state=await page.evaluate(()=>({ready:!!window.__NIGHT_STEP_QA__,message:document.querySelector('#error-message').textContent}));
    assert.ok(state.ready,`WebGL scene failed: ${state.message}; ${errors.join('; ')}`);
    assert.equal(await page.evaluate(()=>window.__NIGHT_STEP_QA__.getState().sourceHash),'bfa845260fdaecdb44d4e01fb57f608c193910d1db98f8ed7b6d3340262729f7');
    const geo=await page.evaluate(()=>window.__NIGHT_STEP_QA__.frame({time:0,strength:1,contributions:[{zone:'footNear',variant:0,amount:1,followAmount:1,lateAmount:1}]}));
    assert.ok(geo.minimumCellCross>0);for(const limb of Object.values(geo.limbs))assert.ok(limb.minimumCellCross>0);
    await page.evaluate(()=>window.__NIGHT_STEP_QA__.resume());
    const zones={footNear:[410,780],legRight:[590,710],handLeft:[315,420],handRight:[710,420],face:[510,100]};
    await page.locator('#animated-view').scrollIntoViewIfNeeded();
    for(const [zone,point] of Object.entries(zones)){
      const xy=await page.evaluate(([x,y])=>window.__NIGHT_STEP_QA__.sourceToClient(x,y),point);
      assert.equal(await page.evaluate(({x,y})=>window.__NIGHT_STEP_QA__.zoneAtClient(x,y),xy),zone,`${zone}: hitbox`);
      const count=await page.evaluate(()=>window.__NIGHT_STEP_QA__.getState().reaction.count);
      await page.touchscreen.tap(xy.x,xy.y);await page.waitForTimeout(160);
      const after=await page.evaluate(()=>window.__NIGHT_STEP_QA__.getState());
      assert.equal(after.reaction.count,count+1,`${zone}: tap`);assert.equal(after.lastReaction.zone,zone);assert.equal(after.input,'touch');
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');
    assert.deepEqual(errors,[]);console.log('Public Chromium: WebGL startup, source, geometry and five real emulated touch zones passed.');
  }catch(error){console.error('Public diagnostics:',JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1800)}));throw error;}
  finally{await context.close();}
}finally{await browser.close();}
