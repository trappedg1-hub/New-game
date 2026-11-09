const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:await require('@sparticuz/chromium').default.executablePath(),args:['--no-sandbox','--disable-gpu']});
 try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('waifuB_save_v1',JSON.stringify({v:1,level:1,settings:{music:0,sfx:23,motion:true},streak:{last:new Date().toISOString().slice(0,10),count:1},lastSeen:Date.now()}));
   window.__audio={created:0,starts:0,frequency:0,gain:0,state:null};
   window.__audioHidden=false;Object.defineProperty(document,'hidden',{get:()=>window.__audioHidden});
   class Param{
    constructor(key){this.key=key;this.value=0;}
    cancelScheduledValues(){}
    setValueAtTime(value){this.value=value;window.__audio[this.key]=value;}
    setTargetAtTime(value){this.setValueAtTime(value);}
   }
   class Node{connect(next){return next;}}
   window.AudioContext=class extends EventTarget{
    constructor(){super();window.__audio.created++;this.state='suspended';this.currentTime=0;this.sampleRate=100;this.destination=new Node();}
    createBuffer(){return {getChannelData:()=>new Float32Array(300)};}
    createBufferSource(){const n=new Node();n.start=()=>window.__audio.starts++;n.stop=()=>{};return n;}
    createBiquadFilter(){const n=new Node();n.frequency=new Param('frequency');return n;}
    createGain(){const n=new Node();n.gain=new Param('gain');return n;}
    async transition(state){await Promise.resolve();if(this.state!==state){this.state=state;window.__audio.state=state;this.dispatchEvent(new Event('statechange'));}}
    resume(){return this.transition('running');}suspend(){return this.transition('suspended');}close(){return this.transition('closed');}
   };
  });
  await page.goto(process.env.GAME_URL||'http://localhost:8765');
  await page.waitForFunction(()=>document.body.dataset.environment==='classroom');
  assert.equal(await page.locator('#music-val').textContent(),'0%');
  assert.equal(await page.locator('#sfx-val').textContent(),'23%');
  await page.evaluate(()=>document.dispatchEvent(new Event('pointerdown')));
  assert.equal(await page.evaluate(()=>window.__audio.created),0,'zero-volume gestures must not allocate audio');
  const input=async value=>page.evaluate(v=>{const s=document.getElementById('set-music');s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await input(60);
  await page.waitForFunction(()=>window.__audio.state==='running');
  let a=await page.evaluate(()=>window.__audio);
  assert.equal(a.created,1);assert.equal(a.starts,1);assert.equal(a.frequency,620);assert(Math.abs(a.gain-.0072)<1e-8);
  await page.evaluate(()=>document.body.dataset.environment='beach');
  await page.waitForFunction(()=>window.__audio.frequency===900);
  assert(Math.abs((await page.evaluate(()=>window.__audio.gain))-.015)<1e-8);
  const hidden=async value=>page.evaluate(v=>{window.__audioHidden=v;document.dispatchEvent(new Event('visibilitychange'));},value);
  await hidden(true);await page.waitForFunction(()=>window.__audio.state==='suspended');
  assert.equal(await page.evaluate(()=>window.__audio.gain),0);
  await hidden(false);await page.waitForFunction(()=>window.__audio.state==='running');
  await input(0);await page.waitForFunction(()=>window.__audio.state==='suspended');
  await hidden(true);await hidden(false);assert.equal(await page.evaluate(()=>window.__audio.gain),0);
  await input(40);await page.waitForFunction(()=>window.__audio.state==='running');
  a=await page.evaluate(()=>window.__audio);assert.equal(a.created,1);assert.equal(a.starts,1);
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${width}: saved volume labels, zero-volume allocation guard, scene profile, hidden/muted suspension, single audio context`);
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
