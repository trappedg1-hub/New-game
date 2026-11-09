const {chromium}=require('playwright');const assert=require('node:assert/strict');
const m=require('../assets/characters/animation-manifest.json');
(async()=>{const b=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});try{
for(const width of [390,1280]){
const p=await b.newPage({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block',reducedMotion:'no-preference'});
const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.GAME_URL||'http://localhost:8765');await p.waitForTimeout(1100);await p.keyboard.press('Escape');
const sample=()=>p.evaluate(()=>({transform:getComputedStyle(document.getElementById('character-surface')).transform,wind:document.getElementById('hair-wind').getAttribute('dx'),scale:document.getElementById('hair-displacement').getAttribute('scale')}));
for(const item of [...Object.values(m.tiers),...Object.values(m.costumes)]){
 await p.evaluate(async src=>CharacterAnimation.mount(null,src),item.original);
 const a=await sample();await p.waitForTimeout(450);const c=await sample();
 assert.notEqual(a.transform,c.transform,'breathing must actually advance: '+item.source);
 assert.notEqual(a.wind,c.wind,'hair wind must actually advance: '+item.source);assert(+c.scale>6);
 assert.equal(await p.locator('#character-wrap img').count(),1);
}
// Motion off/on must stop and resume both systems, not leave SVG frozen.
await p.evaluate(()=>document.body.classList.add('no-motion'));await p.waitForTimeout(100);
assert.equal((await sample()).scale,'0');assert.equal((await sample()).transform,'none');
await p.evaluate(()=>document.body.classList.remove('no-motion'));await p.waitForTimeout(180);let a=await sample();await p.waitForTimeout(300);let c=await sample();assert.notEqual(a.wind,c.wind);
await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(100);assert.equal((await sample()).scale,'0');
await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForTimeout(100);a=await sample();await p.waitForTimeout(300);c=await sample();assert.notEqual(a.wind,c.wind);
assert.deepEqual(errors,[]);console.log('PASS visible breathing + advancing hair wind on all 12 illustrations, pause/resume at '+width);await p.close();
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
