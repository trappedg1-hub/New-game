import './style.css';
import approvedSource from '../../../Generated/Approved/HERO-01_outfit10_night_lingerie_step_pose.png';
import { createStage } from './rig.js';
import { automaticBlink, blinkEnvelope } from './animation/idle-controller.js';
import { ReactionController } from './reactions.js';

const $=s=>document.querySelector(s);
const c={host:$('#animated-view'),play:$('#play-toggle'),playLabel:$('#play-label'),playIcon:$('#play-icon'),
  playHint:$('#play-hint'),blink:$('#blink-button'),demo:$('#demo-button'),intensity:$('#intensity'),
  intensityValue:$('#intensity-value'),body:$('#view-body'),face:$('#view-face'),compare:$('#compare-toggle'),
  reference:$('#reference-section'),symbol:$('#compare-symbol'),status:$('#scene-status'),touch:$('#touch-status'),
  loading:$('#loading'),error:$('#error-message'),source:$('#source-image')};
const params=new URLSearchParams(location.search),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={playing:!reduced,idleTime:0,strength:1,view:'body',manualBlinkAt:null,blink:0,lastReaction:null,input:null,testMode:false};
const controller=new ReactionController();let stage,lastFrame=performance.now(),needsDraw=true,shownHint=true;
c.source.src=approvedSource;
function syncPlay(){
  c.play.setAttribute('aria-pressed',String(!state.playing));
  c.playLabel.textContent=state.playing?'Пауза':'Продолжить';c.playIcon.textContent=state.playing?'Ⅱ':'▶';
  c.status.textContent=state.playing?'В ДВИЖЕНИИ':'ПАУЗА';
  c.playHint.textContent=state.playing?'Дыхание и волосы движутся мягко.':'Автоматическое движение на паузе; касания работают.';
}
function setView(view){
  state.view=view;for(const [button,value] of [[c.body,'body'],[c.face,'face']]){
    button.classList.toggle('is-active',value===view);button.setAttribute('aria-pressed',String(value===view));
  }
  stage?.setView(view);needsDraw=true;
}
function trigger(zone,pointerType='unknown'){
  const now=performance.now()/1000,event=controller.trigger(zone,now);if(!event)return null;
  state.lastReaction=event;state.input=pointerType;c.touch.textContent=`${event.label} · реакция ${event.count}`;
  shownHint=false;needsDraw=true;return event;
}
function draw(now){
  const elapsed=Math.max(0,Math.min(.05,(now-lastFrame)/1000));lastFrame=now;
  if(!state.testMode&&!document.hidden){
    if(state.playing)state.idleTime+=elapsed;
    const response=controller.sample(now/1000);
    let blink=state.playing?automaticBlink(state.idleTime):0;
    if(state.manualBlinkAt!==null){const t=(now-state.manualBlinkAt)/1000;blink=blinkEnvelope(t);if(t>.4)state.manualBlinkAt=null;}
    state.blink=blink;
    if(state.playing||state.manualBlinkAt!==null||response.active||needsDraw){
      stage.render(state.idleTime,state.strength,blink,{contributions:response.contributions});needsDraw=false;
    }
    if(!shownHint&&!response.active){c.touch.textContent='Коснись ступни, руки или лица';shownHint=true;}
  }
  requestAnimationFrame(draw);
}
async function initialize(){
  try{
    stage=await createStage(c.host,approvedSource,import.meta.env.BASE_URL,{debug:params.get('debug')==='1',onTap:trigger});
    c.loading.hidden=true;for(const el of [c.play,c.blink,c.demo,c.intensity,...document.querySelectorAll('[data-zone]')])el.disabled=false;
    stage.render(0,state.strength,0);syncPlay();lastFrame=performance.now();requestAnimationFrame(draw);
    if(params.has('qa')||params.get('debug')==='1')window.__NIGHT_STEP_QA__={
      frame({time=0,strength=1,blink=0,contributions=[],jointPose=null}={}){
        state.testMode=true;stage.render(time,strength,blink,{contributions,jointPose});return stage.geometryStats();
      },
      geometryAt({time=0,strength=1,blink=0,contributions=[],jointPose=null}={}){
        state.testMode=true;stage.render(time,strength,blink,{contributions,jointPose,dryRun:true});return stage.geometryStats();
      },
      resume(){state.testMode=false;lastFrame=performance.now();needsDraw=true;},
      getState(){return {...state,reaction:controller.sample(performance.now()/1000),sourceHash:stage.metadata.source_sha256};},
      trigger:zone=>trigger(zone,'qa'),geometry:()=>stage.geometryStats(),angles:()=>stage.jointAngles(),
      limbPoint:(name,x,y)=>stage.limbPoint(name,x,y),bodyPose:()=>stage.bodyPose(),
      sourceToClient:(x,y)=>stage.sourceToClient(x,y),zoneAtClient:(x,y)=>stage.zoneAtClient(x,y),
      comparePixels:()=>stage.comparePixels(),compareSparsePixels:()=>stage.compareSparsePixels(),pendingPointers:()=>stage.hitboxes.pendingCount(),
    };
  }catch(error){console.error('Night-step preview failed:',error);c.loading.hidden=true;
    c.error.textContent='Не удалось запустить сцену. Проверь поддержку WebGL и обнови страницу.';
    c.error.hidden=false;c.status.textContent='ОШИБКА';}
}
c.play.addEventListener('click',()=>{state.playing=!state.playing;needsDraw=true;syncPlay();});
c.blink.addEventListener('click',()=>{state.manualBlinkAt=performance.now();needsDraw=true;});
c.demo.addEventListener('click',()=>trigger('footNear','button'));
for(const button of document.querySelectorAll('[data-zone]'))button.addEventListener('click',()=>trigger(button.dataset.zone,'button'));
c.intensity.addEventListener('input',event=>{state.strength=Number(event.target.value)/100;c.intensityValue.value=`${event.target.value}%`;needsDraw=true;});
c.body.addEventListener('click',()=>setView('body'));c.face.addEventListener('click',()=>setView('face'));
c.compare.addEventListener('click',()=>{const show=c.reference.hidden;c.reference.hidden=!show;c.compare.setAttribute('aria-expanded',String(show));c.symbol.textContent=show?'−':'+';});
c.host.addEventListener('keydown',event=>{const ids={1:'footNear',2:'legRight',3:'handLeft',4:'handRight',5:'face',6:'torso'};
  if(ids[event.key]){event.preventDefault();trigger(ids[event.key],'keyboard');}});
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();needsDraw=true;});
initialize();
