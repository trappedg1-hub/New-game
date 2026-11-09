"""Register independently generated pool outfit layers; lock eye-only blink."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json
S=Path('assets/characters/candidates/keyed/pool');D=Path('assets/characters/costume_pool');D.mkdir(exist_ok=True)
size=(560,1892)
def source(n):
 im=Image.open(S/(n+'.png')).convert('RGBA');return im.crop(im.getbbox())
def place(im,box):
 out=Image.new('RGBA',size);out.alpha_composite(im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS),box[:2]);return out
body=Image.open(S/'body_base.png').convert('RGBA');a=np.array(body)
a[:295,:,3]=0;a[295:320,:238,3]=0;a[295:320,320:,3]=0;body=Image.fromarray(a)
op=source('face_open');cl=source('face_closed').resize(op.size,Image.Resampling.LANCZOS)
m=Image.new('L',op.size)
for box in [(43,275,232,365),(292,275,482,365)]:ImageDraw.Draw(m).rounded_rectangle(box,10,fill=255)
m=m.filter(ImageFilter.GaussianBlur(1));blink=Image.composite(cl,op,m);blink.putalpha(op.getchannel('A'))
faces=[place(im,(156,48,372,320)) for im in (op,blink)]
back=place(source('hair_back'),(103,24,449,555))
raw=source('hair_front')
# Remove generated bridge below bangs that protrudes into the facial opening.
e=Image.new('L',raw.size);ImageDraw.Draw(e).polygon([(100,260),(149,280),(192,300),(192,342),(131,344),(95,303)],fill=255)
e=e.filter(ImageFilter.GaussianBlur(1));a=np.array(raw);a[:,:,3]=(a[:,:,3]*(1-np.array(e)/255)).astype('uint8');raw=Image.fromarray(a)
front=place(raw,(112,20,412,436))
for name,im in zip(('body_base','hair_back','face_open','face_closed','hair_front'),(body,back,*faces,front)):im.save(D/(name+'.png'),optimize=True)
for label,face in zip(('open','closed'),faces):
 im=Image.new('RGBA',size)
 for layer in (back,body,face,front):im.alpha_composite(layer)
 im.save('/home/user/pool-'+label+'.png');im.crop((80,0,470,450)).save('/home/user/pool-head-'+label+'.png')
a,b=map(np.array,faces);yy,xx=np.where(np.any(a!=b,axis=2))
assert np.array_equal(a[:,:,3],b[:,:,3]);assert yy.max()<240
(D/'registration.json').write_text(json.dumps({'status':'candidate','canvas':size,'blinkChangeBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'identicalAlpha':True,'nonEyePixelsLocked':True},indent=2)+'\n')
