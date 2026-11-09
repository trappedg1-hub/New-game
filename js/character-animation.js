/* Single-image presentation only. No component rigs or duplicate DOM images; localized eyelids share the same surface. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let revision = 0, bounce = null, fade = null;
  const motion = () => !reduced.matches && !document.body.classList.contains('no-motion') && !document.hidden;
  let currentMeta = null, lastMotion = null;
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
  function present(path) {
    currentMeta=landmarks(path);if(!currentMeta)return;
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
    bounce?.cancel(); bounce = null;
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
    bounce?.cancel();
    bounce = document.getElementById('char-container').animate([
      {transform:'scale(1) translateY(0)'},
      {transform:'scale(0.97) translateY(4px)',offset:0.3},
      {transform:'scale(1.02) translateY(-3px)',offset:0.6},
      {transform:'scale(1) translateY(0)'}
    ],{duration:450,easing:'ease-in-out'});
  }
  function stop() {bounce?.cancel(); fade?.cancel(); bounce=null; fade=null;}
  document.addEventListener('visibilitychange',()=>{
    document.body.classList.toggle('animation-paused',document.hidden);
    if(document.hidden)stop();
  });
  reduced.addEventListener?.('change',stop);
  new MutationObserver(()=>{
    if(!motion())stop();
    if(lastMotion===motion())return;
    lastMotion=motion();
    const frequency=document.getElementById('sway-frequency');
    const displacement=document.getElementById('hair-displacement');
    displacement?.setAttribute('scale',motion()?'2':'0');
    if(frequency) {if(motion())frequency.beginElement?.();else frequency.endElement?.();}
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.CharacterAnimation = {mount,ready,react};
})();
