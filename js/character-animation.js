/* Registered PNG layers only. No SVG displacement, facial masks or image warping. */
(() => {
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const motion=()=>!reduced.matches&&!document.body.classList.contains('no-motion')&&!document.hidden;
 let manifest={},revision=0,currentMeta=null,currentPath='',reactions=[];
 const required=['body_base','hair_back','face_open','face_closed','hair_front'];
 const ready=fetch('assets/characters/animation-manifest.json').then(r=>{if(!r.ok)throw Error('Manifest');return r.json();}).then(m=>manifest=m).catch(()=>manifest);
 const cache=new Map();
 function load(src){if(!cache.has(src)){const img=new Image();img.src=src;const p=img.decode();cache.set(src,p);p.catch(()=>cache.delete(src));}return cache.get(src);}
 function configFor(src){const name=src.split('/').pop().replace(/\.(webp|png)$/,'');return name.startsWith('tier')?manifest.tiers?.[name.slice(4)]:manifest.costumes?.[name.replace('costume_','')];}
 function fit(){
  const wrap=document.getElementById('character-wrap'),root=document.getElementById('char-container');if(!wrap||!currentMeta)return;
  const [w,h]=currentMeta.size;const s=Math.min(wrap.clientWidth/w,wrap.clientHeight/h);
  root.style.width=w*s+'px';root.style.height=h*s+'px';
  const gap=(1-currentMeta.floor)*h*s;
  const shadow=document.getElementById('char-shadow');shadow.style.width=Math.min(200,w*s*.7)+'px';shadow.style.bottom=gap-5+'px';
  const contacts=document.getElementById('contact-shadows');contacts.style.width=w*s+'px';contacts.style.bottom=gap+'px';
 }
 function ground(meta){
  currentMeta=meta;const contacts=document.getElementById('contact-shadows');contacts.replaceChildren();
  for(const c of meta.contacts||[]){const e=document.createElement('i');e.className='contact-shadow';e.style.cssText=`left:${c.x*100}%;width:${c.width*100}%`;contacts.append(e);}fit();
 }
 function image(src,cls){const e=new Image();e.src=src;e.className='rig-part '+cls;e.alt='';e.draggable=false;return e;}
 function rig(config){
  const scene=document.createElement('div');scene.className='rig-scene';
  const view=config.viewport;
  if(view){scene.style.cssText=`left:${-view[0]/view[2]*100}%;top:${-view[1]/view[3]*100}%;width:${config.canvas[0]/view[2]*100}%;height:${config.canvas[1]/view[3]*100}%;--hair-pivot:50% ${view[1]/config.canvas[1]*100}%`;}
  const breath=document.createElement('div');breath.className='rig-breath';scene.append(breath);
  const group=(cls,src,part)=>{const react=document.createElement('div');react.className='rig-react '+cls+'-react';const idle=document.createElement('div');idle.className=cls;idle.append(image(src,part));react.append(idle);return react;};
  breath.append(group('rig-hair-back',config.layers.hair_back,'hair-back'));
  breath.append(image(config.layers.body_base,'body-base'));
  const faces=document.createElement('div');faces.className='rig-faces';
  faces.append(image(config.layers.face_open,'face-open'),image(config.layers.face_closed,'face-closed'));breath.append(faces);
  breath.append(group('rig-hair-front',config.layers.hair_front,'hair-front'));
  return scene;
 }
 function stop(){for(const a of reactions)a.cancel();reactions=[];}
 async function mount(_container,src){
  const token=++revision;await ready;if(token!==revision)return;
  const config=configFor(src),surface=document.getElementById('character-surface');
  if(currentPath===src&&surface.dataset.mode)return;
  const layered=config?.type==='layered'&&config.contentAudit?.status==='faceless-head-repaint-and-visual-review'&&required.every(k=>config.layers?.[k]);
  const fallback=config?.source||src.replace('assets/characters/','assets/characters/single/').replace(/\.webp$/,'.png');
  try{await Promise.all((layered?required.map(k=>config.layers[k]):[fallback]).map(load));}catch(_){return;}
  if(token!==revision)return;stop();currentPath=src;
  let content;
  if(layered){content=rig(config);ground(config.ground);}
  else {
   content=image(fallback,'char-single-img');content.id='character-art';content.alt='Character';
   const key=src.split('/').pop().replace(/\.(png|webp)$/,'');const meta=window.CHARACTER_PRESENTATION?.[key];
   ground(meta||{size:config?.canvas||[420,1323],floor:1,contacts:[]});
  }
  surface.dataset.mode=layered?'layered':'single';surface.style.removeProperty('--art-mask');surface.replaceChildren(content);
  if(motion())reactions.push(surface.animate([{opacity:.5},{opacity:1}],{duration:300,easing:'ease-out'}));
 }
 function react(){
  if(!motion())return;const root=document.getElementById('character-surface');
  for(const [selector,angle,duration] of [['.rig-hair-front-react',2,650],['.rig-hair-back-react',.8,850]]){
   const e=root.querySelector(selector);if(!e)continue;
   for(const a of e.getAnimations())a.cancel();
   reactions.push(e.animate([{transform:'rotate(0)'},{transform:`rotate(${-angle}deg)`,offset:.25},{transform:`rotate(${angle*.5}deg)`,offset:.6},{transform:'rotate(0)'}],{duration,easing:'ease-out'}));
  }
  reactions=reactions.filter(a=>a.playState!=='finished');
 }
 document.addEventListener('DOMContentLoaded',()=>{if(window.ResizeObserver)new ResizeObserver(fit).observe(document.getElementById('character-wrap'));});
 window.addEventListener('resize',fit,{passive:true});
 document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('animation-paused',document.hidden);if(!motion())stop();});
 reduced.addEventListener?.('change',()=>{if(!motion())stop();});
 new MutationObserver(()=>{if(!motion())stop();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.CharacterAnimation={mount,ready,react};
})();
