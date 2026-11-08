// Gentle, newly authored idle fields for the approved night-step pose.
export const SOURCE_WIDTH=1024, SOURCE_HEIGHT=1024, LOOP_SECONDS=8;
const unit=x=>Math.max(0,Math.min(1,x));
export function smoothstep(a,b,value){const t=unit((value-a)/(b-a));return t*t*(3-2*t);}
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
export function motionWeights(x,y){
  const edge=smoothstep(0,65,x)*(1-smoothstep(959,1024,x))*smoothstep(0,15,y)*(1-smoothstep(1005,1024,y));
  const torso=edge*bell(x,510,150)*bell(y,234,75)*smoothstep(150,180,y)*(1-smoothstep(300,350,y));
  const hair=edge*(bell(x,399,47)+bell(x,632,47))*smoothstep(150,205,y)*(1-smoothstep(310,355,y));
  const head=edge*bell(x,510,94)*bell(y,92,66)*(1-smoothstep(160,195,y));
  const waist=edge*bell(x,510,140)*bell(y,300,95)*(1-smoothstep(410,450,y));
  return {x,y,torso,hair,head,waist};
}
export function motionPhases(time){
  const p=2*Math.PI*(Number.isFinite(time)?time:0)/LOOP_SECONDS;
  return {breath:Math.sin(2*p),hair:Math.sin(p-.5)+Math.sin(.5),balance:Math.sin(p)};
}
export function motionOffset(w,p,strength,reaction={head:0,hair:0,waist:0},out=[0,0]){
  const side=w.x<510?-1:1;
  out[0]=strength*((w.x-510)*.006*w.torso*p.breath+side*2.1*w.hair*p.hair+.8*w.waist*p.balance)
    + w.head*reaction.head + side*w.hair*reaction.hair + w.waist*reaction.waist;
  out[1]=strength*(-1.8*w.torso*p.breath+.4*w.hair*p.hair)+w.head*Math.abs(reaction.head)*.12;
  return out;
}
export function blinkEnvelope(t){
  if(t<0||t>=.34)return 0;
  if(t<.11)return smoothstep(0,.11,t);
  if(t<.15)return 1;
  return 1-smoothstep(.15,.34,t);
}
export function automaticBlink(time){
  const cycle=((time%24)+24)%24;
  return Math.max(...[3.2,9.4,16.4,16.85,21.8].map(start=>blinkEnvelope(cycle-start)));
}
