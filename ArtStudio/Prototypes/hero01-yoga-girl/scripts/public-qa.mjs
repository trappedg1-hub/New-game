// Public-deployment smoke test. The WebKit viewport is emulated, not a real iPhone.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { webkit } from 'playwright-core';

const root=new URL(process.env.YOGA_PUBLIC_URL || 'https://hero01-yoga-girl-prototype.vercel.app/');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const get=async path=>{
  const url=new URL(path,root), response=await fetch(url,{cache:'no-store'});
  assert.equal(response.status,200,`${url}: HTTP ${response.status}; publication must not require login`);
  return Buffer.from(await response.arrayBuffer());
};
const localHtml=await readFile('dist/index.html','utf8');
const publicHtml=(await get('')).toString('utf8');
assert.match(publicHtml,/YOGA GIRL — предпросмотр анимации/);
const jsName=html=>html.match(/(?:\.\/)?(assets\/index-[^" ]+\.js)/)?.[1];
assert.ok(jsName(localHtml));assert.equal(jsName(publicHtml),jsName(localHtml),'public JS differs from local build');
const assetNames=await readdir('dist/assets');
const image=assetNames.find(name=>name.startsWith('HERO-01_outfit05_yoga_girl-')&&name.endsWith('.png'));
assert.ok(image,'approved image missing from build');
const files=[jsName(localHtml),`assets/${image}`,'derived/rig.json','derived/jointed/jointed.json',
  ...['body','arm_left','arm_right','leg_left','leg_right','shorts'].map(part=>`derived/jointed/${part}.png`),
  ...['left','right'].flatMap(eye=>['open','closed','underpaint'].map(layer=>`derived/eye_${eye}_${layer}.png`))];
for(const file of files){
  const [remote,local]=await Promise.all([get(file),readFile(`dist/${file}`)]);
  assert.equal(sha(remote),sha(local),`${file} differs from the built file`);
}
console.log(`Public HTML and ${files.length} bundle/asset hashes match.`);
if(process.env.YOGA_SKIP_BROWSER==='1')process.exit(0);

const browser=await webkit.launch({headless:true});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(`page: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});
  page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))errors.push(`HTTP ${response.status()}: ${response.url()}`);});
  try{
    await page.goto(new URL('?qa=1',root).href,{waitUntil:'networkidle',timeout:90000});
    await page.waitForFunction(()=>window.__YOGA_QA__ || !document.querySelector('#error-message').hidden,null,{timeout:90000});
    const startup=await page.evaluate(()=>({ready:!!window.__YOGA_QA__,message:document.querySelector('#error-message').textContent}));
    assert.equal(startup.ready,true,`scene did not load: ${startup.message}; errors: ${errors.join('; ')}`);
    assert.equal(await page.locator('#play-toggle').isEnabled(),true);
    assert.equal(await page.evaluate(()=>window.__YOGA_QA__.getState().sourceHash),'5cd0f5faca1f86fa3f0dfca6429615a877cc98b60c5af542ccbb99a1ff16a317');
    const measured=await page.evaluate(()=>{
      const qa=window.__YOGA_QA__,geometry=qa.frame({time:3,strength:1.5,blink:0});
      const blink=qa.compareFrames({time:0,strength:0,blink:0},{time:0,strength:0,blink:1});
      const cycle=qa.compareFrames({time:0,strength:1.5,blink:0},{time:12,strength:1.5,blink:0});
      return {geometry,blink,cycle};
    });
    assert.ok(measured.geometry.minimumCellCross>0);
    for(const part of Object.values(measured.geometry.limbs))assert.ok(part.minimumCellCross>0);
    assert.ok(measured.blink.changedFraction>0.00001,'blinking must alter pixels');
    assert.equal(measured.cycle.maxDifference,0,'body loop must close');
    await page.evaluate(()=>window.__YOGA_QA__.resume());await page.waitForTimeout(200);
    const points={head:[800,100],hair:[400,500],face:[900,350],shoulderLeft:[560,820],shoulderRight:[950,700],
      armLeft:[460,1200],armRight:[1100,1300],handLeft:[280,1530],handRight:[1240,1520],
      upperTorso:[700,850],waist:[750,1070],legLeft:[520,2000],legRight:[1050,2000]};
    for(const [zone,source] of Object.entries(points)){
      await page.locator('#animated-view').scrollIntoViewIfNeeded();
      let point=await page.evaluate(([x,y])=>window.__YOGA_QA__.sourceToClient(x,y),source);
      if(point.y<30||point.y>814){
        await page.evaluate(y=>window.scrollBy(0,y-innerHeight/2),point.y);await page.waitForTimeout(60);
        point=await page.evaluate(([x,y])=>window.__YOGA_QA__.sourceToClient(x,y),source);
      }
      assert.ok(point.x>=0&&point.x<390&&point.y>=0&&point.y<844,`${zone} outside viewport`);
      assert.equal(await page.evaluate(({x,y})=>window.__YOGA_QA__.zoneAtClient(x,y),point),zone,`${zone} hit target`);
      const before=await page.evaluate(()=>window.__YOGA_QA__.getState().reaction.count);
      await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(180);
      const state=await page.evaluate(()=>window.__YOGA_QA__.getState());
      assert.equal(state.reaction.count,before+1,`${zone} did not react`);
      assert.equal(state.lastReaction.zone,zone);assert.equal(state.input,'touch');
    }
    await page.locator('#view-face').click();assert.equal(await page.locator('#view-face').getAttribute('aria-pressed'),'true');
    await page.locator('#view-body').click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log('Public WebKit: scene, 12-second closure, blink, 13 touch zones and face/body controls passed.');
    console.log('WebKit is emulated; no physical iPhone or hardware FPS result is implied.');
  }catch(error){
    console.error('Public WebKit diagnostics:',JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1600)}));
    throw error;
  }finally{await context.close();}
}finally{await browser.close();}
