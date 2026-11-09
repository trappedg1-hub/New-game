/* Single-image presentation only. No component rigs, overlays, or duplicate DOM images. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let revision = 0, bounce = null, fade = null;
  const motion = () => !reduced.matches && !document.body.classList.contains('no-motion') && !document.hidden;
  const ready = Promise.resolve();
  const pngPath = src => src.replace('assets/characters/', 'assets/characters/single/').replace(/\.(webp|png)$/, '.png');
  async function mount(_container, src) {
    const token = ++revision;
    const img = document.getElementById('character-art');
    const path = pngPath(src);
    if(img.getAttribute('src') === path) return;
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
  new MutationObserver(()=>{if(!motion())stop();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.CharacterAnimation = {mount,ready,react};
})();
