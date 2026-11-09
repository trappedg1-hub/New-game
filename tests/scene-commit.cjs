const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});
 try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('waifuB_save_v1',JSON.stringify({v:1,level:1,owned:['base','gown','pool','apron'],equip:'base',streak:{last:new Date().toISOString().slice(0,10),count:1},lastSeen:Date.now()})));
  await page.goto(process.env.GAME_URL||'http://localhost:8765');
  await page.waitForFunction(()=>document.body.dataset.environment==='classroom'&&document.querySelector('.body-base'));
  await page.keyboard.press('Escape');
  let release,requested;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>requested=resolve);
  await page.route('**/costume_gown/hair_front.png',async route=>{requested();await gate;await route.continue();});
  await page.route('**/costume_apron/hair_front.png',route=>route.abort());
  await page.locator('#toggle-right').click();
  const select=async name=>page.locator('.costume-thumb').filter({has:page.locator(`img[alt="${name}"]`)}).click();
  await select('Silk Nightgown');await seen;
  assert.equal(await page.locator('#character-surface').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('#character-loading').evaluate(e=>e.hidden),false);
  assert.equal(await page.locator('body').getAttribute('data-environment'),'classroom','do not change lighting while layers are pending');
  assert.equal(await page.locator('.body-base').getAttribute('src'),'assets/characters/tier1/body_base.png');
  // Newer selection wins before older layers complete.
  await select('Poolside');
  await page.waitForFunction(()=>document.body.dataset.environment==='pool'&&document.querySelector('.body-base')?.getAttribute('src')==='assets/characters/costume_pool/body_base.png');
  assert.equal(await page.locator('#character-surface').getAttribute('aria-busy'),'false');
  assert.equal(await page.locator('#character-loading').evaluate(e=>e.hidden),true);
  const poolBG=await page.locator('body').getAttribute('data-scene-bg');
  release();await page.waitForTimeout(300);
  assert.equal(await page.locator('body').getAttribute('data-environment'),'pool');
  assert.equal(await page.locator('.body-base').getAttribute('src'),'assets/characters/costume_pool/body_base.png');
  await select('Café Apron');await page.waitForTimeout(300);
  assert.equal(await page.locator('#character-loading').evaluate(e=>e.hidden),true);
  assert.equal(await page.locator('body').getAttribute('data-environment'),'pool','failed decode must preserve lighting/ambient context');
  assert.equal(await page.locator('body').getAttribute('data-scene-bg'),poolBG);
  assert.equal(await page.locator('.body-base').getAttribute('src'),'assets/characters/costume_pool/body_base.png');
  // Once the cached gown is selected again, art and scene commit together.
  await select('Silk Nightgown');
  await page.waitForFunction(()=>document.body.dataset.environment==='bedroom'&&document.querySelector('.body-base')?.getAttribute('src')==='assets/characters/costume_gown/body_base.png');
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${width}: pending, superseded, failed and successful wardrobe loads commit scene with art`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
