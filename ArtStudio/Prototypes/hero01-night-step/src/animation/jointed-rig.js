// Original night-step choreography, using the same general FK/weighted-skin
// technique as V3. Coordinates belong to the approved 1024×1024 source.
import { clamp } from './controller-utils.js';
const pt=(x,y)=>Object.freeze({x,y});
export const LIMBS=Object.freeze({
  armLeft: {root:pt(430,205),middle:pt(385,320),end:pt(329,397),names:['shoulder','elbow','wrist'],limits:[.15,.20,.23]},
  armRight:{root:pt(610,204),middle:pt(657,324),end:pt(702,395),names:['shoulder','elbow','wrist'],limits:[.15,.20,.23]},
  legLeft: {root:pt(450,400),middle:pt(466,482),end:pt(422,651),names:['hip','knee','ankle'],limits:[.12,.19,.20]},
  legRight:{root:pt(588,405),middle:pt(585,590),end:pt(576,915),names:['hip','knee','ankle'],limits:[.065,.095,.065]},
});
const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,v)=>{const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);};
export function limbWeights(name,x,y){
  let root,middle,end;
  if(name==='armLeft'||name==='armRight'){
    root=smooth(202,255,y);middle=smooth(296,342,y);end=smooth(380,419,y);
  }else if(name==='legLeft'){
    root=smooth(405,452,y);middle=smooth(460,510,y);end=smooth(615,680,y);
  }else if(name==='legRight'){
    root=smooth(395,445,y);middle=smooth(560,620,y);end=smooth(870,925,y);
    // Preserve the planted toe at the original floor edge; the knee still moves.
    root*=1-smooth(965,1018,y);
  }else throw new Error(`Unknown limb ${name}`);
  return {root,middle,end:Math.min(middle,end)};
}
function rotationAt(p,angle){
  const a=Math.cos(angle),b=Math.sin(angle),c=-b,d=a;
  return {a,b,c,d,tx:p.x-a*p.x-c*p.y,ty:p.y-b*p.x-d*p.y};
}
function multiply(p,q){return {a:p.a*q.a+p.c*q.b,b:p.b*q.a+p.d*q.b,c:p.a*q.c+p.c*q.d,d:p.b*q.c+p.d*q.d,
  tx:p.a*q.tx+p.c*q.ty+p.tx,ty:p.b*q.tx+p.d*q.ty+p.ty};}
export function jointMatrices(name,angles){
  const d=LIMBS[name];if(!d)throw new Error(`Unknown limb ${name}`);
  const root=rotationAt(d.root,angles[d.names[0]]||0);
  const middle=multiply(root,rotationAt(d.middle,angles[d.names[1]]||0));
  const end=multiply(middle,rotationAt(d.end,angles[d.names[2]]||0));return [root,middle,end];
}
export function skinPoint(x,y,weights,matrices,result={x:0,y:0}){
  const [a,b,c]=matrices;
  const ax=a.a*x+a.c*y+a.tx,ay=a.b*x+a.d*y+a.ty;
  const bx=b.a*x+b.c*y+b.tx,by=b.b*x+b.d*y+b.ty;
  const cx=c.a*x+c.c*y+c.tx,cy=c.b*x+c.d*y+c.ty;
  result.x=x+weights.root*(ax+weights.middle*(bx-ax)+weights.end*(cx-bx)-x);
  result.y=y+weights.root*(ay+weights.middle*(by-ay)+weights.end*(cy-by)-y);
  return result;
}
// A lifted sole has its own response; a planted foot retains a floor anchor.
// Values are radians at 100% strength, independently authored for this pose.
const PROFILES=Object.freeze({
  head:{armLeft:[.022,.030,-.020],armRight:[-.022,-.030,.020]},
  hair:{armLeft:[.030,.045,-.030],armRight:[-.030,-.045,.030]},
  face:{armLeft:[.020,.032,-.025],armRight:[-.020,-.032,.025]},
  armLeft:{armLeft:[.085,.115,-.085]},
  handLeft:{armLeft:[.100,.130,-.100],armRight:[-.010,-.015,.010]},
  armRight:{armRight:[-.085,-.115,.085]},
  handRight:{armRight:[-.100,-.130,.100],armLeft:[.010,.015,-.010]},
  torso:{armLeft:[.045,.060,-.040],armRight:[-.045,-.060,.040],legLeft:[.025,-.040,.045]},
  waist:{legLeft:[.060,-.085,.100],legRight:[-.035,.055,-.035],armLeft:[.030,.045,-.030]},
  legLeft:{legLeft:[.080,-.050,.090],armRight:[-.020,-.030,.020]},
  footNear:{legLeft:[.100,-.040,.110],armLeft:[.030,.045,-.030],armRight:[-.030,-.045,.030]},
  legRight:{legRight:[-.063,.095,-.055],legLeft:[.035,-.055,.050]},
  footFar:{legRight:[-.058,.090,-.050],legLeft:[.045,-.070,.070],armRight:[-.020,-.030,.020]},
});
export const LOOP_SECONDS=8;
function idle(time){
  const p=2*Math.PI*time/LOOP_SECONDS,s=Math.sin(p),b=Math.sin(2*p);
  return {armLeft:[-.003*s,.004*b,-.003*s],armRight:[.003*s,-.004*b,.003*s],
    legLeft:[.002*s,-.003*s,.006*(Math.sin(p-.3)+Math.sin(.3))],
    legRight:[-.002*s,.003*s,-.002*s]};
}
// Alternate magnitude rather than swinging into the unrecoverable occluded hair.
const dirs=[1,.74,1.08];
export function composeJoints(time=0,strength=1,contributions=[],override=null){
  const level=Number.isFinite(strength)?Math.max(0,Math.min(1.35,strength)):0;
  const values=idle(Number.isFinite(time)?time:0);
  for(const name of Object.keys(values))values[name]=values[name].map(n=>n*level);
  for(const c of contributions){
    const profile=PROFILES[c.zone];if(!profile)continue;
    const direction=dirs[((c.variant||0)%dirs.length+dirs.length)%dirs.length];
    const channels=[c.amount,c.followAmount??c.amount,c.lateAmount??c.followAmount??c.amount]
      .map(n=>Math.max(-1,Math.min(1,Number.isFinite(n)?n:0))*direction*level);
    for(const [name,p] of Object.entries(profile))for(let i=0;i<3;i++)values[name][i]+=p[i]*channels[i];
  }
  const result={};
  for(const [name,d] of Object.entries(LIMBS)){
    result[name]={};for(let i=0;i<3;i++){
      const key=d.names[i],value=override===null?values[name][i]:(override[name]?.[key]??0);
      result[name][key]=clamp(Number.isFinite(value)?value:0,d.limits[i])||0;
    }
  }
  return result;
}
