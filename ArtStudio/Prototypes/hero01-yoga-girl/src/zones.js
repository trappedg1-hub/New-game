// Source-space hit polygons follow the actual deformed V3-style skin meshes.
// Left/right here mean the left/right sides as seen by the viewer.
export const ZONES = [
  { id:'legLeft', label:'левая нога и стопа', priority:10, color:0x88c6df, polygons:[[400,1640,730,1660,730,1920,690,2050,590,2170,550,2260,530,2650,500,2710,340,2700,320,2600,350,2240,400,2080,460,1970]] },
  { id:'legRight', label:'правая нога и стопа', priority:11, color:0x6ba4dd, polygons:[[805,1640,1130,1640,1130,1940,1190,2080,1230,2240,1210,2650,1170,2710,1000,2700,975,2620,965,2260,930,2180,840,2060,800,1940]] },
  { id:'hair', label:'хвост', priority:20, color:0xf3c86b, polygons:[[405,100,585,85,620,220,620,400,600,650,610,850,545,1000,420,1030,305,915,300,700,310,490,350,270]] },
  { id:'waist', label:'талия', priority:30, color:0xdbc1ed, polygons:[[575,940,935,940,975,1095,950,1200,580,1200,540,1110]] },
  { id:'upperTorso', label:'спортивный топ', priority:40, color:0xcaa0df, polygons:[[650,570,860,560,890,630,940,750,950,930,890,1000,560,1000,550,830,585,700]] },
  { id:'armLeft', label:'левая рука', priority:50, color:0x92d6cb, polygons:[[425,990,555,980,555,1100,525,1220,480,1310,435,1380,410,1350,410,1150]] },
  { id:'armRight', label:'правая рука', priority:51, color:0x75cabc, polygons:[[985,780,1080,780,1105,1020,1128,1250,1140,1455,1080,1450,1055,1330,1010,1160,980,1000]] },
  { id:'shoulderLeft', label:'левое плечо', priority:60, color:0xf4b685, polygons:[[530,740,620,730,625,870,575,930,515,910]] },
  { id:'shoulderRight', label:'правое плечо', priority:61, color:0xf3a679, polygons:[[820,555,975,565,1050,615,1075,720,1050,825,930,825,860,760]] },
  { id:'head', label:'макушка', priority:70, color:0xb8c2fa, polygons:[[600,90,680,35,790,30,900,50,985,100,1020,190,980,220,900,175,800,170,720,200,640,210]] },
  { id:'face', label:'лицо', priority:80, color:0xf8aabd, polygons:[[765,245,875,235,930,235,990,250,1000,340,975,420,930,475,865,500,790,465,760,395,750,320]] },
  { id:'handLeft', label:'левая кисть', priority:90, color:0x9de9a3, polygons:[[395,1450,425,1475,420,1545,370,1590,290,1600,210,1570,215,1510,290,1470]] },
  { id:'handRight', label:'правая кисть', priority:91, color:0x83dd9b, polygons:[[1100,1450,1150,1450,1190,1485,1250,1500,1320,1530,1330,1580,1290,1600,1220,1585,1150,1560,1100,1550]] },
];
export const ZONES_BY_ID = Object.fromEntries(ZONES.map(zone => [zone.id, zone]));
export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const xi=polygon[i], yi=polygon[i+1], xj=polygon[j], yj=polygon[j+1];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export function zoneAtSource(x, y) {
  return [...ZONES].sort((a,b)=>b.priority-a.priority)
    .find(zone=>zone.polygons.some(poly=>pointInPolygon(x,y,poly)))?.id ?? null;
}
