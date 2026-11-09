const {chromium}=require('playwright');const assert=require('node:assert/strict');
const manifest=require('../assets/characters/animation-manifest.json');
(async()=>{
const b=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});
try{
for(const width of [360,390,768,1280]){
const p=await b.newPage({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{localStorage.setItem('waifuB_save_v1',JSON.stringify({v:1,level:76,owned:['base','cardigan','track','apron','maid','pool','gown','bunny'],gems:10000,lastSeen:Date.now(),streak:{last:new Date().toISOString().slice(0,10),count:1}}));});
await p.goto(process.env.GAME_URL||'http://localhost:8765');await p.waitForTimeout(1200);
await p.keyboard.press('Escape');
const scenes={cardigan:'classroom',track:'classroom',apron:'cafe',maid:'cafe',pool:'pool',gown:'bedroom',bunny:'beach'};
for(const [key,env] of Object.entries(scenes)){
 await p.locator('#toggle-right').click();
 const idx=await p.evaluate(k=>CONTENT.COSTUMES.findIndex(c=>c.id===k),key);
 await p.locator('.costume-thumb').nth(idx).click();
 await p.locator('#toggle-right').click();
 await p.waitForFunction(src=>document.getElementById('character-art').getAttribute('src')===src,manifest.costumes[key].source);
 assert.equal(await p.locator('body').getAttribute('data-environment'),env);
 assert.equal(await p.locator('#character-wrap img').count(),1);
 assert(await p.locator('.eyelid-mask').count()>0);
 const blink=await p.locator('.eyelid-mask').first().evaluate(el=>{
  const a=el.getAnimations()[0];a.pause();a.currentTime=4200;const open=getComputedStyle(el).opacity;
  a.currentTime=4400;const closed=getComputedStyle(el).opacity;a.play();return [open,closed];
 });assert.deepEqual(blink,['0','1']);
 const geom=await p.evaluate(()=>{
 const r=document.getElementById('char-container').getBoundingClientRect(),s=document.getElementById('stage').getBoundingClientRect();
 return {bottom:r.bottom,ground:s.bottom-s.height*.03,height:r.height,stage:s.height,filter:getComputedStyle(document.getElementById('character-surface')).filter};});
 assert(Math.abs(geom.bottom-geom.ground)<3,JSON.stringify(geom));
 assert(geom.height<=geom.stage);assert.notEqual(geom.filter,'none');
}
for(const [tier,item] of Object.entries(manifest.tiers)){
 await p.evaluate(async src=>CharacterAnimation.mount(null,src),item.original);
 assert.equal(await p.locator('#character-wrap img').count(),1);
}
if(width===390){
 for(const item of [...Object.values(manifest.tiers),...Object.values(manifest.costumes)]){
  await p.evaluate(async src=>CharacterAnimation.mount(null,src),item.original);
  await p.addStyleTag({content:'.eyelid-mask{animation:none!important;opacity:1!important}.character-surface{animation:none!important}#bubble{display:none!important}'});
  const r=await p.locator('#char-container').boundingBox();
  await p.screenshot({path:`/home/user/lids-${item.original.split('/').pop()}`,clip:{x:r.x,y:r.y,width:r.width,height:r.height*.32}});
 }
}
await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.character-surface').evaluate(el=>getComputedStyle(el).animationName),'none');
assert.deepEqual(errors,[]);await p.close();console.log(`PASS ${width}: costume-scene matrix, one PNG, registered eyelids, lighting, ground plane, reduced motion`);
}
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
