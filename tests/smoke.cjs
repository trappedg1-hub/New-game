// npm install --no-save jsdom && node tests/smoke.cjs
const {JSDOM}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{for(const width of [360,390,414,1280]){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://game.test',pretendToBeVisual:true});const w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>({tiers:{},costumes:{}})});
 w.innerWidth=width;w.matchMedia=()=>({matches:width<768});w.HTMLElement.prototype.animate=()=>({});
 for(const p of ['data/content.js','data/dialogue.js','js/character-animation.js','js/game.js'])w.eval(fs.readFileSync(p,'utf8'));
 await new Promise(r=>setTimeout(r,80));
 assert.equal(w.document.querySelectorAll('.character-stack img').length,1);
 const tap=w.document.getElementById('tap-btn');tap.click();tap.click();
 await new Promise(r=>setTimeout(r,450));
 assert.equal(w.document.getElementById('coins').textContent,'201');
 w.document.getElementById('btn-upgrades').click();assert(w.document.getElementById('modal-upgrades').classList.contains('open'));
 for(const t of w.CONTENT.TIERS){assert(fs.existsSync(t.art));assert(fs.existsSync(t.bg));}
 for(const c of w.CONTENT.COSTUMES)if(c.img)assert(fs.existsSync(c.img));
 console.log(width+': DOM boot, tap rate limit, modal, asset references PASS (not a layout test)');dom.window.close();
}})().catch(e=>{console.error(e);process.exit(1);});
