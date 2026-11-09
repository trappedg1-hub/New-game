const {chromium}=require('playwright');const assert=require('node:assert/strict');
const fs=require('node:fs');const m=require('../assets/characters/animation-manifest.json');
(async()=>{const b=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});try{
for(const width of [390,1280]){
const p=await b.newPage({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>localStorage.setItem('waifuB_save_v1',JSON.stringify({v:1,level:76,gems:10000,owned:['base','cardigan','track','apron','maid','pool','gown','bunny','ribbon'],lastSeen:Date.now(),streak:{last:new Date().toISOString().slice(0,10),count:1}})));
await p.goto(process.env.GAME_URL||'http://localhost:8765');await p.waitForTimeout(1000);await p.keyboard.press('Escape');
assert.equal(await p.locator('feDisplacementMap,feTurbulence,.eyelid-mask').count(),0);
for(const [t,c] of Object.entries(m.tiers)){
 await p.evaluate(async src=>CharacterAnimation.mount(null,src),`assets/characters/tier${t}.webp`);
 assert.equal(await p.locator('#character-surface').getAttribute('data-mode'),'layered');assert.equal(await p.locator('#character-surface img').count(),5);
 const states=await p.evaluate(()=>{
  const a=document.querySelector('.face-open'),b=document.querySelector('.face-closed');
  const anim=[a.getAnimations()[0],b.getAnimations()[0]];anim.forEach(x=>x.pause());
  const pairs=[0,4274,4275,4364,4365,4500].map(time=>{anim.forEach(x=>x.currentTime=time);return [getComputedStyle(a).opacity,getComputedStyle(b).opacity];});
  anim.forEach(x=>x.play());return pairs;
 });assert.deepEqual(states,[['1','0'],['1','0'],['0','1'],['0','1'],['1','0'],['1','0']]);
 const geometry=await p.evaluate(ground=>{
 const body=document.querySelector('.body-base').getBoundingClientRect(),face=document.querySelector('.face-open').getBoundingClientRect(),root=document.getElementById('char-container').getBoundingClientRect(),stage=document.getElementById('stage').getBoundingClientRect();
 return {drift:Math.abs(body.x-face.x)+Math.abs(body.y-face.y)+Math.abs(body.width-face.width)+Math.abs(body.height-face.height),bottom:root.bottom-(1-ground.floor)*root.height,ground:stage.bottom-stage.height*.02};
 },c.ground);assert(geometry.drift<.05);assert(Math.abs(geometry.bottom-geometry.ground)<2);
 for(const selector of ['.rig-hair-back','.rig-hair-front']){
 const states=await p.locator(selector).evaluate(e=>{const a=e.getAnimations()[0];a.pause();a.currentTime=700;const first=getComputedStyle(e).transform;a.currentTime=2600;const second=getComputedStyle(e).transform;a.play();return [first,second];});assert.notEqual(states[0],states[1]);
 }
 await p.evaluate(()=>CharacterAnimation.react());await p.waitForTimeout(100);
 assert.equal(await p.locator('#char-container').evaluate(e=>getComputedStyle(e).transform),'none');
 if(width===390)await p.screenshot({path:`/home/user/true-tier${t}.png`});
}
const scenes={cardigan:'classroom',track:'classroom',apron:'cafe',maid:'cafe',pool:'pool',gown:'bedroom',bunny:'beach',ribbon:'cafe'};
for(const [key,env] of Object.entries(scenes)){
 await p.locator('#toggle-right').click();const idx=await p.evaluate(k=>CONTENT.COSTUMES.findIndex(c=>c.id===k),key);await p.locator('.costume-thumb').nth(idx).click();await p.locator('#toggle-right').click();
 if(m.costumes[key].type==='layered'){
 await p.waitForFunction(src=>document.querySelector('.body-base')?.getAttribute('src')===src,m.costumes[key].layers.body_base);
 assert.equal(await p.locator('#character-surface img').count(),5);
 assert.equal(await p.locator('.face-open,.face-closed').count(),2);
 const blink=await p.evaluate(()=>{
 const a=document.querySelector('.face-open'),b=document.querySelector('.face-closed');
 const anim=[a.getAnimations()[0],b.getAnimations()[0]];anim.forEach(x=>x.pause());
 const pairs=[0,4300,4500].map(t=>{anim.forEach(x=>x.currentTime=t);return [getComputedStyle(a).opacity,getComputedStyle(b).opacity];});anim.forEach(x=>x.play());return pairs;
 });assert.deepEqual(blink,[['1','0'],['0','1'],['1','0']]);
 const hairStates=await p.locator('.rig-hair-front').evaluate(e=>{
 const a=e.getAnimations()[0];a.pause();a.currentTime=0;const first=getComputedStyle(e).transform;
 a.currentTime=1050;const second=getComputedStyle(e).transform;a.play();return [first,second];
 });assert.notEqual(hairStates[0],hairStates[1]);
 if(width===390){await p.waitForTimeout(500);await p.screenshot({path:`/home/user/${key}-runtime.png`});}
 }else{
 await p.waitForFunction(src=>document.querySelector('#character-art')?.getAttribute('src')===src,m.costumes[key].source);
 assert.equal(await p.locator('#character-surface img').count(),1);assert.equal(await p.locator('.face-open,.face-closed').count(),0);
 }assert.equal(await p.locator('body').getAttribute('data-environment'),env);
}
// Atomic cancellation: quickly queued rig loads must not mount obsolete faces.
await p.evaluate(async()=>{await Promise.all([1,2,3,4,5].map(t=>CharacterAnimation.mount(null,`assets/characters/tier${t}.webp`)));});assert.equal(await p.locator('.face-open').count(),1);
await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.face-closed').evaluate(e=>getComputedStyle(e).opacity),'0');assert.deepEqual(errors,[]);
console.log(`PASS ${width}: 5 true rigs, exclusive blink, shared face/body registration, independent hair, ground plane, 8 layered costumes; no outfit fallbacks and scene logic`);await p.close();
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
