import './style.css';
import approvedSource from '../../../Generated/Approved/HERO-01_outfit05_yoga_girl.png';
import { createStage } from './rig.js';
import { automaticBlink, blinkEnvelope } from './animation/idle-controller.js';
import { ReactionClock, ReactionController, STATES } from './reactions.js';

const $=selector=>document.querySelector(selector);
const controls={play:$('#play-toggle'),playLabel:$('#play-label'),playStatus:$('#play-status'),
  blink:$('#blink-button'),body:$('#view-body'),face:$('#view-face'),solo:$('#layout-solo'),compare:$('#layout-compare'),
  touchStatus:$('#touch-status'),intensity:$('#intensity'),intensityValue:$('#intensity-value'),
  status:$('#connection-status'),loading:$('#loading'),error:$('#error-message')};
const params=new URLSearchParams(location.search), debug=params.get('debug')==='1';
const state={playing:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,time:0,reactionTime:0,
  strength:1,manualBlinkStart:null,currentBlink:0,view:'body',layout:'solo',testMode:false,lastReaction:null,input:null};
const reactions=new ReactionController();
let stage,previousTime=performance.now(),needsRedraw=true,shownIdleHint=true;
const reactionClock=new ReactionClock(previousTime);
function syncPlayback(){
  controls.play.classList.toggle('is-paused',!state.playing);
  controls.play.setAttribute('aria-label',state.playing?'Пауза':'Продолжить анимацию');
  controls.play.setAttribute('aria-pressed',String(!state.playing));
  controls.playLabel.textContent=state.playing?'Пауза':'Продолжить';
  controls.playStatus.textContent=state.playing?'Анимация включена':'Анимация на паузе';
  controls.status.textContent=state.playing?'ИДЁТ ПРОСМОТР':'ПАУЗА';
}
function setView(view){
  state.view=view;needsRedraw=true;document.querySelector('.viewport-pair').classList.toggle('is-face',view==='face');
  for(const [button,value] of [[controls.body,'body'],[controls.face,'face']]){
    button.classList.toggle('is-active',view===value);button.setAttribute('aria-pressed',String(view===value));
  }
  stage?.setView(view);
}
function setLayout(layout){
  state.layout=layout;document.querySelector('.viewport-pair').classList.toggle('is-solo',layout==='solo');
  for(const [button,value] of [[controls.solo,'solo'],[controls.compare,'compare']]){
    button.classList.toggle('is-active',layout===value);button.setAttribute('aria-pressed',String(layout===value));
  }
  stage?.setView(state.view);needsRedraw=true;
}
function touch(zone,pointerType='unknown'){
  if(!state.testMode&&!document.hidden)state.reactionTime=reactionClock.advance(performance.now());
  const event=reactions.trigger(zone,state.reactionTime);if(!event)return null;
  state.lastReaction=event;state.input=pointerType;controls.touchStatus.textContent=`${event.label} · реакция ${event.count}`;
  shownIdleHint=false;needsRedraw=true;return event;
}
function draw(now){
  const elapsed=Math.max(0,(now-previousTime)/1000),delta=Math.min(0.05,elapsed);previousTime=now;
  if(!state.testMode&&!document.hidden){
    if(state.playing)state.time+=delta;
    state.reactionTime=reactionClock.advance(now);
    const reaction=reactions.sample(state.reactionTime);
    let blink=automaticBlink(state.time);const manualActive=state.manualBlinkStart!==null;
    if(manualActive){const blinkTime=(now-state.manualBlinkStart)/1000;blink=blinkEnvelope(blinkTime);if(blinkTime>0.42)state.manualBlinkStart=null;}
    state.currentBlink=blink;
    const active=reaction.state!==STATES.IDLE||reaction.contributions.length>0;
    if(state.playing||manualActive||needsRedraw||active){stage.render(state.time,state.strength,blink,{contributions:reaction.contributions});needsRedraw=false;}
    if(!shownIdleHint&&!active){controls.touchStatus.textContent='Коснитесь волос, рук или ног';shownIdleHint=true;}
  }
  requestAnimationFrame(draw);
}
async function initialize(){
  try{
    stage=await createStage($('#original-view'),$('#animated-view'),approvedSource,import.meta.env.BASE_URL,{debug,onTap:touch});
    stage.setView(state.view);controls.loading.hidden=true;controls.play.disabled=false;controls.blink.disabled=false;
    controls.intensity.disabled=false;syncPlayback();previousTime=performance.now();reactionClock.reset(previousTime);
    requestAnimationFrame(draw);
    if(params.has('qa')||debug){
      window.__YOGA_QA__={
        frame({time=0,blink=0,strength=1,contributions=[],jointPose=null}={}){
          state.testMode=true;reactionClock.reset(performance.now());stage.render(time,strength,blink,{contributions,jointPose});return stage.geometryStats();
        },
        geometryAt({time=0,blink=0,strength=1,contributions=[],jointPose=null}={}){
          state.testMode=true;reactionClock.reset(performance.now());stage.render(time,strength,blink,{contributions,jointPose,dryRun:true});return stage.geometryStats();
        },
        resume(){state.testMode=false;needsRedraw=true;previousTime=performance.now();reactionClock.reset(previousTime);},
        getState(){return {...state,reaction:reactions.sample(state.reactionTime),sourceHash:stage.metadata.source_sha256};},
        geometry:()=>stage.geometryStats(),joints:()=>stage.jointAngles(),pose:()=>stage.pose(),
        limbPoint:(name,x,y)=>stage.limbPoint(name,x,y),deformedSourcePoint:(x,y)=>stage.deformedSourcePoint(x,y),
        comparePixels:()=>stage.comparePixels(),compareFrames:(a,b)=>{state.testMode=true;return stage.compareFrames(a,b);},
        compareCulling:frame=>{state.testMode=true;return stage.compareCulling(frame);},
        sourceToClient:(x,y)=>stage.sourceToClient(x,y),zoneAtClient:(x,y)=>stage.zoneAtClient(x,y),
        pendingPointers:()=>stage.hitboxes.pendingCount(),trigger:zone=>touch(zone,'qa'),
      };
    }
  }catch(error){console.error('YOGA GIRL preview failed to initialize:',error);controls.loading.hidden=true;
    controls.error.textContent='Не удалось запустить сцену. Проверьте поддержку WebGL и перезагрузите страницу.';
    controls.error.hidden=false;controls.status.textContent='ОШИБКА ЗАГРУЗКИ';}
}
controls.play.addEventListener('click',()=>{state.playing=!state.playing;needsRedraw=true;syncPlayback();});
controls.blink.addEventListener('click',()=>{state.manualBlinkStart=performance.now();needsRedraw=true;});
controls.body.addEventListener('click',()=>setView('body'));controls.face.addEventListener('click',()=>setView('face'));
controls.solo.addEventListener('click',()=>setLayout('solo'));controls.compare.addEventListener('click',()=>setLayout('compare'));
controls.intensity.addEventListener('input',event=>{state.strength=Number(event.target.value)/100;needsRedraw=true;controls.intensityValue.value=`${event.target.value}%`;});
$('#animated-view').addEventListener('keydown',event=>{const zones={1:'head',2:'hair',3:'face',4:'shoulderRight',5:'armRight',6:'handRight',7:'upperTorso',8:'waist',9:'legLeft'};
  if(zones[event.key]){event.preventDefault();touch(zones[event.key],'keyboard');}});
document.addEventListener('visibilitychange',()=>{previousTime=performance.now();reactionClock.reset(previousTime);});
initialize();
