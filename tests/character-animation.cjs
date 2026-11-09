const {JSDOM}=require('jsdom');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const dom=new JSDOM('<body><div id="char-container"><img id="character-art" src="assets/characters/single/tier1.png"></div></body>',{runScripts:'outside-only'});
 const w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){}});
 const loads=new Map();
 w.Image=function(){this.decode=()=>new Promise((resolve,reject)=>loads.set(this.src,{resolve,reject}));};
 w.eval(fs.readFileSync('js/character-animation.js','utf8'));
 // Disable motion in jsdom; rendering order and decode failure are independent of WAAPI.
 w.document.body.classList.add('no-motion');
 const mount=src=>w.CharacterAnimation.mount(null,'assets/characters/'+src+'.webp');
 const a=mount('tier2'),b=mount('tier3');
 loads.get('assets/characters/single/tier3.png').resolve();await b;
 loads.get('assets/characters/single/tier2.png').resolve();await a;
 assert.equal(w.document.getElementById('character-art').getAttribute('src'),'assets/characters/single/tier3.png');
 const bad=mount('missing');loads.get('assets/characters/single/missing.png').reject(Error('missing'));await bad;
 assert.equal(w.document.getElementById('character-art').getAttribute('src'),'assets/characters/single/tier3.png');
 assert.equal(w.document.querySelectorAll('img').length,1);
 for(const group of Object.values(JSON.parse(fs.readFileSync('assets/characters/animation-manifest.json')).tiers))assert.equal(group.type,'single');
 dom.window.close();console.log('PASS single renderer stale decode protection, failed art preservation, one DOM image');
})().catch(e=>{console.error(e);process.exit(1)});
