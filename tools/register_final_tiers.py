"""Register independently generated tier components, no slices from original art."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from pathlib import Path
SIZE=(420,1323);ROOT=Path('/home/user/layer-candidates')
def key(p):
 im=Image.open(p).convert('RGBA');a=np.array(im);r,g,b=[a[:,:,i].astype(float) for i in range(3)]
 bg=(g>100)&(g>r*1.35)&(g>b*1.35);a[bg,3]=0
 edge=(a[:,:,3]>0)&(g>r+25)&(g>b+25);a[:,:,1][edge]=np.maximum(a[:,:,0],a[:,:,2])[edge]
 return Image.fromarray(a).resize(SIZE,Image.Resampling.LANCZOS)
def place(im,box):
 x,y,r,b=box;patch=im.crop(im.getbbox()).resize((r-x,b-y),Image.Resampling.LANCZOS);out=Image.new('RGBA',SIZE);out.alpha_composite(patch,(x,y));return out
for t in [2,5]:
 out=Path(f'assets/characters/tier{t}');out.mkdir(exist_ok=True)
 if t==2:
  # Reprocess original four candidates, not already normalized outputs.
  parts={n:key(ROOT/f'tier2/{n}.png') for n in ['body_base','hair_back','hair_front','face','face_blink']}
  # Open-face generator returned a full dressed figure; isolate only its independently generated head.
  parts['face']=parts['face'].crop((145,35,298,218))
  parts['hair_front']=place(parts['hair_front'],(120,4,328,213))
  box=(154,25,296,213);eye=(160,98,289,151)
 else:
  parts={n:key(ROOT/f'tier5/{n}.png') for n in ['body_base','hair_back','hair_front','face','face_blink']}
  parts['hair_back']=place(parts['hair_back'],(60,8,295,510))
  box=(94,26,237,218);eye=(101,98,230,158)
 for n in ['face','face_blink']:parts[n]=place(parts[n],box)
 mask=Image.new('L',SIZE);ImageDraw.Draw(mask).rounded_rectangle(eye,8,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(3))
 parts['face_blink']=Image.composite(parts['face_blink'],parts['face'],mask)
 for n,im in parts.items():
  im.putalpha(im.getchannel('A').filter(ImageFilter.MinFilter(3)));im.save(out/f'{n}.png',optimize=True)
 comp=Image.new('RGBA',SIZE)
 for n in ['hair_back','body_base','face','hair_front']:comp.alpha_composite(parts[n])
 comp.save(f'/home/user/final-tier{t}.png')
out=Path('assets/characters/costume_gown');out.mkdir(exist_ok=True)
for n in ['body_base','hair_back','hair_front']:key(ROOT/f'gown/{n}.png').save(out/f'{n}.png',optimize=True)
