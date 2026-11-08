import { ZONES_BY_ID } from './zones.js';

const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp01(n);return t*t*(3-2*t);};
export const ATTACK_SECONDS=.14;
export const REACTION_SECONDS=2.0;
export const COOLDOWN_SECONDS=.08;
const RETIRE_SECONDS=.20;

// Quick response, a held expressive gesture, then a long, smooth return.
// Each limb follows with a small delay; no timers or queued stale actions.
export function reactionEnvelope(t){
  if(!Number.isFinite(t)||t<0||t>=REACTION_SECONDS)return 0;
  if(t<ATTACK_SECONDS)return smooth(t/ATTACK_SECONDS);
  if(t<.43)return 1;
  const rest=(t-.43)/(REACTION_SECONDS-.43);
  return (1-smooth(rest))*(1+.08*Math.sin(rest*Math.PI*2));
}

export class ReactionController {
  constructor(){this.active=null;this.retiring=[];this.lastAt=-Infinity;this.count=0;this.counts={};}
  trigger(zone,now){
    if(!ZONES_BY_ID[zone]||!Number.isFinite(now)||now<this.lastAt||now-this.lastAt<COOLDOWN_SECONDS)return null;
    const previous=this.sample(now).contributions;
    this.retiring=previous.slice(-2).map(c=>({...c,retiredAt:now}));
    const variant=this.counts[zone]||0;this.counts[zone]=variant+1;
    this.active={zone,started:now,variant:variant%3};this.lastAt=now;this.count++;
    return {zone,variant:variant%3,count:this.count,label:ZONES_BY_ID[zone].label};
  }
  sample(now){
    if(!Number.isFinite(now))return {active:false,contributions:[],count:this.count};
    this.retiring=this.retiring.filter(c=>now-c.retiredAt<RETIRE_SECONDS);
    const contributions=this.retiring.map(c=>{
      const fade=1-smooth((now-c.retiredAt)/RETIRE_SECONDS);
      return {...c,amount:c.amount*fade,followAmount:c.followAmount*fade,lateAmount:c.lateAmount*fade};
    });
    if(this.active){
      const t=Math.max(0,now-this.active.started);
      if(t>=REACTION_SECONDS+.18)this.active=null;
      else {
        const {zone,variant}=this.active;
        contributions.push({zone,variant,amount:reactionEnvelope(t),followAmount:reactionEnvelope(t-.065),
          lateAmount:reactionEnvelope(t-.13)});
      }
    }
    return {active:!!this.active||this.retiring.length>0,contributions,count:this.count};
  }
}

const BODY={
  head:{head:-2.8,hair:2.5,waist:0},hair:{head:1.5,hair:4,waist:0},face:{head:-2,hair:1.5,waist:0},
  armLeft:{head:1,hair:1,waist:-1},handLeft:{head:1.5,hair:1,waist:-1},
  armRight:{head:-1,hair:1,waist:1},handRight:{head:-1.5,hair:1,waist:1},
  torso:{head:-2,hair:2,waist:-2.2},waist:{head:1,hair:2,waist:3},
  legLeft:{head:1.3,hair:2,waist:2},footNear:{head:-1.5,hair:2.5,waist:-2.8},
  legRight:{head:-1,hair:1,waist:-2},footFar:{head:1,hair:1,waist:2},
};
export function composeBodyReaction(contributions=[],strength=1){
  const out={head:0,hair:0,waist:0},level=Number.isFinite(strength)?Math.max(0,Math.min(1.35,strength)):0;
  const variants=[1,.74,1.08];
  for(const c of contributions){const p=BODY[c.zone];if(!p)continue;
    const sign=variants[((c.variant||0)%3+3)%3];
    for(const key of Object.keys(out)){
      const amount=key==='hair'?(c.lateAmount??c.amount):(c.amount??0);
      out[key]+=p[key]*Math.max(-1,Math.min(1,Number.isFinite(amount)?amount:0))*level*sign;
    }
  }
  for(const key of Object.keys(out))out[key]=Math.max(-6,Math.min(6,out[key]));
  return out;
}
