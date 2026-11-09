/* Quiet synthesized ambience, opt-in through the Music slider and a user gesture.
   No autoplay, external recordings, network audio or relationship/save mutations. */
(() => {
 'use strict';
 const profiles={classroom:[620,.012],cafe:[420,.018],pool:[1500,.020],bedroom:[230,.010],beach:[900,.025]};
 let context,source,filter,gain,unlocked=false;
 function update(){
  if(!context)return;
  const [frequency,level]=profiles[document.body.dataset.environment]||profiles.classroom;
  const volume=Number(document.getElementById('set-music')?.value||0)/100;
  filter.frequency.setTargetAtTime(frequency,context.currentTime,.8);
  gain.gain.setTargetAtTime(document.hidden?0:volume*level,context.currentTime,.6);
 }
 function start(){
  if(unlocked){if(context?.state==='suspended'&&!document.hidden)context.resume().catch(()=>{});update();return;}
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  try{
   context=new Audio();const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate);
   const samples=buffer.getChannelData(0);let previous=0;
   for(let i=0;i<samples.length;i++){previous=(previous+Math.random()*.04-.02)/1.02;samples[i]=previous*3;}
   source=context.createBufferSource();source.buffer=buffer;source.loop=true;
   filter=context.createBiquadFilter();filter.type='lowpass';gain=context.createGain();gain.gain.value=0;
   source.connect(filter).connect(gain).connect(context.destination);source.start();unlocked=true;context.resume().catch(()=>{});update();
  }catch(_){context=null;}
 }
 document.addEventListener('pointerdown',start,{passive:true});
 document.addEventListener('keydown',start);
 document.getElementById('set-music')?.addEventListener('input',()=>{start();update();});
 new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['data-environment']});
 document.addEventListener('visibilitychange',update);
})();
