/* Single-image presentation only. No component rigs or duplicate DOM images; localized eyelids share the same surface. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let revision = 0, fade = null, reactionTimes = [];
  const motion = () => !reduced.matches && !document.body.classList.contains('no-motion') && !document.hidden;
  let currentMeta = null;
  const ready = Promise.resolve();
  function landmarks(path) {
    const key=path.split('/').pop().replace(/\.png$/,'');
    return window.CHARACTER_PRESENTATION?.[key];
  }
  function fit() {
    const wrap=document.getElementById('character-wrap'), root=document.getElementById('char-container');
    if(!wrap || !root || !currentMeta)return;
    const [w,h]=currentMeta.size;
    const scale=Math.min(wrap.clientWidth/w,wrap.clientHeight/h);
    root.style.width=(w*scale)+'px';root.style.height=(h*scale)+'px';
    const bottomGap=(1-currentMeta.floor)*h*scale;
    const shadows=document.getElementById('contact-shadows');
    if(shadows){
      shadows.style.width=(w*scale)+'px';shadows.style.bottom=bottomGap+'px';
    }
    const shadow=document.getElementById('char-shadow');
    if(shadow){shadow.style.width=Math.min(180,w*scale*.65)+'px';shadow.style.bottom=(bottomGap-5)+'px';}
  }
  function buildMotionFields(){
    const colors={chest:'#80e680',hip:'#e68080',cloth:'#dfad80'};
    for(const [zone,coords] of Object.entries(currentMeta.motionZones||{})){
      const [x,y,rx,ry]=coords;
      const map=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="512" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><radialGradient id="field"><stop offset="0" stop-color="${colors[zone]}"/><stop offset=".35" stop-color="${colors[zone]}"/><stop offset="1" stop-color="#808080"/></radialGradient></defs><rect width="100" height="100" fill="#808080"/><ellipse cx="${x*100}" cy="${y*100}" rx="${rx*100}" ry="${ry*100}" fill="url(#field)"/></svg>`;
      document.getElementById(zone+'-motion-map')?.setAttribute('href','data:image/svg+xml,'+encodeURIComponent(map));
      document.getElementById(zone+'-displacement')?.setAttribute('scale','0');
    }
  }
  function present(path) {
    currentMeta=landmarks(path);if(!currentMeta)return;
    reactionTimes=[];
    buildMotionFields();
    const surface=document.getElementById('character-surface');
    surface?.style.setProperty('--art-mask',`url("${path}")`);
    const eyelids=document.getElementById('eyelids');
    if(eyelids){
      eyelids.replaceChildren();
      for(const eye of currentMeta.eyes){
        const lid=document.createElement('i');lid.className='eyelid-mask';
        lid.style.cssText=`left:${eye.x*100}%;top:${eye.y*100}%;width:${eye.width*100}%;height:${eye.height*100}%;--skin:${eye.skin};--eye-angle:${eye.angle}deg`;
        eyelids.append(lid);
      }
    }
    const contacts=document.getElementById('contact-shadows');
    if(contacts){
      contacts.replaceChildren();
      for(const contact of currentMeta.contacts){
        const spot=document.createElement('i');spot.className='contact-shadow';
        spot.style.cssText=`left:${contact.x*100}%;width:${contact.width*100}%`;contacts.append(spot);
      }
    }
    // Noise only in a feathered upper hair region. Neutral grey elsewhere means
    // zero displacement of eyes, lips, torso or ground contacts. This is NOT a
    // second copy of the art and does not mask the original PNG out of view.
    const eyes=currentMeta.eyes;
    const ex=eyes.reduce((n,e)=>n+e.x,0)/eyes.length;
    const ey=eyes.reduce((n,e)=>n+e.y,0)/eyes.length;
    const mask=`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset=".18" stop-color="white"/><stop offset=".4" stop-color="white" stop-opacity="0"/></linearGradient><mask id="m"><rect width="100" height="100" fill="white"/><ellipse cx="${ex*100}" cy="${ey*100+1}" rx="18" ry="8" fill="black"/></mask></defs><rect width="100" height="100" fill="url(#g)" mask="url(#m)"/></svg>`;
    document.getElementById('hair-region-map')?.setAttribute('href','data:image/svg+xml,'+encodeURIComponent(mask));
    fit();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    present(document.getElementById('character-art').getAttribute('src'));
    if(window.ResizeObserver)new ResizeObserver(fit).observe(document.getElementById('character-wrap'));
  });
  window.addEventListener('resize',fit,{passive:true});
  const pngPath = src => src.replace('assets/characters/', 'assets/characters/single/').replace(/\.(webp|png)$/, '.png');
  async function mount(_container, src) {
    const token = ++revision;
    const img = document.getElementById('character-art');
    const path = pngPath(src);
    if(img.getAttribute('src') === path) {present(path);return;}
    // Decode off-DOM; never mount an outgoing copy, even during rapid switches.
    const preload = new Image();
    preload.src = path;
    try { await preload.decode(); } catch (_) {
      if(token === revision) document.getElementById('char-container').dataset.artError = 'load-failed';
      return; // Keep the last complete illustration if loading fails.
    }
    if(token !== revision) return;
    fade?.cancel(); fade = null;
    img.src = path;
    present(path);
    document.getElementById('char-container').dataset.artError = '';
    if(motion()) {
      // Fade in the new decoded art, without an empty frame or a second image.
      fade = img.animate([{opacity:0.35},{opacity:1}], {duration:300,easing:'ease-out'});
    }
  }
  function react() {
    if(!motion()) return;
    // A bounded impulse replaces the old whole-character jump. Each local field
    // has its own delay/frequency so hair, fabric and torso settle independently.
    reactionTimes.push(performance.now());
    reactionTimes=reactionTimes.slice(-6);
  }
  function stop() {fade?.cancel();fade=null;reactionTimes=[];}
  document.addEventListener('visibilitychange',()=>{
    document.body.classList.toggle('animation-paused',document.hidden);
    if(document.hidden)stop();
  });
  // Drive wind explicitly: SMIL baseFrequency animations can freeze when filters
  // are nested under CSS lighting/masks, especially after visibility changes.
  // Only the neutral-masked hair noise moves; the PNG and face never move apart.
  let windFrame = null, lastWind = 0, windTime = 0;
  function windTick(now) {
    windFrame = null;
    if(!motion())return;
    const elapsed = lastWind ? Math.min(now-lastWind,80) : 0;
    if(!lastWind || now-lastWind>=32){
      windTime+=elapsed;lastWind=now;
      const wind=document.getElementById('hair-wind');
      const displacement=document.getElementById('hair-displacement');
      wind?.setAttribute('dx',String((Math.sin(windTime/1250)*18).toFixed(3)));
      wind?.setAttribute('dy',String((Math.sin(windTime/1900)*5).toFixed(3)));
      const t=windTime/1000;
      reactionTimes=reactionTimes.filter(start=>now-start<2200);
      const spring=(delay,frequency)=>{
        const sum=reactionTimes.reduce((value,start)=>{
          const a=(now-start)/1000-delay;
          return value+(a>=0 && a<2 ? Math.sin(a*frequency)*Math.exp(-a*3.5) : 0);
        },0);
        return Math.max(-1.2,Math.min(1.2,sum));
      };
      displacement?.setAttribute('scale',(11+spring(.03,15)*14).toFixed(3));
      const values={
        chest:Math.sin(t*1.65)*4+spring(0,17)*22,
        hip:Math.sin(t*1.05+.7)*3+spring(.09,12)*18,
        cloth:Math.sin(t*1.4+1.2)*6+spring(.16,10)*25
      };
      for(const [zone,value] of Object.entries(values)){
        document.getElementById(zone+'-displacement')?.setAttribute('scale',value.toFixed(3));
      }
    }
    windFrame=requestAnimationFrame(windTick);
  }
  function syncMotion(){
    if(windFrame!==null)cancelAnimationFrame(windFrame);
    windFrame=null;lastWind=0;
    if(motion())windFrame=requestAnimationFrame(windTick);
    else {stop();for(const zone of ['hair','chest','hip','cloth'])document.getElementById(zone+'-displacement')?.setAttribute('scale','0');}
  }
  reduced.addEventListener?.('change',syncMotion);
  document.addEventListener('visibilitychange',syncMotion);
  document.addEventListener('DOMContentLoaded',syncMotion);
  new MutationObserver(syncMotion).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.CharacterAnimation = {mount,ready,react};
})();
