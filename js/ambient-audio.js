/* Synthesized ambience; first nonzero playback requires an interaction.
   No autoplay, external recordings, network audio or save mutations. */
(() => {
 'use strict';
 const profiles={classroom:[620,.012],cafe:[420,.018],pool:[1500,.020],bedroom:[230,.010],beach:[900,.025]};
 let context,source,filter,gain;
 function volume(){
  const value=Number(document.getElementById('set-music')?.value??0);
  return Number.isFinite(value)?Math.max(0,Math.min(100,value))/100:0;
 }
 function update(){
  if(!context||context.state==='closed')return;
  const now=context.currentTime;
  const [frequency,level]=profiles[document.body.dataset.environment]||profiles.classroom;
  filter.frequency.setTargetAtTime(frequency,now,.8);
  gain.gain.cancelScheduledValues(now);
  if(document.hidden||volume()===0){
   // Do not leave the old scene audible during an exponential fade in a
   // background tab. Suspend the processor too, not just its output gain.
   gain.gain.setValueAtTime(0,now);
   if(context.state==='running')context.suspend().catch(()=>{});
   return;
  }
  if(context.state==='suspended')context.resume().catch(()=>{});
  gain.gain.setTargetAtTime(volume()*level,now,.6);
 }
 function start(){
  if(context){update();return;}
  if(document.hidden||volume()===0)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  try{
   context=new Audio();const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate);
   const samples=buffer.getChannelData(0);let previous=0;
   for(let i=0;i<samples.length;i++){previous=(previous+Math.random()*.04-.02)/1.02;samples[i]=previous*3;}
   source=context.createBufferSource();source.buffer=buffer;source.loop=true;
   filter=context.createBiquadFilter();filter.type='lowpass';gain=context.createGain();gain.gain.value=0;
   source.connect(filter).connect(gain).connect(context.destination);source.start();
   context.addEventListener('statechange',update);
   context.resume().catch(()=>{});update();
  }catch(_){
   try{source?.stop();context?.close()?.catch(()=>{});}catch(_){}
   context=source=filter=gain=null;
  }
 }
 document.addEventListener('pointerdown',start,{passive:true});
 document.addEventListener('keydown',start);
 document.getElementById('set-music')?.addEventListener('input',()=>{start();update();});
 new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['data-environment']});
 // Visibility may resume an existing, user-unlocked context; never creates one.
 document.addEventListener('visibilitychange',update);
 /* ASMR-lite: a soft binaural sigh on crit taps / heart-eyes trance.
    Reuses the ambience context; creates nothing at zero volume, while
    hidden, or before the first user-unlocked context exists. */
 let sighSide=1,lastSigh=0;
 window.AmbientAudio={sigh(){
  if(!context||context.state!=='running'||document.hidden||volume()===0)return;
  const now=performance.now();if(now-lastSigh<900)return;lastSigh=now;
  try{
   const dur=.8,len=Math.floor(context.sampleRate*dur);
   const buffer=context.createBuffer(1,len,context.sampleRate);
   const d=buffer.getChannelData(0);let lp=0;
   for(let i=0;i<len;i++){const w=Math.random()*2-1;lp+=(w-lp)*.18;d[i]=lp*1.4;}
   const src=context.createBufferSource();src.buffer=buffer;
   const bp=context.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.1;
   const t=context.currentTime;
   bp.frequency.setValueAtTime(480,t);
   bp.frequency.exponentialRampToValueAtTime(1050,t+dur*.55);
   bp.frequency.exponentialRampToValueAtTime(520,t+dur);
   const g=context.createGain();
   g.gain.setValueAtTime(0,t);
   g.gain.exponentialRampToValueAtTime(Math.max(.001,volume()*.14),t+.18);
   g.gain.exponentialRampToValueAtTime(.0008,t+dur);
   src.connect(bp);bp.connect(g);
   if(context.createStereoPanner){const pan=context.createStereoPanner();pan.pan.value=.65*sighSide;sighSide*=-1;g.connect(pan);pan.connect(context.destination);}
   else g.connect(context.destination);
   src.start();src.stop(t+dur+.05);
  }catch(_){}
 }};
})();
