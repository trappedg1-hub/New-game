"""One deterministic canvas transform per rig; no independent part fitting.
Generated replacement bodies are registered once before the common transform.
Runtime parts all use exactly 420x1323 RGBA. Viewports preserve aspect/scale.
"""
from pathlib import Path
from io import BytesIO
import json,subprocess
from PIL import Image, ImageFilter
import numpy as np
BASE='3c30f98'
def historical(path):return subprocess.check_output(['git','show',f'{BASE}:{path}'])
m=json.loads(historical('assets/characters/animation-manifest.json'))
for key,c in m['costumes'].items():
 w,h=c['canvas'];scale=min(420/w,1323/h);nw,nh=round(w*scale),round(h*scale);ox,oy=(420-nw)//2,1323-nh
 parts={k:Image.open(BytesIO(historical(p))).convert('RGBA') for k,p in c['layers'].items()}
 if key in ('bunny','maid'):
  src=Image.open(f'tools/animation-reference/style-refresh/{key}-body.png').convert('RGBA')
  if key=='bunny':s=1544/1417;dx=-35;dy=480-round(415*s)
  else:s=1480/1495;dx=12;dy=280-round(345*s)
  replacement=Image.new('RGBA',(w,h));replacement.alpha_composite(src.resize((round(src.width*s),round(src.height*s)),Image.Resampling.LANCZOS),(dx,dy));parts['body_base']=replacement
 for name,im in parts.items():
  out=Image.new('RGBA',(420,1323));out.alpha_composite(im.resize((nw,nh),Image.Resampling.LANCZOS),(ox,oy));# Despill only antialiased silhouette edges, not interior costume colors.
  pix=np.array(out);rgb=pix[:,:,:3].astype(int)
  edge=(np.array(out.getchannel('A').filter(ImageFilter.MinFilter(5)))<255)&(pix[:,:,3]>0)
  green=edge&(rgb[:,:,1]>rgb[:,:,0]+4)&(rgb[:,:,1]>rgb[:,:,2]+4)
  pix[:,:,1][green]=np.maximum(pix[:,:,0],pix[:,:,2])[green]
  Image.fromarray(pix).save(c['layers'][name],optimize=True)
 c['canvas']=[420,1323];c['viewport']=[ox,oy,nw,nh];c['ground']['size']=[nw,nh]
 # Use actual opaque footprint, not an empty source-canvas margin.
 alpha=np.array(Image.open(c['layers']['body_base']))[:,:,3];ys,xs=np.where(alpha>32)
 c['ground']['floor']=float((ys.max()+1-oy)/nh)
 band=alpha[max(0,ys.max()-max(3,round(nh*.008))):ys.max()+1]>32
 occupied=np.where(band.any(axis=0))[0];runs=[]
 for x in occupied:
  if not runs or x-runs[-1][-1]>5:runs.append([])
  runs[-1].append(int(x))
 c['ground']['contacts']=[{'x':round(((run[0]+run[-1])/2-ox)/nw,5),'width':round(max(.04,min(.22,(run[-1]-run[0]+1)/nw)),5)} for run in runs]

 face=Image.open(c['layers']['face_open']);x,y,r,b=face.getbbox();c['hairPivot']=[(x+r)/2,y]
 a=np.array(face);b=np.array(Image.open(c['layers']['face_closed']));yy,xx=np.where(np.any(a!=b,axis=2))
 report=json.loads(Path(c['contentAudit']['report']).read_text());report.update(canvas=[420,1323],blinkChangeBounds=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],canonicalTransform={'sourceCanvas':[w,h],'viewport':[ox,oy,nw,nh],'uniformFit':True},styleRefresh=key in ('bunny','maid'))
 Path(c['contentAudit']['report']).write_text(json.dumps(report,indent=2)+'\n')
for c in m['tiers'].values():
 x,y,r,b=Image.open(c['layers']['face_open']).getbbox();c['hairPivot']=[(x+r)/2,y]
m['version']=18;m['renderer']='canonical-420x1323-registered-png'
Path('assets/characters/animation-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print('12 rigs: canonical RGBA420x1323; same per-rig transform, aspect preserved by viewport')
