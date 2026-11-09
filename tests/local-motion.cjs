const {chromium}=require('playwright');const assert=require('node:assert/strict');
const manifest=require('../assets/characters/animation-manifest.json');
(async()=>{const b=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});try{
for(const width of [390,1280]){
 const p=await b.newPage({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block',reducedMotion:'no-preference'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://localhost:8765');await p.waitForTimeout(1100);await p.keyboard.press('Escape');
 await p.addStyleTag({content:'.modal,#bubble,#rail-backdrop{display:none!important}'});
 const sample=()=>p.evaluate(()=>Object.fromEntries(['hair','chest','hip','cloth'].map(k=>[k,+document.getElementById(k+'-displacement').getAttribute('scale')])));
 for(const [index,item] of [...Object.values(manifest.tiers),...Object.values(manifest.costumes)].entries()){
  await p.evaluate(async src=>CharacterAnimation.mount(null,src),item.original);
  await p.waitForTimeout(60);
  for(const zone of ['chest','hip','cloth'])assert((await p.locator('#'+zone+'-motion-map').getAttribute('href')).startsWith('data:image/svg+xml,'));
  await p.evaluate(()=>CharacterAnimation.react());await p.waitForTimeout(80);const a=await sample();
  await p.waitForTimeout(160);const mid=await sample();
  await p.waitForTimeout(280);const c=await sample();
  for(const k of ['chest','hip','cloth'])assert(Math.max(a[k],mid[k],c[k])-Math.min(a[k],mid[k],c[k])>.5,`${item.source} ${k} not reacting`);
  assert.equal(await p.locator('#char-container').evaluate(e=>getComputedStyle(e).transform),'none','No whole-body jump');
  assert.equal(await p.locator('#character-wrap img').count(),1);
  if(width===390&&index===2){await p.locator('#character-art').screenshot({path:'/home/user/local-motion-tap.png'});}
 }
 for(let i=0;i<10;i++){if(width<768)await p.locator('#tap-btn').tap();else await p.locator('#tap-btn').click();}
 const busy=await sample();for(const v of Object.values(busy))assert(Math.abs(v)<40,'Bounded response after rapid taps');
 await p.evaluate(()=>document.body.classList.add('no-motion'));await p.waitForTimeout(80);for(const v of Object.values(await sample()))assert.equal(v,0);
 await p.evaluate(()=>document.body.classList.remove('no-motion'));await p.waitForTimeout(80);assert((await sample()).hair>0);
 assert.deepEqual(errors,[]);await p.close();console.log(`PASS ${width}: hair/chest/hip/fabric fields on all 12 art, delayed tap response, no parent jump, bounded rapid taps, motion toggle`);
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
