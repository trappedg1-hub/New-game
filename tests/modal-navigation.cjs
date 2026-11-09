const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});
 try{for(const width of [390,1280]){
  const p=await b.newPage({viewport:{width,height:900},serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('waifuB_save_v1',JSON.stringify({v:1,level:1,streak:{last:new Date().toISOString().slice(0,10),count:1},lastSeen:Date.now()})));
  await p.goto(process.env.GAME_URL||'http://localhost:8765');await p.waitForFunction(()=>document.querySelector('.face-open'));
  // The desktop navigation is already visible; mobile opens its drawer.
  if(width<768)await p.locator('#toggle-left').click();
  await p.locator('[data-modal="settings"]').click();
  await p.waitForFunction(()=>document.activeElement?.closest('#modal-settings'));
  assert.equal(await p.locator('#stage').evaluate(e=>e.inert),true);
  const controls=()=>p.locator('#modal-settings').evaluate(m=>[...m.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')].filter(e=>!e.closest('[inert]')&&e.getClientRects().length).map(e=>e.id||e.className));
  assert((await controls()).length>2);
  await p.locator('#modal-settings .modal-close').focus();await p.keyboard.press('Shift+Tab');
  assert.equal(await p.locator('#modal-settings').evaluate(m=>{
   const c=[...m.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')].filter(e=>!e.closest('[inert]')&&e.getClientRects().length);return document.activeElement===c.at(-1);
  }),true,'backward tab wraps within modal');
  await p.keyboard.press('Tab');assert.equal(await p.locator('#modal-settings .modal-close').evaluate(e=>e===document.activeElement),true);
  await p.keyboard.press('Escape');
  await p.waitForFunction(()=>!document.getElementById('stage').inert);
  assert.equal(await p.locator(width<768?'#toggle-left':'[data-modal="settings"]').evaluate(e=>e===document.activeElement),true,'restore to visible menu control');
  // Open/close in one turn: no stale delayed focus stealing 50ms later.
  await p.locator('#tap-btn').focus();
  await p.evaluate(()=>{const m=document.getElementById('modal-settings');m.classList.add('open');m.classList.remove('open');});
  await p.waitForTimeout(100);assert.equal(await p.locator('#tap-btn').evaluate(e=>e===document.activeElement),true);
  // When two dialogs are open only the topmost is interactive.
  await p.evaluate(()=>document.getElementById('modal-settings').classList.add('open'));
  await p.waitForFunction(()=>document.activeElement?.closest('#modal-settings'));
  await p.evaluate(()=>document.getElementById('modal-reveal').classList.add('open'));
  await p.waitForFunction(()=>document.getElementById('modal-settings').inert&& !document.getElementById('modal-reveal').inert);
  await p.evaluate(()=>document.getElementById('modal-reveal').classList.remove('open'));
  await p.waitForFunction(()=>document.activeElement?.closest('#modal-settings')&&!document.getElementById('modal-settings').inert);
  await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('stage').inert);
  assert.deepEqual(errors,[]);await p.close();console.log(`PASS ${width}: modal focus, Tab wrap, Escape return, rapid close and stacked dialogs`);
 }}finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
