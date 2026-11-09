const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});
 try{for(const width of [360,390,414,1280]){
  const p=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('waifuB_save_v1',JSON.stringify({v:1,level:11,coins:0,owned:['base','cardigan','maid','gown'],settings:{motion:false,music:0},streak:{last:new Date().toISOString().slice(0,10),count:1},lastSeen:Date.now()})));
  await p.goto(process.env.GAME_URL||'http://localhost:8765');await p.waitForFunction(()=>document.querySelector('.face-open'));
  await p.keyboard.press('Escape');await p.locator('#toggle-right').click();
  assert.match(await p.locator('#wardrobe-summary').textContent(),/3 \/ 9 collected/);
  const card=p.locator('.costume-thumb[data-costume-id="cardigan"]');
  await card.focus();const coins=await p.locator('#coins').textContent(),energy=await p.locator('#energy').textContent();
  await p.keyboard.press('Space');
  await p.waitForFunction(()=>document.querySelector('.body-base')?.getAttribute('src')==='assets/characters/costume_cardigan/body_base.png');
  assert.equal(await card.getAttribute('aria-pressed'),'true');
  assert.equal(await card.evaluate(e=>e===document.activeElement),true,'list rebuild must retain focus');
  assert.equal(await p.locator('#coins').textContent(),coins,'wardrobe Space must not earn coins');
  assert.equal(await p.locator('#energy').textContent(),energy,'wardrobe Space must not spend energy');
  assert.equal(await card.locator('.rar').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>0,true,'rarity text must be readable');
  assert.equal(await p.locator('.costume-thumb.equipped').count(),1);
  const fit=await p.evaluate(()=>{
   const rail=document.getElementById('right-rail'),r=rail.getBoundingClientRect();return {page:document.documentElement.scrollWidth<=innerWidth,left:r.left,right:r.right,inner:rail.scrollWidth<=rail.clientWidth+1};
  });
  assert(fit.page&&fit.inner&&fit.left>=0&&fit.right<=width+1,JSON.stringify(fit));
  if(width===390||width===1280)await p.screenshot({path:`/home/user/wardrobe-polished-${width}.png`});
  await p.locator('#toggle-right').click();
  if(width===390)await p.screenshot({path:'/home/user/stage-polished-390.png'});
  assert.deepEqual(errors,[]);await p.close();console.log(`PASS ${width}: readable rarity, collection count, selection, keyboard focus/no accidental tap, drawer fit`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
