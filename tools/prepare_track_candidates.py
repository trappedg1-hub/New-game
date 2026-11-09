"""Recover alpha from baked neutral backgrounds; preserve source candidates.
Body uses edge-connected neutral flood fill, not global white removal (shoes).
"""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
S=Path('assets/characters/candidates/track');D=Path('assets/characters/candidates/keyed/track');D.mkdir(exist_ok=True)
for p in sorted(S.glob('*.png')):
 im=Image.open(p).convert('RGBA');a=np.array(im);rgb=a[:,:,:3].astype(int)
 neutral=(rgb.max(2)-rgb.min(2)<23)&(rgb.min(2)>140)
 if p.stem in ('body_base','face_open','face_closed'):
  # Connected exterior removal keeps white sock/shoe interiors behind outlines.
  mask=Image.fromarray(np.where(neutral,255,0).astype('uint8')).convert('RGB')
  ImageDraw.floodfill(mask,(0,0),(255,0,0),thresh=0)
  arr=np.array(mask);erase=(arr[:,:,0]==255)&(arr[:,:,1]==0)
 else:erase=neutral
 a[:,:,3]=np.where(erase,0,255)
 out=Image.fromarray(a);out.save(D/p.name);print(p.name,out.size,out.getbbox())
