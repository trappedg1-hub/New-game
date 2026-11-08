// Source-space polygons, updated with the same skinned transforms as each limb.
export const ZONES=[
  {id:'legLeft',label:'поднятая нога',priority:20,color:0xc68cda,polygons:[[389,368,511,355,520,458,493,534,487,602,350,630,359,552,394,480,378,416]]},
  {id:'legRight',label:'опорная нога',priority:21,color:0x8da4e4,polygons:[[539,385,643,386,649,466,631,555,634,671,622,794,607,903,535,903,543,790,550,688,537,573,528,460]]},
  {id:'hair',label:'волосы',priority:25,color:0xe0c790,polygons:[[388,105,438,86,452,130,435,187,414,245,383,310,349,320,350,265,374,211],[557,89,609,100,645,143,680,213,691,288,661,313,643,257,618,207,583,150]]},
  {id:'waist',label:'талия',priority:30,color:0xcaaedb,polygons:[[442,235,585,225,613,275,614,315,565,345,455,340,421,300]]},
  {id:'torso',label:'корпус',priority:35,color:0xd9a6ce,polygons:[[440,160,585,155,620,191,600,243,425,247,413,204]]},
  {id:'armLeft',label:'левая рука',priority:40,color:0x8abfc6,polygons:[[421,196,452,193,438,258,421,301,392,343,363,374,337,393,315,378,345,347,371,312,393,268,407,218]]},
  {id:'armRight',label:'правая рука',priority:41,color:0x81afb9,polygons:[[592,194,623,192,637,259,660,309,680,345,704,379,691,397,665,377,640,344,619,303,606,260]]},
  {id:'head',label:'голова',priority:50,color:0xd7bb8b,polygons:[[432,34,461,12,512,5,557,19,578,50,573,84,548,76,527,55,481,63,455,91,430,84]]},
  {id:'face',label:'лицо',priority:55,color:0xe8a8a4,polygons:[[461,66,486,59,532,52,553,68,555,104,542,128,519,147,491,139,469,120,457,97]]},
  {id:'handLeft',label:'левая кисть',priority:60,color:0x92d7b2,polygons:[[313,379,343,385,338,418,328,449,309,449,291,431,290,405]]},
  {id:'handRight',label:'правая кисть',priority:61,color:0x7abfa7,polygons:[[686,377,706,378,727,394,730,424,718,451,700,454,684,438,696,411]]},
  {id:'footNear',label:'ближняя стопа',priority:70,color:0xdca3ca,polygons:[[431,596,468,595,503,604,518,630,519,690,515,767,503,851,478,934,456,960,430,969,389,969,355,956,341,929,335,880,324,814,318,753,321,703,331,680,353,650,382,620,411,604]]},
  {id:'footFar',label:'опорная стопа',priority:69,color:0xa4b4ec,polygons:[[534,894,607,891,613,941,624,971,627,1009,621,1022,527,1022,522,1001,529,970]]},
];
export const ZONES_BY_ID=Object.fromEntries(ZONES.map(z=>[z.id,z]));
export function pointInPolygon(x,y,poly){let inside=false;for(let i=0,j=poly.length-2;i<poly.length;j=i,i+=2){const xi=poly[i],yi=poly[i+1],xj=poly[j],yj=poly[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
export function zoneAtSource(x,y){return [...ZONES].sort((a,b)=>b.priority-a.priority).find(z=>z.polygons.some(p=>pointInPolygon(x,y,p)))?.id??null;}
