const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const manifest=require('../assets/characters/animation-manifest.json');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(await require('@sparticuz/chromium').default.executablePath()),args:['--no-sandbox','--disable-gpu']});
 try {
 for(const width of [390,1280]){
 const p=await b.newPage({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block'});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  if(!localStorage.getItem('waifuB_save_v1'))localStorage.setItem('waifuB_save_v1',JSON.stringify({v:1,gems:10000,owned:['base','cardigan','track','apron','maid','pool','gown','bunny'],lastSeen:Date.now(),streak:{last:new Date().toISOString().slice(0,10),count:1}}));
 });
 await p.goto(process.env.GAME_URL||'http://localhost:8765');
 await p.waitForFunction(()=>document.querySelector('#character-art').complete&&document.querySelector('#character-art').naturalHeight===4096);
 await p.evaluate(()=>{
  window.artDuplicates=0;
  new MutationObserver(()=>{if(document.querySelectorAll('#character-wrap img').length!==1)window.artDuplicates++;}).observe(document.getElementById('character-wrap'),{childList:true,subtree:true});
 });
 for(const [key,item] of Object.entries(manifest.tiers)){
  assert.equal(item.type,'single');assert(fs.existsSync(item.source));
  await p.evaluate(async src=>{await CharacterAnimation.mount(document.getElementById('char-container'),src);},item.original);
  await p.waitForTimeout(330);
  assert.equal(await p.locator('#character-art').getAttribute('src'),item.source);
  assert.equal(await p.locator('#character-wrap img').count(),1);
  assert.equal(await p.locator('.rig-layer,.character-rig,.layer-face,.layer-hair-front').count(),0);
  const geometry=await p.locator('#character-art').evaluate(el=>({height:el.naturalHeight,fit:getComputedStyle(el).objectFit,animation:getComputedStyle(document.getElementById('character-surface')).animationName}));
  assert.equal(geometry.height,4096);assert.equal(geometry.fit,'contain');assert.equal(geometry.animation,'singleBreathe');
 }
 // Real wardrobe interactions, not direct renderer calls.
 for(const [key,item] of Object.entries(manifest.costumes)){
  await p.locator('#toggle-right').click();
  const idx=await p.evaluate(key=>CONTENT.COSTUMES.findIndex(c=>c.id===key),key);
  await p.locator('.costume-thumb').nth(idx).click();
  await p.locator('#toggle-right').click();
  await p.waitForFunction(src=>document.getElementById('character-art').getAttribute('src')===src,item.source);
  await p.waitForTimeout(320);
  assert.equal(await p.locator('#character-wrap img').count(),1);
 }
 // Rapid swaps: stale decode completions may not overwrite the latest request.
 await p.evaluate(async()=>{await Promise.all([1,2,3,4,5,1,2,3,4,5].map(t=>CharacterAnimation.mount(null,`assets/characters/tier${t}.webp`)));});
 assert.equal(await p.locator('#character-art').getAttribute('src'),manifest.tiers['5'].source);
 for(let i=0;i<12;i++){
  if(width<768)await p.locator('#tap-btn').tap();else await p.locator('#tap-btn').click();
 }
 await p.waitForFunction(()=>document.getElementById('char-container').getAnimations().every(a=>a.playState==='finished'));
 assert.equal(await p.locator('#char-container').evaluate(el=>getComputedStyle(el).transform),'none');
 assert.equal(await p.evaluate(()=>window.artDuplicates),0);
 await p.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await p.locator('#character-art').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(errors,[]);
 await p.screenshot({path:`/home/user/single-art-${width}.png`});
 await p.close();console.log(`PASS ${width}: 5 tiers, 7 wardrobe outfits, 4K PNGs, one image, rapid swaps/taps, reduced motion`);
 }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
