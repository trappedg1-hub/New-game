"""Register independently generated components. Never slice the original painting.
Raw AI candidates live outside Git; pass their directory as argv[1].
Green/checker backing is removed before registration. Canvas size is never trimmed.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json,sys,os
root=sys.argv[1] if len(sys.argv)>1 else '/home/user/layer-candidates'
names=['body_base','hair_back','hair_front','face','face_blink','cloth_loose']
for tier in [1,2]:
 out=f'assets/characters/tier{tier}';os.makedirs(out,exist_ok=True)
 target=Image.open(f'assets/characters/tier{tier}.png').size
 for n in names:
  p=f'{root}/tier{tier}/{n}.png'
  if not os.path.exists(p):continue
  im=Image.open(p).convert('RGBA');a=np.array(im);rgb=a[:,:,:3].astype(float)
  if tier==1:
   bg=(rgb.min(2)>(220 if n=='body_base' else 90))&((rgb.max(2)-rgb.min(2))<(20 if n=='body_base' else 22))
   a[bg,3]=0
   if n=='face_blink':a[340:,:,3]=0 # generator returned an extraneous second head; discard it
   if n=='hair_back':a[850:,:,3]=0 # remove background-only stray matte pixels
   im=Image.fromarray(a)
   if n in ['face','face_blink']:
    patch=im.crop(im.getbbox()).resize((225,295),Image.Resampling.LANCZOS)
    im=Image.new('RGBA',(576,1840));im.alpha_composite(patch,(231,25))
  else:
   bg=(rgb[:,:,1]>130)&(rgb[:,:,1]>rgb[:,:,0]*1.3)&(rgb[:,:,1]>rgb[:,:,2]*1.3)
   a[bg,3]=0
   # despill only green-dominant edge pixels
   edge=(a[:,:,3]>0)&(rgb[:,:,1]>rgb[:,:,0]+25)&(rgb[:,:,1]>rgb[:,:,2]+25)
   a[:,:,1][edge]=np.maximum(a[:,:,0],a[:,:,2])[edge]
   im=Image.fromarray(a)
  im.resize(target,Image.Resampling.LANCZOS).save(f'{out}/{n}.png',optimize=True)
# Freeze the open-face silhouette/jaw/mouth and replace only the generated eyelid region.
# This is compositing two independently generated faces, not a fake brightness blink.
p='assets/characters/tier1/'
opened=Image.open(p+'face.png');closed=Image.open(p+'face_blink.png')
mask=Image.new('L',opened.size);d=ImageDraw.Draw(mask);d.rounded_rectangle((243,72,334,145),radius=9,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(3))
Image.composite(closed,opened,mask).save(p+'face_blink.png',optimize=True)
# Cloth is supplied but NOT enabled for Stranger. Its generated waistband did not
# align to the sweater hem. Tier 1 intentionally has no flutter in the brief.
