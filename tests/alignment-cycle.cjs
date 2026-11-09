const {chromium}=require('playwright');const assert=require('node:assert/strict');const m=require('../assets/characters/animation-manifest.json');
const rigs=[...Object.entries(m.tiers).map(([k,c])=>({src:`assets/characters/tier${k}.webp`,c})),...Object.entries(m.costumes).map(([k,c])=>({src:`assets/characters/costume_${k}.webp`,c}))];
(async()=>{const b=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});try{
for(const width of [390,1280]){
 const p=await b.newPage({viewport:{width,height:900},serviceWorkers:'block'});await p.goto(process.env.GAME_URL||'http://localhost:8765');await p.waitForTimeout(800);await p.keyboard.press('Escape');
 for(const {src,c} of rigs){
  assert.deepEqual(c.canvas,[420,1323]);await p.evaluate(src=>CharacterAnimation.mount(null,src),src);
  const result=await p.evaluate(c=>{
   const root=document.getElementById('character-surface');
   const body=root.querySelector('.body-base');const faces=[...root.querySelectorAll('.face-open,.face-closed')];
   const drift=()=>{const b=body.getBoundingClientRect();return Math.max(...faces.map(f=>{const a=f.getBoundingClientRect();return Math.max(...['x','y','width','height'].map(k=>Math.abs(a[k]-b[k])));}));};
   const breathe=root.getAnimations({subtree:true}).filter(a=>a.animationName==='breatheSync');
   const samples=[0,950,1900,2850,3800].map(t=>{breathe.forEach(a=>{a.pause();a.currentTime=t;});return drift();});
   breathe.forEach(a=>{a.currentTime=0;});
   const bounds=body.getBoundingClientRect(),stage=document.getElementById('stage').getBoundingClientRect();
   const view=c.viewport||[0,0,...c.canvas];
   const foot=bounds.top+(view[1]+c.ground.floor*view[3])/c.canvas[1]*bounds.height;
   const footError=Math.abs(foot-(stage.bottom-stage.height*.02));
   const shared=[body,...faces].every(e=>e.classList.contains('layer-synced'));
   const phase=breathe.map(a=>a.currentTime);CharacterAnimation.react();const bounce=root.querySelector('.rig-tap-synced').getAnimations()[0];
   const tap=[0,112.5,292.5,450].map(t=>{bounce.pause();bounce.currentTime=t;return drift();});
   const selectors=['.rig-hair-back','.rig-hair-front'];const timings=selectors.map(s=>root.querySelector(s).getAnimations()[0].effect.getTiming());
   const opened=faces[0],closed=faces[1];const opacity=[4274,4275,4364,4365].map(t=>{
    [opened,closed].forEach(e=>{const a=e.getAnimations().find(a=>a.animationName.startsWith('blink'));a.pause();a.currentTime=t;});
    return [getComputedStyle(opened).opacity,getComputedStyle(closed).opacity];
   });
   return {samples,tap,shared,phase,timings,opacity,footError,bounceDuration:bounce.effect.getTiming().duration};
  },c);
  assert(result.footError<1,src+' opaque-foot floor error: '+result.footError);
  assert(result.shared,src);assert(result.samples.every(d=>d<.001)&&result.tap.every(d=>d<.001),src+' drift');
  assert.equal(result.bounceDuration,450);assert.equal(result.timings[0].duration,5200);assert.equal(result.timings[1].duration,4000);assert.equal(result.timings[1].delay,600);
  assert.deepEqual(result.opacity,[['1','0'],['0','1'],['0','1'],['1','0']]);
 }
 await p.close();console.log(`PASS ${width}: 12 canonical rigs, <0.001px face/body drift over full breath and tap, anchored hair timing and exclusive 95–97% blink`);
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
