const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const manifest=require('../assets/characters/animation-manifest.json');
const rigs=[...Object.entries(manifest.tiers).map(([key,c])=>({src:`assets/characters/tier${key}.webp`,c})),...Object.entries(manifest.costumes).map(([key,c])=>({src:`assets/characters/costume_${key}.webp`,c}))];
(async()=>{
 const browser=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});
 try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://localhost:8765');
  await page.evaluate(()=>CharacterAnimation.ready);
  for(const {src,c} of rigs){
   await page.evaluate(src=>CharacterAnimation.mount(null,src),src);
   const origins=await page.evaluate(()=>['.rig-hair-front','.rig-hair-back','.rig-hair-front-react','.rig-hair-back-react'].map(sel=>{
    const s=getComputedStyle(document.querySelector(sel));return {origin:s.transformOrigin.split(' ').map(parseFloat),size:[parseFloat(s.width),parseFloat(s.height)]};
   }));
   for(const {origin,size} of origins){
    assert(Math.abs(origin[0]/size[0]-c.hairPivot[0]/c.canvas[0])<.0001,src+' x pivot');
    assert(Math.abs(origin[1]/size[1]-c.hairPivot[1]/c.canvas[1])<.0001,src+' y pivot');
   }
  }
  // Last requested costume wins even with multiple queued mounts.
  await page.evaluate(async paths=>Promise.all(paths.map(src=>CharacterAnimation.mount(null,src))),rigs.map(r=>r.src));
  assert.equal(await page.locator('.body-base').getAttribute('src'),rigs.at(-1).c.layers.body_base);
  await page.evaluate(()=>{CharacterAnimation.react();document.body.classList.add('no-motion');});
  await page.waitForTimeout(30);
  assert.equal(await page.locator('.face-open').evaluate(e=>getComputedStyle(e).opacity),'1');
  assert.equal(await page.locator('.face-closed').evaluate(e=>getComputedStyle(e).opacity),'0');
  assert.equal(await page.locator('.rig-hair-front').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await page.locator('.rig-hair-front-react').evaluate(e=>e.getAnimations().length),0);
  await page.evaluate(()=>document.body.classList.remove('no-motion'));
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.face-closed').evaluate(e=>getComputedStyle(e).opacity),'0');
  assert.equal(await page.locator('.rig-hair-back').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${width}: 12 head pivots, rapid wardrobe cancellation, Motion OFF and reduced motion`);
 }
 // One missing component must not replace the previous complete character.
 const page=await browser.newPage({serviceWorkers:'block'});
 await page.route('**/costume_gown/hair_front.png',route=>route.abort());
 await page.goto(process.env.GAME_URL||'http://localhost:8765');
 await page.evaluate(()=>CharacterAnimation.mount(null,'assets/characters/tier1.webp'));
 const previous=await page.locator('.body-base').getAttribute('src');
 const failed=await page.evaluate(async()=>{let commits=0;const mounted=await CharacterAnimation.mount(null,'assets/characters/costume_gown.webp',()=>commits++);return {mounted,commits};});
 assert.deepEqual(failed,{mounted:false,commits:0});
 const cached=await page.evaluate(async()=>{let commits=0;const mounted=await CharacterAnimation.mount(null,'assets/characters/tier1.webp',()=>commits++);return {mounted,commits};});
 assert.deepEqual(cached,{mounted:true,commits:1});
 assert.equal(await page.locator('.body-base').getAttribute('src'),previous);
 assert.equal(await page.locator('#character-surface img').count(),5);
 await page.close();console.log('PASS failed layer decode retains previous complete rig');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
