"""Key and register independent AI components; never extract parts from whole art."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from pathlib import Path
ROOT=Path('/home/user/layer-candidates')
SIZE=(420,1323)
def keyed(path):
 a=np.array(Image.open(path).convert('RGBA'));r,g,b=[a[:,:,i].astype(float) for i in range(3)]
 green=(g>100)&(g>r*1.35)&(g>b*1.35);a[green,3]=0
 edge=(a[:,:,3]>0)&(g>r+25)&(g>b+25);a[:,:,1][edge]=np.maximum(a[:,:,0],a[:,:,2])[edge]
 return Image.fromarray(a)
for t in (3,4):
 out=Path(f'assets/characters/tier{t}');out.mkdir(exist_ok=True)
 parts={n:keyed(ROOT/f'tier{t}/{n}.png').resize(SIZE,Image.Resampling.LANCZOS) for n in ('body_base','hair_back','hair_front','face','face_blink')}
 # Faces were generated at different scales. Register each to the blank head.
 boxes={3:(102,27,255,220),4:(142,19,258,298)}
 for n in ('face','face_blink'):
  im=parts[n];bb=im.getbbox()
  # Open tier3 face includes a neck; use head only. Tier4 closed face includes neck too.
  if (t==3 and n=='face') or (t==4 and n=='face_blink'):
   bb=(bb[0],bb[1],bb[2],int(bb[1]+(bb[3]-bb[1])*.82))
  x,y,r,b=boxes[t];patch=im.crop(bb).resize((r-x,b-y),Image.Resampling.LANCZOS)
  parts[n]=Image.new('RGBA',SIZE);parts[n].alpha_composite(patch,(x,y))
 # Preserve the open face outline/mouth throughout blink, substitute generated eyelids only.
 mask=Image.new('L',SIZE);d=ImageDraw.Draw(mask)
 eye={3:(112,101,241,158),4:(151,116,250,192)}[t]
 d.rounded_rectangle(eye,8,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(3))
 parts['face_blink']=Image.composite(parts['face_blink'],parts['face'],mask)
 # Letterbox kneeling art rather than stretching its anatomy into a standing silhouette.
 if t==4:
  for n,im in list(parts.items()):
   fitted=Image.new('RGBA',SIZE)
   fitted.alpha_composite(im.resize((420,706),Image.Resampling.LANCZOS),(0,617))
   parts[n]=fitted
 for n,im in parts.items():
  im.putalpha(im.getchannel('A').filter(ImageFilter.MinFilter(3)))
  im.save(out/f'{n}.png',optimize=True)
 comp=Image.new('RGBA',SIZE)
 for n in ('hair_back','body_base','face','hair_front'):comp.alpha_composite(parts[n])
 comp.save(f'/home/user/tier{t}-registered.png')
