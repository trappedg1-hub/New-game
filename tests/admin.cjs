const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(await require('@sparticuz/chromium').default.executablePath()),args:['--no-sandbox','--disable-gpu']});
 try{
 for(const width of [390,1280]){
 const p=await b.newPage({viewport:{width,height:900},serviceWorkers:'block'});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://localhost:8765');
 const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('waifuB_save_v1')));
 await p.waitForTimeout(1000);
 await p.keyboard.press('Escape');
 if(width<768)await p.locator('#toggle-left').click();
 await p.locator('[data-modal=settings]').click();
 await p.locator('#admin-panel summary').click();
 await p.locator('[data-admin-gems="10000"]').click();
 assert.equal((await state()).gems,10000);
 await p.locator('#admin-gems').fill('123');
 await p.locator('#admin-gems-form button').click();
 assert.equal((await state()).gems,10123);
 await p.locator('#admin-gems').fill('-1');
 await p.locator('#admin-gems-form button').click();
 assert.equal((await state()).gems,10123);
 await p.locator('#admin-gacha').click();
 await p.locator('#pull-x10').click();
 assert.equal((await state()).gems,9223);assert.equal((await state()).stats.pulls,10);
 await p.locator('#reveal-close').click();
 await p.locator('#pull-free').click();
 assert((await state()).freePull>0);
 await p.locator('#reveal-close').click();
 await p.locator('#modal-gacha .modal-close').click();
 await p.waitForTimeout(1000);
 await p.keyboard.press('Escape');
 if(width<768)await p.locator('#toggle-left').click();
 await p.locator('[data-modal=settings]').click();
 await p.locator('#admin-free').click();
 assert.equal((await state()).freePull,0);
 await p.reload();
 assert.equal((await state()).gems,9223);assert.equal((await state()).stats.pulls,11);
 assert.deepEqual(errors,[]);await p.close();
 console.log('PASS admin balance, validation, paid/free pulls, cooldown reset, persistence at '+width);
 }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
